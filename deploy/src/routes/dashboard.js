const express = require('express')
const router = express.Router()
const Appointment = require('../models/Appointment')
const MedicalRecord = require('../models/MedicalRecord')
const Medication = require('../models/Medication')
const Vitals = require('../models/Vitals')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

router.use(protect)

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id
    const role = req.user.role
    const today = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1)

    if (role === 'patient') {
      const [latestVitals, upcomingAppts, activeMeds, recentRecords] = await Promise.all([
        Vitals.findOne({ patientId: userId }).sort({ recordedAt: -1 }).lean(),
        Appointment.find({ patientId: userId, status: 'upcoming', date: { $gte: today } }).sort({ date: 1 }).limit(3).lean(),
        Medication.find({ patientId: userId, isActive: true }).lean(),
        MedicalRecord.find({ patientId: userId }).sort({ date: -1 }).limit(5).lean(),
      ])

      // Heart rate history for chart (last 8 readings)
      const hrHistory = await Vitals.find({ patientId: userId, heartRate: { $exists: true } })
        .sort({ recordedAt: -1 }).limit(8).select('heartRate recordedAt').lean()
      const heartRateChart = hrHistory.reverse().map(v => ({
        time: new Date(v.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bpm: v.heartRate,
      }))

      // BP chart (last 7 days)
      const bpHistory = await Vitals.find({ patientId: userId, systolic: { $exists: true } })
        .sort({ recordedAt: -1 }).limit(7).select('systolic diastolic recordedAt').lean()
      const bpChart = bpHistory.reverse().map(v => ({
        day: new Date(v.recordedAt).toLocaleDateString('en-US', { weekday: 'short' }),
        sys: v.systolic, dia: v.diastolic,
      }))

      return res.json({
        success: true,
        role: 'patient',
        data: {
          vitals: latestVitals,
          heartRateChart,
          bpChart,
          upcomingAppointments: upcomingAppts,
          activeMedications: activeMeds.length,
          lowStockMeds: activeMeds.filter(m => m.daysLeft <= 5),
          recentRecords,
        }
      })
    }

    if (role === 'doctor') {
      const [todayAppts, totalPatients, pendingRecords, upcomingAppts] = await Promise.all([
        Appointment.find({ doctorId: userId, date: { $gte: today, $lt: tomorrow } }).populate('patientId','name initials color').lean(),
        Appointment.distinct('patientId', { doctorId: userId }),
        MedicalRecord.countDocuments({ doctorId: userId, status: 'Pending' }),
        Appointment.find({ doctorId: userId, status: 'upcoming', date: { $gte: today } }).sort({ date: 1 }).limit(5).populate('patientId','name initials color').lean(),
      ])

      return res.json({
        success: true, role: 'doctor',
        data: { todayAppointments: todayAppts, totalPatients: totalPatients.length, pendingRecords, upcomingAppointments: upcomingAppts }
      })
    }

    if (role === 'receptionist') {
      const [todayAppts, totalPatients, totalDoctors] = await Promise.all([
        Appointment.find({ date: { $gte: today, $lt: tomorrow } }).populate('patientId','name initials').populate('doctorId','name').lean(),
        User.countDocuments({ role: 'patient', isActive: true }),
        User.countDocuments({ role: 'doctor', isActive: true }),
      ])
      return res.json({
        success: true, role: 'receptionist',
        data: { todayAppointments: todayAppts, totalPatients, totalDoctors }
      })
    }

    // Attendee: same as patient but for their linked patient
    res.json({ success: true, role, data: {} })
  } catch (err) { next(err) }
})

module.exports = router
