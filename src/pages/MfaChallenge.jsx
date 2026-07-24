import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function MfaChallenge() {
  const { verifyMfaCode, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyMfaCode(code.trim())
    } catch (err) {
      setError('Código inválido. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Flow<span>Commerce</span></div>
        <p className="auth-subtitle">
          Introduz o código de 6 dígitos da tua aplicação de autenticação (Google Authenticator, Authy, etc.).
        </p>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Código de verificação</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
              required
            />
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={loading || code.length < 6}>
            {loading ? 'A verificar...' : 'Confirmar'}
          </button>
        </form>

        <div className="auth-toggle">
          <button onClick={signOut}>Terminar sessão</button>
        </div>
      </div>
    </div>
  )
}
