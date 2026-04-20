/**
 * CAD Version Control — Raspberry Pi Bridge
 *
 * Runs on a Raspberry Pi (Ubuntu) on the same local network as the Bambu printer.
 * Connects to the cloud portal via WebSocket and handles:
 *   - File upload to printer SD card (FTPS)
 *   - Start print command (MQTT)
 *   - SD card file listing
 *   - SD card file deletion
 *   - Printer status polling
 */

require('dotenv').config();
const { io }  = require('socket.io-client');
const mqtt    = require('mqtt');
const ftp     = require('basic-ftp');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const SERVER_URL  = process.env.SERVER_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!SERVER_URL || !AGENT_TOKEN) {
  console.error('[Bridge] ERROR: SERVER_URL and AGENT_TOKEN must be set in .env');
  process.exit(1);
}

console.log('[Bridge] Starting CAD VC Bridge...');
console.log(`[Bridge] Connecting to: ${SERVER_URL}`);

// ── WebSocket connection to cloud portal ─────────────────────────────────────

const socket = io(SERVER_URL, {
  auth: { agentToken: AGENT_TOKEN },
  reconnection: true,
  reconnectionDelay: 3000,
  reconnectionAttempts: Infinity
});

socket.on('connect', () => {
  console.log(`[Bridge] ✓ Connected to cloud portal (id: ${socket.id})`);
});

socket.on('disconnect', (reason) => {
  console.log(`[Bridge] ✗ Disconnected: ${reason} — will reconnect...`);
});

socket.on('connect_error', (err) => {
  console.log(`[Bridge] Connection error: ${err.message}`);
});

// ── Event: Upload file to printer SD card ────────────────────────────────────

socket.on('upload', async (data, callback) => {
  const { fileBase64, fileName, printerIp, accessCode } = data;
  console.log(`[Bridge] Upload: ${fileName} → ${printerIp}`);
  const tmpPath = path.join(os.tmpdir(), fileName);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
    await ftpUpload(printerIp, accessCode, tmpPath, fileName);
    console.log(`[Bridge] ✓ Upload complete: ${fileName}`);
    callback({ success: true });
  } catch (e) {
    console.error(`[Bridge] ✗ Upload failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    safeUnlink(tmpPath);
  }
});

// ── Event: Start print ───────────────────────────────────────────────────────

socket.on('startprint', async (data, callback) => {
  const { remoteFileName, printerIp, accessCode, serial, options } = data;
  console.log(`[Bridge] Start print: ${remoteFileName} on ${printerIp}`);
  try {
    await mqttPrint(printerIp, accessCode, serial, remoteFileName, options);
    console.log(`[Bridge] ✓ Print started: ${remoteFileName}`);
    callback({ success: true });
  } catch (e) {
    console.error(`[Bridge] ✗ Start print failed: ${e.message}`);
    callback({ success: false, error: e.message });
  }
});

// ── Event: Combined upload + print ───────────────────────────────────────────

socket.on('print', async (data, callback) => {
  const { fileBase64, fileName, printerIp, accessCode, serial, options } = data;
  console.log(`[Bridge] Print job: ${fileName} → ${printerIp}`);
  const tmpPath = path.join(os.tmpdir(), fileName);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
    await ftpUpload(printerIp, accessCode, tmpPath, fileName);
    await mqttPrint(printerIp, accessCode, serial, fileName, options);
    console.log(`[Bridge] ✓ Print job complete: ${fileName}`);
    callback({ success: true });
  } catch (e) {
    console.error(`[Bridge] ✗ Print job failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    safeUnlink(tmpPath);
  }
});

// ── Event: List SD card files ─────────────────────────────────────────────────

