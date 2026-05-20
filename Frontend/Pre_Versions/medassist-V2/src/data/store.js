// ─── Appointments ──────────────────────────────────────────────────────────
export const INITIAL_APPOINTMENTS = [
  { id:1, patientName:'Rahul Kumar',   patientId:'P001', doctor:'Dr. Priya Nair',   doctorId:'D001', specialty:'Cardiology',        date:'Apr 16, 2026', time:'10:30 AM', mode:'video',     status:'upcoming',  avatar:'PN', color:'from-pink-400 to-rose-500',     notes:'Bring recent ECG report' },
  { id:2, patientName:'Rahul Kumar',   patientId:'P001', doctor:'Dr. Amit Sharma',  doctorId:'D002', specialty:'General Physician', date:'Apr 18, 2026', time:'2:00 PM',  mode:'in-person', status:'upcoming',  avatar:'AS', color:'from-violet-400 to-purple-500',  notes:'Annual checkup' },
  { id:3, patientName:'Rahul Kumar',   patientId:'P001', doctor:'Dr. Sunita Rao',   doctorId:'D003', specialty:'Endocrinology',     date:'Apr 22, 2026', time:'11:00 AM', mode:'in-person', status:'upcoming',  avatar:'SR', color:'from-teal-400 to-cyan-500',     notes:'Diabetes review — bring glucose log' },
  { id:4, patientName:'Rahul Kumar',   patientId:'P001', doctor:'Dr. Vikram Mehta', doctorId:'D004', specialty:'Ophthalmology',     date:'Mar 28, 2026', time:'3:30 PM',  mode:'in-person', status:'completed', avatar:'VM', color:'from-amber-400 to-orange-500',  notes:'Annual eye exam completed' },
  { id:5, patientName:'Rahul Kumar',   patientId:'P001', doctor:'Dr. Priya Nair',   doctorId:'D001', specialty:'Cardiology',        date:'Feb 12, 2026', time:'9:00 AM',  mode:'video',     status:'completed', avatar:'PN', color:'from-pink-400 to-rose-500',    notes:'Follow-up after stress test' },
  { id:6, patientName:'Anjali Bose',   patientId:'P002', doctor:'Dr. Priya Nair',   doctorId:'D001', specialty:'Cardiology',        date:'Apr 16, 2026', time:'11:30 AM', mode:'in-person', status:'upcoming',  avatar:'PN', color:'from-pink-400 to-rose-500',    notes:'Post-surgery follow-up' },
  { id:7, patientName:'Vikram Das',    patientId:'P003', doctor:'Dr. Priya Nair',   doctorId:'D001', specialty:'Cardiology',        date:'Apr 17, 2026', time:'9:00 AM',  mode:'video',     status:'upcoming',  avatar:'PN', color:'from-pink-400 to-rose-500',    notes:'Routine check-up' },
  { id:8, patientName:'Sunita Mehta',  patientId:'P004', doctor:'Dr. Amit Sharma',  doctorId:'D002', specialty:'General Physician', date:'Apr 16, 2026', time:'3:00 PM',  mode:'in-person', status:'upcoming',  avatar:'AS', color:'from-violet-400 to-purple-500', notes:'Fever & cough evaluation' },
]

export const DOCTORS = [
  { id:'D001', name:'Dr. Priya Nair',   specialty:'Cardiology',        avatar:'PN', color:'from-pink-400 to-rose-500',    slots:['9:00 AM','10:00 AM','11:00 AM','2:00 PM','3:00 PM'] },
  { id:'D002', name:'Dr. Amit Sharma',  specialty:'General Physician', avatar:'AS', color:'from-violet-400 to-purple-500', slots:['9:30 AM','11:00 AM','1:00 PM','3:00 PM','4:30 PM'] },
  { id:'D003', name:'Dr. Sunita Rao',   specialty:'Endocrinology',     avatar:'SR', color:'from-teal-400 to-cyan-500',    slots:['10:00 AM','11:30 AM','2:30 PM','4:00 PM'] },
  { id:'D004', name:'Dr. Vikram Mehta', specialty:'Ophthalmology',     avatar:'VM', color:'from-amber-400 to-orange-500', slots:['9:00 AM','10:30 AM','12:00 PM','3:30 PM'] },
]

