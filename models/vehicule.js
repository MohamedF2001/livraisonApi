import mongoose from 'mongoose';

const vehiculeSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['velo', 'moto', 'tricycle', 'voiture', 'camionnette'], 
    required: true 
  },
  tarifBase: { type: Number, required: true, min: 0 },
  coutParKm: { type: Number, required: true, min: 0 },
  commission: { type: Number, required: true, min: 0, max: 100 }, // en %
  description: { type: String, trim: true },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

const Vehicule = mongoose.models.Vehicule || mongoose.model('Vehicule', vehiculeSchema);
export default Vehicule;