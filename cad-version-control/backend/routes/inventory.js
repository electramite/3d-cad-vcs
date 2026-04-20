const router = require('express').Router();
const ComponentGroup = require('../models/ComponentGroup');
const Component = require('../models/Component');
const ComponentType = require('../models/ComponentType');
const { protect } = require('../middleware/auth');

router.use(protect);

// ── Types ────────────────────────────────────────────────────────────────────

router.get('/types', async (req, res) => {
  const types = await ComponentType.find().sort({ name: 1 });
  res.json(types);
});

router.post('/types', async (req, res) => {
  try {
    const type = await ComponentType.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(type);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/types/:id', async (req, res) => {
  const type = await ComponentType.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(type);
});

router.delete('/types/:id', async (req, res) => {
  // Check if any groups use this type
  const inUse = await ComponentGroup.countDocuments({ type: req.params.id });
  if (inUse > 0) return res.status(400).json({ message: `Cannot delete — ${inUse} group(s) use this type` });
  await ComponentType.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// Seed default types if none exist
router.post('/types/seed', async (req, res) => {
  const count = await ComponentType.countDocuments();
  if (count > 0) return res.json({ message: 'Already seeded' });
  const defaults = [
    { name: 'material', icon: '🧵', color: '#3d6b55' },
    { name: 'electronics', icon: '⚡', color: '#1e3a5f' },
    { name: 'hardware', icon: '🔩', color: '#5a3d1e' },
    { name: 'misc', icon: '📦', color: '#4a3d5a' }
  ];
  await ComponentType.insertMany(defaults);
  res.json({ message: 'Seeded' });
});

// ── Groups ───────────────────────────────────────────────────────────────────

router.get('/groups', async (req, res) => {
  const groups = await ComponentGroup.find().sort({ type: 1, name: 1 });
  res.json(groups);
});

router.post('/groups', async (req, res) => {
  try {
    const group = await ComponentGroup.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(group);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/groups/:id', async (req, res) => {
  const group = await ComponentGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(group);
});

router.delete('/groups/:id', async (req, res) => {
  await ComponentGroup.findByIdAndDelete(req.params.id);
  await Component.deleteMany({ group: req.params.id });
  res.json({ message: 'Deleted' });
});

// ── Components ───────────────────────────────────────────────────────────────

router.get('/components', async (req, res) => {
  const { group, alert } = req.query;
  const filter = {};
  if (group) filter.group = group;
  if (alert === 'true') filter.alertTriggered = true;
  const components = await Component.find(filter)
    .populate('group', 'name type')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });
  res.json(components);
});

// Alert summary count
router.get('/alerts', async (req, res) => {
  const count = await Component.countDocuments({ alertTriggered: true, alertAcknowledged: false });
  const items = await Component.find({ alertTriggered: true, alertAcknowledged: false })
    .populate('group', 'name type')
    .select('name code inStock minThreshold unit group');
  res.json({ count, items });
});

router.post('/components', async (req, res) => {
  try {
    const component = await Component.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(component);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.put('/components/:id', async (req, res) => {
  try {
    const component = await Component.findById(req.params.id);
    if (!component) return res.status(404).json({ message: 'Not found' });
    Object.assign(component, req.body);
    await component.save(); // triggers pre-save for alert check
    res.json(component);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// Acknowledge alert
router.post('/components/:id/acknowledge', async (req, res) => {
  const component = await Component.findByIdAndUpdate(req.params.id, {
    alertAcknowledged: true,
    alertAcknowledgedAt: new Date(),
    alertAcknowledgedBy: req.user._id
  }, { new: true });
  res.json(component);
});

// Stock adjustment (add/remove stock)
router.post('/components/:id/adjust', async (req, res) => {
  try {
    const { field, delta } = req.body; // field: 'inStock' | 'inTransit', delta: number
    const component = await Component.findById(req.params.id);
    if (!component) return res.status(404).json({ message: 'Not found' });
    component[field] = Math.max(0, (component[field] || 0) + delta);
    // Reset acknowledgement if stock changes
    if (field === 'inStock') component.alertAcknowledged = false;
    await component.save();
    res.json(component);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

router.delete('/components/:id', async (req, res) => {
  await Component.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
