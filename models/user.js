import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  // ==================== CHAMPS COMMUNS ====================
  nom: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  telephone: { 
    type: String, 
    required: function() { return this.role !== 'Admin'; },
    unique: true, 
    sparse: true,
    trim: true,
    match: [/^\+?[0-9\s\-()]{8,15}$/, 'Numéro de téléphone invalide']
  },
  email: { 
    type: String, 
    required: function() { return this.role === 'Admin'; },
    unique: true, 
    sparse: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  motDePasse: { 
    type: String, 
    required: function() { return this.role !== 'Client'; },
    minlength: 6,
    select: false 
  },
  codePin: { 
    type: String, 
    required: function() { return this.role === 'Client'; },
    minlength: 4,
    select: false,
    //match: [/^[0-9]{4,6}$/, 'Code PIN doit contenir 4 à 6 chiffres'],
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Client', 'Livreur', 'PointIllico'], 
    required: true 
  },
  
  // ==================== ADMIN ====================
  admin: {
    type: Boolean,
    default: false
  },
  
  // ==================== CLIENT ====================
  typeClient: { 
    type: String, 
    enum: ['standard', 'professionnel'], 
    default: 'standard' 
  },
  adresse: { type: String, trim: true, maxlength: 200 },
  soldeIllico: { type: Number, default: 0, min: 0 },
  forfaitActif: { type: mongoose.Schema.Types.ObjectId, ref: 'Forfait' },
  
  // ==================== LIVREUR ====================
  vehicule: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicule' },
  statut: { 
    type: String, 
    enum: ['en_ligne', 'hors_ligne', 'en_mission'], 
    default: 'hors_ligne' 
  },
  scoreNote: { type: Number, default: 5, min: 0, max: 5 },
  cashCollecte: { type: Number, default: 0, min: 0 },
  cashReverse: { type: Number, default: 0, min: 0 },
  valide: { type: Boolean, default: false },
  photoProfil: { type: String, default: '' },
  
  // ==================== POINT ILLICO ====================
  actif: { type: Boolean, default: false },
  commissionTotal: { type: Number, default: 0, min: 0 },
  signatureUrl: { type: String, default: '' },
  
  // ==================== GÉOLOCALISATION ====================
  location: {
    type: { 
      type: String, 
      enum: ['Point'], 
      default: 'Point' 
    },
    coordinates: { 
      type: [Number], 
      default: [0, 0],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Coordonnées GPS invalides: [longitude, latitude]'
      }
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==================== INDEX ====================
// Index pour géolocalisation (recherche proximité livreurs)
userSchema.index({ location: '2dsphere' });
// Index pour recherches fréquentes
userSchema.index({ telephone: 1, role: 1 });
userSchema.index({ email: 1, role: 1 });
userSchema.index({ role: 1, valide: 1, statut: 1 });

// ==================== VIRTUALS ====================
// Calcul du solde cash restant à reverser (livreur)
userSchema.virtual('cashRestant').get(function() {
  if (this.role !== 'Livreur') return null;
  return this.cashCollecte - this.cashReverse;
});

// Vérifier si le livreur est bloqué (seuil cash dépassé)
userSchema.virtual('estBloque').get(function() {
  if (this.role !== 'Livreur') return false;
  const seuil = parseInt(process.env.CASH_BLOCAGE_SEUIL) || 50000;
  return this.cashRestant > seuil;
});

// ==================== HOOKS PRE-SAVE ====================

// 🔐 Hook hash motDePasse (Admin, Livreur, PointIllico)
// ✅ Pattern async moderne SANS next() - Mongoose capture automatiquement les erreurs
userSchema.pre('save', async function() {
  // Ne pas hasher si le champ n'est pas modifié
  if (!this.isModified('motDePasse')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.motDePasse = await bcrypt.hash(this.motDePasse, salt);
    console.log(`🔐 Mot de passe hashé pour ${this.role}: ${this.email || this.telephone}`);
  } catch (error) {
    console.error('❌ Erreur lors du hash du mot de passe:', error.message);
    // Mongoose capturera automatiquement cette erreur et l'enverra au controller
    throw error;
  }
});

// 🔐 Hook hash codePin (Client uniquement)
userSchema.pre('save', async function() {
  if (!this.isModified('codePin')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.codePin = await bcrypt.hash(this.codePin, salt);
    console.log(`🔐 Code PIN hashé pour Client: ${this.telephone}`);
  } catch (error) {
    console.error('❌ Erreur lors du hash du code PIN:', error.message);
    throw error;
  }
});

// ==================== MÉTHODES D'INSTANCE ====================

// 🔐 Vérifier un mot de passe en clair contre le hash stocké
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.motDePasse) return false;
  return await bcrypt.compare(candidatePassword, this.motDePasse);
};

// 🔢 Vérifier un code PIN en clair contre le hash stocké
userSchema.methods.compareCodePin = async function(candidatePin) {
  if (!this.codePin) return false;
  return await bcrypt.compare(candidatePin, this.codePin);
};

// 🚫 Vérifier si un livreur peut accepter des missions
userSchema.methods.peutAccepterMission = function() {
  if (this.role !== 'Livreur') return false;
  if (!this.valide) return false;
  if (this.statut !== 'en_ligne') return false;
  if (this.estBloque) return false;
  return true;
};

// 📊 Mettre à jour le score après une note
userSchema.methods.updateScoreNote = async function(nouvelleNote) {
  if (this.role !== 'Livreur') return this.scoreNote;
  
  const Livraison = mongoose.model('Livraison');
  const stats = await Livraison.aggregate([
    { $match: { livreur: this._id, noteLivreur: { $exists: true, $gte: 1 } } },
    { $group: { _id: null, moyenne: { $avg: '$noteLivreur' }, count: { $sum: 1 } } }
  ]);
  
  if (stats.length > 0 && stats[0].count >= 1) {
    this.scoreNote = parseFloat(stats[0].moyenne.toFixed(2));
    await this.save();
  }
  
  return this.scoreNote;
};

// ==================== MÉTHODES STATIQUES ====================

// 🔍 Trouver un utilisateur par téléphone + rôle
userSchema.statics.findByTelephoneAndRole = function(telephone, role) {
  return this.findOne({ telephone, role }).select('+motDePasse +codePin');
};

// 🔍 Trouver un admin par email
userSchema.statics.findAdminByEmail = function(email) {
  return this.findOne({ email, role: 'Admin' }).select('+motDePasse');
};

// 🚴 Trouver les livreurs disponibles près d'un point
userSchema.statics.findAvailableLivreursNear = async function(coordinates, vehiculeId, limit = 5) {
  return this.find({
    role: 'Livreur',
    valide: true,
    statut: 'en_ligne',
    vehicule: vehiculeId,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: 10000 // 10 km max
      }
    }
  })
  .select('-motDePasse')
  .limit(limit)
  .sort({ scoreNote: -1, 'location.coordinates': 1 });
};

// ==================== EXPORT DU MODÈLE ====================
// ✅ Protection contre le ré-enregistrement (nodemon + ES Modules)
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;