// ─── Medical Records ────────────────────────────────────────────────────────
export const INITIAL_RECORDS = [
  { id:1, patientId:'P001', type:'Lab Results',   title:'Complete Blood Count (CBC)',       date:'Apr 10, 2026', doctor:'Dr. Amit Sharma',  status:'Normal',   category:'Lab Results',   details:'WBC: 6.2, RBC: 4.8, Hgb: 14.2, Plt: 210. All values within normal range.' },
  { id:2, patientId:'P001', type:'Lab Results',   title:'HbA1c Blood Sugar Test',           date:'Apr 5, 2026',  doctor:'Dr. Sunita Rao',   status:'Elevated', category:'Lab Results',   details:'HbA1c: 7.2% (target <7.0%). Slightly elevated — continue Metformin, dietary modifications advised.' },
  { id:3, patientId:'P001', type:'Imaging',       title:'Chest X-Ray',                      date:'Mar 28, 2026', doctor:'Dr. Vikram Mehta', status:'Normal',   category:'Imaging',       details:'No acute cardiopulmonary process. Lung fields clear bilaterally. Cardiac silhouette normal.' },
  { id:4, patientId:'P001', type:'Consultations', title:'Cardiology Follow-up Notes',       date:'Mar 15, 2026', doctor:'Dr. Priya Nair',   status:'Reviewed', category:'Consultations', details:'Patient reports improved exercise tolerance. BP well controlled on current regimen. Continue Amlodipine 5mg. Follow up in 3 months.' },
  { id:5, patientId:'P001', type:'Lab Results',   title:'Lipid Panel (Cholesterol)',         date:'Mar 8, 2026',  doctor:'Dr. Amit Sharma',  status:'Normal',   category:'Lab Results',   details:'Total Cholesterol: 182 mg/dL, LDL: 108, HDL: 52, Triglycerides: 142. All within acceptable range on Atorvastatin.' },
  { id:6, patientId:'P001', type:'Prescriptions', title:'Metformin 500mg — Prescription',   date:'Feb 20, 2026', doctor:'Dr. Sunita Rao',   status:'Active',   category:'Prescriptions', details:'Metformin 500mg twice daily with meals. Duration: 3 months. Refill authorized x2.' },
  { id:7, patientId:'P001', type:'Imaging',       title:'ECG / Electrocardiogram',          date:'Feb 12, 2026', doctor:'Dr. Priya Nair',   status:'Normal',   category:'Imaging',       details:'Normal sinus rhythm. Rate 72 bpm. No ST changes, no arrhythmia detected.' },
  { id:8, patientId:'P001', type:'Consultations', title:'Annual Physical Exam Summary',     date:'Jan 15, 2026', doctor:'Dr. Amit Sharma',  status:'Reviewed', category:'Consultations', details:'Overall health satisfactory. Weight stable. Continue current medications. Recommended flu vaccination.' },
]

// ─── Medications ─────────────────────────────────────────────────────────────
export const INITIAL_MEDS = [
  { id:1, patientId:'P001', name:'Metformin',    dose:'500 mg', frequency:'Twice daily',   times:['8:00 AM','8:00 PM'], purpose:'Type 2 Diabetes', prescriber:'Dr. Sunita Rao',   refillDate:'Apr 18, 2026', daysLeft:3,  taken:[true,false], color:'from-teal-400 to-cyan-500',   warning:'Take with meals to reduce stomach upset.' },
  { id:2, patientId:'P001', name:'Amlodipine',   dose:'5 mg',   frequency:'Once daily',    times:['9:00 AM'],           purpose:'Blood Pressure',  prescriber:'Dr. Priya Nair',    refillDate:'May 5, 2026',  daysLeft:20, taken:[true],        color:'from-brand-400 to-brand-600', warning:null },
  { id:3, patientId:'P001', name:'Atorvastatin', dose:'10 mg',  frequency:'Once at night',  times:['10:00 PM'],          purpose:'Cholesterol',     prescriber:'Dr. Amit Sharma',   refillDate:'May 12, 2026', daysLeft:27, taken:[false],       color:'from-violet-400 to-purple-600', warning:'Avoid grapefruit juice while taking this medication.' },
  { id:4, patientId:'P001', name:'Vitamin D3',   dose:'1000 IU',frequency:'Once daily',    times:['9:00 AM'],           purpose:'Supplement',      prescriber:'Dr. Amit Sharma',   refillDate:'Jun 1, 2026',  daysLeft:47, taken:[true],        color:'from-amber-400 to-orange-500', warning:null },
]

// ─── Patients (for doctor/receptionist views) ────────────────────────────────
export const PATIENTS = [
  { id:'P001', name:'Rahul Kumar',   age:41, blood:'B+', phone:'+91 98765 43210', condition:'Diabetes, Hypertension', lastVisit:'Apr 10, 2026', status:'Active', initials:'RK', color:'from-brand-400 to-teal-500' },
  { id:'P002', name:'Anjali Bose',   age:34, blood:'O+', phone:'+91 98765 11111', condition:'Arrhythmia',             lastVisit:'Apr 5, 2026',  status:'Active', initials:'AB', color:'from-pink-400 to-rose-500' },
  { id:'P003', name:'Vikram Das',    age:52, blood:'A+', phone:'+91 98765 22222', condition:'Coronary Artery Disease', lastVisit:'Mar 28, 2026', status:'Active', initials:'VD', color:'from-violet-400 to-purple-500' },
  { id:'P004', name:'Sunita Mehta',  age:28, blood:'AB-',phone:'+91 98765 33333', condition:'Fever',                  lastVisit:'Apr 14, 2026', status:'Active', initials:'SM', color:'from-amber-400 to-orange-500' },
  { id:'P005', name:'Kiran Reddy',   age:65, blood:'B-', phone:'+91 98765 44444', condition:'Diabetes Type 2',        lastVisit:'Mar 15, 2026', status:'Active', initials:'KR', color:'from-teal-400 to-cyan-500' },
]
