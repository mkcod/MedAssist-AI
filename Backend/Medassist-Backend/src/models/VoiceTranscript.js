const mongoose = require('mongoose')

const voiceTranscriptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    transcript: {
      type: String,
      required: true,
      trim: true,
    },
    interimSnapshots: {
      // Rolling interim text snapshots captured during recording
      type: [String],
      default: [],
    },
    language: {
      type: String,
      default: 'en-IN',
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    confidence: {
      // 0-1 confidence from SpeechRecognition API
      type: Number,
      default: null,
    },
    aiResponse: {
      // Optional: AI reply generated from this transcript
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
)

voiceTranscriptSchema.virtual('shortPreview').get(function () {
  return this.transcript.length > 80
    ? this.transcript.slice(0, 80) + '…'
    : this.transcript
})

voiceTranscriptSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('VoiceTranscript', voiceTranscriptSchema)
