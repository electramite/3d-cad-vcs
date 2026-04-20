const router = require('express').Router();
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  const products = await Product.find().populate('createdBy', 'name email');
  res.json(products);
});

router.post('/', async (req, res) => {
  try {
    const { name, description, sku } = req.body;
    const product = await Product.create({
      name, description,
      sku: sku || undefined,   // don't store empty string
      createdBy: req.user._id
    });
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).populate('createdBy', 'name');
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
});

router.put('/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(product);
});

router.delete('/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
