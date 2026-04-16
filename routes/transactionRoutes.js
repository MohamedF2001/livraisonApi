import express from 'express';
import {
  getTransactions,
  getTransaction,
  validateTransaction,
  getTransactionStats
} from '../controllers/transactionController.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 🔐 Authentifié (filtré par rôle)
router.get('/', verifyToken, getTransactions);
router.get('/:id', verifyToken, getTransaction);

// 👨‍💼 Admin
router.put('/:id/validate', verifyToken, verifyAdmin, validateTransaction);
router.get('/admin/stats', verifyToken, verifyAdmin, getTransactionStats);

export default router;