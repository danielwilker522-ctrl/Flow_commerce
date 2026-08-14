import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#687268' }}>
        A carregar...
      </div>
    )
  }

  // Permite o acesso se o usuário for administrador da plataforma, ignorando o 2FA
  if (profile?.is_platform_admin) {
    return children
  }

  // Caso contrário, redireciona para a rota padrão
  return <Navigate to="/app" replace />
}
