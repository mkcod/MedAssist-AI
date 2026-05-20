const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema({
  patientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName:  String,
  doctorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorName:   String,
  specialty:    String,
  date:         { type: Date, required: true },
  time:         { type: String, required: true },
  mode:         { type: String, enum: ['video','in-person','phone'], default: 'in-person' },
  status:       { type: String, enum: ['upcoming','completed','cancelled','no-show'], default: 'upcoming' },
  notes:        String,
  // doctor's avatar metadata for frontend
  doctorInitials: String,
  doctorColor:    String,
  // cancellation
  cancelledBy:  String,
  cancelReason: String,
  // video call
  meetingLink:  String,
  // timestamps
}, { timestamps: true })

appointmentSchema.index({ patientId: 1, date: -1 })
appointmentSchema.index({ doctorId: 1, date: -1 })
appointmentSchema.index({ date: 1, status: 1 })

module.exports = mongoose.model('Appointment', appointmentSchema)
