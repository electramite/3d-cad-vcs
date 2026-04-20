const mongoose = require('mongoose');

// Auto-generate code prefix from type name (first 3 chars uppercase)
function genCode(typeName) {
  const prefix = (typeName || 'CMP').slice(0, 3).toUpperCase();
  return `${prefix}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

const componentSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'ComponentGroup', required: true },
  name: { type: String, required: true },
  code: { type: String, unique: true },          // auto-generated HSN-style code
  description: { type: String },
  unit: { type: String, default: 'pcs' },        // pcs, kg, m, rolls, etc.
  // Stock levels
  inStock: { type: Number, default: 0 },
  inTransit: { type: Number, default: 0 },
  minThreshold: { type: Number, default: 10 },   // alert when inStock < this
  // Alert state
  alertTriggered: { type: Boolean, default: false },
  alertAcknowledged: { type: Boolean, default: false },
  alertAcknowledgedAt: { type: Date },
  alertAcknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Meta
  supplier: { type: String },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate code before save
componentSchema.pre('save', async function (next) {
  if (!this.code) {
    const group = await mongoose.model('ComponentGroup').findById(this.group);
    const type = group?.type || 'misc';
    let code, exists;
    do {
      code = genCode(type);
      exists = await mongoose.model('Component').findOne({ code });
    } while (exists);
    this.code = code;
  }
  // Auto-trigger alert if stock drops below threshold
  this.alertTriggered = this.inStock < this.minThreshold;
  if (this.alertTriggered && !this.alertAcknowledged) {
    // keep alert active
  }
  next();
});

module.exports = mongoose.model('Component', componentSchema);
