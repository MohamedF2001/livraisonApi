import jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import User from '../models/user.js';
import { cloudinary } from '../config/cloudinary.js';

// Générer token JWT
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// 📤 Envoi OTP (simulation - à remplacer par SMS provider)
const sendOTP = async (telephone, otp) => {
  console.log(`📱 OTP pour ${telephone}: ${otp}`);
  // TODO: Intégrer Twilio/Infobip pour envoi SMS réel
  return true;
};

// 🔐 ADMIN - Inscription
export const adminRegister = async (req, res) => {
  try {
    const { nom, email, motDePasse, telephone } = req.body;
    
    if (!nom || !email || !motDePasse || !telephone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis.' 
      });
    }
    
    if (motDePasse.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères.' 
      });
    }
    
    const existingAdmin = await User.findOne({ email, role: 'Admin' });
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet email est déjà utilisé par un administrateur.' 
      });
    }
    
    const admin = new User({
      nom,
      email,
      motDePasse,
      telephone,
      role: 'Admin'
    });
    
    await admin.save();
    console.log('✅ Admin créé:', admin.nom);
    
    res.status(201).json({
      success: true,
      message: 'Administrateur créé avec succès.',
      data: {
        id: admin._id,
        nom: admin.nom,
        email: admin.email,
        telephone: admin.telephone,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur création admin:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la création.' 
    });
  }
};

// 🔐 ADMIN - Connexion
export const adminLogin = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    
    if (!email || !motDePasse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email et mot de passe requis.' 
      });
    }
    
    const admin = await User.findOne({ email, role: 'Admin' }).select('+motDePasse');
    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const isMatch = await admin.comparePassword(motDePasse);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const token = generateToken(admin._id, admin.role);
    console.log('✅ Admin connecté:', admin.nom);
    
    res.json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        token,
        user: {
          id: admin._id,
          nom: admin.nom,
          email: admin.email,
          telephone: admin.telephone,
          role: admin.role
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur connexion admin:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la connexion.' 
    });
  }
};

// 👤 CLIENT - Inscription avec OTP
/* export const clientRegister = async (req, res) => {
  try {
    const { telephone, codePin, nom, adresse, typeClient } = req.body;
    const { action, otp } = req.query;

    console.log('📥 BODY REÇU:', req.body);
    console.log('📥 QUERY REÇU:', req.query);
    
    // Étape 1: Demande d'inscription → envoi OTP
    if (action === 'init') {
      if (!telephone) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le numéro de téléphone est requis.' 
        });
      }
      
      const existingClient = await User.findOne({ telephone, role: 'Client' });
      if (existingClient) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ce numéro est déjà enregistré.' 
        });
      }
      
      const generatedOTP = authenticator.generate(process.env.OTP_SECRET + telephone);
      const sent = await sendOTP(telephone, generatedOTP);
      
      if (!sent) {
        return res.status(500).json({ 
          success: false, 
          message: 'Échec envoi OTP.' 
        });
      }
      
      // Stockage temporaire OTP (en prod: utiliser Redis)
      console.log(`🔐 OTP temporaire pour ${telephone}: ${generatedOTP}`);
      
      return res.json({
        success: true,
        message: 'OTP envoyé. Veuillez le saisir pour finaliser.',
        data: { telephone, otpExpires: Date.now() + 5 * 60 * 1000 }
      });
    }
    
    // Étape 2: Validation OTP + création compte
    if (!telephone || !codePin || !nom || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis.' 
      });
    }
    
    if (!/^\d{4,6}$/.test(codePin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le code PIN doit contenir 4 à 6 chiffres.' 
      });
    }
    
    const expectedOTP = authenticator.generate(process.env.OTP_SECRET + telephone);
    if (otp !== expectedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP invalide ou expiré.' 
      });
    }
    
    const client = new User({
      nom,
      telephone,
      codePin,
      adresse,
      typeClient: typeClient || 'standard',
      role: 'Client'
    });
    
    await client.save();
    console.log('✅ Client créé:', client.nom);
    
    res.status(201).json({
      success: true,
      message: 'Compte client créé avec succès.',
      data: {
        id: client._id,
        nom: client.nom,
        telephone: client.telephone,
        role: client.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur inscription client:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'inscription.' 
    });
  }
}; */

