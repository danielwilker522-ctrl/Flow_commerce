import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

const movementLabels = {
  entrada: 'Entrada',
  saida: 'Saída (venda)',
  ajuste: 'Ajuste manual',
}

export default function Profit() {
  const { company, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [historyProduct, setHistoryProduct] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => { if (company?.id) load() }, [company?.id])

  if (profile?.role !== 'admin') {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <h3>Acesso restrito</h3>
        <p>Esta página só está disponível para administradores da loja.</p>
      </div>
    )
  }

  async function load() {
    setLoading(true)
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, cost_price, sale_price, stock_quantity')
      .eq('company_id', company.id)
      .order('name')

    const productIds = (products || []).map(p => p.id)
    let itemsByProduct = {}

    if (productIds.length > 0) {
      const { data: items } = await supabase
        .from('sales_itens')
        .select('product_id, quantity, subtotal')
        .in('product_id', productIds)

      for (const it of items || []) {
        if (!itemsByProduct[it.product_id]) {
          itemsByProduct[it.product_id] = { quantity: 0, revenue: 0 }
        }
        itemsByProduct[it.product_id].quantity += Number(it.quantity || 0)
        itemsByProduct[it.product_id].revenue += Number(it.subtotal || 0)
      }
    }

    const computed = (products || []).map(p => {
      const sold = itemsByProduct[p.id] || { quantity: 0, revenue: 0 }
      const cost = Number(p.cost_price || 0)
      const price = Number(p.sale_price || 0)
      const marginUnit = price - cost
      const marginPct = price > 0 ? (marginUnit / price) * 100 : null
      const estimatedProfit = sold.quantity * marginUnit
      return { ...p, soldQty: sold.quantity, revenue: sold.revenue, marginUnit, marginPct, estimatedProfit }
    })

    setRows(computed)
    setLoading(false)
  }

  async function openHistory(product) {
    setHistoryProduct(product)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setHistory(data || [])
    setHistoryLoading(false)
  }

  const filtered = rows.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const totals = filtered.reduce((acc, p) => ({
    revenue: acc.revenue + p.revenue,
    profit: acc.profit + p.estimatedProfit,
  }), { revenue: 0, profit: 0 })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Lucro &amp; Stock</h1>
          <p>Margem por produto, estimativa de lucro e histórico de movimentos de stock.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <div className="label">Receita total (todas as vendas)</div>
          <div className="value">{loading ? '—' : formatKz(totals.revenue)}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Lucro estimado total</div>
          <div className="value accent">{loading ? '—' : formatKz(totals.profit)}</div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -14, marginBottom: 18 }}>
        O lucro é uma estimativa baseada no preço de custo atual de cada produto — se o custo mudou ao longo do tempo, os valores mais antigos podem não refletir o custo exato de compra dessa altura.
      </p>

      <div className="toolbar">
        <input placeholder="Pesquisar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum produto encontrado</h3>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Custo/un.</th>
                <th>Venda/un.</th>
                <th>Margem</th>
                <th>Qtd. vendida</th>
                <th>Receita</th>
                <th>Lucro estimado</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sku || 'sem SKU'}</div>
                  </td>
                  <td className="mono">{formatKz(p.cost_price)}</td>
                  <td className="mono">{formatKz(p.sale_price)}</td>
                  <td className="mono">
                    {p.marginPct !== null ? `${p.marginPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="mono">{p.soldQty}</td>
                  <td className="mono">{formatKz(p.revenue)}</td>
                  <td className="mono" style={{ color: p.estimatedProfit >= 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 600 }}>
                    {formatKz(p.estimatedProfit)}
                  </td>
                  <td><span className="badge ok">{p.stock_quantity}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => openHistory(p)}>Ver histórico</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {historyProduct && (
        <div className="modal-overlay" onClick={() => setHistoryProduct(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Histórico de stock — {historyProduct.name}</h2>
            {historyLoading ? (
              <p style={{ color: 'var(--muted)' }}>A carregar...</p>
            ) : history.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Ainda sem movimentos registados para este produto.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Qtd.</th><th>Antes → Depois</th></tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12.5 }}>{new Date(h.created_at).toLocaleString('pt-AO')}</td>
                      <td>
                        <span className={`badge ${h.movement_type === 'saida' ? 'low' : 'ok'}`}>
                          {movementLabels[h.movement_type] || h.movement_type}
                        </span>
                      </td>
                      <td className="mono">{h.movement_type === 'saida' ? '−' : '+'}{h.quantity}</td>
                      <td className="mono">{h.stock_before} → {h.stock_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setHistoryProduct(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
