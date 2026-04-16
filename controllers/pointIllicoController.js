import User from '../models/user.js';
import Colis from '../models/colis.js';
import Notification from '../models/notification.js';

// 📋 Liste des points ILLICO (Admin)
export const getPointsIllico = async (req, res) => {
  try {
    const { actif } = req.query;
    
    let filter = { role: 'PointIllico' };
    if (actif !== undefined) filter.actif = actif === 'true';
    
    const points = await User.find(filter)
      .select('-motDePasse')
      .sort({ nom: 1 });
    
    console.log(`🏪 ${points.length} points ILLICO récupérés`);
    
    res.json({
      success: true,
      message: 'Points ILLICO récupérés.',
      data: points
    });
  } catch (error) {
    console.error('❌ Erreur récupération points ILLICO:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✅ Activation/Désactivation point par Admin
export const togglePointActivation = async (req, res) => {
  try {
    const { actif } = req.body;
    const point = await User.findById(req.params.id);
    
    if (!point || point.role !== 'PointIllico') {
      return res.status(404).json({ 
        success: false, 
        message: 'Point ILLICO non trouvé.' 
      });
    }
    
    point.actif = actif;
    await point.save();
    
    await Notification.create({
      destinataire: point._id,
      type: 'info',
      message: actif ? '✅ Votre point ILLICO a été activé.' : '⚠️ Votre point ILLICO a été désactivé.',
      lien: '/profile'
    });
    
    console.log(`🏪 Point ${point.nom} ${actif ? 'activé' : 'désactivé'}`);
    
    res.json({
      success: true,
      message: `Point ILLICO ${actif ? 'activé' : 'désactivé'} avec succès.`,
      data: { id: point._id, nom: point.nom, actif: point.actif }
    });
  } catch (error) {
    console.error('❌ Erreur activation point:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📦 Liste des colis pour un point ILLICO
export const getColisByPoint = async (req, res) => {
  try {
    const { statut } = req.query;
    
    let filter = { pointIllico: req.user._id };
    if (statut) filter.statut = statut;
    
    const colis = await Colis.find(filter)
      .populate('livraison', 'client pointDepart pointArrivee prixEstime')
      .sort({ dateDepot: -1 });
    
    console.log(`📦 ${colis.length} colis récupérés pour ${req.user.nom}`);
    
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

// 📥 Réception d'un colis en point ILLICO
export const receiveColis = async (req, res) => {
  try {
    const { livraisonId, otpRetrait } = req.body;
    
    const livraison = await Livraison.findById(livraisonId);
    if (!livraison || livraison.mode !== 'point_illico') {
      return res.status(400).json({ 
        success: false, 
        message: 'Livraison invalide pour dépôt en point.' 
      });
    }
    
    if (livraison.statut !== 'colis_récupéré') {
      return res.status(400).json({ 
        success: false, 
        message: 'La livraison doit être marquée comme récupérée avant dépôt.' 
      });
    }
    
    // Vérifier OTP
    if (otpRetrait !== livraison.otpRetrait) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP de retrait invalide.' 
      });
    }
    
    // Créer le colis
    const colis = new Colis({
      livraison: livraisonId,
      pointIllico: req.user._id,
      otpRetrait: authenticator.generate(process.env.OTP_SECRET + livraisonId + Date.now()),
      dateDepot: new Date(),
      dateLimiteGratuite: new Date(Date.now() + 48 * 60 * 60 * 1000) // +48h
    });
    
    await colis.save();
    
    // Mettre à jour statut livraison
    livraison.statut = 'déposé_en_point';
    await livraison.save();
    
    // Notification client
    await Notification.create({
      destinataire: livraison.client,
      type: 'livraison',
      message: `Votre colis #${colis.reference} est disponible au point ILLICO ${req.user.nom}. OTP: ${colis.otpRetrait.slice(0,3)}***`,
      lien: `/colis/${colis._id}`
    });
    
    // Commission point ILLICO
    const tarif = await Tarif.findById(livraison.vehicule);
    if (tarif?.remisePointIllico > 0) {
      const commission = livraison.prixEstime * (tarif.remisePointIllico / 100);
      req.user.commissionTotal += commission;
      await req.user.save();
      
      await Transaction.create({
        livraison: livraisonId,
        client: livraison.client,
        type: 'commission_point',
        montant: Math.round(commission),
        statut: 'validé',
        description: `Commission point pour livraison #${livraisonId.toString().slice(-6)}`
      });
    }
    
    console.log(`📥 Colis ${colis.reference} reçu au point ${req.user.nom}`);
    
    res.status(201).json({
      success: true,
      message: 'Colis réceptionné avec succès.',
      data: await colis.populate('livraison', 'client')
    });
  } catch (error) {
    console.error('❌ Erreur réception colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📤 Retrait d'un colis par le client
export const retrieveColis = async (req, res) => {
  try {
    const { otpRetrait, signatureUrl } = req.body;
    const colis = await Colis.findById(req.params.id).select('+otpRetrait');
    
    if (!colis) {
      return res.status(404).json({ 
        success: false, 
        message: 'Colis non trouvé.' 
      });
    }
    
    if (colis.pointIllico.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    if (colis.statut !== 'receptionné') {
      return res.status(400).json({ 
        success: false, 
        message: 'Colis non prêt pour retrait.' 
      });
    }
    
    if (otpRetrait !== colis.otpRetrait) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP de retrait invalide.' 
      });
    }
    
    // Calcul frais de stockage si retard
    let fraisStockage = 0;
    const now = new Date();
    if (now > colis.dateLimiteGratuite) {
      const joursRetard = Math.ceil((now - colis.dateLimiteGratuite) / (1000 * 60 * 60 * 24));
      const tarifJour = parseInt(process.env.STOCKAGE_TARIF_JOUR) || 200;
      fraisStockage = joursRetard * tarifJour;
    }
    
    colis.statut = 'retiré';
    colis.dateRetrait = now;
    colis.fraisStockage = fraisStockage;
    if (signatureUrl) colis.signatureUrl = signatureUrl;
    await colis.save();
    
    // Transaction frais stockage si applicable
    if (fraisStockage > 0) {
      await Transaction.create({
        livraison: colis.livraison,
        client: (await Livraison.findById(colis.livraison)).client,
        type: 'stockage',
        montant: fraisStockage,
        statut: 'validé',
        description: `Frais stockage ${fraisStockage} FCFA pour colis ${colis.reference}`
      });
    }
    
    // Mettre à jour livraison
    const livraison = await Livraison.findById(colis.livraison);
    livraison.statut = 'livré';
    livraison.dateLivraison = now;
    await livraison.save();
    
    // Notification client
    await Notification.create({
      destinataire: livraison.client,
      type: 'livraison',
      message: `✅ Votre colis ${colis.reference} a été retiré avec succès.`
    });
    
    console.log(`📤 Colis ${colis.reference} retiré`);
    
    res.json({
      success: true,
      message: 'Colis retiré avec succès.',
      data: { 
        statut: 'retiré', 
        fraisStockage,
        dateRetrait: colis.dateRetrait 
      }
    });
  } catch (error) {
    console.error('❌ Erreur retrait colis:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Stats point ILLICO
export const getPointStats = async (req, res) => {
  try {
    const colis = await Colis.find({ pointIllico: req.user._id });
    const transactions = await Transaction.find({ 
      'livraison.pointIllico': req.user._id,
      type: 'commission_point'
    });
    
    const stats = {
      totalColis: colis.length,
      colisRetires: colis.filter(c => c.statut === 'retiré').length,
      commissionTotale: req.user.commissionTotal,
      revenusMois: transactions
        .filter(t => {
          const date = new Date(t.createdAt);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, t) => sum + t.montant, 0)
    };
    
    res.json({
      success: true,
      message: 'Statistiques récupérées.',
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur stats point:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// Import nécessaire pour OTP
import { authenticator } from '@otplib/preset-default';

export default {
  getPointsIllico,
  togglePointActivation,
  getColisByPoint,
  receiveColis,
  retrieveColis,
  getPointStats
};