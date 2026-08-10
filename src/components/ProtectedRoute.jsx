import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CompleteSetup from '../pages/CompleteSetup'
import PendingApproval from '../pages/PendingApproval'
import MfaChallenge from '../pages/MfaChallenge'
import AccountDeactivated from '../pages/AccountDeactivated'

export default function ProtectedRoute({ children }) {
  const { session, profile, company, loading, mfaRequired } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7268' }}>
        A carregar...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (mfaRequired) return <MfaChallenge />

  if (!profile) return <CompleteSetup />

  if (!profile.is_active) return <AccountDeactivated />

  if (!company?.is_approved) return <PendingApproval />

  return children
}
