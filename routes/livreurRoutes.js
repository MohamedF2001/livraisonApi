import express from 'express';
import {
  getLivreurs,
  validateLivreur,
  updateLivreurStatut,
  updateLivreurPosition,
  getLivreurMissions,
  reverseCash,
  getLivreurStats
} from '../controllers/livreurController.js';
import { verifyToken, verifyLivreur, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 👨‍💼 Admin
router.get('/', verifyToken, verifyAdmin, getLivreurs);
router.put('/:id/valider', verifyToken, verifyAdmin, validateLivreur);
router.put('/:id/reverse-cash', verifyToken, verifyAdmin, reverseCash);

// 🚴 Livreur
router.put('/statut', verifyToken, verifyLivreur, updateLivreurStatut);
router.post('/position', verifyToken, verifyLivreur, updateLivreurPosition);
router.get('/missions', verifyToken, verifyLivreur, getLivreurMissions);
router.get('/stats', verifyToken, verifyLivreur, getLivreurStats);

export default router;