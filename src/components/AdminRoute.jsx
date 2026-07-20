import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7268' }}>
        A carregar...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!profile?.is_platform_admin) return <Navigate to="/app" replace />

  return children
}
