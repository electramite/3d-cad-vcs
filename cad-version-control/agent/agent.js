require('dotenv').config();
const { io } = require('socket.io-client');
const mqtt = require('mqtt');
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_URL = process.env.SERVER_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;

if (!SERVER_URL || !AGENT_TOKEN) {
  console.error('Missing SERVER_URL or AGENT_TOKEN in .env');
  process.exit(1);
}

console.log(`CAD VC Agent starting...`);
console.log(`Connecting to: ${SERVER_URL}`);

const socket = io(SERVER_URL, {
  auth: { agentToken: AGENT_TOKEN },
  reconnection: true,
  reconnectionDelay: 3000
});

socket.on('connect', () => {
  console.log(`✓ Connected to cloud server (id: ${socket.id})`);
});

socket.on('disconnect', (reason) => {
  console.log(`✗ Disconnected: ${reason} — reconnecting...`);
});

socket.on('connect_error', (err) => {
  console.log(`Connection error: ${err.message}`);
});

// ── Handle upload only ───────────────────────────────────────────────────────
socket.on('upload', async (data, callback) => {
  const { fileBase64, fileName, printerIp, accessCode } = data;
  console.log(`\nUpload job: ${fileName} → ${printerIp}`);
  const tmpPath = path.join(os.tmpdir(), fileName);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
    await uploadFtp(printerIp, accessCode, tmpPath, fileName);
    console.log(`✓ File uploaded`);
    callback({ success: true });
  } catch (e) {
    console.error(`✗ Upload failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// ── Handle start print only ──────────────────────────────────────────────────
socket.on('startprint', async (data, callback) => {
  const { remoteFileName, printerIp, accessCode, serial, options } = data;
  console.log(`\nStart print: ${remoteFileName} on ${printerIp}`);
  try {
    await sendPrintCommand(printerIp, accessCode, serial, remoteFileName, options);
    console.log(`✓ Print started`);
    callback({ success: true });
  } catch (e) {
    console.error(`✗ Start print failed: ${e.message}`);
    callback({ success: false, error: e.message });
  }
});

// ── Handle combined print job ────────────────────────────────────────────────
socket.on('print', async (data, callback) => {
  const { fileBase64, fileName, printerIp, accessCode, serial, options } = data;
  console.log(`\nPrint job received: ${fileName} → ${printerIp}`);

  // Write file to temp dir
  const tmpPath = path.join(os.tmpdir(), fileName);
  try {
    fs.writeFileSync(tmpPath, Buffer.from(fileBase64, 'base64'));
    console.log(`File written to temp: ${tmpPath}`);

    // 1. Upload via FTPS
    await uploadFtp(printerIp, accessCode, tmpPath, fileName);
    console.log(`✓ File uploaded to printer`);

    // 2. Send MQTT print command
    await sendPrintCommand(printerIp, accessCode, serial, fileName, options);
    console.log(`✓ Print command sent`);

    callback({ success: true });
  } catch (e) {
    console.error(`✗ Print failed: ${e.message}`);
    callback({ success: false, error: e.message });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// ── FTP Upload ───────────────────────────────────────────────────────────────
async function uploadFtp(ip, accessCode, localPath, remoteFileName) {
  const client = new ftp.Client(30000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: ip,
      port: 990,
      user: 'bblp',
      password: accessCode,
      secure: 'implicit',
      secureOptions: { rejectUnauthorized: false }
    });
    await client.uploadFrom(localPath, remoteFileName);
  } finally {
    client.close();
  }
}

// ── MQTT Print Command ───────────────────────────────────────────────────────
function sendPrintCommand(ip, accessCode, serial, fileName, opts) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtts://${ip}:8883`, {
      username: 'bblp',
      password: accessCode,
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
          profile_id: '0',
          project_id: '0',
          subtask_id: '0',
          subtask_name: fileName.replace('.3mf', ''),
          task_id: '0'
        }
      });

      client.publish(`device/${serial}/request`, payload, { qos: 1 }, (err) => {
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

console.log('Agent running. Press Ctrl+C to stop.');
