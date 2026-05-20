const mongoose = require('mongoose')

const SOPSchema = new mongoose.Schema(
  {
    patientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    conversationId: { type: String, default: null },
    recordId:       { type: String, default: null },
    transcript:     { type: String, default: '' },

    soapData: {
      subjective:        { type: String, default: '' },
      objective:         { type: String, default: '' },
      assessment:        { type: String, default: '' },
      plan:              { type: String, default: '' },
      symptoms:          [{ type: String }],
      icd10Code:         { type: String, default: '' },
      possibleCondition: { type: String, default: '' },
      confidenceScore:   { type: Number, default: 0 },
      actionPlan:        { type: String, default: '' },
    },

    // 'pending' | 'approved' | 'rejected'
    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    doctorNote: { type: String, default: '' },
  },
  { timestamps: true }
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
SOPSchema.index({ patientId: 1 })
SOPSchema.index({ doctorId: 1 })
SOPSchema.index({ patientId: 1, status: 1 })  // patient view: own approved SOPs
SOPSchema.index({ status: 1, createdAt: -1 }) // doctor filter by status

module.exports = mongoose.model('SOP', SOPSchema)
