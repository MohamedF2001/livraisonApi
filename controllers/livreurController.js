import User from '../models/user.js';
import Livraison from '../models/livraison.js';
import Transaction from '../models/transaction.js';
import Notification from '../models/notification.js';

// 📋 Liste des livreurs (Admin)
export const getLivreurs = async (req, res) => {
  try {
    const { statut, valide, vehicule } = req.query;
    
    let filter = { role: 'Livreur' };
    if (statut) filter.statut = statut;
    if (valide !== undefined) filter.valide = valide === 'true';
    if (vehicule) filter.vehicule = vehicule;
    
    const livreurs = await User.find(filter)
      .select('-motDePasse')
      .populate('vehicule')
      .sort({ createdAt: -1 });
    
    console.log(`🚴 ${livreurs.length} livreurs récupérés`);
    
    res.json({
      success: true,
      message: 'Liste des livreurs récupérée.',
      data: livreurs
    });
  } catch (error) {
    console.error('❌ Erreur récupération livreurs:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✅ Validation livreur par Admin
export const validateLivreur = async (req, res) => {
  try {
    const { valide } = req.body;
    const livreur = await User.findById(req.params.id);
    
    if (!livreur || livreur.role !== 'Livreur') {
      return res.status(404).json({ 
        success: false, 
        message: 'Livreur non trouvé.' 
      });
    }
    
    livreur.valide = valide;
    await livreur.save();
    
    await Notification.create({
      destinataire: livreur._id,
      type: 'info',
      message: valide ? '✅ Votre compte livreur a été validé par l\'administrateur.' : '❌ Votre compte livreur a été suspendu.',
      lien: '/profile'
    });
    
    console.log(`✅ Livreur ${livreur.nom} ${valide ? 'validé' : 'suspendu'}`);
    
    res.json({
      success: true,
      message: `Livreur ${valide ? 'validé' : 'suspendu'} avec succès.`,
      data: { id: livreur._id, nom: livreur.nom, valide: livreur.valide }
    });
  } catch (error) {
    console.error('❌ Erreur validation livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔄 Mise à jour statut livreur (en_ligne/hors_ligne)
export const updateLivreurStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    
    if (!['en_ligne', 'hors_ligne'].includes(statut)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Statut invalide.' 
      });
    }
    
    // Ne peut pas passer en ligne si cashCollecte - cashReverse > seuil
    if (statut === 'en_ligne') {
      const seuil = parseInt(process.env.CASH_BLOCAGE_SEUIL) || 50000;
      if ((req.user.cashCollecte - req.user.cashReverse) > seuil) {
        return res.status(400).json({ 
          success: false, 
          message: 'Compte bloqué: Veuillez reverser votre cash collecté avant de vous reconnecter.' 
        });
      }
    }
    
    req.user.statut = statut;
    await req.user.save();
    
    // Socket: broadcast position si en ligne
    if (global.io && statut === 'en_ligne') {
      global.io.to(`livreur_${req.user._id}`).emit('livreur:status', { statut });
    }
    
    console.log(`🚴 Statut livreur mis à jour: ${statut}`);
    
    res.json({
      success: true,
      message: 'Statut mis à jour.',
      data: { statut }
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📍 Mise à jour position GPS livreur
export const updateLivreurPosition = async (req, res) => {
  try {
    const { coordinates } = req.body; // [longitude, latitude]
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coordonnées GPS invalides.' 
      });
    }
    
    req.user.location = { type: 'Point', coordinates };
    await req.user.save();
    
    // Socket: broadcast position aux clients suivant ce livreur
    if (global.io) {
      const livraisonsActives = await Livraison.find({ 
        livreur: req.user._id, 
        statut: { $in: ['affecté', 'arrivé_pickup', 'colis_récupéré'] }
      });
      
      livraisonsActives.forEach(livraison => {
        global.io.to(`livraison_${livraison._id}`).emit('livreur:position', {
          coordinates,
          timestamp: new Date()
        });
      });
    }
    
    res.json({
      success: true,
      message: 'Position mise à jour.'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour position:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📋 Missions en cours du livreur
export const getLivreurMissions = async (req, res) => {
  try {
    const livraisons = await Livraison.find({ 
      livreur: req.user._id,
      statut: { $in: ['affecté', 'arrivé_pickup', 'colis_récupéré', 'déposé_en_point'] }
    })
    .populate('client', 'nom telephone adresse')
    .populate('pointArrivee')
    .populate('vehicule')
    .sort({ dateCreation: 1 });
    
    console.log(`📋 ${livraisons.length} missions actives`);
    
    res.json({
      success: true,
      message: 'Missions récupérées.',
      data: livraisons
    });
  } catch (error) {
    console.error('❌ Erreur récupération missions:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 💰 Reversement cash par Admin
export const reverseCash = async (req, res) => {
  try {
    const { montant } = req.body;
    const livreur = await User.findById(req.params.id);
    
    if (!livreur || livreur.role !== 'Livreur') {
      return res.status(404).json({ 
        success: false, 
        message: 'Livreur non trouvé.' 
      });
    }
    
    if (!montant || montant <= 0 || montant > livreur.cashCollecte - livreur.cashReverse) {
      return res.status(400).json({ 
        success: false, 
        message: 'Montant de reversement invalide.' 
      });
    }
    
    livreur.cashReverse += montant;
    await livreur.save();
    
    await Transaction.create({
      livreur: livreur._id,
      client: livreur._id,
      type: 'remboursement',
      montant,
      modePaiement: 'cash',
      statut: 'validé',
      description: `Reversement cash par admin`
    });
    
    console.log(`💰 Reversement de ${montant} FCFA pour ${livreur.nom}`);
    
    res.json({
      success: true,
      message: 'Reversement enregistré.',
      data: {
        cashCollecte: livreur.cashCollecte,
        cashReverse: livreur.cashReverse,
        solde: livreur.cashCollecte - livreur.cashReverse
      }
    });
  } catch (error) {
    console.error('❌ Erreur reversement cash:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Stats livreur (pour son dashboard)
export const getLivreurStats = async (req, res) => {
  try {
    const livraisons = await Livraison.find({ livreur: req.user._id });
    
    const stats = {
      totalLivraisons: livraisons.length,
      livraisonsLivrees: livraisons.filter(l => l.statut === 'livré').length,
      tauxReussite: 0,
      revenuTotal: 0,
      noteMoyenne: req.user.scoreNote
    };
    
    if (stats.totalLivraisons > 0) {
      stats.tauxReussite = Math.round((stats.livraisonsLivrees / stats.totalLivraisons) * 100);
    }
    
    // Calcul revenu (commissions)
    const transactions = await Transaction.find({ 
      livreur: req.user._id, 
      type: 'commission_livreur',
      statut: 'validé'
    });
    
    stats.revenuTotal = transactions.reduce((sum, t) => sum + t.montant, 0);
    
    res.json({
      success: true,
      message: 'Statistiques récupérées.',
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur stats livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getLivreurs,
  validateLivreur,
  updateLivreurStatut,
  updateLivreurPosition,
  getLivreurMissions,
  reverseCash,
  getLivreurStats
};