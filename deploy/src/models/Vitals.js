const mongoose = require('mongoose')

const vitalsSchema = new mongoose.Schema({
  patientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordedAt:   { type: Date, default: Date.now },
  recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Core vitals
  heartRate:      Number,   // bpm
  systolic:       Number,   // mmHg
  diastolic:      Number,   // mmHg
  temperature:    Number,   // °F
  spo2:           Number,   // %
  bloodGlucose:   Number,   // mg/dL
  weight:         Number,   // kg
  respiratoryRate:Number,   // breaths/min
  // Derived
  bmi:            Number,
  notes:          String,
  source:         { type: String, enum: ['manual','device','lab'], default: 'manual' },
}, { timestamps: true })

vitalsSchema.index({ patientId: 1, recordedAt: -1 })

module.exports = mongoose.model('Vitals', vitalsSchema)
