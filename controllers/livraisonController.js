import { authenticator } from '@otplib/preset-default';
import Livraison from '../models/livraison.js';
import Tarif from '../models/tarif.js';
import Vehicule from '../models/vehicule.js';
import Zone from '../models/zone.js';
import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import Notification from '../models/notification.js';
import Forfait from '../models/forfait.js';
import { cloudinary } from '../config/cloudinary.js';

// Calcul distance Haversine (km)
const calculateDistance = (coord1, coord2) => {
  const R = 6371;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// 📊 Estimation prix livraison
export const estimatePrice = async (req, res) => {
  try {
    const { vehicule, coordDepart, coordArrivee, mode, urgent, nuit, poids, pointIllico } = req.body;
    
    if (!vehicule || !coordDepart || !coordArrivee) {
      return res.status(400).json({ 
        success: false, 
        message: 'Véhicule, coordonnées départ et arrivée requis.' 
      });
    }
    
    const distance = calculateDistance(coordDepart, coordArrivee);
    const vehiculeData = await Vehicule.findById(vehicule);
    
    if (!vehiculeData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Véhicule non trouvé.' 
      });
    }
    
    const tarif = await Tarif.findOne({ vehicule, actif: true }).populate('zone');
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non configuré pour ce véhicule.' 
      });
    }
    
    let prix = tarif.prixBase + (distance * tarif.coutKm);
    
    if (tarif.zone?.supplement) prix += tarif.zone.supplement;
    if (urgent) prix += tarif.supplementUrgent;
    if (nuit) prix += tarif.supplementNuit;
    if (poids > 1) prix += (poids - 1) * tarif.supplementPoids;
    
    if (mode === 'point_illico' && pointIllico && tarif.remisePointIllico > 0) {
      prix = prix * (1 - tarif.remisePointIllico / 100);
    }
    
    if (req.user?.forfaitActif) {
      const forfait = await Forfait.findById(req.user.forfaitActif);
      if (forfait?.remise > 0) {
        prix = prix * (1 - forfait.remise / 100);
      }
    }
    
    console.log(`💰 Estimation: ${Math.round(prix)} FCFA pour ${distance.toFixed(2)} km`);
    
    res.json({
      success: true,
      message: 'Estimation calculée.',
      data: {
        distance: distance.toFixed(2),
        prixEstime: Math.round(prix),
        details: {
          tarifBase: tarif.prixBase,
          coutKm: tarif.coutKm,
          supplementZone: tarif.zone?.supplement || 0,
          supplementUrgent: urgent ? tarif.supplementUrgent : 0,
          supplementNuit: nuit ? tarif.supplementNuit : 0,
          supplementPoids: poids > 1 ? (poids - 1) * tarif.supplementPoids : 0,
          remise: mode === 'point_illico' ? tarif.remisePointIllico : 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur estimation prix:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors du calcul.' 
    });
  }
};

// 📦 Création livraison
export const createLivraison = async (req, res) => {
  try {
    const { 
      pointDepart, pointArrivee, vehicule, mode, pointIllico,
      urgent, nuit, poids, modePaiement 
    } = req.body;
    
    if (!pointDepart?.adresse || !pointDepart?.coordinates || 
        !pointArrivee?.adresse || !pointArrivee?.coordinates || 
        !vehicule || !mode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Champs requis manquants.' 
      });
    }
    
    const distance = calculateDistance(pointDepart.coordinates, pointArrivee.coordinates);
    const tarif = await Tarif.findOne({ vehicule, actif: true });
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non configuré.' 
      });
    }
    
    let prixEstime = tarif.prixBase + (distance * tarif.coutKm);
    if (tarif.zone?.supplement) prixEstime += tarif.zone.supplement;
    if (urgent) prixEstime += tarif.supplementUrgent;
    if (nuit) prixEstime += tarif.supplementNuit;
    if (poids > 1) prixEstime += (poids - 1) * tarif.supplementPoids;
    
    const otpLivraison = authenticator.generate(process.env.OTP_SECRET + Date.now() + req.user._id);
    
    const livraison = new Livraison({
      client: req.user._id,
      pointDepart,
      pointArrivee,
      vehicule,
      mode,
      pointIllico,
      prixEstime: Math.round(prixEstime),
      modePaiement,
      otpLivraison,
      urgent: urgent || false,
      nuit: nuit || false,
      poids: poids || 1
    });
    
    await livraison.save();
    await autoDispatch(livraison._id);
    
    await Notification.create({
      destinataire: req.user._id,
      type: 'livraison',
      message: `Votre livraison #${livraison._id.toString().slice(-6)} a été créée. OTP: ${otpLivraison.slice(0,3)}***`
    });
    
    if (req.io) {
      req.io.to(`client_${req.user._id}`).emit('livraison:created', {
        livraisonId: livraison._id,
        statut: livraison.statut
      });
    }
    
    console.log('📦 Livraison créée:', livraison._id);
    console.log(`💰 Estimation: ${Math.round(prixEstime)} FCFA pour ${distance.toFixed(2)} km`);
    console.log(`📱 OTP: ${otpLivraison}`);
    
    res.status(201).json({
      success: true,
      message: 'Livraison créée avec succès.',
      data: await Livraison.findById(livraison._id)
        .populate('client', 'nom telephone')
        .populate('livreur', 'nom telephone photoProfil')
        .populate('vehicule')
        .populate('pointIllico', 'nom adresse')
    });
  } catch (error) {
    console.error('❌ Erreur création livraison:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la création.' 
    });
  }
};

