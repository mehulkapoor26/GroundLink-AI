import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { HOST, PORT } from './config/constants.js';
import api from './routes/index.js';
import { configureSockets } from './sockets/index.js';
import { configureVoiceSockets } from './sockets/voice.js';
import { identifyUser } from './middleware/auth.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { maxHttpBufferSize: 2 * 1024 * 1024 });
app.set('io', io);
app.use(express.json({ limit: '32kb' }));
app.use(identifyUser);
app.use('/api', api);
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Internal server error' }); });
configureSockets(io);
configureVoiceSockets(io);

const dist = resolve('backend/dist');
app.use(express.static(dist));
app.get('*', (_req, res, next) => res.sendFile(resolve(dist, 'index.html'), error => error && next()));

httpServer.listen(PORT, HOST, () => console.log(`GroundLink AI listening on http://${HOST}:${PORT}`));
