import mongoose from 'mongoose';

const forfaitSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  prix: { type: Number, required: true, min: 0 },
  dureeJours: { type: Number, required: true, min: 1 },
  livraisonsIncluses: { type: Number, required: true, min: 1 },
  remise: { type: Number, default: 0, min: 0, max: 100 }, // en %
  actif: { type: Boolean, default: true }
}, { timestamps: true });

	
const Forfait = mongoose.models.Forfait || mongoose.model('Forfait', forfaitSchema);
export default Forfait;