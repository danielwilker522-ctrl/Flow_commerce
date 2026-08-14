import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Security() {
  const { refreshMfaStatus, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const isMandatory = false
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadFactors() }, [])

  async function loadFactors() {
    setLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(data?.totp || [])
    setLoading(false)
  }

  async function startEnroll() {
    setError('')
    setEnrolling(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error) throw error
      setQrCode(data.totp.qr_code)
      setFactorId(data.id)
    } catch (err) {
      setError(err.message)
      setEnrolling(false)
    }
  }

  async function confirmEnroll(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId, challengeId: challengeData.id, code: code.trim(),
      })
      if (verifyError) throw verifyError

      setSuccess('Autenticação de dois fatores ativada com sucesso!')
      setEnrolling(false)
      setQrCode(null)
      setCode('')
      await loadFactors()
      await refreshMfaStatus()
    } catch (err) {
      setError('Código inválido. Verifica a aplicação de autenticação e tenta novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function removeFactor(id) {
    if (!confirm('Desativar a autenticação de dois fatores? A tua conta ficará protegida apenas por palavra-passe.')) return
    await supabase.auth.mfa.unenroll({ factorId: id })
    await loadFactors()
    await refreshMfaStatus()
  }

  function cancelEnroll() {
    setEnrolling(false)
    setQrCode(null)
    setCode('')
    setError('')
  }

  const hasActiveFactor = factors.some(f => f.status === 'verified')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Segurança</h1>
          <p>Protege a tua conta com autenticação de dois fatores (2FA).</p>
        </div>
      </div>

      {isMandatory && !hasActiveFactor && (
        <div className="alert error" style={{ marginBottom: 20 }}>
          Como administrador da plataforma, é obrigatório ativares a autenticação de dois fatores antes de acederes ao Painel Admin.
        </div>
      )}
      {profile?.is_platform_admin && !hasActiveFactor && !isMandatory && (
        <div className="alert error" style={{ marginBottom: 20 }}>
          A tua conta tem acesso de administrador da plataforma — recomendamos vivamente que ativa a 2FA agora.
        </div>
      )}

      {error && !enrolling && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="card" style={{ padding: 24, maxWidth: 460 }}>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>A carregar...</p>
        ) : hasActiveFactor && !enrolling ? (
          <>
            <div className="badge ok" style={{ marginBottom: 14 }}>2FA ativa</div>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 18 }}>
              A tua conta está protegida com um código adicional a cada início de sessão.
            </p>
            {factors.filter(f => f.status === 'verified').map(f => (
              <button key={f.id} className="btn-danger" onClick={() => removeFactor(f.id)}>
                Desativar 2FA
              </button>
            ))}
          </>
        ) : enrolling ? (
          <>
            <h3 style={{ marginBottom: 10 }}>1. Digitaliza este código</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 16 }}>
              Abre o Google Authenticator, Authy ou outra app semelhante e digitaliza o QR code.
            </p>
            {qrCode && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <img
                  src={`data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`}
                  alt="QR code para configurar autenticação de dois fatores"
                  style={{ width: 180, height: 180, border: '1px solid var(--border)', borderRadius: 8 }}
                />
              </div>
            )}
            <h3 style={{ marginBottom: 10 }}>2. Confirma o código</h3>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={confirmEnroll}>
              <div className="field">
                <label>Código de 6 dígitos</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  required
                />
              </div>
              <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="btn-primary" disabled={submitting || code.length < 6}>
                  {submitting ? 'A confirmar...' : 'Ativar 2FA'}
                </button>
                {!isMandatory && (
                  <button type="button" className="btn-secondary" onClick={cancelEnroll}>Cancelar</button>
                )}
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="badge low" style={{ marginBottom: 14 }}>2FA desativada</div>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 18 }}>
              Adiciona uma camada extra de segurança: além da palavra-passe, vais precisar de um código
              gerado por uma app no telemóvel para entrares na conta.
            </p>
            <button className="btn-primary" onClick={startEnroll}>Ativar autenticação de dois fatores</button>
          </>
        )}
      </div>
    </div>
  )
}
