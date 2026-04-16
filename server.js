import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
// ✅ Compatible Node 20.19+ & v24
import swaggerDocument from './swagger.json' with { type: 'json' };

import connectDB from './config/db.js';
import configureCloudinary from './config/cloudinary.js';

import authRoutes from './routes/authRoutes.js';
import livraisonRoutes from './routes/livraisonRoutes.js';
import livreurRoutes from './routes/livreurRoutes.js';
import pointIllicoRoutes from './routes/pointIllicoRoutes.js';
import colisRoutes from './routes/colisRoutes.js';
import tarifRoutes from './routes/tarifRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import forfaitRoutes from './routes/forfaitRoutes.js';
import vehiculeRoutes from './routes/vehiculeRoutes.js';
import zoneRoutes from './routes/zoneRoutes.js';

dotenv.config();
const app = express();
const httpServer = createServer(app);

// Socket.io global
export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
global.io = io;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/livraisons', livraisonRoutes);
app.use('/api/livreurs', livreurRoutes);
app.use('/api/points', pointIllicoRoutes);
app.use('/api/colis', colisRoutes);
app.use('/api/tarifs', tarifRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/forfaits', forfaitRoutes);
app.use('/api/vehicules', vehiculeRoutes);
app.use('/api/zones', zoneRoutes);


app.get('/', (req, res) => {
    res.send('Hello World Me')
});

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'API ILLICO DELIVERY opérationnelle 🚀' });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔌 Client connecté:', socket.id);
  
  socket.on('join', ({ role, userId }) => {
    socket.join(`${role}_${userId}`);
    console.log(`📡 ${role} ${userId} connecté au channel`);
  });
  
  socket.on('livreur:position', ({ livreurId, coordinates }) => {
    // Broadcast position aux clients suivant cette livraison
    socket.to(`livreur_${livreurId}`).emit('livreur:position:update', { coordinates });
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client déconnecté:', socket.id);
  });
});

// Démarrage
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    configureCloudinary();
    
    if (!process.env.VERCEL) {
      httpServer.listen(PORT, () => {
        console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
        console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
      });
    }
  } catch (error) {
    console.error('❌ Échec démarrage serveur:', error.message);
    process.exit(1);
  }
};

startServer();

// Vercel serverless export
export default async (req, res) => {
  await app(req, res);
};