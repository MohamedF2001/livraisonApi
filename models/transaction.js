import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  livraison: { type: mongoose.Schema.Types.ObjectId, ref: 'Livraison' },
  livreur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  type: { 
    type: String, 
    enum: ['paiement', 'commission_livreur', 'commission_point', 'stockage', 'remboursement'], 
    required: true 
  },
  
  montant: { type: Number, required: true, min: 0 },
  modePaiement: { type: String, enum: ['cash', 'mobile_money', 'credit_illico'] },
  statut: { type: String, enum: ['en_attente', 'validé', 'échoué'], default: 'en_attente' },
  
  dateTransaction: { type: Date, default: Date.now },
  description: { type: String, trim: true }
}, { timestamps: true });

	
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default Transaction;