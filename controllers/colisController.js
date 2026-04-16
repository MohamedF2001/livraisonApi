import Colis from '../models/colis.js';
import Livraison from '../models/livraison.js';
import User from '../models/user.js';
import { authenticator } from '@otplib/preset-default';
// 📦 Liste colis (Admin ou Point ILLICO)
export const getColis = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'PointIllico') {
      filter.pointIllico = req.user._id;
    }
    
    const { statut, reference } = req.query;
    if (statut) filter.statut = statut;
    if (reference) filter.reference = reference;
    
    const colis = await Colis.find(filter)
      .populate('livraison', 'client pointDepart pointArrivee prixEstime statut')
      .populate('pointIllico', 'nom adresse telephone')
      .sort({ dateDepot: -1 });
    
    console.log(`📦 ${colis.length} colis récupérés`);
    
    res.json({
      success: true,
      message: 'Colis récupérés.',
      data: colis
    });
  } catch (error) {
    console.error('❌ Erreur récupération colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail colis
export const getColisById = async (req, res) => {
  try {
    const colis = await Colis.findById(req.params.id)
      .populate('livraison')
      .populate('pointIllico', 'nom adresse telephone');
    
    if (!colis) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé.' 
      });
    }
    
    // Permissions
    if (req.user.role === 'PointIllico' && colis.pointIllico._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    if (req.user.role === 'Client') {
      const livraison = await Livraison.findById(colis.livraison);
      if (livraison.client.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Non autorisé.' 
        });
      }
    }
    
    // Calcul frais stockage à la volée
    let fraisStockageActuel = colis.fraisStockage;
    if (colis.statut === 'receptionné' && new Date() > colis.dateLimiteGratuite) {
      const joursRetard = Math.ceil((new Date() - colis.dateLimiteGratuite) / (1000 * 60 * 60 * 24));
      const tarifJour = parseInt(process.env.STOCKAGE_TARIF_JOUR) || 200;
      fraisStockageActuel = joursRetard * tarifJour;
    }
    
    res.json({
      success: true,
      message: 'Colis récupéré.',
      data: { ...colis.toObject(), fraisStockageActuel }
    });
  } catch (error) {
    console.error('❌ Erreur détail colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔄 Mise à jour statut colis
export const updateColisStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const colis = await Colis.findById(req.params.id);
    
    if (!colis) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé.' 
      });
    }
    
    if (req.user.role === 'PointIllico' && colis.pointIllico.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    const validTransitions = {
      'en_attente': ['receptionné', 'retourné'],
      'receptionné': ['retiré', 'retourné'],
      'retiré': [],
      'retourné': []
    };
    
    if (!validTransitions[colis.statut]?.includes(statut)) {
      return res.status(400).json({ 
        success: false, 
        message: `Transition invalide: ${colis.statut} → ${statut}` 
      });
    }
    
    colis.statut = statut;
    if (statut === 'retiré') {
      colis.dateRetrait = new Date();
    }
    await colis.save();
    
    // Mettre à jour livraison associée
    if (['retiré', 'retourné'].includes(statut)) {
      await Livraison.findByIdAndUpdate(colis.livraison, { 
        statut: statut === 'retiré' ? 'livré' : 'échoué',
        dateLivraison: new Date()
      });
    }
    
    console.log(`📦 Statut colis ${colis.reference} mis à jour: ${statut}`);
    
    res.json({
      success: true,
      message: 'Statut mis à jour.',
      data: { statut: colis.statut }
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔁 Générer nouvel OTP pour retrait
export const regenerateOTP = async (req, res) => {
  try {
    const colis = await Colis.findById(req.params.id);
    
    if (!colis || colis.statut !== 'receptionné') {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP ne peut être régénéré que pour un colis réceptionné.' 
      });
    }
    
    if (req.user.role === 'PointIllico' && colis.pointIllico.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    colis.otpRetrait = authenticator.generate(process.env.OTP_SECRET + colis._id + Date.now());
    await colis.save();
    
    // Notification client avec nouvel OTP
    const livraison = await Livraison.findById(colis.livraison);
    await Notification.create({
      destinataire: livraison.client,
      type: 'alerte',
      message: `Nouvel OTP pour retrait colis ${colis.reference}: ${colis.otpRetrait.slice(0,3)}***`
    });
    
    console.log(`🔐 Nouvel OTP généré pour colis ${colis.reference}`);
    
    res.json({
      success: true,
      message: 'Nouvel OTP généré et envoyé au client.',
      data: { otpPreview: colis.otpRetrait.slice(0,3) + '***' }
    });
  } catch (error) {
    console.error('❌ Erreur régénération OTP:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Alertes colis (48h et 7 jours)
export const getColisAlertes = async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'PointIllico') {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    const now = new Date();
    const limite48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const limite7j = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let filter = { 
      pointIllico: req.user.role === 'PointIllico' ? req.user._id : { $exists: true },
      statut: 'receptionné'
    };
    
    const alertes = await Colis.find(filter)
      .populate('pointIllico', 'nom telephone')
      .populate('livraison', 'client')
      .lean();
    
    const result = {
      aRetirer48h: alertes.filter(c => new Date(c.dateLimiteGratuite) <= now && new Date(c.dateLimiteGratuite) > limite48h),
      aRetirer7j: alertes.filter(c => new Date(c.dateLimiteGratuite) <= limite48h && new Date(c.dateLimiteGratuite) > limite7j),
      enRetard: alertes.filter(c => new Date(c.dateLimiteGratuite) <= limite7j)
    };
    
    res.json({
      success: true,
      message: 'Alertes récupérées.',
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur alertes colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getColis,
  getColisById,
  updateColisStatut,
  regenerateOTP,
  getColisAlertes
};