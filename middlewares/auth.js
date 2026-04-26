import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Vérification token JWT
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('❌ Token manquant');
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token requis.' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+motDePasse +codePin');
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé.' 
      });
    }
    
    req.user = user;
    req.tokenPayload = decoded;
    console.log('✅ Token vérifié pour:', user.nom, `(${user.role})`);
    next();
  } catch (error) {
    console.error('❌ Erreur vérification token:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Token invalide ou expiré.' 
    });
  }
};

// Vérification rôle Admin
export const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    console.log('❌ Accès Admin refusé pour:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux administrateurs.' 
    });
  }
  console.log('✅ Accès Admin autorisé');
  next();
};

// Vérification rôle Client
export const verifyClient = (req, res, next) => {
  if (req.user?.role !== 'Client') {
    console.log('❌ Accès Client refusé pour:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux clients.' 
    });
  }
  console.log('✅ Accès Client autorisé');
  next();
};

// Vérification rôle Livreur
export const verifyLivreur = (req, res, next) => {
  if (req.user?.role !== 'Livreur') {
    console.log('❌ Accès Livreur refusé pour:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux livreurs.' 
    });
  }
  if (!req.user.valide) {
    console.log('❌ Livreur non validé:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Compte livreur en attente de validation.' 
    });
  }
  console.log('✅ Accès Livreur autorisé');
  next();
};

// Vérification rôle PointIllico
/* export const verifyPointIllico = (req, res, next) => {
  if (req.user?.role !== 'PointIllico') {
    console.log('❌ Accès Point ILLICO refusé pour:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux points ILLICO.' 
    });
  }
  if (!req.user.actif) {
    console.log('❌ Point ILLICO inactif:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Point ILLICO désactivé.' 
    });
  }
  console.log('✅ Accès Point ILLICO autorisé');
  next();
}; */

export const verifyPointIllico = (req, res, next) => {
  const allowedRoles = ['PointIllico', 'Admin'];

  if (!allowedRoles.includes(req.user?.role)) {
    console.log('❌ Accès refusé pour:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux points ILLICO ou Admin.' 
    });
  }

  if (!req.user.actif) {
    console.log('❌ Compte inactif:', req.user?.nom);
    return res.status(403).json({ 
      success: false, 
      message: 'Compte désactivé.' 
    });
  }

  console.log('✅ Accès Point ILLICO autorisé');
  next();
};

// Vérification de plusieurs rôles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié.' });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`❌ Accès refusé pour ${req.user.nom} (${req.user.role}). Rôles requis: ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé.'
      });
    }

    // Vérifications additionnelles selon le rôle
    if (req.user.role === 'Livreur' && !req.user.valide) {
      return res.status(403).json({ success: false, message: 'Compte livreur en attente de validation.' });
    }

    if (req.user.role === 'PointIllico' && !req.user.actif) {
      return res.status(403).json({ success: false, message: 'Compte Point Illico inactif.' });
    }

    next();
  };
};

export default { verifyToken, verifyAdmin, verifyClient, verifyLivreur, verifyPointIllico, authorize };