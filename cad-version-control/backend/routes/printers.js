const router = require('express').Router();
const mqtt = require('mqtt');
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const PrintLog = require('../models/PrintLog');
const { calcFilamentUsage } = require('../utils/filamentCalc');
const Printer = require('../models/Printer');
const GCodeVersion = require('../models/GCodeVersion');
const { protect } = require('../middleware/auth');

router.use(protect);

// ── CRUD for printers ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const printers = await Printer.find().populate('addedBy', 'name');
  res.json(printers);
});

router.post('/', async (req, res) => {
  try {
    const printer = await Printer.create({ ...req.body, addedBy: req.user._id });
    res.status(201).json(printer);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const printer = await Printer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(printer);
});

router.delete('/:id', async (req, res) => {
  await Printer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ── List SD card files ───────────────────────────────────────────────────────
router.get('/:id/sdcard', async (req, res) => {
  const printer = await Printer.findById(req.params.id);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });

  const agents = req.app.get('agents');
  const agentSocket = printer.agentToken ? agents[printer.agentToken] : null;

  try {
    if (agentSocket && agentSocket.connected) {
      // Route through bridge
      const result = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Bridge timed out')), 15000);
        agentSocket.emit('listsd', { printerIp: printer.ip, accessCode: printer.accessCode }, (r) => {
          clearTimeout(t);
          r.success ? resolve(r.files) : reject(new Error(r.error));
        });
      });
      return res.json(result);
    }

    // Direct local access
    const client = new ftp.Client(15000);
    client.ftp.verbose = false;
    await client.access({
      host: printer.ip, port: 990, user: 'bblp',
      password: printer.accessCode, secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    const list = await client.list('/');
    client.close();
    res.json(list.map(f => ({ name: f.name, size: f.size, isDirectory: f.isDirectory })));
  } catch (e) {
    res.status(500).json({ message: `SD card access failed: ${e.message}` });
  }
});

// ── Delete file from SD card ─────────────────────────────────────────────────
router.delete('/:id/sdcard/:filename', async (req, res) => {
  const printer = await Printer.findById(req.params.id);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });

  const agents = req.app.get('agents');
  const agentSocket = printer.agentToken ? agents[printer.agentToken] : null;

  try {
    if (agentSocket && agentSocket.connected) {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Bridge timed out')), 10000);
        agentSocket.emit('deletesd', { printerIp: printer.ip, accessCode: printer.accessCode, fileName: req.params.filename }, (r) => {
          clearTimeout(t);
          r.success ? resolve() : reject(new Error(r.error));
        });
      });
      return res.json({ message: 'Deleted' });
    }

    // Direct local access
    const client = new ftp.Client(15000);
    client.ftp.verbose = false;
    await client.access({
      host: printer.ip, port: 990, user: 'bblp',
      password: printer.accessCode, secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    await client.remove(`/${req.params.filename}`);
    client.close();
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: `Delete failed: ${e.message}` });
  }
});

router.get('/:id/status', async (req, res) => {
  const printer = await Printer.findById(req.params.id);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });

  try {
    const status = await getPrinterStatus(printer);
    res.json(status);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Step 1: Upload file to printer SD card only ─────────────────────────────
router.post('/:printerId/upload/:versionId', async (req, res) => {
  const printer = await Printer.findById(req.params.printerId);
  const version = await GCodeVersion.findById(req.params.versionId);

  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  if (!version) return res.status(404).json({ message: 'Version not found' });
  if (version.fileType !== '3mf') return res.status(400).json({ message: 'Only .3mf files can be sent to Bambu printers' });

  const agents = req.app.get('agents');
  const agentSocket = printer.agentToken ? agents[printer.agentToken] : null;

  // Use originalName directly — it already contains part name, units and version
  // e.g. "Phone_Stand_Base_2units_v3.0.3mf"
  const safeName = version.originalName.replace(/[^a-zA-Z0-9_.\-]/g, '_');
  const remoteFileName = safeName;

  try {
    if (agentSocket && agentSocket.connected) {      const fileContent = fs.readFileSync(version.filePath).toString('base64');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Agent timed out')), 60000);
        agentSocket.emit('upload', { fileBase64: fileContent, fileName: remoteFileName, printerIp: printer.ip, accessCode: printer.accessCode }, (r) => {
          clearTimeout(timeout);
          r.success ? resolve() : reject(new Error(r.error));
        });
      });
    } else {
      await uploadFileFtp(printer, version.filePath, remoteFileName);
    }
    res.json({ message: 'File uploaded to printer SD card', remoteFileName });
  } catch (e) {
    res.status(500).json({ message: `Upload failed: ${e.message}` });
  }
});

