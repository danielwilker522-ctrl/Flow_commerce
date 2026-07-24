import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

export default function PDV() {
  const { company, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // { product, quantity }
  const [discount, setDiscount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [amountReceived, setAmountReceived] = useState('')
  const [hasOpenRegister, setHasOpenRegister] = useState(true)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (company?.id) init() }, [company?.id])

  async function init() {
    setChecking(true)
    const [{ data: prods }, { data: cats }, { data: openRegister }] = await Promise.all([
      supabase.from('products').select('*, categories(name)').eq('company_id', company.id).eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name').eq('company_id', company.id).order('name'),
      supabase.from('cash_register').select('id').eq('company_id', company.id).eq('status', 'aberto').maybeSingle(),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
    setHasOpenRegister(!!openRegister)
    setChecking(false)
  }

  const filtered = useMemo(() => (
    products
      .filter(p => selectedCategory === 'all' || p.category_id === selectedCategory)
      .filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      )
  ), [products, search, selectedCategory])

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(l => l.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_quantity) return prev
        return prev.map(l => l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l)
      }
      if (product.stock_quantity <= 0) return prev
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(productId, delta) {
    setCart(prev => prev
      .map(l => l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l)
      .filter(l => l.quantity > 0))
  }

  function removeLine(productId) {
    setCart(prev => prev.filter(l => l.product.id !== productId))
  }

  const subtotal = cart.reduce((sum, l) => sum + Number(l.product.sale_price || 0) * l.quantity, 0)
  const discountValue = Number(discount || 0)
  const total = Math.max(subtotal - discountValue, 0)
  const change = paymentMethod === 'dinheiro' ? Math.max(Number(amountReceived || 0) - total, 0) : 0

  function resetSale() {
    setCart([])
    setDiscount('0')
    setAmountReceived('')
    setPaymentMethod('dinheiro')
  }

  async function finalizeSale() {
    setError('')
    setSuccess('')
    if (cart.length === 0) return
    if (paymentMethod === 'dinheiro' && Number(amountReceived || 0) < total) {
      setError('O valor recebido é inferior ao total da venda.')
      return
    }
    setSubmitting(true)
    try {
      const { data: sale, error } = await supabase.rpc('process_sale', {
        p_items: cart.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
        p_discount: discountValue,
        p_payment_method: paymentMethod,
        p_amount_received: paymentMethod === 'dinheiro' ? Number(amountReceived || 0) : total,
      })
      if (error) throw error

      setSuccess(`Venda registada com sucesso! Total: ${formatKz(sale.total)}`)
      resetSale()
      init()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) return <div className="empty-state">A carregar...</div>

  if (!hasOpenRegister) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <h3>O caixa está fechado</h3>
        <p>Abre o caixa na página "Caixa" antes de iniciares as vendas.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ponto de Venda</h1>
          <p>Pesquisa produtos, adiciona ao carrinho e finaliza a venda.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="pdv-layout">
        <div className="pdv-products">
          <input
            placeholder="Pesquisar por nome, SKU ou código de barras..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="category-nav">
            <button
              className={`category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              Todas
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                className={`category-pill ${selectedCategory === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {filtered.map(p => (
              <button key={p.id} className="product-tile" onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="product-tile-img" />
                ) : (
                  <div className="product-tile-img placeholder" />
                )}
                <div className="name">{p.name}</div>
                <div className="price">{formatKz(p.sale_price)}</div>
                <div className="stock">{p.stock_quantity > 0 ? `${p.stock_quantity} em stock` : 'Sem stock'}</div>
              </button>
            ))}
            {filtered.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum produto encontrado.</p>}
          </div>
        </div>

        <div className="card cart-panel">
          <h3>Carrinho</h3>
          <div className="cart-items">
            {cart.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 20 }}>Adiciona produtos para iniciar a venda.</p>
            ) : cart.map(l => (
              <div className="cart-line" key={l.product.id}>
                <div className="info">
                  <div className="n">{l.product.name}</div>
                  <div className="p">{formatKz(l.product.sale_price)} × {l.quantity}</div>
                </div>
                <div className="qty-control">
                  <button onClick={() => changeQty(l.product.id, -1)}>−</button>
                  <span className="mono">{l.quantity}</span>
                  <button onClick={() => changeQty(l.product.id, 1)} disabled={l.quantity >= l.product.stock_quantity}>+</button>
                </div>
                <button className="btn-ghost" onClick={() => removeLine(l.product.id)}>✕</button>
              </div>
            ))}
          </div>

          <div className="field">
            <label>Desconto (Kz)</label>
            <input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div className="field">
            <label>Método de pagamento</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="dinheiro">Dinheiro</option>
              <option value="multicaixa">Multicaixa</option>
              <option value="transferencia">Transferência</option>
              <option value="cartao">Cartão</option>
            </select>
          </div>
          {paymentMethod === 'dinheiro' && (
            <div className="field">
              <label>Valor recebido</label>
              <input type="number" step="0.01" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
            </div>
          )}

          <div className="cart-totals">
            <div className="row"><span>Subtotal</span><span className="mono">{formatKz(subtotal)}</span></div>
            <div className="row"><span>Desconto</span><span className="mono">− {formatKz(discountValue)}</span></div>
            {paymentMethod === 'dinheiro' && <div className="row"><span>Troco</span><span className="mono">{formatKz(change)}</span></div>}
            <div className="row total"><span>Total</span><span>{formatKz(total)}</span></div>
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 16, padding: 14 }}
            onClick={finalizeSale}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? 'A finalizar...' : 'Finalizar venda'}
          </button>
        </div>
      </div>
    </div>
  )
}
