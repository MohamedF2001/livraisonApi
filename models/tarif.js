import mongoose from 'mongoose';

const tarifSchema = new mongoose.Schema({
  vehicule: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicule', required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
  prixBase: { type: Number, required: true, min: 0 },
  coutKm: { type: Number, required: true, min: 0 },
  supplementUrgent: { type: Number, default: 0 },
  supplementNuit: { type: Number, default: 0 },
  supplementPoids: { type: Number, default: 0 }, // par kg au-delà de 1kg
  remisePointIllico: { type: Number, default: 0, min: 0, max: 100 }, // en %
  actif: { type: Boolean, default: true }
}, { timestamps: true });

const Tarif = mongoose.models.Tarif || mongoose.model('Tarif', tarifSchema);
export default Tarif;