export const clientRegister = async (req, res) => {
  try {
    const { telephone, codePin, nom, adresse, typeClient, otp } = req.body;
    const { action } = req.query;
    
    // DEBUG : Afficher ce qu'on reçoit
    console.log('📥 BODY REÇU:', req.body);
    console.log('📥 QUERY REÇU:', req.query);
    console.log('🔍 action value:', action, '=== init ?', action === 'init');
    
    // ÉTAPE 1: Demande d'OTP (quand action === 'init')
    if (action === 'init') {
      console.log('➡️ Entrée dans la logique action=init');
      
      if (!telephone) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le numéro de téléphone est requis.' 
        });
      }
      
      const existingClient = await User.findOne({ telephone, role: 'Client' });
      if (existingClient) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ce numéro est déjà enregistré.' 
        });
      }
      
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`📱 OTP pour ${telephone}: ${generatedOTP}`);
      console.log(`🔒 OTP temporaire pour ${telephone}: ${generatedOTP}`);
      
      global.otpStore = global.otpStore || {};
      global.otpStore[telephone] = {
        otp: generatedOTP,
        expires: Date.now() + 5 * 60 * 1000
      };
      
      return res.json({
        success: true,
        message: 'OTP envoyé. Veuillez le saisir pour finaliser.',
        data: { telephone, otpExpires: global.otpStore[telephone].expires }
      });
    }
    
    // ÉTAPE 2: Finalisation (quand action !== 'init' ou absent)
    console.log('➡️ Entrée dans la logique étape 2 (finalisation)');
    console.log('🔍 Vérification champs: telephone=', telephone, 'codePin=', codePin, 'nom=', nom, 'otp=', otp);
    
    // Vérification stricte des champs requis
    if (!telephone || !codePin || !nom || !otp) {
      console.log('❌ Champs manquants détectés !');
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis.' 
      });
    }
    
    // Validation format
    if (!/^\d{4,6}$/.test(codePin)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le code PIN doit contenir 4 à 6 chiffres.' 
      });
    }
    
    // Vérifier OTP stocké
    const storedOTP = global.otpStore?.[telephone];
    console.log('🔍 OTP stocké trouvé:', storedOTP ? 'OUI' : 'NON');
    
    if (!storedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucune demande d\'inscription trouvée. Demandez d\'abord un OTP (action=init).' 
      });
    }
    
    if (Date.now() > storedOTP.expires) {
      delete global.otpStore[telephone];
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expiré. Demandez un nouvel OTP.' 
      });
    }
    
    if (otp !== storedOTP.otp) {
      console.log(`❌ OTP invalide: reçu=${otp}, attendu=${storedOTP.otp}`);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP invalide.' 
      });
    }
    
    // Créer le client
    console.log('✅ Tous les checks passés, création du client...');
    const client = new User({
      nom,
      telephone,
      codePin,
      adresse,
      typeClient: typeClient || 'standard',
      role: 'Client'
    });
    
    await client.save();
    delete global.otpStore[telephone];
    
    console.log(`✅ Client créé: ${nom} (${telephone})`);
    
    res.status(201).json({
      success: true,
      message: 'Compte client créé avec succès.',
      data: {
        id: client._id,
        nom: client.nom,
        telephone: client.telephone,
        role: client.role
      }
    });
  } catch (error) {
    console.error('❌ Erreur inscription client:', error.message);
    console.error('📍 Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'inscription.' 
    });
  }
};

// 👤 CLIENT - Connexion
export const clientLogin = async (req, res) => {
  try {
    const { telephone, codePin } = req.body;
    
    if (!telephone || !codePin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Téléphone et code PIN requis.' 
      });
    }
    
    const client = await User.findOne({ telephone, role: 'Client' }).select('+codePin');
    if (!client) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const isMatch = await client.compareCodePin(codePin);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const token = generateToken(client._id, client.role);
    console.log('✅ Client connecté:', client.nom);
    
    res.json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        token,
        user: {
          id: client._id,
          nom: client.nom,
          telephone: client.telephone,
          adresse: client.adresse,
          typeClient: client.typeClient,
          soldeIllico: client.soldeIllico,
          role: client.role
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur connexion client:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la connexion.' 
    });
  }
};

// 🚴 LIVREUR - Inscription
export const livreurRegister = async (req, res) => {
  try {
    const { nom, telephone, motDePasse, vehicule } = req.body;
    
    if (!nom || !telephone || !motDePasse || !vehicule) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis.' 
      });
    }
    
    if (motDePasse.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères.' 
      });
    }
    
    const existingLivreur = await User.findOne({ telephone, role: 'Livreur' });
    if (existingLivreur) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce numéro est déjà utilisé par un livreur.' 
      });
    }
    
    const livreur = new User({
      nom,
      telephone,
      motDePasse,
      vehicule,
      role: 'Livreur',
      valide: false // En attente validation admin
    });
    
    await livreur.save();
    console.log('📤 Livreur inscrit (en attente):', livreur.nom);
    
    res.status(201).json({
      success: true,
      message: 'Inscription réussie. En attente de validation par l\'administrateur.',
      data: {
        id: livreur._id,
        nom: livreur.nom,
        telephone: livreur.telephone,
        role: livreur.role,
        valide: livreur.valide
      }
    });
  } catch (error) {
    console.error('❌ Erreur inscription livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'inscription.' 
    });
  }
};

