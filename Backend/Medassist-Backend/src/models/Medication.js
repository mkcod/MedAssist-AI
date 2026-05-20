const mongoose = require('mongoose')

const medicationSchema = new mongoose.Schema({
  patientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescriberId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name:        { type: String, required: true },
  dose:        String,
  frequency:   String,
  times:       [String],
  purpose:     String,
  prescriberName: String,
  refillDate:  Date,
  daysLeft:    Number,
  warning:     String,
  color:       String,
  isActive:    { type: Boolean, default: true },
  // Daily taken log { date: 'YYYY-MM-DD', doseIndex: 0, taken: true }
  takenLog: [{
    date:      String,
    doseIndex: Number,
    taken:     Boolean,
    takenAt:   Date,
  }],
}, { timestamps: true })

medicationSchema.index({ patientId: 1, isActive: 1 })

module.exports = mongoose.model('Medication', medicationSchema)
