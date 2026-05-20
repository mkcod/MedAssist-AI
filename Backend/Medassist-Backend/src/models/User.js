const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  // ─── Identity ─────────────────────────────────────────────
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, required: true, enum: ['patient','doctor','receptionist','attendee'] },
  name:     { type: String, required: true, trim: true },
  initials: { type: String },
  phone:    { type: String, trim: true },
  isActive: { type: Boolean, default: true },

  // ─── Patient-specific ─────────────────────────────────────
  patientProfile: {
    patientId:    String,
    bloodGroup:   String,
    height:       String,
    weight:       String,
    bmi:          String,
    dateOfBirth:  Date,
    gender:       String,
    address:      String,
    conditions:   [String],
    allergies:    [String],
    emergencyContacts: [{
      name:     String,
      relation: String,
      phone:    String,
    }],
  },

  // ─── Doctor-specific ──────────────────────────────────────
  doctorProfile: {
    doctorId:    String,
    specialty:   String,
    department:  String,
    regNumber:   String,
    experience:  String,
    availableSlots: [String],
    color:       String,
  },

  // ─── Receptionist-specific ────────────────────────────────
  receptionistProfile: {
    department: String,
    shift:      String,
  },

  // ─── Attendee-specific ────────────────────────────────────
  attendeeProfile: {
    relation:   String,
    patientId:  String,
  },

  // ─── Display ──────────────────────────────────────────────
  color:    { type: String, default: 'from-brand-400 to-teal-500' },
  subtitle: String,

  // ─── Timestamps ───────────────────────────────────────────
  lastLogin:   Date,
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, { timestamps: true })

// Auto-generate initials from name
userSchema.pre('save', function () {
  if (this.isModified('name') && !this.initials) {
    this.initials = this.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
})

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Strip password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 })
userSchema.index({ isActive: 1 })
userSchema.index({ role: 1, isActive: 1 })            // dashboard countDocuments queries
userSchema.index({ 'attendeeProfile.patientId': 1 })  // attendee→patient lookup in appointments

module.exports = mongoose.model('User', userSchema)
