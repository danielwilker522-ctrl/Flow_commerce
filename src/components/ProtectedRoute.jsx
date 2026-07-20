import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CompleteSetup from '../pages/CompleteSetup'
import PendingApproval from '../pages/PendingApproval'

export default function ProtectedRoute({ children }) {
  const { session, profile, company, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7268' }}>
        A carregar...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!profile) return <CompleteSetup />

  if (!company?.is_approved) return <PendingApproval />

  return children
}