socket.on('listsd', async (data, callback) => {
  const { printerIp, accessCode } = data;
  console.log(`[Bridge] List SD card: ${printerIp}`);
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;
  try {
    await ftpConnect(client, printerIp, accessCode);
    const list = await client.list('/');
    callback({
      success: true,
      files: list.map(f => ({ name: f.name, size: f.size, isDirectory: f.isDirectory }))
    });
  } catch (e) {
    console.error(`[Bridge] ✗ List SD failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    client.close();
  }
});

// ── Event: Delete SD card file ────────────────────────────────────────────────

socket.on('deletesd', async (data, callback) => {
  const { printerIp, accessCode, fileName } = data;
  console.log(`[Bridge] Delete SD file: ${fileName} on ${printerIp}`);
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;
  try {
    await ftpConnect(client, printerIp, accessCode);
    await client.remove(`/${fileName}`);
    console.log(`[Bridge] ✓ Deleted: ${fileName}`);
    callback({ success: true });
  } catch (e) {
    console.error(`[Bridge] ✗ Delete failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    client.close();
  }
});

// ── Event: Get printer status ─────────────────────────────────────────────────

socket.on('status', async (data, callback) => {
  const { printerIp, accessCode, serial } = data;
  console.log(`[Bridge] Status check: ${printerIp}`);
  try {
    const status = await mqttStatus(printerIp, accessCode, serial);
    callback({ success: true, status });
  } catch (e) {
    console.error(`[Bridge] ✗ Status failed: ${e.message}`);
    callback({ success: false, error: e.message });
  }
});

// ── FTP helpers ───────────────────────────────────────────────────────────────

async function ftpConnect(client, ip, accessCode) {
  await client.access({
    host: ip, port: 990, user: 'bblp',
    password: accessCode, secure: 'implicit',
    secureOptions: { rejectUnauthorized: false }
  });
}

async function ftpUpload(ip, accessCode, localPath, remoteFileName) {
  const client = new ftp.Client(60000);
  client.ftp.verbose = false;
  try {
    await ftpConnect(client, ip, accessCode);
    await client.uploadFrom(localPath, remoteFileName);
  } finally {
    client.close();
  }
}

// ── MQTT helpers ──────────────────────────────────────────────────────────────

function mqttPrint(ip, accessCode, serial, fileName, opts = {}) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${ip}:8883`, {
      username: 'bblp', password: accessCode,
      rejectUnauthorized: false, connectTimeout: 10000
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
          url: `ftp:///${fileName}`,
          file: fileName,
          md5: '',
          bed_type: 'auto',
          timelapse: opts.timelapse || false,
          bed_levelling: opts.bedLeveling !== false,
          flow_cali: false,
          vibration_cali: true,
          layer_inspect: false,
          use_ams: opts.useAms || false,
          ams_mapping: '',
          profile_id: '0', project_id: '0',
          subtask_id: '0', task_id: '0',
          subtask_name: fileName.replace(/\.3mf$/i, '')
        }
      });

      client.publish(`device/${serial}/request`, payload, { qos: 1 }, (err) => {
        clearTimeout(timeout);
        client.end();
        err ? reject(err) : resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

function mqttStatus(ip, accessCode, serial) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${ip}:8883`, {
      username: 'bblp', password: accessCode,
      rejectUnauthorized: false, connectTimeout: 8000
    });

    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('Printer unreachable'));
    }, 10000);

    client.on('connect', () => {
      client.subscribe(`device/${serial}/report`, (err) => {
        if (err) { clearTimeout(timeout); client.end(true); reject(err); return; }
        client.publish(`device/${serial}/request`,
          JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } })
        );
      });
    });

    client.on('message', (topic, message) => {
      clearTimeout(timeout);
      client.end();
      try {
        const data = JSON.parse(message.toString());
        const p = data.print || {};
        resolve({
          state: p.gcode_state || 'unknown',
          progress: p.mc_percent || 0,
          remainingTime: p.mc_remaining_time || 0,
          nozzleTemp: p.nozzle_temper || 0,
          bedTemp: p.bed_temper || 0,
          currentFile: p.subtask_name || '',
          totalLayers: p.total_layer_num || 0,
          currentLayer: p.layer_num || 0
        });
      } catch { resolve({ state: 'unknown' }); }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

function safeUnlink(p) { try { fs.unlinkSync(p); } catch {} }

console.log('[Bridge] Ready. Waiting for jobs from cloud portal...');
