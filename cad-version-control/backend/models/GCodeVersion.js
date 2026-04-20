const mongoose = require('mongoose');

const gcodeVersionSchema = new mongoose.Schema({
  part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true },
  version: { type: String, required: true },   // e.g. "v1.0", "v1.1"
  versionNumber: { type: Number, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: { type: String },                  // gcode, mf, etc.
  filePath: { type: String, required: true },
  gcodePreviewPath: { type: String },   // extracted .gcode path for .3mf files
  meshPath: { type: String },           // extracted 3D mesh .model path for solid view
  fileSize: { type: Number },
  notes: { type: String },                     // changelog / notes for this version
  isLatest: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('GCodeVersion', gcodeVersionSchema);