// ── Step 2: Start print for an already-uploaded file ────────────────────────
router.post('/:printerId/startprint', async (req, res) => {
  const printer = await Printer.findById(req.params.printerId);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });

  const { remoteFileName, versionId, useAms = false, bedLeveling = true, timelapse = false } = req.body;
  if (!remoteFileName) return res.status(400).json({ message: 'remoteFileName required' });

  const agents = req.app.get('agents');
  const agentSocket = printer.agentToken ? agents[printer.agentToken] : null;

  try {
    if (agentSocket && agentSocket.connected) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Agent timed out')), 15000);
        agentSocket.emit('startprint', { remoteFileName, printerIp: printer.ip, accessCode: printer.accessCode, serial: printer.serial, options: { useAms, bedLeveling, timelapse } }, (r) => {
          clearTimeout(timeout);
          r.success ? resolve() : reject(new Error(r.error));
        });
      });
    } else {
      await sendPrintCommand(printer, remoteFileName, { useAms, bedLeveling, timelapse });
    }
    const version = versionId ? await GCodeVersion.findById(versionId) : null;
    if (version) await createPrintLog(printer, version, remoteFileName, req.user._id);
    res.json({ message: 'Print started successfully' });
  } catch (e) {
    res.status(500).json({ message: `Start print failed: ${e.message}` });
  }
});

// ── Combined (legacy) ────────────────────────────────────────────────────────

router.post('/:printerId/print/:versionId', async (req, res) => {
  const printer = await Printer.findById(req.params.printerId);
  const version = await GCodeVersion.findById(req.params.versionId);

  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  if (!version) return res.status(404).json({ message: 'Version not found' });
  if (version.fileType !== '3mf') return res.status(400).json({ message: 'Only .3mf files can be sent to Bambu printers' });

  const { useAms = false, bedLeveling = true, timelapse = false } = req.body;
  const agents = req.app.get('agents');
  const agentSocket = printer.agentToken ? agents[printer.agentToken] : null;

  try {
    if (agentSocket && agentSocket.connected) {
      // ── Remote mode: delegate to local agent via WebSocket ──
      const fileContent = fs.readFileSync(version.filePath).toString('base64');
      const remoteFileName = `cad_vc_${Date.now()}.3mf`;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Agent timed out')), 60000);
        agentSocket.emit('print', {
          fileBase64: fileContent,
          fileName: remoteFileName,
          printerIp: printer.ip,
          accessCode: printer.accessCode,
          serial: printer.serial,
          options: { useAms, bedLeveling, timelapse }
        }, (response) => {
          clearTimeout(timeout);
          if (response.success) resolve();
          else reject(new Error(response.error));
        });
      });

      await createPrintLog(printer, version, remoteFileName, req.user._id);
      res.json({ message: 'Print started via remote agent', mode: 'remote' });
    } else {
      // ── Local mode: direct connection (portal on same network) ──
      const remoteFileName = `cad_vc_${Date.now()}.3mf`;
      await uploadFileFtp(printer, version.filePath, remoteFileName);
      await sendPrintCommand(printer, remoteFileName, { useAms, bedLeveling, timelapse });
      await createPrintLog(printer, version, remoteFileName, req.user._id);
      res.json({ message: 'Print started successfully', mode: 'local' });
    }
  } catch (e) {
    res.status(500).json({ message: `Print failed: ${e.message}` });
  }
});

