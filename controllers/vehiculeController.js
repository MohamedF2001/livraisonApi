import Vehicule from '../models/vehicule.js';
import Tarif from '../models/tarif.js';

// 📋 Liste des véhicules (public)
export const getVehicules = async (req, res) => {
  try {
    const { type, actif } = req.query;
    
    let filter = {};
    if (type) filter.type = type;
    if (actif !== undefined) filter.actif = actif === 'true';
    
    const vehicules = await Vehicule.find(filter)
      .sort({ tarifBase: 1, coutParKm: 1 });
    
    console.log(`🚗 ${vehicules.length} véhicules récupérés`);
    
    res.json({
      success: true,
      message: 'Véhicules récupérés.',
      data: vehicules
    });
  } catch (error) {
    console.error('❌ Erreur récupération véhicules:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail d'un véhicule (public)
export const getVehicule = async (req, res) => {
  try {
    const vehicule = await Vehicule.findById(req.params.id);
    
    if (!vehicule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Véhicule non trouvé.' 
      });
    }
    
    res.json({
      success: true,
      message: 'Véhicule récupéré.',
      data: vehicule
    });
  } catch (error) {
    console.error('❌ Erreur détail véhicule:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ➕ Création véhicule (Admin uniquement)
export const createVehicule = async (req, res) => {
  try {
    const { type, tarifBase, coutParKm, commission, description } = req.body;
    
    // Validation champs requis
    if (!type || tarifBase === undefined || coutParKm === undefined || commission === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Champs requis: type, tarifBase, coutParKm, commission.' 
      });
    }
    
    // Validation valeurs
    if (tarifBase < 0 || coutParKm < 0 || commission < 0 || commission > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valeurs numériques invalides.' 
      });
    }
    
    const vehicule = new Vehicule({
      type,
      tarifBase,
      coutParKm,
      commission,
      description: description || ''
    });
    
    await vehicule.save();
    
    console.log(`🚗 Véhicule créé: ${type}`);
    
    res.status(201).json({
      success: true,
      message: 'Véhicule créé avec succès.',
      data: vehicule
    });
  } catch (error) {
    console.error('❌ Erreur création véhicule:', error.message);
    
    // Gestion erreur doublon (type unique si nécessaire)
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ce type de véhicule existe déjà.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✏️ Mise à jour véhicule (Admin uniquement)
export const updateVehicule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const vehicule = await Vehicule.findById(id);
    if (!vehicule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Véhicule non trouvé.' 
      });
    }
    
    // Mise à jour sélective des champs autorisés
    const allowedUpdates = ['type', 'tarifBase', 'coutParKm', 'commission', 'description', 'actif'];
    allowedUpdates.forEach(key => {
      if (updates[key] !== undefined) {
        vehicule[key] = updates[key];
      }
    });
    
    await vehicule.save();
    
    console.log(`✏️ Véhicule mis à jour: ${vehicule.type}`);
    
    res.json({
      success: true,
      message: 'Véhicule mis à jour.',
      data: vehicule
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour véhicule:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🗑️ Désactiver véhicule (soft delete - Admin uniquement)
export const deleteVehicule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicule = await Vehicule.findById(id);
    if (!vehicule) {
      return res.status(404).json({ 
        success: false, 
        message: 'Véhicule non trouvé.' 
      });
    }
    
    // Vérifier si des tarifs utilisent ce véhicule
    const tarifsCount = await Tarif.countDocuments({ vehicule: id, actif: true });
    if (tarifsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de désactiver: ${tarifsCount} tarif(s) actif(s) utilisent ce véhicule.` 
      });
    }
    
    // Soft delete
    vehicule.actif = false;
    await vehicule.save();
    
    console.log(`🗑️ Véhicule désactivé: ${vehicule.type}`);
    
    res.json({
      success: true,
      message: 'Véhicule désactivé avec succès.'
    });
  } catch (error) {
    console.error('❌ Erreur désactivation véhicule:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Stats véhicules (Admin)
export const getVehiculeStats = async (req, res) => {
  try {
    const stats = await Vehicule.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          tarifBaseMoyen: { $avg: '$tarifBase' },
          coutParKmMoyen: { $avg: '$coutParKm' },
          commissionMoyenne: { $avg: '$commission' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const total = await Vehicule.countDocuments();
    const actifs = await Vehicule.countDocuments({ actif: true });
    
    res.json({
      success: true,
      message: 'Statistiques véhicules récupérées.',
      data: {
        total,
        actifs,
        inactifs: total - actifs,
        parType: stats
      }
    });
  } catch (error) {
    console.error('❌ Erreur stats véhicules:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getVehicules,
  getVehicule,
  createVehicule,
  updateVehicule,
  deleteVehicule,
  getVehiculeStats
};