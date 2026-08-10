import { useAuth } from '../context/AuthContext'

export default function AccountDeactivated() {
  const { signOut } = useAuth()

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>Flow<span>Commerce</span></div>
        <div style={{ margin: '20px 0' }}>
          <div className="badge low" style={{ fontSize: 13 }}>Conta desativada</div>
        </div>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          O teu acesso a esta loja foi desativado por um administrador. Contacta a gerência se achares que isto é um engano.
        </p>
        <button className="btn-secondary" onClick={signOut}>Terminar sessão</button>
      </div>
    </div>
  )
}
