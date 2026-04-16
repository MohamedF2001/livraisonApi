import Transaction from '../models/transaction.js';
import User from '../models/user.js';

// 📋 Liste transactions
export const getTransactions = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'Client') {
      filter.client = req.user._id;
    } else if (req.user.role === 'Livreur') {
      filter.livreur = req.user._id;
    }
    // Admin et PointIllico voient tout (PointIllico peut filtrer par type)
    
    const { type, statut, modePaiement, dateDebut, dateFin } = req.query;
    if (type) filter.type = type;
    if (statut) filter.statut = statut;
    if (modePaiement) filter.modePaiement = modePaiement;
    if (dateDebut || dateFin) {
      filter.dateTransaction = {};
      if (dateDebut) filter.dateTransaction.$gte = new Date(dateDebut);
      if (dateFin) filter.dateTransaction.$lte = new Date(dateFin);
    }
    
    const transactions = await Transaction.find(filter)
      .populate('livraison', 'statut prixEstime')
      .populate('livreur', 'nom telephone')
      .populate('client', 'nom telephone')
      .sort({ dateTransaction: -1 })
      .limit(100);
    
    console.log(`💳 ${transactions.length} transactions récupérées`);
    
    res.json({
      success: true,
      message: 'Transactions récupérées.',
      data: transactions
    });
  } catch (error) {
    console.error('❌ Erreur récupération transactions:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 🔍 Détail transaction
export const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('livraison')
      .populate('livreur', 'nom')
      .populate('client', 'nom');
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée.' 
      });
    }
    
    // Permissions
    if (req.user.role === 'Client' && transaction.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }
    if (req.user.role === 'Livreur' && transaction.livreur?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }
    
    res.json({
      success: true,
      message: 'Transaction récupérée.',
      data: transaction
    });
  } catch (error) {
    console.error('❌ Erreur détail transaction:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// ✅ Validation transaction (Admin)
export const validateTransaction = async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['validé', 'échoué'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction non trouvée.' });
    }
    
    if (transaction.statut !== 'en_attente') {
      return res.status(400).json({ success: false, message: 'Transaction déjà traitée.' });
    }
    
    transaction.statut = statut;
    await transaction.save();
    
    // Mise à jour solde client si paiement validé
    if (statut === 'validé' && transaction.type === 'paiement') {
      await User.findByIdAndUpdate(transaction.client, {
        $inc: { soldeIllico: -transaction.montant }
      });
    }
    
    console.log(`💳 Transaction ${transaction._id} ${statut === 'validé' ? 'validée' : 'échouée'}`);
    
    res.json({
      success: true,
      message: `Transaction ${statut === 'validé' ? 'validée' : 'marquée échouée'}.`,
      data: { statut: transaction.statut }
    });
  } catch (error) {
    console.error('❌ Erreur validation transaction:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

// 📊 Stats financières
export const getTransactionStats = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
    }
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const stats = await Transaction.aggregate([
      { $match: { dateTransaction: { $gte: startOfMonth } } },
      { 
        $group: {
          _id: '$type',
          total: { $sum: '$montant' },
          count: { $sum: 1 },
          valide: { $sum: { $cond: [{ $eq: ['$statut', 'validé'] }, 1, 0] } }
        }
      }
    ]);
    
    const totalGeneral = stats.reduce((sum, s) => sum + s.total, 0);
    
    res.json({
      success: true,
      message: 'Statistiques financières récupérées.',
      data: {
        parType: stats,
        totalMois: totalGeneral,
        periode: { debut: startOfMonth, fin: now }
      }
    });
  } catch (error) {
    console.error('❌ Erreur stats transactions:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

export default {
  getTransactions,
  getTransaction,
  validateTransaction,
  getTransactionStats
};