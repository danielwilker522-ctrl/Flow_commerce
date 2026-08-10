import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MfaChallenge from '../pages/MfaChallenge'

export default function AdminRoute({ children }) {
  const { session, profile, loading, mfaRequired, mfaEnrolled } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7268' }}>
        A carregar...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (mfaRequired) return <MfaChallenge />
  if (!profile?.is_platform_admin) return <Navigate to="/app" replace />

  // Administradores da plataforma são obrigados a ter 2FA ativa
  if (!mfaEnrolled) return <Navigate to="/app/seguranca?obrigatorio=admin" replace />

  return children
}
