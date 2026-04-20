const mongoose = require('mongoose');

const printLogSchema = new mongoose.Schema({
  printer: { type: mongoose.Schema.Types.ObjectId, ref: 'Printer', required: true },
  version: { type: mongoose.Schema.Types.ObjectId, ref: 'GCodeVersion' },
  fileName: { type: String },
  status: { type: String, enum: ['started', 'running', 'finished', 'failed', 'cancelled'], default: 'started' },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  durationMinutes: { type: Number },
  // Material usage (calculated from gcode E values)
  filamentUsedMm: { type: Number, default: 0 },
  filamentUsedGrams: { type: Number, default: 0 },
  filamentType: { type: String, default: 'PLA' },
  // Print stats from MQTT
  totalLayers: { type: Number },
  printError: { type: Number, default: 0 },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PrintLog', printLogSchema);
