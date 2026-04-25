import express from 'express';
import {
  estimatePrice,
  createLivraison,
  getLivraisons,
  getLivraison,
  getAvailableLivraisons,
  selfAssignLivraison,
  validateOTP,
  uploadPreuve,
  updateStatut,
  deleteLivraison,
  assignLivreur
} from '../controllers/livraisonController.js';
import { verifyToken, verifyClient, verifyLivreur, verifyAdmin, verifyPointIllico } from '../middlewares/auth.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  }
});

// 🔓 Public
router.post('/estimation-prix', estimatePrice);

// 👤 Client
router.post('/', verifyToken, verifyClient, createLivraison);
router.get('/', verifyToken, verifyClient, getLivraisons);
router.get('/:id', verifyToken, verifyClient, getLivraison);
router.post('/:id/valider-otp', verifyToken, verifyClient, validateOTP);
router.delete('/:id', verifyToken, verifyClient, deleteLivraison);

// 🚴 Livreur
router.get('/disponibles', verifyToken, verifyLivreur, getAvailableLivraisons);
router.post('/:id/accepter', verifyToken, verifyLivreur, selfAssignLivraison);
router.get('/mes-missions', verifyToken, verifyLivreur, getLivraisons);
router.put('/:id/statut', verifyToken, verifyLivreur, updateStatut);
router.post('/:id/valider-otp', verifyToken, verifyLivreur, validateOTP);
router.post('/:id/preuve', verifyToken, verifyLivreur, upload.single('preuve'), uploadPreuve);

// 🏪 Point ILLICO
router.post('/:id/valider-otp', verifyToken, verifyPointIllico, validateOTP);

// 👨‍💼 Admin
router.get('/', verifyToken, verifyAdmin, getLivraisons);
router.get('/:id', verifyToken, verifyAdmin, getLivraison);
router.put('/:id/affecter', verifyToken, verifyAdmin, assignLivreur);
router.put('/:id/statut', verifyToken, verifyAdmin, updateStatut);

export default router;