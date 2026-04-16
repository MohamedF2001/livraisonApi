import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  nom: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  supplement: { type: Number, default: 0, min: 0 },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

const Zone = mongoose.models.Zone || mongoose.model('Zone', zoneSchema);
export default Zone;