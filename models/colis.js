import mongoose from 'mongoose';

const colisSchema = new mongoose.Schema({
  reference: { type: String, unique: true, required: true },
  livraison: { type: mongoose.Schema.Types.ObjectId, ref: 'Livraison', required: true },
  pointIllico: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  statut: { 
    type: String, 
    enum: ['en_attente', 'receptionné', 'retiré', 'retourné'], 
    default: 'en_attente' 
  },
  
  dateDepot: { type: Date, default: Date.now },
  dateLimiteGratuite: { type: Date },
  dateRetrait: { type: Date },
  
  fraisStockage: { type: Number, default: 0 },
  
  otpRetrait: { type: String, select: false },
  signatureUrl: { type: String, default: '' }
}, { timestamps: true });

// Générer référence auto avant save
colisSchema.pre('save', function(next) {
  if (!this.reference) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.reference = `COL-${timestamp}-${random}`;
  }
  // Calcul date limite gratuite si non définie
  if (!this.dateLimiteGratuite && this.dateDepot) {
    this.dateLimiteGratuite = new Date(this.dateDepot.getTime() + 48 * 60 * 60 * 1000);
  }
  next();
});

const Colis = mongoose.models.Colis || mongoose.model('Colis', colisSchema);
export default Colis;