// ── FTP upload to Bambu printer ──────────────────────────────────────────────

async function uploadFileFtp(printer, localPath, remoteFileName) {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: printer.ip,
      port: 990,
      user: 'bblp',
      password: printer.accessCode,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    // Upload to root — Bambu A1 serves files from SD card root via ftp:///
    await client.uploadFrom(localPath, remoteFileName);
  } finally {
    client.close();
  }
}

// ── MQTT print command ───────────────────────────────────────────────────────

function sendPrintCommand(printer, remoteFileName, opts) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {      username: 'bblp',
      password: printer.accessCode,
      rejectUnauthorized: false,
      connectTimeout: 10000
    });

    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('MQTT connection timed out'));
    }, 12000);

    client.on('connect', () => {
      const payload = JSON.stringify({
        print: {
          sequence_id: String(Date.now()),
          command: 'project_file',
          param: 'Metadata/plate_1.gcode',
          url: `ftp:///${remoteFileName}`,   // triple slash = printer's own SD card
          file: remoteFileName,
          md5: '',
          bed_type: 'auto',
          timelapse: opts.timelapse,
          bed_levelling: opts.bedLeveling,   // double-L per Bambu API spec
          flow_cali: false,
          vibration_cali: true,
          layer_inspect: false,
          use_ams: opts.useAms,
          ams_mapping: '',
          profile_id: '0',
          project_id: '0',
          subtask_id: '0',
          subtask_name: remoteFileName.replace('.3mf', ''),
          task_id: '0'
        }
      });

      client.publish(`device/${printer.serial}/request`, payload, { qos: 1 }, (err) => {
        clearTimeout(timeout);
        client.end();
        if (err) reject(err);
        else resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

// ── Get printer status ───────────────────────────────────────────────────────

function getPrinterStatus(printer) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
      username: 'bblp',
      password: printer.accessCode,
      rejectUnauthorized: false,
      connectTimeout: 8000
    });

    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('Printer unreachable'));
    }, 10000);

    client.on('connect', () => {
      client.subscribe(`device/${printer.serial}/report`, (err) => {
        if (err) { clearTimeout(timeout); client.end(true); reject(err); return; }

        // Request status push
        client.publish(`device/${printer.serial}/request`, JSON.stringify({
          pushing: { sequence_id: '0', command: 'pushall' }
        }));
      });
    });

    client.on('message', (topic, message) => {
      clearTimeout(timeout);
      client.end();
      try {
        const data = JSON.parse(message.toString());
        const print = data.print || {};
        resolve({
          state: print.gcode_state || 'unknown',
          progress: print.mc_percent || 0,
          remainingTime: print.mc_remaining_time || 0,
          nozzleTemp: print.nozzle_temper || 0,
          bedTemp: print.bed_temper || 0,
          currentFile: print.subtask_name || '',
          amsLoaded: !!print.ams
        });
      } catch {
        resolve({ state: 'unknown' });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

// ── Create print log entry ───────────────────────────────────────────────────
async function createPrintLog(printer, version, fileName, userId) {
  try {
    let filamentUsedMm = 0, filamentUsedGrams = 0;
    if (version?.gcodePreviewPath) {
      const usage = calcFilamentUsage(version.gcodePreviewPath);
      filamentUsedMm = usage.totalMm;
      filamentUsedGrams = usage.totalGrams;
    }
    await PrintLog.create({
      printer: printer._id, version: version._id, fileName,
      filamentUsedMm, filamentUsedGrams, startedBy: userId, status: 'started'
    });
  } catch (e) {
    console.error('Failed to create print log:', e.message);
  }
}

module.exports = router;
