const router = require('express').Router();
const Part = require('../models/Part');
const { protect } = require('../middleware/auth');

router.use(protect);

// Get all parts for a product
router.get('/product/:productId', async (req, res) => {
  const parts = await Part.find({ product: req.params.productId }).populate('createdBy', 'name');
  res.json(parts);
});

router.post('/', async (req, res) => {
  try {
    const part = await Part.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(part);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const part = await Part.findById(req.params.id).populate('product').populate('createdBy', 'name');
  if (!part) return res.status(404).json({ message: 'Not found' });
  res.json(part);
});

router.put('/:id', async (req, res) => {
  const part = await Part.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(part);
});

router.delete('/:id', async (req, res) => {
  await Part.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