// 🔄 Dispatch automatique vers livreur
const autoDispatch = async (livraisonId) => {
  try {
    const livraison = await Livraison.findById(livraisonId).populate('vehicule');
    if (!livraison) return;
    
    const livreurs = await User.find({
      role: 'Livreur',
      valide: true,
      statut: 'en_ligne',
      vehicule: livraison.vehicule,
      'location.coordinates': { $exists: true }
    });
    
    if (livreurs.length === 0) {
      console.log('⏳ Aucun livreur disponible, en attente...');
      return;
    }
    
    const livreursTriés = livreurs.map(l => ({
      livreur: l,
      distance: calculateDistance(l.location.coordinates, livraison.pointDepart.coordinates)
    })).sort((a, b) => a.distance - b.distance);
    
    const meilleurLivreur = livreursTriés[0].livreur;
    
    const seuilCash = parseInt(process.env.CASH_BLOCAGE_SEUIL) || 50000;
    if ((meilleurLivreur.cashCollecte - meilleurLivreur.cashReverse) > seuilCash) {
      console.log('🚫 Livreur bloqué (seuil cash dépassé)');
      return;
    }
    
    livraison.livreur = meilleurLivreur._id;
    livraison.statut = 'affecté';
    await livraison.save();
    
    meilleurLivreur.statut = 'en_mission';
    await meilleurLivreur.save();
    
    await Notification.create({
      destinataire: meilleurLivreur._id,
      type: 'livraison',
      message: `Nouvelle mission! Livraison #${livraison._id.toString().slice(-6)}`,
      lien: `/livraisons/${livraison._id}`
    });
    
    if (global.io) {
      global.io.to(`livreur_${meilleurLivreur._id}`).emit('livraison:assigned', {
        livraisonId: livraison._id,
        pointDepart: livraison.pointDepart
      });
    }
    
    console.log(`🚴 Livraison ${livraison._id} affectée à ${meilleurLivreur.nom}`);
    
    setTimeout(async () => {
      const updatedLivraison = await Livraison.findById(livraisonId);
      if (updatedLivraison?.statut === 'affecté') {
        updatedLivraison.statut = 'en_attente';
        updatedLivraison.livreur = null;
        await updatedLivraison.save();
        meilleurLivreur.statut = 'en_ligne';
        await meilleurLivreur.save();
        console.log('🔄 Livraison réaffectée (timeout)');
      }
    }, 30000);
    
  } catch (error) {
    console.error('❌ Erreur dispatch:', error.message);
  }
};