// 🚴 LIVREUR - Connexion
export const livreurLogin = async (req, res) => {
  try {
    const { telephone, motDePasse } = req.body;
    
    if (!telephone || !motDePasse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Téléphone et mot de passe requis.' 
      });
    }
    
    const livreur = await User.findOne({ telephone, role: 'Livreur' }).select('+motDePasse');
    if (!livreur) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    if (!livreur.valide) {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte en attente de validation par l\'administrateur.' 
      });
    }
    
    const isMatch = await livreur.comparePassword(motDePasse);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const token = generateToken(livreur._id, livreur.role);
    console.log('✅ Livreur connecté:', livreur.nom);
    
    res.json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        token,
        user: {
          id: livreur._id,
          nom: livreur.nom,
          telephone: livreur.telephone,
          vehicule: livreur.vehicule,
          statut: livreur.statut,
          scoreNote: livreur.scoreNote,
          role: livreur.role
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur connexion livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la connexion.' 
    });
  }
};

// 🏪 POINT ILLICO - Inscription
export const pointIllicoRegister = async (req, res) => {
  try {
    const { nom, telephone, motDePasse, adresse } = req.body;
    
    if (!nom || !telephone || !motDePasse || !adresse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis.' 
      });
    }
    
    if (motDePasse.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères.' 
      });
    }
    
    const existingPoint = await User.findOne({ telephone, role: 'PointIllico' });
    if (existingPoint) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce numéro est déjà utilisé par un point ILLICO.' 
      });
    }
    
    const point = new User({
      nom,
      telephone,
      motDePasse,
      adresse,
      role: 'PointIllico',
      actif: false // En attente activation admin
    });
    
    await point.save();
    console.log('📤 Point ILLICO inscrit (en attente):', point.nom);
    
    res.status(201).json({
      success: true,
      message: 'Inscription réussie. En attente d\'activation par l\'administrateur.',
      data: {
        id: point._id,
        nom: point.nom,
        telephone: point.telephone,
        role: point.role,
        actif: point.actif
      }
    });
  } catch (error) {
    console.error('❌ Erreur inscription point ILLICO:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'inscription.' 
    });
  }
};

// 🏪 POINT ILLICO - Connexion
export const pointIllicoLogin = async (req, res) => {
  try {
    const { telephone, motDePasse } = req.body;
    
    if (!telephone || !motDePasse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Téléphone et mot de passe requis.' 
      });
    }
    
    const point = await User.findOne({ telephone, role: 'PointIllico' }).select('+motDePasse');
    if (!point) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    if (!point.actif) {
      return res.status(403).json({ 
        success: false, 
        message: 'Point ILLICO désactivé. Contactez l\'administrateur.' 
      });
    }
    
    const isMatch = await point.comparePassword(motDePasse);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants invalides.' 
      });
    }
    
    const token = generateToken(point._id, point.role);
    console.log('✅ Point ILLICO connecté:', point.nom);
    
    res.json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        token,
        user: {
          id: point._id,
          nom: point.nom,
          telephone: point.telephone,
          adresse: point.adresse,
          commissionTotal: point.commissionTotal,
          role: point.role
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur connexion point ILLICO:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la connexion.' 
    });
  }
};

// 👤 Profil utilisateur (tous rôles)
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-motDePasse -codePin')
      .populate('vehicule')
      .populate('forfaitActif');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé.' 
      });
    }
    
    console.log('📋 Profil récupéré:', user.nom);
    
    res.json({
      success: true,
      message: 'Profil récupéré.',
      data: user
    });
  } catch (error) {
    console.error('❌ Erreur récupération profil:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération du profil.' 
    });
  }
};

// 🖼️ Upload photo de profil (livreur)
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun fichier envoyé.' 
      });
    }
    
    // Supprimer ancienne photo si existe
    if (req.user.photoProfil) {
      const publicId = req.user.photoProfil.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`illico/profiles/${publicId}`);
      console.log('🗑️ Ancienne photo supprimée');
    }
    
    // Upload vers Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'illico/profiles', public_id: `livreur_${req.user._id}` },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(req.file.buffer);
    });
    
    req.user.photoProfil = result.secure_url;
    await req.user.save();
    
    console.log('✅ Photo de profil uploadée');
    
    res.json({
      success: true,
      message: 'Photo de profil mise à jour.',
      data: { photoProfil: result.secure_url }
    });
  } catch (error) {
    console.error('❌ Erreur upload photo:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'upload.' 
    });
  }
};

export default {
  adminRegister,
  adminLogin,
  clientRegister,
  clientLogin,
  livreurRegister,
  livreurLogin,
  pointIllicoRegister,
  pointIllicoLogin,
  getProfile,
  uploadProfilePhoto
};