import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)
const ACTIVE_COMPANY_KEY = 'flowcommerce_active_company'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [accessibleCompanies, setAccessibleCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaEnrolled, setMfaEnrolled] = useState(false)

  const loadCompanyById = useCallback(async (companyId) => {
    const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
    if (!error && data) {
      setCompany(data)
      localStorage.setItem(ACTIVE_COMPANY_KEY, companyId)
    }
  }, [])

  const loadProfileAndCompany = useCallback(async (userId) => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      // Falha temporária (ex: token a renovar depois de o browser estar
      // muito tempo inativo) — não apagamos o que já tínhamos carregado,
      // para não mostrar por engano o ecrã de "completar registo".
      console.warn('Falha temporária ao carregar perfil:', profileError.message)
      return
    }

    setProfile(profileData || null)
    if (!profileData?.company_id) return

    const { data: companiesList } = await supabase.rpc('get_my_accessible_companies')
    const accessible = companiesList || [{ id: profileData.company_id, name: null }]
    setAccessibleCompanies(accessible)

    const savedActiveId = localStorage.getItem(ACTIVE_COMPANY_KEY)
    const stillAccessible = savedActiveId && accessible.some(c => c.id === savedActiveId)
    const targetCompanyId = stillAccessible ? savedActiveId : profileData.company_id

    await loadCompanyById(targetCompanyId)
  }, [loadCompanyById])

  async function switchCompany(companyId) {
    await loadCompanyById(companyId)
  }

  const checkMfaStatus = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!error && data) {
      setMfaRequired(data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel)
    }
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    setMfaEnrolled(!!factorsData?.totp?.some(f => f.status === 'verified'))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfileAndCompany(session.user.id), checkMfaStatus()])
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfileAndCompany(session.user.id), checkMfaStatus()])
      } else {
        setProfile(null)
        setCompany(null)
        setAccessibleCompanies([])
        setMfaRequired(false)
        localStorage.removeItem(ACTIVE_COMPANY_KEY)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfileAndCompany, checkMfaStatus])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        // A aba voltou a ficar ativa depois de estar em segundo plano —
        // confirma a sessão junto do Supabase (renova o token se precisar)
        // antes de qualquer outra ação, para evitar o bug de "perfil em falta".
        supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
          setSession(freshSession)
          if (freshSession?.user) {
            loadProfileAndCompany(freshSession.user.id)
            checkMfaStatus()
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadProfileAndCompany, checkMfaStatus])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp({ email, password, fullName, companyName, inviteCode }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    const userId = data.user?.id
    if (!userId) throw new Error('Não foi possível criar a conta.')

    // Sem sessão imediata = confirmação de email está ativa no projeto
    if (!data.session) {
      if (inviteCode) {
        localStorage.setItem('flowcommerce_pending_invite', JSON.stringify({ code: inviteCode, fullName }))
      }
      return { needsEmailConfirmation: true }
    }

    if (inviteCode) {
      const { error: redeemError } = await supabase.rpc('redeem_invite', { p_code: inviteCode, p_full_name: fullName })
      if (redeemError) throw redeemError
    } else {
      const { error: companyError } = await supabase
        .from('companies')
        .insert({ id: userId, name: companyName })
      if (companyError) throw companyError

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId, company_id: userId, full_name: fullName, role: 'admin' })
      if (profileError) throw profileError
    }

    await loadProfileAndCompany(userId)
    return { needsEmailConfirmation: false }
  }

  async function redeemPendingInvite(fallbackFullName) {
    const pending = localStorage.getItem('flowcommerce_pending_invite')
    if (!pending) return false
    const { code, fullName } = JSON.parse(pending)
    const { error } = await supabase.rpc('redeem_invite', { p_code: code, p_full_name: fullName || fallbackFullName })
    localStorage.removeItem('flowcommerce_pending_invite')
    if (error) throw error
    if (session?.user) await loadProfileAndCompany(session.user.id)
    return true
  }

  async function signOut() {
    localStorage.removeItem(ACTIVE_COMPANY_KEY)
    await supabase.auth.signOut()
  }

  async function verifyMfaCode(code) {
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) throw factorsError

    const factor = factorsData?.totp?.[0]
    if (!factor) throw new Error('Nenhum método de autenticação de dois fatores encontrado.')

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challengeError) throw challengeError

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challengeData.id,
      code,
    })
    if (verifyError) throw verifyError

    await checkMfaStatus()
  }

  const value = {
    session, profile, company, accessibleCompanies, loading, mfaRequired, mfaEnrolled,
    signIn, signUp, signOut, verifyMfaCode, redeemPendingInvite, switchCompany,
    hasPendingInvite: () => !!localStorage.getItem('flowcommerce_pending_invite'),
    reload: () => session?.user && loadProfileAndCompany(session.user.id),
    refreshMfaStatus: checkMfaStatus,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
