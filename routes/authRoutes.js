import express from 'express';
import { 
  adminRegister, adminLogin,
  clientRegister, clientLogin,
  livreurRegister, livreurLogin,
  pointIllicoRegister, pointIllicoLogin,
  getProfile, updateProfile, uploadProfilePhoto
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/auth.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Admin
router.post('/admin/register', adminRegister);
router.post('/admin/login', adminLogin);

// Client
router.post('/client/register', clientRegister);
router.post('/client/login', clientLogin);

// Livreur
router.post('/livreur/register', livreurRegister);
router.post('/livreur/login', livreurLogin);

// Point ILLICO
router.post('/point/register', pointIllicoRegister);
router.post('/point/login', pointIllicoLogin);

// Profil (tous rôles)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);

// Upload photo profil (tous rôles)
router.post('/profile/photo', verifyToken, upload.single('photo'), uploadProfilePhoto);

export default router;