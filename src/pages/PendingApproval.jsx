import { useAuth } from '../context/AuthContext'

export default function PendingApproval() {
  const { company, signOut } = useAuth()

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>Flow<span>Commerce</span></div>
        <div style={{ margin: '20px 0' }}>
          <div className="badge low" style={{ fontSize: 13 }}>Conta pendente de aprovação</div>
        </div>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          A conta de <strong>{company?.name}</strong> foi criada com sucesso, mas ainda precisa de ser aprovada
          antes de poderes começar a usar o FlowCommerce. Assim que for validada, terás acesso automaticamente.
        </p>
        <button className="btn-secondary" onClick={signOut}>Terminar sessão</button>
      </div>
    </div>
  )
}
