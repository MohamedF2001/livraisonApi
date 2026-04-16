import express from 'express';
import {
  getForfaits,
  getForfait,
  createForfait,
  updateForfait,
  subscribeForfait,
  checkForfaitRemise
} from '../controllers/forfaitController.js';
import { verifyToken, verifyClient, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 🔓 Public
router.get('/', getForfaits);
router.get('/:id', getForfait);

// 👤 Client
router.post('/souscrire', verifyToken, verifyClient, subscribeForfait);
router.get('/check-remise', verifyToken, checkForfaitRemise);

// 👨‍💼 Admin
router.post('/', verifyToken, verifyAdmin, createForfait);
router.put('/:id', verifyToken, verifyAdmin, updateForfait);

export default router;