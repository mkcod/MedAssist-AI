// Central API client — wraps fetch with auth token injection

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function getToken() {
  return localStorage.getItem('medassist_token')
}

async function request(method, path, body, isFormData = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const api = {
  get:    (path)               => request('GET',    path),
  post:   (path, body)         => request('POST',   path, body),
  patch:  (path, body)         => request('PATCH',  path, body),
  put:    (path, body)         => request('PUT',    path, body),
  delete: (path)               => request('DELETE', path),
  upload: (path, formData)     => request('POST',   path, formData, true),
}

// ─── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email, password)  => api.post('/auth/login',    { email, password }),
  register: (data)             => api.post('/auth/register', data),
  logout:   ()                 => api.post('/auth/logout'),
  me:       ()                 => api.get('/auth/me'),
}

// ─── Dashboard ─────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard'),
}

// ─── Appointments ──────────────────────────────────────────────────────
export const appointmentsApi = {
  list:         (params = {}) => api.get('/appointments?' + new URLSearchParams(params)),
  create:       (data)        => api.post('/appointments', data),
  updateStatus: (id, status, cancelReason) => api.patch(`/appointments/${id}/status`, { status, cancelReason }),
  delete:       (id)          => api.delete(`/appointments/${id}`),
}

// ─── Records ───────────────────────────────────────────────────────────
export const recordsApi = {
  list:     (params = {}) => api.get('/records?' + new URLSearchParams(params)),
  create:   (formData)    => api.upload('/records', formData),
  download: (id)          => api.get(`/records/${id}/download`),
  delete:   (id)          => api.delete(`/records/${id}`),
}

// ─── Medications ───────────────────────────────────────────────────────
export const medicationsApi = {
  list:       (params = {}) => api.get('/medications?' + new URLSearchParams(params)),
  create:     (data)        => api.post('/medications', data),
  markTaken:  (id, doseIndex, taken) => api.patch(`/medications/${id}/taken`, { doseIndex, taken }),
  deactivate: (id)          => api.delete(`/medications/${id}`),
}

// ─── Vitals ────────────────────────────────────────────────────────────
export const vitalsApi = {
  list:    (params = {}) => api.get('/vitals?' + new URLSearchParams(params)),
  latest:  (params = {}) => api.get('/vitals/latest?' + new URLSearchParams(params)),
  chart:   (params = {}) => api.get('/vitals/chart?' + new URLSearchParams(params)),
  add:     (data)        => api.post('/vitals', data),
}

// ─── Users ─────────────────────────────────────────────────────────────
export const usersApi = {
  doctors:      ()       => api.get('/users/doctors'),
  patients:     (search) => api.get('/users/patients' + (search ? `?search=${search}` : '')),
  myProfile:    ()       => api.get('/users/me/profile'),
  updateProfile:(data)   => api.patch('/users/me/profile', data),
}

// ─── Chat ──────────────────────────────────────────────────────────────
export const chatApi = {
  history:     ()        => api.get('/chat/history'),
  sendMessage: (message, sessionId) => api.post('/chat/message', { message, sessionId }),
  clearHistory:()        => api.delete('/chat/history'),
}
