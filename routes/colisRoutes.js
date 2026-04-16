import express from 'express';
import {
  getColis,
  getColisById,
  updateColisStatut,
  regenerateOTP,
  getColisAlertes
} from '../controllers/colisController.js';
import { verifyToken, verifyPointIllico, verifyAdmin, verifyClient } from '../middlewares/auth.js';

const router = express.Router();

// 🔓 Public (recherche par référence)
router.get('/search', getColis);

// 👤 Client (ses colis)
router.get('/mes-colis', verifyToken, verifyClient, getColis);
router.get('/:id', verifyToken, getColisById);

// 🏪 Point ILLICO
router.get('/', verifyToken, verifyPointIllico, getColis);
router.get('/:id', verifyToken, verifyPointIllico, getColisById);
router.put('/:id/statut', verifyToken, verifyPointIllico, updateColisStatut);
router.post('/:id/regenerate-otp', verifyToken, verifyPointIllico, regenerateOTP);

// 👨‍💼 Admin
router.get('/admin', verifyToken, verifyAdmin, getColis);
router.get('/admin/alertes', verifyToken, verifyAdmin, getColisAlertes);
router.put('/:id/statut', verifyToken, verifyAdmin, updateColisStatut);

export default router;