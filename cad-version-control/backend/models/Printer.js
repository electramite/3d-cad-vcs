const mongoose = require('mongoose');

const printerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ip: { type: String, required: true },
  serial: { type: String, required: true },
  accessCode: { type: String, required: true },
  model: { type: String, default: 'X1C' },
  agentToken: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Printer', printerSchema);
