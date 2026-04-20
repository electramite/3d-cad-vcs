const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const GCodeVersion = require('../models/GCodeVersion');
const { protect } = require('../middleware/auth');

// Extract gcode and mesh from a Bambu Lab .3mf ZIP archive
function extractFrom3mf(zipPath, destDir) {
  const result = { gcodePath: null, meshPath: null };
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Extract gcode
    const gcodeEntry =
      entries.find(e => e.entryName.match(/Metadata\/plate_\d+\.gcode$/i)) ||
      entries.find(e => e.entryName.match(/\.gcode$/i));
    if (gcodeEntry) {
      const outPath = path.join(destDir, `extracted_${Date.now()}.gcode`);
      fs.writeFileSync(outPath, gcodeEntry.getData());
      result.gcodePath = outPath;
    }

    // Extract 3D mesh model (3MF spec: 3D/3dmodel.model)
    const meshEntry =
      entries.find(e => e.entryName.match(/3D\/3dmodel\.model$/i)) ||
      entries.find(e => e.entryName.match(/\.model$/i));
    if (meshEntry) {
      const outPath = path.join(destDir, `mesh_${Date.now()}.model`);
      fs.writeFileSync(outPath, meshEntry.getData());
      result.meshPath = outPath;
    }
  } catch (e) {
    console.error('3mf extraction failed:', e.message);
  }
  return result;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads', req.params.partId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.gcode', '.gc', '.mf', '.3mf', '.nc', '.tap', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('File type not allowed'));
  }
});

router.use(protect);

// Get all versions for a part
router.get('/part/:partId', async (req, res) => {
  const versions = await GCodeVersion.find({ part: req.params.partId })
    .populate('uploadedBy', 'name')
    .sort({ versionNumber: -1 });
  res.json(versions);
});

// Upload new version
router.post('/part/:partId', upload.single('file'), async (req, res) => {
  try {
    const { notes } = req.body;
    const partId = req.params.partId;

    // Mark previous versions as not latest
    await GCodeVersion.updateMany({ part: partId }, { isLatest: false });

    // Get next version number
    const count = await GCodeVersion.countDocuments({ part: partId });
    const versionNumber = count + 1;
    const version = `v${versionNumber}.0`;

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const uploadDir = path.join(__dirname, '../uploads', partId);

    let gcodePreviewPath = req.file.path;
    let meshPath = null;

    if (ext === '3mf') {
      const extracted = extractFrom3mf(req.file.path, uploadDir);
      if (extracted.gcodePath) gcodePreviewPath = extracted.gcodePath;
      if (extracted.meshPath) meshPath = extracted.meshPath;
    }

    const gcode = await GCodeVersion.create({
      part: partId,
      version,
      versionNumber,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileType: ext,
      filePath: req.file.path,
      gcodePreviewPath,
      meshPath,
      fileSize: req.file.size,
      notes,
      isLatest: true,
      uploadedBy: req.user._id
    });

    res.status(201).json(gcode);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Get raw file content (for renderer) — uses extracted gcode for .3mf files
router.get('/:id/content', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id);
  if (!gcode) return res.status(404).json({ message: 'Not found' });
  const servePath = gcode.gcodePreviewPath || gcode.filePath;
  res.sendFile(path.resolve(servePath));
});

// Get extracted 3MF mesh XML for 3D solid rendering
router.get('/:id/mesh', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id);
  if (!gcode || !gcode.meshPath) return res.status(404).json({ message: 'No mesh available' });
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.resolve(gcode.meshPath));
});

// Download file
router.get('/:id/download', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id);
  if (!gcode) return res.status(404).json({ message: 'Not found' });
  res.download(path.resolve(gcode.filePath), gcode.originalName);
});

router.delete('/:id', async (req, res) => {
  const gcode = await GCodeVersion.findById(req.params.id);
  if (!gcode) return res.status(404).json({ message: 'Not found' });
  fs.unlink(gcode.filePath, () => {});
  await gcode.deleteOne();
  res.json({ message: 'Deleted' });
});

module.exports = router;
