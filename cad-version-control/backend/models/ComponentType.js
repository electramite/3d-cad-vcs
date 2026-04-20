const mongoose = require('mongoose');

const componentTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  icon: { type: String, default: '📦' },
  color: { type: String, default: '#4a3d5a' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ComponentType', componentTypeSchema);
