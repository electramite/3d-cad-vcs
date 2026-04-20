const router = require('express').Router();
const PrintLog = require('../models/PrintLog');
const GCodeVersion = require('../models/GCodeVersion');
const Printer = require('../models/Printer');
const { calcFilamentUsage } = require('../utils/filamentCalc');
const { protect } = require('../middleware/auth');
const mqtt = require('mqtt');

router.use(protect);

// Get all logs (with filters)
router.get('/', async (req, res) => {
  const { printer, status, limit = 50 } = req.query;
  const filter = {};
  if (printer) filter.printer = printer;
  if (status) filter.status = status;
  const logs = await PrintLog.find(filter)
    .populate('printer', 'name model ip')
    .populate('version', 'version originalName')
    .populate('startedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
  res.json(logs);
});

// Get stats summary
router.get('/stats', async (req, res) => {
  const [total, finished, failed, filament] = await Promise.all([
    PrintLog.countDocuments(),
    PrintLog.countDocuments({ status: 'finished' }),
    PrintLog.countDocuments({ status: 'failed' }),
    PrintLog.aggregate([{ $group: { _id: null, totalGrams: { $sum: '$filamentUsedGrams' }, totalMm: { $sum: '$filamentUsedMm' } } }])
  ]);
  res.json({
    total, finished, failed,
    successRate: total > 0 ? Math.round((finished / total) * 100) : 0,
    totalFilamentGrams: filament[0]?.totalGrams?.toFixed(1) || 0,
    totalFilamentMm: filament[0]?.totalMm || 0
  });
});

// Create log when print starts (called internally from printers route)
router.post('/', async (req, res) => {
  try {
    const { printerId, versionId, fileName, startedBy } = req.body;
    const version = versionId ? await GCodeVersion.findById(versionId) : null;

    // Calculate filament usage from gcode
    let filamentUsedMm = 0, filamentUsedGrams = 0;
    if (version?.gcodePreviewPath) {
      const usage = calcFilamentUsage(version.gcodePreviewPath);
      filamentUsedMm = usage.totalMm;
      filamentUsedGrams = usage.totalGrams;
    }

    const log = await PrintLog.create({
      printer: printerId, version: versionId, fileName,
      filamentUsedMm, filamentUsedGrams, startedBy,
      status: 'started'
    });
    res.status(201).json(log);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update log status (called by agent or MQTT monitor)
router.patch('/:id', async (req, res) => {
  const { status, totalLayers, printError } = req.body;
  const update = { status };
  if (status === 'finished' || status === 'failed' || status === 'cancelled') {
    update.finishedAt = new Date();
  }
  if (totalLayers) update.totalLayers = totalLayers;
  if (printError !== undefined) update.printError = printError;

  // Calculate duration
  const log = await PrintLog.findById(req.params.id);
  if (log?.startedAt && update.finishedAt) {
    update.durationMinutes = Math.round((update.finishedAt - log.startedAt) / 60000);
  }

  const updated = await PrintLog.findByIdAndUpdate(req.params.id, update, { new: true });
  res.json(updated);
});

// Subscribe to printer MQTT and monitor print status
router.post('/monitor/:printerId', async (req, res) => {
  const printer = await Printer.findById(req.params.printerId);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });

  // Start background MQTT monitor (non-blocking)
  startMqttMonitor(printer);
  res.json({ message: `Monitoring started for ${printer.name}` });
});

// Active monitors map
const activeMonitors = {};

function startMqttMonitor(printer) {
  if (activeMonitors[printer._id]) return; // already monitoring

  const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
    username: 'bblp',
    password: printer.accessCode,
    rejectUnauthorized: false,
    reconnectPeriod: 5000
  });

  let currentLog = null;
  let lastState = 'IDLE';

  client.on('connect', () => {
    console.log(`[Monitor] Connected to ${printer.name}`);
    client.subscribe(`device/${printer.serial}/report`);
    // Request full status
    client.publish(`device/${printer.serial}/request`,
      JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } })
    );
  });

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const print = data.print;
      if (!print) return;

      const state = print.gcode_state;
      if (!state || state === lastState) return;
      lastState = state;

      console.log(`[Monitor] ${printer.name}: ${state}`);

      if (state === 'RUNNING' && !currentLog) {
        // New print started — find most recent 'started' log for this printer
        currentLog = await PrintLog.findOne({ printer: printer._id, status: 'started' }).sort({ createdAt: -1 });
        if (currentLog) {
          await PrintLog.findByIdAndUpdate(currentLog._id, { status: 'running', totalLayers: print.total_layer_num });
        }
      }

      if ((state === 'FINISH' || state === 'FAILED') && currentLog) {
        const status = state === 'FINISH' ? 'finished' : 'failed';
        const finishedAt = new Date();
        const durationMinutes = Math.round((finishedAt - currentLog.startedAt) / 60000);
        await PrintLog.findByIdAndUpdate(currentLog._id, {
          status, finishedAt, durationMinutes,
          totalLayers: print.total_layer_num,
          printError: print.print_error || 0
        });
        console.log(`[Monitor] Print ${status}: ${currentLog.fileName} (${durationMinutes} min)`);
        currentLog = null;
      }
    } catch {}
  });

  client.on('error', (e) => console.log(`[Monitor] ${printer.name} error: ${e.message}`));
  activeMonitors[printer._id] = client;
}

// Auto-start monitors for all printers on server boot
async function initMonitors() {
  try {
    const printers = await Printer.find();
    for (const p of printers) startMqttMonitor(p);
    console.log(`[Monitor] Started ${printers.length} printer monitor(s)`);
  } catch {}
}

module.exports = router;
module.exports.initMonitors = initMonitors;
