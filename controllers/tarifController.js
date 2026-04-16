import Tarif from '../models/tarif.js';
import Vehicule from '../models/vehicule.js';
import Zone from '../models/zone.js';

// 📋 Liste tarifs (public)
export const getTarifs = async (req, res) => {
  try {
    const { vehicule, zone, actif } = req.query;
    
    let filter = { actif: actif !== 'false' };
    if (vehicule) filter.vehicule = vehicule;
    if (zone) filter.zone = zone;
    
    const tarifs = await Tarif.find(filter)
      .populate('vehicule', 'type tarifBase coutParKm commission')
      .populate('zone', 'nom supplement')
      .sort({ createdAt: -1 });
    
    console.log(`💰 ${tarifs.length} tarifs récupérés`);
    
    res.json({
      success: true,
      message: 'Tarifs récupérés.',
      data: tarifs
    });
  } catch (error) {
    console.error('❌ Erreur récupération tarifs:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail tarif
export const getTarif = async (req, res) => {
  try {
    const tarif = await Tarif.findById(req.params.id)
      .populate('vehicule')
      .populate('zone');
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non trouvé.' 
      });
    }
    
    res.json({
      success: true,
      message: 'Tarif récupéré.',
      data: tarif
    });
  } catch (error) {
    console.error('❌ Erreur détail tarif:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ➕ Création tarif (Admin)
export const createTarif = async (req, res) => {
  try {
    const { vehicule, zone, prixBase, coutKm, supplementUrgent, supplementNuit, supplementPoids, remisePointIllico } = req.body;
    
    if (!vehicule || !zone || prixBase === undefined || coutKm === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Champs requis manquants.' 
      });
    }
    
    // Vérifier unicité vehicule+zone
    const existing = await Tarif.findOne({ vehicule, zone });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un tarif existe déjà pour ce véhicule et cette zone.' 
      });
    }
    
    const tarif = new Tarif({
      vehicule,
      zone,
      prixBase,
      coutKm,
      supplementUrgent: supplementUrgent || 0,
      supplementNuit: supplementNuit || 0,
      supplementPoids: supplementPoids || 0,
      remisePointIllico: remisePointIllico || 0
    });
    
    await tarif.save();
    
    console.log('💰 Tarif créé:', tarif._id);
    
    res.status(201).json({
      success: true,
      message: 'Tarif créé avec succès.',
      data: await tarif.populate('vehicule').populate('zone')
    });
  } catch (error) {
    console.error('❌ Erreur création tarif:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✏️ Mise à jour tarif (Admin)
export const updateTarif = async (req, res) => {
  try {
    const updates = req.body;
    const tarif = await Tarif.findById(req.params.id);
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non trouvé.' 
      });
    }
    
    // Mise à jour sélective
    Object.keys(updates).forEach(key => {
      if (['prixBase', 'coutKm', 'supplementUrgent', 'supplementNuit', 'supplementPoids', 'remisePointIllico', 'actif'].includes(key)) {
        tarif[key] = updates[key];
      }
    });
    
    await tarif.save();
    
    console.log('✏️ Tarif mis à jour:', tarif._id);
    
    res.json({
      success: true,
      message: 'Tarif mis à jour.',
      data: await tarif.populate('vehicule').populate('zone')
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour tarif:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🗑️ Suppression tarif (Admin)
export const deleteTarif = async (req, res) => {
  try {
    const tarif = await Tarif.findById(req.params.id);
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non trouvé.' 
      });
    }
    
    // Soft delete via actif=false
    tarif.actif = false;
    await tarif.save();
    
    console.log('🗑️ Tarif désactivé:', tarif._id);
    
    res.json({
      success: true,
      message: 'Tarif désactivé avec succès.'
    });
  } catch (error) {
    console.error('❌ Erreur suppression tarif:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Calculateur de tarif avancé
export const calculateTarif = async (req, res) => {
  try {
    const { vehicule, zone, distance, urgent, nuit, poids, mode } = req.body;
    
    if (!vehicule || !zone || !distance) {
      return res.status(400).json({ 
        success: false, 
        message: 'Véhicule, zone et distance requis.' 
      });
    }
    
    const tarif = await Tarif.findOne({ vehicule, zone, actif: true })
      .populate('vehicule')
      .populate('zone');
    
    if (!tarif) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tarif non configuré.' 
      });
    }
    
    let prix = tarif.prixBase + (distance * tarif.coutKm);
    
    if (tarif.zone?.supplement) prix += tarif.zone.supplement;
    if (urgent) prix += tarif.supplementUrgent;
    if (nuit) prix += tarif.supplementNuit;
    if (poids > 1) prix += (poids - 1) * tarif.supplementPoids;
    if (mode === 'point_illico' && tarif.remisePointIllico > 0) {
      prix = prix * (1 - tarif.remisePointIllico / 100);
    }
    
    res.json({
      success: true,
      message: 'Calcul effectué.',
      data: {
        prixTotal: Math.round(prix),
        details: {
          base: tarif.prixBase,
          distance: `${distance} km × ${tarif.coutKm} FCFA/km = ${Math.round(distance * tarif.coutKm)} FCFA`,
          supplements: {
            zone: tarif.zone?.supplement || 0,
            urgent: urgent ? tarif.supplementUrgent : 0,
            nuit: nuit ? tarif.supplementNuit : 0,
            poids: poids > 1 ? Math.round((poids - 1) * tarif.supplementPoids) : 0
          },
          remise: mode === 'point_illico' ? `${tarif.remisePointIllico}%` : '0%'
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur calcul tarif:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getTarifs,
  getTarif,
  createTarif,
  updateTarif,
  deleteTarif,
  calculateTarif
};