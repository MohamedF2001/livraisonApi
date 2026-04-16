import express from 'express';
import {
  getPointsIllico,
  togglePointActivation,
  getColisByPoint,
  receiveColis,
  retrieveColis,
  getPointStats
} from '../controllers/pointIllicoController.js';
import { verifyToken, verifyPointIllico, verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 👨‍💼 Admin
router.get('/', verifyToken, verifyAdmin, getPointsIllico);
router.put('/:id/activation', verifyToken, verifyAdmin, togglePointActivation);

// 🏪 Point ILLICO
router.get('/mes-colis', verifyToken, verifyPointIllico, getColisByPoint);
router.post('/colis/reception', verifyToken, verifyPointIllico, receiveColis);
router.post('/colis/:id/retrait', verifyToken, verifyPointIllico, retrieveColis);
router.get('/stats', verifyToken, verifyPointIllico, getPointStats);

export default router;