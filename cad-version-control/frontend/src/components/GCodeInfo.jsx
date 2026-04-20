function parseHeader(content) {
  if (!content) return {};
  const lines = content.split('\n').slice(0, 400);

  // Match "; key : value" (Bambu header block) or "; key = value" (config block)
  const getH = (key) => {
    const line = lines.find(l => l.match(new RegExp(`^;\\s*${key}\\s*[=:]`, 'i')));
    if (!line) return null;
    return line.replace(/^;[^:=]*[=:]/, '').trim();
  };

  // Bambu uses commas as separator in header block
  const commaVals = (raw) => raw ? raw.split(',').map(v => v.trim()).filter(v => v) : [];
  // Config block uses semicolons
  const semiVals  = (raw) => raw ? raw.split(';').map(v => v.trim()).filter(v => v) : [];

  const firstNonZero = (arr) => arr.find(v => v !== '0' && v !== '') || null;
  const uniqueNonZero = (arr) => [...new Set(arr.filter(v => v !== '0' && v !== ''))];

  // Header block values (comma separated)
  const filamentGs   = commaVals(getH('total filament weight \\[g\\]'));
  const filamentMms  = commaVals(getH('total filament length \\[mm\\]'));
  const filamentCm3s = commaVals(getH('total filament volume \\[cm\\^3\\]'));

  // Config block values (semicolon separated)
  const filamentTypes  = semiVals(getH('filament_type'));
  const filamentColors = semiVals(getH('filament_colour'));
  const nozzleTempsRaw = semiVals(getH('nozzle_temperature') || getH('nozzle_temperature_initial_layer'));
  const bedTempsRaw    = semiVals(getH('bed_temperature') || getH('bed_temperature_initial_layer'));

  return {
    timeRaw:       getH('total estimated time') || getH('estimated printing time'),
    printTimeRaw:  getH('model printing time'),
    layerCount:    getH('total layer number'),
    filamentGs, filamentMms, filamentCm3s,
    filamentTypes, filamentColors,
    nozzleTemps:   uniqueNonZero(nozzleTempsRaw),
    bedTemps:      uniqueNonZero(bedTempsRaw),
    chamberTemp:   firstNonZero(semiVals(getH('chamber_temperatures'))),
    layerHeight:   firstNonZero(semiVals(getH('layer_height'))),
    firstLayer:    firstNonZero(semiVals(getH('initial_layer_print_height') || getH('first_layer_height'))),
    nozzle:        firstNonZero(semiVals(getH('nozzle_diameter'))),
    printer:       getH('printer_model') || getH('printer_settings_id'),
    infillDensity: firstNonZero(semiVals(getH('sparse_infill_density') || getH('fill_density'))),
    infillPattern: firstNonZero(semiVals(getH('sparse_infill_pattern') || getH('fill_pattern'))),
    wallLoops:     firstNonZero(semiVals(getH('wall_loops') || getH('perimeters'))),
    topLayers:     firstNonZero(semiVals(getH('top_shell_layers') || getH('top_solid_layers'))),
    botLayers:     firstNonZero(semiVals(getH('bottom_shell_layers') || getH('bottom_solid_layers'))),
    support:       firstNonZero(semiVals(getH('enable_support') || getH('support_material'))),
    printSpeed:    firstNonZero(semiVals(getH('outer_wall_speed') || getH('print_speed'))),
  };
}

function fmtGrams(g) {
  const val = parseFloat(g);
  if (isNaN(val)) return g;
  if (val >= 1000) return `${(val / 1000).toFixed(2)} kg`;
  return `${val.toFixed(1)} g`;
}

function InfoRow({ label, value, unit = '' }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
        {value}{unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const flat = Array.isArray(children) ? children.flat() : [children];
  if (!flat.some(c => c !== null && c !== false && c !== undefined)) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px 20px' }}>
        {children}
      </div>
    </div>
  );
}

export default function GCodeInfo({ content }) {
  if (!content) return null;
  const d = parseHeader(content);

  const totalG   = d.filamentGs.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalMm  = d.filamentMms.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const multiFilament = d.filamentGs.filter(v => parseFloat(v) > 0).length > 1;

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Material Usage */}
      {totalG > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Material Usage
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>
                {fmtGrams(totalG)}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{(totalMm / 1000).toFixed(2)} m</span>
              </div>
            </div>
            {multiFilament && d.filamentGs.map((g, i) => {
              if (!parseFloat(g)) return null;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {d.filamentColors[i] && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.filamentColors[i], border: '1px solid #aaa', flexShrink: 0 }} />
                    )}
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {d.filamentTypes[i] || `Filament ${i + 1}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmtGrams(g)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Section title="Print Time & Layers">
        <InfoRow label="Total Time" value={d.timeRaw} />
        <InfoRow label="Model Time" value={d.printTimeRaw} />
        <InfoRow label="Total Layers" value={d.layerCount} />
        <InfoRow label="Layer Height" value={d.layerHeight} unit="mm" />
        <InfoRow label="First Layer" value={d.firstLayer} unit="mm" />
      </Section>

      <Section title="Print Settings">
        <InfoRow label="Nozzle" value={d.nozzle} unit="mm" />
        <InfoRow label="Infill" value={d.infillDensity} />
        <InfoRow label="Infill Pattern" value={d.infillPattern} />
        <InfoRow label="Wall Loops" value={d.wallLoops} />
        <InfoRow label="Top Layers" value={d.topLayers} />
        <InfoRow label="Bottom Layers" value={d.botLayers} />
        <InfoRow label="Support" value={
          d.support === '1' || d.support === 'true' ? 'Yes' :
          d.support === '0' || d.support === 'false' ? 'No' : d.support
        } />
        <InfoRow label="Print Speed" value={d.printSpeed} unit="mm/s" />
      </Section>

      {d.printer && (
        <Section title="Printer">
          <InfoRow label="Model" value={d.printer} />
        </Section>
      )}
    </div>
  );
}
