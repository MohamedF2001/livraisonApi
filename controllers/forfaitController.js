import Forfait from '../models/forfait.js';
import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import Notification from '../models/notification.js';

// 📋 Liste forfaits (public)
export const getForfaits = async (req, res) => {
  try {
    const forfaits = await Forfait.find({ actif: true })
      .sort({ prix: 1 });
    
    console.log(`🎫 ${forfaits.length} forfaits récupérés`);
    
    res.json({
      success: true,
      message: 'Forfaits récupérés.',
      data: forfaits
    });
  } catch (error) {
    console.error('❌ Erreur récupération forfaits:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail forfait
export const getForfait = async (req, res) => {
  try {
    const forfait = await Forfait.findById(req.params.id);
    
    if (!forfait) {
      return res.status(404).json({ 
        success: false, 
        message: 'Forfait non trouvé.' 
      });
    }
    
    res.json({
      success: true,
      message: 'Forfait récupéré.',
      data: forfait
    });
  } catch (error) {
    console.error('❌ Erreur détail forfait:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ➕ Création forfait (Admin)
export const createForfait = async (req, res) => {
  try {
    const { nom, description, prix, dureeJours, livraisonsIncluses, remise } = req.body;
    
    if (!nom || prix === undefined || dureeJours === undefined || livraisonsIncluses === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Champs requis manquants.' 
      });
    }
    
    const forfait = new Forfait({
      nom,
      description,
      prix,
      dureeJours,
      livraisonsIncluses,
      remise: remise || 0
    });
    
    await forfait.save();
    
    console.log('🎫 Forfait créé:', forfait.nom);
    
    res.status(201).json({
      success: true,
      message: 'Forfait créé avec succès.',
      data: forfait
    });
  } catch (error) {
    console.error('❌ Erreur création forfait:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✏️ Mise à jour forfait (Admin)
export const updateForfait = async (req, res) => {
  try {
    const updates = req.body;
    const forfait = await Forfait.findById(req.params.id);
    
    if (!forfait) {
      return res.status(404).json({ 
        success: false, 
        message: 'Forfait non trouvé.' 
      });
    }
    
    Object.keys(updates).forEach(key => {
      if (['nom', 'description', 'prix', 'dureeJours', 'livraisonsIncluses', 'remise', 'actif'].includes(key)) {
        forfait[key] = updates[key];
      }
    });
    
    await forfait.save();
    
    console.log('✏️ Forfait mis à jour:', forfait.nom);
    
    res.json({
      success: true,
      message: 'Forfait mis à jour.',
      data: forfait
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour forfait:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🎫 Souscription client à un forfait
export const subscribeForfait = async (req, res) => {
  try {
    const { forfaitId, modePaiement } = req.body;
    
    if (req.user.typeClient !== 'professionnel') {
      return res.status(400).json({ 
        success: false, 
        message: 'Seuls les clients professionnels peuvent souscrire un forfait.' 
      });
    }
    
    const forfait = await Forfait.findById(forfaitId);
    if (!forfait || !forfait.actif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Forfait non disponible.' 
      });
    }
    
    // Vérifier solde si paiement par credit_illico
    if (modePaiement === 'credit_illico' && req.user.soldeIllico < forfait.prix) {
      return res.status(400).json({ 
        success: false, 
        message: `Solde insuffisant. Il vous manque ${forfait.prix - req.user.soldeIllico} FCFA.` 
      });
    }
    
    // Déduire solde si nécessaire
    if (modePaiement === 'credit_illico') {
      req.user.soldeIllico -= forfait.prix;
    }
    
    // Mettre à jour forfait actif client
    req.user.forfaitActif = forfaitId;
    await req.user.save();
    
    // Créer transaction
    await Transaction.create({
      client: req.user._id,
      type: 'paiement',
      montant: forfait.prix,
      modePaiement,
      statut: 'validé',
      description: `Souscription forfait ${forfait.nom}`
    });
    
    // Notification
    await Notification.create({
      destinataire: req.user._id,
      type: 'info',
      message: `✅ Forfait ${forfait.nom} activé! ${forfait.livraisonsIncluses} livraisons incluses, -${forfait.remise}% de remise.`
    });
    
    console.log(`🎫 Client ${req.user.nom} a souscrit au forfait ${forfait.nom}`);
    
    res.json({
      success: true,
      message: 'Souscription réussie!',
      data: {
        forfait: forfait.nom,
        dureeJours: forfait.dureeJours,
        livraisonsIncluses: forfait.livraisonsIncluses,
        remise: forfait.remise,
        dateActivation: new Date(),
        dateExpiration: new Date(Date.now() + forfait.dureeJours * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('❌ Erreur souscription forfait:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Vérifier éligibilité remise forfait
export const checkForfaitRemise = async (req, res) => {
  try {
    if (!req.user.forfaitActif) {
      return res.json({
        success: true,
        message: 'Aucun forfait actif.',
        data: { hasForfait: false, remise: 0 }
      });
    }
    
    const forfait = await Forfait.findById(req.user.forfaitActif);
    if (!forfait || !forfait.actif) {
      req.user.forfaitActif = null;
      await req.user.save();
      return res.json({
        success: true,
        message: 'Forfait expiré ou désactivé.',
        data: { hasForfait: false, remise: 0 }
      });
    }
    
    // Vérifier date expiration
    const dateActivation = req.user.forfaitActivation || req.user.createdAt;
    const dateExpiration = new Date(dateActivation.getTime() + forfait.dureeJours * 24 * 60 * 60 * 1000);
    
    if (new Date() > dateExpiration) {
      req.user.forfaitActif = null;
      await req.user.save();
      return res.json({
        success: true,
        message: 'Forfait expiré.',
        data: { hasForfait: false, remise: 0 }
      });
    }
    
    res.json({
      success: true,
      message: 'Forfait actif.',
      data: {
        hasForfait: true,
        forfait: forfait.nom,
        remise: forfait.remise,
        livraisonsRestantes: forfait.livraisonsIncluses, // À implémenter avec compteur
        expiration: dateExpiration
      }
    });
  } catch (error) {
    console.error('❌ Erreur vérification forfait:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getForfaits,
  getForfait,
  createForfait,
  updateForfait,
  subscribeForfait,
  checkForfaitRemise
};