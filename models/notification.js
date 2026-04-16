import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  destinataire: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['livraison', 'alerte', 'paiement', 'info'], required: true },
  message: { type: String, required: true, trim: true },
  lu: { type: Boolean, default: false },
  dateCreation: { type: Date, default: Date.now },
  lien: { type: String } // URL optionnelle pour navigation
}, { timestamps: true });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;