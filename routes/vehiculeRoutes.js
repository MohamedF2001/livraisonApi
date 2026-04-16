import express from 'express';
import {
  getVehicules,
  getVehicule,
  createVehicule,
  updateVehicule,
  deleteVehicule,
  getVehiculeStats
} from '../controllers/vehiculeController.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 🔓 Routes publiques
router.get('/', getVehicules);
router.get('/:id', getVehicule);

// 🔐 Routes Admin uniquement
router.post('/', verifyToken, verifyAdmin, createVehicule);
router.put('/:id', verifyToken, verifyAdmin, updateVehicule);
router.delete('/:id', verifyToken, verifyAdmin, deleteVehicule);
router.get('/admin/stats', verifyToken, verifyAdmin, getVehiculeStats);

export default router;