// 📋 Liste livraisons
export const getLivraisons = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'Client') {
      query.client = req.user._id;
    } else if (req.user.role === 'Livreur') {
      query.livreur = req.user._id;
    }
    
    const livraisons = await Livraison.find(query)
      .populate('client', 'nom telephone')
      .populate('livreur', 'nom telephone photoProfil')
      .populate('vehicule')
      .populate('pointIllico', 'nom adresse')
      .sort({ dateCreation: -1 });
    
    console.log(`📋 ${livraisons.length} livraisons récupérées`);
    
    res.json({
      success: true,
      message: 'Livraisons récupérées.',
      data: livraisons
    });
  } catch (error) {
    console.error('❌ Erreur récupération livraisons:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail livraison
export const getLivraison = async (req, res) => {
  try {
    const livraison = await Livraison.findById(req.params.id)
      .populate('client', 'nom telephone adresse')
      .populate('livreur', 'nom telephone photoProfil location')
      .populate('vehicule')
      .populate('pointIllico', 'nom adresse telephone');
    
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    if (req.user.role === 'Client' && livraison.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé.' 
      });
    }
    if (req.user.role === 'Livreur' && livraison.livreur?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès non autorisé.' 
      });
    }
    
    console.log('🔍 Livraison récupérée:', livraison._id);
    
    res.json({
      success: true,
      message: 'Livraison récupérée.',
      data: livraison
    });
  } catch (error) {
    console.error('❌ Erreur détail livraison:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✅ Validation OTP livraison
export const validateOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const livraison = await Livraison.findById(req.params.id).select('+otpLivraison +otpRetrait');
    
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    const expectedOTP = req.user.role === 'Livreur' ? livraison.otpLivraison : 
                       req.user.role === 'PointIllico' ? livraison.otpRetrait : 
                       livraison.otpLivraison;
    
    if (otp !== expectedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP invalide.' 
      });
    }
    
    livraison.otpValidé = true;
    
    if (req.user.role === 'Livreur' && livraison.statut === 'affecté') {
      livraison.statut = 'arrivé_pickup';
    } else if (req.user.role === 'Livreur' && livraison.statut === 'arrivé_pickup') {
      livraison.statut = 'colis_récupéré';
    } else if (req.user.role === 'PointIllico') {
      livraison.statut = 'déposé_en_point';
    } else if (req.user.role === 'Client' && livraison.statut === 'colis_récupéré') {
      livraison.statut = 'livré';
      livraison.dateLivraison = new Date();
    }
    
    await livraison.save();
    
    if (global.io) {
      global.io.to(`livraison_${livraison._id}`).emit('livraison:update', {
        statut: livraison.statut,
        otpValidé: livraison.otpValidé
      });
    }
    
    console.log('✅ OTP validé pour livraison:', livraison._id);
    
    res.json({
      success: true,
      message: 'OTP validé avec succès.',
      data: { statut: livraison.statut, otpValidé: true }
    });
  } catch (error) {
    console.error('❌ Erreur validation OTP:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🖼️ Upload preuve de livraison
export const uploadPreuve = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucune image envoyée.' 
      });
    }
    
    const livraison = await Livraison.findById(req.params.id);
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    if (req.user.role !== 'Livreur' || livraison.livreur?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    if (livraison.preuveLivraisonUrl) {
      const publicId = livraison.preuveLivraisonUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`illico/proofs/${publicId}`);
    }
    
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'illico/proofs', public_id: `proof_${livraison._id}` },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(req.file.buffer);
    });
    
    livraison.preuveLivraisonUrl = result.secure_url;
    livraison.statut = 'livré';
    livraison.dateLivraison = new Date();
    await livraison.save();
    
    const vehicule = await Vehicule.findById(livraison.vehicule);
    const commission = (livraison.prixFinal || livraison.prixEstime) * (vehicule.commission / 100);
    
    await Transaction.create({
      livraison: livraison._id,
      livreur: req.user._id,
      client: livraison.client,
      type: 'commission_livreur',
      montant: Math.round(commission),
      modePaiement: livraison.modePaiement,
      statut: 'validé',
      description: `Commission livraison #${livraison._id.toString().slice(-6)}`
    });
    
    if (livraison.modePaiement === 'cash') {
      req.user.cashCollecte += livraison.prixFinal || livraison.prixEstime;
      await req.user.save();
    }
    
    if (livraison.noteLivreur) {
      const stats = await Livraison.aggregate([
        { $match: { livreur: req.user._id, noteLivreur: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$noteLivreur' } } }
      ]);
      if (stats.length > 0) {
        req.user.scoreNote = parseFloat(stats[0].avg.toFixed(2));
        await req.user.save();
      }
    }
    
    console.log('✅ Preuve uploadée et livraison finalisée');
    
    res.json({
      success: true,
      message: 'Preuve enregistrée. Livraison finalisée.',
      data: { 
        preuveLivraisonUrl: result.secure_url,
        statut: 'livré',
        commission: Math.round(commission)
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload preuve:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Mise à jour statut livraison
export const updateStatut = async (req, res) => {
  try {
    const { statut } = req.body;
    const livraison = await Livraison.findById(req.params.id);
    
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    const validTransitions = {
      'en_attente': ['affecté', 'annulé'],
      'affecté': ['arrivé_pickup', 'annulé'],
      'arrivé_pickup': ['colis_récupéré'],
      'colis_récupéré': ['livré', 'déposé_en_point'],
      'déposé_en_point': ['retiré', 'retourné'],
      'livré': [],
      'échoué': [],
      'annulé': []
    };
    
    if (!validTransitions[livraison.statut]?.includes(statut)) {
      return res.status(400).json({ 
        success: false, 
        message: `Transition invalide: ${livraison.statut} → ${statut}` 
      });
    }
    
    livraison.statut = statut;
    if (statut === 'livré') livraison.dateLivraison = new Date();
    
    await livraison.save();
    
    if (global.io) {
      global.io.to(`livraison_${livraison._id}`).emit('livraison:update', {
        statut: livraison.statut,
        dateLivraison: livraison.dateLivraison
      });
    }
    
    console.log(`📊 Statut mise à jour: ${livraison._id} → ${statut}`);
    
    res.json({
      success: true,
      message: 'Statut mis à jour.',
      data: { statut: livraison.statut }
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🗑️ Annulation/Suppression livraison
export const deleteLivraison = async (req, res) => {
  try {
    const livraison = await Livraison.findById(req.params.id);
    
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    if (req.user.role === 'Client' && livraison.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Non autorisé.' 
      });
    }
    
    if (livraison.statut !== 'en_attente') {
      return res.status(400).json({ 
        success: false, 
        message: 'Seules les livraisons en attente peuvent être annulées.' 
      });
    }
    
    // Réinitialiser statut livreur si affecté
    if (livraison.livreur) {
      await User.findByIdAndUpdate(livraison.livreur, { statut: 'en_ligne' });
    }
    
    await Livraison.findByIdAndDelete(req.params.id);
    
    if (global.io) {
      global.io.to(`livraison_${livraison._id}`).emit('livraison:cancelled');
    }
    
    console.log('🗑️ Livraison annulée:', livraison._id);
    
    res.json({
      success: true,
      message: 'Livraison annulée avec succès.'
    });
  } catch (error) {
    console.error('❌ Erreur annulation livraison:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 👨‍💼 Affectation manuelle par Admin
export const assignLivreur = async (req, res) => {
  try {
    const { livreurId } = req.body;
    const livraison = await Livraison.findById(req.params.id);
    
    if (!livraison) {
      return res.status(404).json({ 
        success: false, 
        message: 'Livraison non trouvée.' 
      });
    }
    
    if (livraison.statut !== 'en_attente') {
      return res.status(400).json({ 
        success: false, 
        message: 'Ne peut affecter qu\'une livraison en attente.' 
      });
    }
    
    const livreur = await User.findById(livreurId);
    if (!livreur || livreur.role !== 'Livreur' || !livreur.valide) {
      return res.status(400).json({ 
        success: false, 
        message: 'Livreur invalide.' 
      });
    }
    
    // Réinitialiser ancien livreur si existe
    if (livraison.livreur) {
      await User.findByIdAndUpdate(livraison.livreur, { statut: 'en_ligne' });
    }
    
    livraison.livreur = livreurId;
    livraison.statut = 'affecté';
    await livraison.save();
    
    livreur.statut = 'en_mission';
    await livreur.save();
    
    await Notification.create({
      destinataire: livreurId,
      type: 'livraison',
      message: `Mission assignée par admin: Livraison #${livraison._id.toString().slice(-6)}`
    });
    
    if (global.io) {
      global.io.to(`livreur_${livreurId}`).emit('livraison:assigned', {
        livraisonId: livraison._id,
        pointDepart: livraison.pointDepart
      });
    }
    
    console.log(`👨‍💼 Livraison ${livraison._id} affectée manuellement à ${livreur.nom}`);
    
    res.json({
      success: true,
      message: 'Livreur affecté avec succès.',
      data: { livraison: await livraison.populate('livreur', 'nom telephone') }
    });
  } catch (error) {
    console.error('❌ Erreur affectation livreur:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  estimatePrice,
  createLivraison,
  getLivraisons,
  getLivraison,
  validateOTP,
  uploadPreuve,
  updateStatut,
  deleteLivraison,
  assignLivreur
};