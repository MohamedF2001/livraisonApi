import express from 'express';
import {
  getZones,
  getZone,
  createZone,
  updateZone,
  deleteZone,
  getZoneStats
} from '../controllers/zoneController.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 🔓 Routes publiques
router.get('/', getZones);
router.get('/:id', getZone);

// 🔐 Routes Admin uniquement
router.post('/', verifyToken, verifyAdmin, createZone);
router.put('/:id', verifyToken, verifyAdmin, updateZone);
router.delete('/:id', verifyToken, verifyAdmin, deleteZone);
router.get('/admin/stats', verifyToken, verifyAdmin, getZoneStats);

export default router;