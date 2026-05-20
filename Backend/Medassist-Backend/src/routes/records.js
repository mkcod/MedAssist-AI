const express = require('express')
const router = express.Router()
const multer = require('multer')
const MedicalRecord = require('../models/MedicalRecord')
const { protect, restrictTo } = require('../middleware/auth')
const { uploadFile, generateSASUrl, deleteFile } = require('../services/blobStorage')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.use(protect)

// ─── GET /api/records ─────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category, status, search } = req.query
    let filter = {}

    if (req.user.role === 'patient') {
      filter.patientId = req.user._id
    } else if (req.user.role === 'doctor') {
      // doctor sees records they created OR their patients
      filter.$or = [{ doctorId: req.user._id }]
      if (req.query.patientId) filter.patientId = req.query.patientId
    } else if (req.query.patientId) {
      filter.patientId = req.query.patientId
    }

    if (category && category !== 'All') filter.type = category
    if (status) filter.status = status
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { doctorName: { $regex: search, $options: 'i' } },
      ]
    }

    const records = await MedicalRecord.find(filter).sort({ date: -1 }).lean()
    res.json({ success: true, count: records.length, data: records })
  } catch (err) { next(err) }
})

// ─── POST /api/records ────────────────────────────────────────────────────
router.post('/', restrictTo('doctor','receptionist'), upload.single('file'), async (req, res, next) => {
  try {
    const { patientId, title, type, status, details, date } = req.body

    const recordData = {
      patientId,
      doctorId: req.user._id,
      doctorName: req.user.name,
      title, type,
      status: status || 'Pending',
      details,
      date: date ? new Date(date) : new Date(),
    }

    // Upload file to Azure Blob Storage if provided
    if (req.file) {
      const folder = `records/${patientId}`
      const { blobName } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder)
      recordData.attachment = {
        blobName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      }
    }

    const record = await MedicalRecord.create(recordData)

    const io = req.app.get('io')
    io?.to(`user:${patientId}`).emit('record:created', record)

    res.status(201).json({ success: true, data: record })
  } catch (err) { next(err) }
})

// ─── GET /api/records/:id/download ───────────────────────────────────────
// Returns a time-limited SAS URL for the file
router.get('/:id/download', async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' })

    // Patients can only access their own records
    if (req.user.role === 'patient' && String(record.patientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    if (!record.attachment?.blobName) {
      return res.status(404).json({ success: false, message: 'No file attached to this record' })
    }

    const sasUrl = await generateSASUrl(record.attachment.blobName, 60)
    res.json({ success: true, url: sasUrl, filename: record.attachment.originalName })
  } catch (err) { next(err) }
})

// ─── DELETE /api/records/:id ──────────────────────────────────────────────
router.delete('/:id', restrictTo('doctor'), async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
    if (!record) return res.status(404).json({ success: false, message: 'Not found' })

    if (record.attachment?.blobName) await deleteFile(record.attachment.blobName)
    await record.deleteOne()

    res.json({ success: true, message: 'Record deleted' })
  } catch (err) { next(err) }
})

module.exports = router
