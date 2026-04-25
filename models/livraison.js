import mongoose from 'mongoose';

const livraisonSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  livreur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  pointDepart: {
    adresse: { type: String, required: true, trim: true },
    telephoneContact: { type: String, required: true, trim: true },
    coordinates: { 
      type: [Number], // [longitude, latitude]
      required: true 
    }
  },
  pointArrivee: {
    adresse: { type: String, required: true, trim: true },
    telephoneContact: { type: String, required: true, trim: true },
    coordinates: { 
      type: [Number],
      required: true 
    }
  },
  
  vehicule: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicule', required: true },
  mode: { type: String, enum: ['express', 'point_illico'], required: true },
  pointIllico: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  statut: { 
    type: String, 
    enum: [
      'en_attente', 'affecté', 'arrivé_pickup', 'colis_récupéré', 
      'déposé_en_point', 'livré', 'échoué', 'annulé'
    ], 
    default: 'en_attente' 
  },
  
  prixEstime: { type: Number, required: true },
  prixFinal: { type: Number },
  modePaiement: { type: String, enum: ['cash', 'mobile_money', 'credit_illico'] },
  
  otpLivraison: { type: String, select: false },
  otpRetrait: { type: String, select: false },
  otpValidé: { type: Boolean, default: false },
  
  preuveLivraisonUrl: { type: String, default: '' },
  noteLivreur: { type: Number, min: 1, max: 5 },
  
  natureColis: { type: String, required: true, trim: true },
  urgent: { type: Boolean, default: false },
  nuit: { type: Boolean, default: false },
  poids: { type: Number, default: 1 }, // en kg
  
  dateCreation: { type: Date, default: Date.now },
  dateLivraison: { type: Date }
}, { timestamps: true });

// Index pour recherche géospatiale
livraisonSchema.index({ 'pointDepart.coordinates': '2dsphere' });
livraisonSchema.index({ 'pointArrivee.coordinates': '2dsphere' });

const Livraison = 
mongoose.models.Livraison || mongoose.model('Livraison', livraisonSchema);

export default Livraison;