const mongoose = require('mongoose')

const medicalRecordSchema = new mongoose.Schema({
  patientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:      { type: String, required: true },
  type:       { type: String, enum: ['Lab Results','Imaging','Consultations','Prescriptions','Vitals'], required: true },
  category:   String,
  date:       { type: Date, default: Date.now },
  status:     { type: String, enum: ['Normal','Elevated','Reviewed','Active','Pending'], default: 'Pending' },
  details:    String,
  doctorName: String,
  // Azure Blob Storage attachment
  attachment: {
    blobName:     String,   // blob path in container
    originalName: String,
    mimeType:     String,
    sizeBytes:    Number,
  },
}, { timestamps: true })

medicalRecordSchema.index({ patientId: 1, date: -1 })
medicalRecordSchema.index({ patientId: 1, type: 1 })

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema)
