import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef({})

  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('medassist_token')
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

    import('socket.io-client').then(({ io }) => {
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
      })

      socket.on('connect',    () => setConnected(true))
      socket.on('disconnect', () => setConnected(false))

      const events = [
        'appointment:created', 'appointment:updated',
        'record:created',
        'medication:created',
        'vitals:new',
        'notification:received',
        // SOP events
        'sop:new',
        'sop:approved',
        'sop:rejected',
        'sop:submitted',
        'orchestrator:log',
      ]

      events.forEach(event => {
        socket.on(event, (data) => {
          const handlers = listenersRef.current[event] || []
          handlers.forEach(fn => fn(data))
          // Route all SOP/notification events through notification:received too
          if (['sop:new', 'sop:approved', 'sop:rejected', 'sop:submitted'].includes(event)) {
            const notifHandlers = listenersRef.current['notification:received'] || []
            notifHandlers.forEach(fn => fn({ ...data, type: event }))
          }
        })
      })

      socketRef.current = socket
    }).catch(err => {
      console.warn('Socket.io-client not installed — real-time disabled:', err.message)
    })

    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [user])

  const on = (event, handler) => {
    listenersRef.current[event] = [...(listenersRef.current[event] || []), handler]
    return () => {
      listenersRef.current[event] = (listenersRef.current[event] || []).filter(h => h !== handler)
    }
  }

  const emit = (event, data) => socketRef.current?.emit(event, data)

  return (
    <SocketContext.Provider value={{ connected, on, emit }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
