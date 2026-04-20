require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Store connected agents: agentToken -> socket
const agents = {};
io.on('connection', (socket) => {
  const token = socket.handshake.auth.agentToken;
  if (!token) { socket.disconnect(); return; }
  agents[token] = socket;
  console.log(`Agent connected: ${token}`);
  socket.on('disconnect', () => { delete agents[token]; console.log(`Agent disconnected: ${token}`); });
});

// Expose agents map to routes
app.set('agents', agents);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/parts', require('./routes/parts'));
app.use('/api/gcodes', require('./routes/gcodes'));
app.use('/api/printers', require('./routes/printers'));
const printlogsRouter = require('./routes/printlogs');
app.use('/api/printlogs', printlogsRouter);
app.use('/api/stl', require('./routes/stl'));
app.use('/api/inventory', require('./routes/inventory'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
      printlogsRouter.initMonitors();
    });
  })
  .catch(err => console.error(err));
