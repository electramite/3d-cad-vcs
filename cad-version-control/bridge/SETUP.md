# Raspberry Pi Bridge Setup

This runs on a Raspberry Pi (Ubuntu) on the same WiFi as your Bambu printer.
It connects to the cloud portal and handles all local printer communication.

## Requirements
- Raspberry Pi 3B+ or newer
- Ubuntu 22.04 LTS (or Raspberry Pi OS 64-bit)
- Node.js 18+
- Same WiFi network as the Bambu printer

## 1. Install Node.js on the Pi

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should show v18.x
```

## 2. Copy bridge files to the Pi

From your dev machine:
```bash
scp -r cad-version-control/bridge ubuntu@<PI_IP>:~/cad-bridge
```

Or clone your repo on the Pi and navigate to the bridge folder.

## 3. Configure

```bash
cd ~/cad-bridge
cp .env.example .env
nano .env
```

Set:
- `SERVER_URL` — your Render backend URL e.g. `https://cad-vc.onrender.com`
- `AGENT_TOKEN` — any long random string e.g. `pi-bridge-secret-abc123xyz`

## 4. Install dependencies and test

```bash
npm install
node bridge.js
```

You should see:
```
[Bridge] Starting CAD VC Bridge...
[Bridge] Connecting to: https://cad-vc.onrender.com
[Bridge] ✓ Connected to cloud portal (id: xxxx)
[Bridge] Ready. Waiting for jobs from cloud portal...
```

## 5. Run as a system service (auto-start on boot)

```bash
sudo nano /etc/systemd/system/cad-bridge.service
```

Paste:
```ini
[Unit]
Description=CAD VC Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/cad-bridge
ExecStart=/usr/bin/node bridge.js
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/cad-bridge/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cad-bridge
sudo systemctl start cad-bridge
sudo systemctl status cad-bridge
```

View logs:
```bash
journalctl -u cad-bridge -f
```

## 6. Add the bridge token in the portal

In the portal → Printers → Add Printer (or Edit existing):
- Fill in printer IP, serial, access code as usual
- In the **Agent Token** field, paste the same `AGENT_TOKEN` from your `.env`

The portal will now route all printer commands through the Pi bridge instead of trying to reach the printer directly.

## Network diagram

```
Browser (anywhere in the world)
        ↓ HTTPS
Render (cloud backend)
        ↓ WebSocket (persistent, outbound from Pi)
Raspberry Pi Bridge (your workshop)
        ↓ FTPS port 990 + MQTT port 8883 (local network)
Bambu Lab Printer
```

The Pi only makes outbound connections — no port forwarding needed on your router.
