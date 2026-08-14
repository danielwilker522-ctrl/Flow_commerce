import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return <div>A carregar...</div>
  }

  // Deixa passar se for administrador da plataforma, ignorando completamente o 2FA
  if (profile?.is_platform_admin) {
    return <>{children}</>
  }

  // Se não for admin, joga de volta para o dashboard padrão
  return <Navigate to="/app" replace />
}
