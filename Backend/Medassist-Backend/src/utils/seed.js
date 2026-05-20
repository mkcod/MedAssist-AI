require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// ── Use the shared connectDB so options are always in sync ──────────────────
const { connectDB, disconnectDB } = require('../config/database')

// ── Models ───────────────────────────────────────────────────────────────────
const User = require('../models/User')
const Appointment = require('../models/Appointment')
const MedicalRecord = require('../models/MedicalRecord')
const Medication = require('../models/Medication')
const Vitals = require('../models/Vitals')

// ── Simple console logger fallback (seed runs standalone) ───────────────────
let logger
try {
  logger = require('./logger')
} catch {
  const ts = () => new Date().toISOString()
  logger = {
    info: (m) => console.log(`[${ts()}] INFO:  ${m}`),
    warn: (m) => console.warn(`[${ts()}] WARN:  ${m}`),
    error: (m) => console.error(`[${ts()}] ERROR: ${m}`),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const future = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d }
const past = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return d }

async function seed() {
  // ── 1. Connect ─────────────────────────────────────────────────────────────
  logger.info('Starting seed …')
  await connectDB()   // all connection logic + error diagnosis lives here

  try {
    // ── 2. Wipe existing data ─────────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Appointment.deleteMany({}),
      MedicalRecord.deleteMany({}),
      Medication.deleteMany({}),
      Vitals.deleteMany({}),
    ])
    logger.info('Cleared existing data')

    // ── 3. Users ──────────────────────────────────────────────────────────────
    // Passwords are hashed by the User model pre-save hook.
    // If your model does NOT hash automatically, swap to:
    //   password: await bcrypt.hash('patient123', 12)
    const users = await User.create([
      {
        email: 'rahul@medassist.com',
        password: 'patient123',
        name: 'Rahul Kumar',
        role: 'patient',
        initials: 'RK',
        phone: '+91 98765 43210',
        color: 'from-brand-400 to-teal-500',
        subtitle: 'Patient ID #2891',
        patientProfile: {
          patientId: 'P001',
          bloodGroup: 'B+',
          height: "5'10\"",
          weight: '78 kg',
          bmi: '24.9',
          dateOfBirth: new Date('1985-03-14'),
          gender: 'Male',
          address: 'Bengaluru, Karnataka',
          conditions: [
            'Type 2 Diabetes (Controlled)',
            'Hypertension (Stage 1)',
            'Hyperlipidemia',
          ],
          allergies: ['Penicillin', 'Sulfa drugs', 'Latex'],
          emergencyContacts: [
            { name: 'Anjali Kumar', relation: 'Spouse', phone: '+91 98765 00001' },
            { name: 'Ravi Kumar', relation: 'Father', phone: '+91 98765 00002' },
          ],
        },
      },
      {
        email: 'priya@medassist.com',
        password: 'doctor123',
        name: 'Dr. Priya Nair',
        role: 'doctor',
        initials: 'PN',
        color: 'from-pink-400 to-rose-500',
        subtitle: 'Cardiologist · Reg #MCI-29817',
        doctorProfile: {
          doctorId: 'D001',
          specialty: 'Cardiology',
          department: 'Cardiology',
          regNumber: 'MCI-29817',
          experience: '14 yrs',
          availableSlots: ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM'],
        },
      },
      {
        email: 'meera@medassist.com',
        password: 'recept123',
        name: 'Meera Patel',
        role: 'receptionist',
        initials: 'MP',
        color: 'from-violet-400 to-purple-500',
        subtitle: 'Front Desk · OPD Wing B',
        receptionistProfile: {
          department: 'OPD',
          shift: 'Morning (8am–4pm)',
        },
      },
      {
        email: 'rohan@medassist.com',
        password: 'attend123',
        name: 'Rohan Singh',
        role: 'attendee',
        initials: 'RS',
        color: 'from-amber-400 to-orange-500',
        subtitle: 'Attender for Rahul Kumar',
        attendeeProfile: {
          relation: 'Son',
          patientId: 'P001',
        },
      },
    ])

    const [rahul, priya] = users
    logger.info(`Created ${users.length} users`)

    // ── 4. Vitals (last 10 days for Rahul) ────────────────────────────────────
    const vitalsData = Array.from({ length: 10 }, (_, i) => {
      const d = past(9 - i)
      return {
        patientId: rahul._id,
        recordedBy: rahul._id,
        recordedAt: d,
        source: 'manual',
        heartRate: 68 + Math.floor(Math.random() * 15),
        systolic: 116 + Math.floor(Math.random() * 12),
        diastolic: 74 + Math.floor(Math.random() * 10),
        temperature: parseFloat((98.4 + Math.random() * 0.6).toFixed(1)),
        spo2: 97 + Math.floor(Math.random() * 2),
        bloodGlucose: 88 + Math.floor(Math.random() * 20),
        weight: 78,
      }
    })
    await Vitals.insertMany(vitalsData)
    logger.info(`Created ${vitalsData.length} vitals records`)

    // ── 5. Appointments ───────────────────────────────────────────────────────
    await Appointment.insertMany([
      {
        patientId: rahul._id, patientName: 'Rahul Kumar',
        doctorId: priya._id, doctorName: 'Dr. Priya Nair',
        specialty: 'Cardiology',
        date: future(1), time: '10:30 AM', mode: 'video', status: 'upcoming',
        doctorInitials: 'PN', doctorColor: 'from-pink-400 to-rose-500',
        notes: 'Bring recent ECG report',
      },
      {
        patientId: rahul._id, patientName: 'Rahul Kumar',
        doctorId: priya._id, doctorName: 'Dr. Priya Nair',
        specialty: 'Cardiology',
        date: past(30), time: '9:00 AM', mode: 'video', status: 'completed',
        doctorInitials: 'PN', doctorColor: 'from-pink-400 to-rose-500',
        notes: 'Follow-up after stress test',
      },
      {
        patientId: rahul._id, patientName: 'Rahul Kumar',
        doctorId: priya._id, doctorName: 'Dr. Priya Nair',
        specialty: 'Ophthalmology',
        date: past(60), time: '3:30 PM', mode: 'in-person', status: 'completed',
        doctorInitials: 'PN', doctorColor: 'from-pink-400 to-rose-500',
        notes: 'Annual eye exam',
      },
    ])
    logger.info('Created appointments')

    // ── 6. Medical Records ────────────────────────────────────────────────────
    await MedicalRecord.insertMany([
      {
        patientId: rahul._id, doctorId: priya._id,
        doctorName: 'Dr. Priya Nair',
        title: 'Complete Blood Count (CBC)', type: 'Lab Results', status: 'Normal',
        date: past(7),
        details: 'WBC: 6.2, RBC: 4.8, Hgb: 14.2, Plt: 210. All values within normal range.',
      },
      {
        patientId: rahul._id, doctorId: priya._id,
        doctorName: 'Dr. Priya Nair',
        title: 'HbA1c Blood Sugar Test', type: 'Lab Results', status: 'Elevated',
        date: past(12),
        details: 'HbA1c: 7.2%. Slightly elevated — continue Metformin, dietary modifications advised.',
      },
      {
        patientId: rahul._id, doctorId: priya._id,
        doctorName: 'Dr. Priya Nair',
        title: 'Chest X-Ray', type: 'Imaging', status: 'Normal',
        date: past(19),
        details: 'No acute cardiopulmonary process. Lung fields clear bilaterally. Cardiac silhouette normal.',
      },
      {
        patientId: rahul._id, doctorId: priya._id,
        doctorName: 'Dr. Priya Nair',
        title: 'Cardiology Follow-up Notes', type: 'Consultations', status: 'Reviewed',
        date: past(32),
        details: 'BP well controlled on current regimen. Continue Amlodipine 5mg. Follow up in 3 months.',
      },
      {
        patientId: rahul._id, doctorId: priya._id,
        doctorName: 'Dr. Priya Nair',
        title: 'Lipid Panel (Cholesterol)', type: 'Lab Results', status: 'Normal',
        date: past(40),
        details: 'Total Cholesterol: 182 mg/dL, LDL: 108, HDL: 52, Triglycerides: 142. Acceptable on Atorvastatin.',
      },
    ])
    logger.info('Created medical records')

    // ── 7. Medications ────────────────────────────────────────────────────────
    await Medication.insertMany([
      {
        patientId: rahul._id, prescriberId: priya._id,
        prescriberName: 'Dr. Priya Nair',
        name: 'Metformin', dose: '500 mg', frequency: 'Twice daily',
        times: ['8:00 AM', '8:00 PM'], purpose: 'Type 2 Diabetes',
        daysLeft: 3, refillDate: future(3),
        color: 'from-teal-400 to-cyan-500',
        warning: 'Take with meals to reduce stomach upset.',
      },
      {
        patientId: rahul._id, prescriberId: priya._id,
        prescriberName: 'Dr. Priya Nair',
        name: 'Amlodipine', dose: '5 mg', frequency: 'Once daily',
        times: ['9:00 AM'], purpose: 'Blood Pressure',
        daysLeft: 20, refillDate: future(20),
        color: 'from-brand-400 to-brand-600',
      },
      {
        patientId: rahul._id, prescriberId: priya._id,
        prescriberName: 'Dr. Priya Nair',
        name: 'Atorvastatin', dose: '10 mg', frequency: 'Once at night',
        times: ['10:00 PM'], purpose: 'Cholesterol',
        daysLeft: 27, refillDate: future(27),
        color: 'from-violet-400 to-purple-600',
        warning: 'Avoid grapefruit juice while taking this medication.',
      },
      {
        patientId: rahul._id, prescriberId: priya._id,
        prescriberName: 'Dr. Priya Nair',
        name: 'Vitamin D3', dose: '1000 IU', frequency: 'Once daily',
        times: ['9:00 AM'], purpose: 'Supplement',
        daysLeft: 47, refillDate: future(47),
        color: 'from-amber-400 to-orange-500',
      },
    ])
    logger.info('Created medications')

    logger.info('✅ Database seeded successfully!')
    logger.info('─────────────────────────────────────────────────────')
    logger.info('Demo credentials:')
    logger.info('  Patient:       rahul@medassist.com  / patient123')
    logger.info('  Doctor:        priya@medassist.com  / doctor123')
    logger.info('  Receptionist:  meera@medassist.com  / recept123')
    logger.info('  Attendee:      rohan@medassist.com  / attend123')
    logger.info('─────────────────────────────────────────────────────')

  } catch (err) {
    logger.error(`Seed data creation failed: ${err.message}`)
    if (err.code === 11000) {
      logger.error('  → Duplicate key error. Run seed again — deleteMany should have cleared it.')
    }
    throw err   // re-throw so the outer catch can exit(1)
  } finally {
    await disconnectDB()
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
