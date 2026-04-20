import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

export default function StlViewer({ versionId }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!versionId || !mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 700;
    const H = 520;

    if (rendererRef.current) { rendererRef.current.dispose(); container.innerHTML = ''; }

    setLoading(true);

    const token = localStorage.getItem('cad_token');
    fetch(`/api/stl/${versionId}/file`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.arrayBuffer())
      .then(buffer => {
        setLoading(false);

        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();
        geometry.center();

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#111318');

        const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Material — warm off-white like the design
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color('#d4cfc4'),
          specular: new THREE.Color('#666'),
          shininess: 50,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        scene.add(mesh);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(200, 400, 200);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xc8d8ff, 0.4);
        fill.position.set(-200, 100, -200);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xfff0d0, 0.25);
        rim.position.set(0, -300, 100);
        scene.add(rim);

        // Fit camera to model
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 0.9, center.z + maxDim * 1.2);
        camera.lookAt(center);

        // Grid
        const grid = new THREE.GridHelper(maxDim * 2, 30, '#1e2030', '#1a1d24');
        grid.position.set(center.x, bbox.min.y - 0.5, center.z);
        scene.add(grid);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.minDistance = maxDim * 0.1;
        controls.maxDistance = maxDim * 10;
        controls.update();

        let animId;
        const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
        animate();

        const onResize = () => {
          const w = container.clientWidth;
          camera.aspect = w / H;
          camera.updateProjectionMatrix();
          renderer.setSize(w, H);
        };
        window.addEventListener('resize', onResize);

        const triCount = geometry.index
          ? geometry.index.count / 3
          : geometry.attributes.position.count / 3;
        setInfo(`${Math.round(triCount).toLocaleString()} triangles · ${(size.x).toFixed(1)} × ${(size.y).toFixed(1)} × ${(size.z).toFixed(1)} mm · drag to rotate`);

        return () => {
          cancelAnimationFrame(animId);
          window.removeEventListener('resize', onResize);
          controls.dispose();
          renderer.dispose();
          container.innerHTML = '';
        };
      })
      .catch(() => { setLoading(false); setInfo('Failed to load STL file'); });
  }, [versionId]);

  return (
    <div>
      {loading && (
        <div style={{ height: 520, background: '#111318', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading STL...
        </div>
      )}
      <div ref={mountRef} style={{ width: '100%', height: loading ? 0 : 520, borderRadius: 8, overflow: 'hidden', background: '#111318', cursor: 'grab' }} />
      {info && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{info}</p>}
    </div>
  );
}
