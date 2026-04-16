import Zone from '../models/zone.js';
import Tarif from '../models/tarif.js';

// 📋 Liste des zones (public)
export const getZones = async (req, res) => {
  try {
    const { actif } = req.query;
    
    let filter = {};
    if (actif !== undefined) filter.actif = actif === 'true';
    
    const zones = await Zone.find(filter)
      .sort({ nom: 1 });
    
    console.log(`🗺️ ${zones.length} zones récupérées`);
    
    res.json({
      success: true,
      message: 'Zones récupérées.',
      data: zones
    });
  } catch (error) {
    console.error('❌ Erreur récupération zones:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail d'une zone (public)
export const getZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Zone non trouvée.' 
      });
    }
    
    res.json({
      success: true,
      message: 'Zone récupérée.',
      data: zone
    });
  } catch (error) {
    console.error('❌ Erreur détail zone:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ➕ Création zone (Admin uniquement)
export const createZone = async (req, res) => {
  try {
    const { nom, description, supplement } = req.body;
    
    // Validation champs requis
    if (!nom) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom de la zone est requis.' 
      });
    }
    
    // Vérifier unicité du nom
    const existing = await Zone.findOne({ nom: new RegExp(`^${nom}$`, 'i') });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Une zone avec ce nom existe déjà.' 
      });
    }
    
    const zone = new Zone({
      nom: nom.trim(),
      description: description?.trim() || '',
      supplement: supplement >= 0 ? supplement : 0
    });
    
    await zone.save();
    
    console.log(`🗺️ Zone créée: ${zone.nom}`);
    
    res.status(201).json({
      success: true,
      message: 'Zone créée avec succès.',
      data: zone
    });
  } catch (error) {
    console.error('❌ Erreur création zone:', error.message);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Une zone avec ce nom existe déjà.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✏️ Mise à jour zone (Admin uniquement)
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, supplement, actif } = req.body;
    
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Zone non trouvée.' 
      });
    }
    
    // Vérifier unicité du nouveau nom si modifié
    if (nom && nom.trim() !== zone.nom) {
      const existing = await Zone.findOne({ 
        nom: new RegExp(`^${nom.trim()}$`, 'i'),
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: 'Une zone avec ce nom existe déjà.' 
        });
      }
      zone.nom = nom.trim();
    }
    
    if (description !== undefined) zone.description = description.trim();
    if (supplement !== undefined) zone.supplement = Math.max(0, supplement);
    if (actif !== undefined) zone.actif = actif;
    
    await zone.save();
    
    console.log(`✏️ Zone mise à jour: ${zone.nom}`);
    
    res.json({
      success: true,
      message: 'Zone mise à jour.',
      data: zone
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour zone:', error.message);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Une zone avec ce nom existe déjà.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🗑️ Désactiver zone (soft delete - Admin uniquement)
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Zone non trouvée.' 
      });
    }
    
    // Vérifier si des tarifs utilisent cette zone
    const tarifsCount = await Tarif.countDocuments({ zone: id, actif: true });
    if (tarifsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Impossible de désactiver: ${tarifsCount} tarif(s) actif(s) utilisent cette zone.` 
      });
    }
    
    // Soft delete
    zone.actif = false;
    await zone.save();
    
    console.log(`🗑️ Zone désactivée: ${zone.nom}`);
    
    res.json({
      success: true,
      message: 'Zone désactivée avec succès.'
    });
  } catch (error) {
    console.error('❌ Erreur désactivation zone:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Stats zones (Admin)
export const getZoneStats = async (req, res) => {
  try {
    const stats = await Zone.aggregate([
      {
        $group: {
          _id: '$actif',
          count: { $sum: 1 },
          supplementMoyen: { $avg: '$supplement' }
        }
      }
    ]);
    
    const total = await Zone.countDocuments();
    const actifs = await Zone.countDocuments({ actif: true });
    const tarifsParZone = await Tarif.aggregate([
      { $group: { _id: '$zone', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      message: 'Statistiques zones récupérées.',
      data: {
        total,
        actifs,
        inactifs: total - actifs,
        parStatut: stats,
        tarifsParZone: tarifsParZone.length
      }
    });
  } catch (error) {
    console.error('❌ Erreur stats zones:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getZones,
  getZone,
  createZone,
  updateZone,
  deleteZone,
  getZoneStats
};