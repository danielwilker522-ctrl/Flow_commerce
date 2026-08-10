import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('convite')
  const [mode, setMode] = useState(inviteCode ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) navigate('/app', { replace: true })
  }, [session])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        const result = await signUp({ email, password, fullName, companyName, inviteCode })
        if (result.needsEmailConfirmation) {
          setInfo('Conta criada! Verifica o teu email para confirmar antes de entrares.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(err.message || 'Ocorreu um erro. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Flow<span>Commerce</span></div>
        <p className="auth-subtitle">
          {inviteCode
            ? 'Foste convidado para uma equipa — cria a tua conta para entrares.'
            : mode === 'login' ? 'Entra para gerir o teu negócio.' : 'Cria a tua conta e a tua empresa.'}
        </p>

        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert success">{info}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Nome completo</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              {!inviteCode && (
                <div className="field">
                  <label>Nome da empresa</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
              )}
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Palavra-passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 10 : undefined} />
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'A processar...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {!inviteCode && (
          <div className="auth-toggle">
            {mode === 'login' ? (
              <>Ainda não tens conta? <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Criar conta</button></>
            ) : (
              <>Já tens conta? <button onClick={() => { setMode('login'); setError(''); setInfo('') }}>Entrar</button></>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
