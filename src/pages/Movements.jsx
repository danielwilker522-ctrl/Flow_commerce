import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const REASONS = {
  entrada: ['Compra a fornecedor', 'Devolução de cliente', 'Transferência recebida', 'Outro'],
  saida: ['Avaria / dano', 'Validade expirada', 'Perda / roubo', 'Uso interno', 'Devolução ao fornecedor', 'Transferência enviada', 'Outro'],
}

const PERIODS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: 'tudo', label: 'Tudo' },
]

const emptyForm = { type: 'entrada', productId: '', quantity: '', reason: '', note: '' }

function typeBadge(type) {
  if (type === 'entrada') return <span className="badge ok">Entrada</span>
  if (type === 'saida') return <span className="badge low">Saída</span>
  return <span className="badge" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>Ajuste</span>
}

function originLabel(m) {
  if (m.sale_id) return 'Venda'
  if (m.movement_type === 'ajuste') return 'Ajuste de produto'
  return 'Manual'
}

export default function Movements() {
  const { company, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [people, setPeople] = useState({})
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState('todos')
  const [period, setPeriod] = useState('7')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [productSearch, setProductSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { if (company?.id) load() }, [company?.id])

  async function load() {
    setLoading(true)
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('products').select('id, name, sku, stock_quantity').eq('company_id', company.id).order('name'),
      supabase.from('stock_movements').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(500),
    ])
    setProducts(prods || [])
    setMovements(movs || [])

    const ids = [...new Set((movs || []).map(m => m.profile_id).filter(Boolean))]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids)
      setPeople(Object.fromEntries((profs || []).map(p => [p.id, p.full_name])))
    } else {
      setPeople({})
    }
    setLoading(false)
  }

  const productById = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products])

  const filtered = useMemo(() => {
    const now = new Date()
    let since = null
    if (period === 'hoje') { since = new Date(now); since.setHours(0, 0, 0, 0) }
    else if (period !== 'tudo') { since = new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000) }

    return movements.filter(m => {
      if (typeFilter !== 'todos' && m.movement_type !== typeFilter) return false
      if (since && new Date(m.created_at) < since) return false
      if (search) {
        const name = productById[m.product_id]?.name || ''
        if (!name.toLowerCase().includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [movements, typeFilter, period, search, productById])

  const totals = useMemo(() => filtered.reduce((acc, m) => {
    const q = Math.abs(Number(m.quantity || 0))
    if (m.movement_type === 'entrada') acc.in += q
    else if (m.movement_type === 'saida') acc.out += q
    return acc
  }, { in: 0, out: 0 }), [filtered])

  const pickerProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )
  const selectedProduct = productById[form.productId]
  const qty = Number(form.quantity)
  const currentStock = Number(selectedProduct?.stock_quantity || 0)
  const newStock = selectedProduct && qty > 0
    ? (form.type === 'entrada' ? currentStock + qty : currentStock - qty)
    : null
  const exceedsStock = form.type === 'saida' && selectedProduct && qty > currentStock

  function openModal(type) {
    setForm({ ...emptyForm, type })
    setProductSearch('')
    setError('')
    setModalOpen(true)
  }

  function changeType(type) {
    setForm(f => ({ ...f, type, reason: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.productId) { setError('Escolhe um produto.'); return }
    if (!qty || qty <= 0) { setError('Indica uma quantidade maior que zero.'); return }
    if (exceedsStock) { setError(`Só existem ${currentStock} unidades em stock.`); return }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('register_stock_movement', {
        p_company_id: company.id,
        p_product_id: form.productId,
        p_type: form.type,
        p_quantity: qty,
        p_reason: form.reason || null,
        p_note: form.note || null,
      })
      if (error) throw error

      setModalOpen(false)
      setSuccess(`${form.type === 'entrada' ? 'Entrada' : 'Saída'} de ${qty} × ${selectedProduct.name} registada com sucesso.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <h3>Acesso restrito</h3>
        <p>Esta página só está disponível para administradores da loja.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Entradas &amp; Saídas</h1>
          <p>Regista reposições e saídas de stock, e consulta o histórico completo de movimentos.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => openModal('entrada')}>+ Registar entrada</button>
          <button className="btn-secondary" onClick={() => openModal('saida')}>− Registar saída</button>
        </div>
      </div>

      {success && (
        <div className="alert success" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{success}</span>
          <button className="btn-ghost" style={{ padding: 0 }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="label">Unidades que entraram</div>
          <div className="value">{loading ? '—' : `+${totals.in}`}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Unidades que saíram</div>
          <div className="value danger">{loading ? '—' : `−${totals.out}`}</div>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input placeholder="Pesquisar produto..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <div className="category-nav" style={{ marginBottom: 0 }}>
          {[['todos', 'Todos'], ['entrada', 'Entradas'], ['saida', 'Saídas'], ['ajuste', 'Ajustes']].map(([id, label]) => (
            <button key={id} className={`category-pill ${typeFilter === id ? 'active' : ''}`} onClick={() => setTypeFilter(id)}>{label}</button>
          ))}
        </div>
        <div className="category-nav" style={{ marginBottom: 0 }}>
          {PERIODS.map(p => (
            <button key={p.id} className={`category-pill ${period === p.id ? 'active' : ''}`} onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Sem movimentos</h3>
            <p>Não há movimentos de stock para este filtro.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Stock</th><th>Origem</th><th>Por</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const q = Number(m.quantity || 0)
                const sign = m.movement_type === 'saida' ? '−' : (q > 0 ? '+' : '')
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('pt-AO')}</td>
                    <td style={{ fontWeight: 600 }}>{productById[m.product_id]?.name || 'Produto removido'}</td>
                    <td>{typeBadge(m.movement_type)}</td>
                    <td className="mono">{sign}{Math.abs(q)}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{m.stock_before} → {m.stock_after}</td>
                    <td style={{ fontSize: 13 }}>{originLabel(m)}</td>
                    <td style={{ fontSize: 13 }}>{people[m.profile_id] || '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 240 }}>{m.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {!loading && movements.length >= 500 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>A mostrar os 500 movimentos mais recentes.</p>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Registar movimento de stock</h2>
            {error && <div className="alert error">{error}</div>}

            <div className="category-nav" style={{ marginBottom: 16 }}>
              <button type="button" className={`category-pill ${form.type === 'entrada' ? 'active' : ''}`} onClick={() => changeType('entrada')}>+ Entrada</button>
              <button type="button" className={`category-pill ${form.type === 'saida' ? 'active' : ''}`} onClick={() => changeType('saida')}>− Saída</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Produto</label>
                <input
                  placeholder="Pesquisar por nome ou SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <select
                  size={5}
                  value={form.productId}
                  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                  style={{ padding: 6 }}
                >
                  {pickerProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — stock: {p.stock_quantity}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Quantidade</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="ex: 12"
                  required
                />
                {selectedProduct && qty > 0 && (
                  <p style={{ fontSize: 13, marginTop: 6, fontWeight: 600, color: exceedsStock ? 'var(--danger)' : 'var(--primary)' }}>
                    {exceedsStock
                      ? `Só existem ${currentStock} unidades em stock.`
                      : `Stock: ${currentStock} → ${newStock}`}
                  </p>
                )}
              </div>

              <div className="field">
                <label>Motivo</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                  <option value="">Sem motivo específico</option>
                  {REASONS[form.type].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="field">
                <label>Nota (opcional)</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="ex: lote 4521, fornecedor X" />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn-primary" disabled={submitting || exceedsStock}>
                  {submitting ? 'A registar...' : form.type === 'entrada' ? 'Registar entrada' : 'Registar saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
