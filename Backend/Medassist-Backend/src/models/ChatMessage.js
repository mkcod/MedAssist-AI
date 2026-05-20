const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String, enum: ['user','assistant'], required: true },
  text:     { type: String, required: true },
  sessionId:String,
}, { timestamps: true })

chatMessageSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
