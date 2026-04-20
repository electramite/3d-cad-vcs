const fs = require('fs');

// Filament density in g/cm³
const DENSITY = { PLA: 1.24, PETG: 1.27, ABS: 1.04, TPU: 1.21, ASA: 1.07, PA: 1.14 };

/**
 * Calculate total filament used from a gcode file.
 * Returns { mm, grams } for each tool/filament.
 */
function calcFilamentUsage(gcodePath, filamentType = 'PLA', diameterMm = 1.75) {
  let content;
  try { content = fs.readFileSync(gcodePath, 'utf8'); } catch { return { totalMm: 0, totalGrams: 0, perTool: [] }; }

  const lines = content.split('\n');
  let relativeE = false;
  let lastE = 0;
  let totalMm = 0;
  const perTool = [0]; // index = tool number
  let tool = 0;

  for (const raw of lines) {
    if (/^M83\b/.test(raw.trim())) { relativeE = true; continue; }
    if (/^M82\b/.test(raw.trim())) { relativeE = false; continue; }
    const tm = raw.trim().match(/^T(\d+)\b/);
    if (tm) {
      tool = parseInt(tm[1]);
      while (perTool.length <= tool) perTool.push(0);
      continue;
    }

    let line = raw.replace(/;.*$/, '').trim().toUpperCase();
    if (!line.match(/^G\s*0*1\b/)) continue;

    const em = line.match(/E\s*([+-]?\d*\.?\d+)/);
    if (!em) continue;
    const eVal = parseFloat(em[1]);

    let extruded = 0;
    if (relativeE) {
      extruded = eVal > 0 ? eVal : 0;
    } else {
      extruded = eVal > lastE ? eVal - lastE : 0;
      lastE = eVal;
    }

    totalMm += extruded;
    perTool[tool] = (perTool[tool] || 0) + extruded;
  }

  // Convert mm of filament to grams: volume = π*(d/2)² * length_cm, mass = volume * density
  const r = (diameterMm / 2) / 10; // radius in cm
  const density = DENSITY[filamentType] || DENSITY.PLA;
  const totalGrams = Math.PI * r * r * (totalMm / 10) * density;

  return {
    totalMm: Math.round(totalMm),
    totalGrams: parseFloat(totalGrams.toFixed(1)),
    perTool: perTool.map(mm => ({
      mm: Math.round(mm),
      grams: parseFloat((Math.PI * r * r * (mm / 10) * density).toFixed(1))
    }))
  };
}

module.exports = { calcFilamentUsage };
