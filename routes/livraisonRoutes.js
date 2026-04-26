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
import { verifyToken, verifyClient, verifyLivreur, verifyAdmin, verifyPointIllico, authorize } from '../middlewares/auth.js';
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

// ⚙️ Routes Communes (Filtrage géré dans le contrôleur)
router.get('/', verifyToken, authorize('Admin', 'Client', 'Livreur', 'PointIllico'), getLivraisons);
router.get('/disponibles', verifyToken, verifyLivreur, getAvailableLivraisons);
router.get('/mes-missions', verifyToken, verifyLivreur, getLivraisons);

// 📦 Gestion Livraison
router.post('/', verifyToken, verifyClient, createLivraison);
router.get('/:id', verifyToken, authorize('Admin', 'Client', 'Livreur', 'PointIllico'), getLivraison);
router.delete('/:id', verifyToken, verifyClient, deleteLivraison);

// 🚴 Actions Livreur
router.post('/:id/accepter', verifyToken, verifyLivreur, selfAssignLivraison);
router.post('/:id/preuve', verifyToken, verifyLivreur, upload.single('preuve'), uploadPreuve);

// 🔄 Mises à jour & Validation
router.put('/:id/statut', verifyToken, authorize('Admin', 'Livreur'), updateStatut);
router.post('/:id/valider-otp', verifyToken, authorize('Client', 'Livreur', 'PointIllico'), validateOTP);

// 👨‍💼 Administration
router.put('/:id/affecter', verifyToken, verifyAdmin, assignLivreur);

export default router;