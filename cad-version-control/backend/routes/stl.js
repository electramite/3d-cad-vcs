const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StlVersion = require('../models/StlVersion');
const { protect } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/stl', req.params.partId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ext === '.stl' ? cb(null, true) : cb(new Error('Only .stl files allowed'));
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.use(protect);

// Get all STL versions for a part
router.get('/part/:partId', async (req, res) => {
  const versions = await StlVersion.find({ part: req.params.partId })
    .populate('uploadedBy', 'name')
    .sort({ versionNumber: -1 });
  res.json(versions);
});

// Upload new STL version
router.post('/part/:partId', upload.single('file'), async (req, res) => {
  try {
    const { notes } = req.body;
    const partId = req.params.partId;

    await StlVersion.updateMany({ part: partId }, { isLatest: false });
    const count = await StlVersion.countDocuments({ part: partId });
    const versionNumber = count + 1;

    const stl = await StlVersion.create({
      part: partId,
      version: `v${versionNumber}.0`,
      versionNumber,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      notes,
      isLatest: true,
      uploadedBy: req.user._id
    });
    res.status(201).json(stl);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Serve STL file for viewer
router.get('/:id/file', async (req, res) => {
  const stl = await StlVersion.findById(req.params.id);
  if (!stl) return res.status(404).json({ message: 'Not found' });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(path.resolve(stl.filePath));
});

// Download
router.get('/:id/download', async (req, res) => {
  const stl = await StlVersion.findById(req.params.id);
  if (!stl) return res.status(404).json({ message: 'Not found' });
  res.download(path.resolve(stl.filePath), stl.originalName);
});

router.delete('/:id', async (req, res) => {
  const stl = await StlVersion.findById(req.params.id);
  if (!stl) return res.status(404).json({ message: 'Not found' });
  fs.unlink(stl.filePath, () => {});
  await stl.deleteOne();
  res.json({ message: 'Deleted' });
});

module.exports = router;
