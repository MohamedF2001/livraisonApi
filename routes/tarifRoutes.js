import express from 'express';
import {
  getTarifs,
  getTarif,
  createTarif,
  updateTarif,
  deleteTarif,
  calculateTarif
} from '../controllers/tarifController.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 🔓 Public
router.get('/', getTarifs);
router.get('/:id', getTarif);
router.post('/calcul', calculateTarif);

// 👨‍💼 Admin
router.post('/', verifyToken, verifyAdmin, createTarif);
router.put('/:id', verifyToken, verifyAdmin, updateTarif);
router.delete('/:id', verifyToken, verifyAdmin, deleteTarif);

export default router;