import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const emptyForm = {
  name: '', description: '', sku: '', barcode: '',
  cost_price: '', sale_price: '', stock_quantity: '0', minimum_stock: '5',
  category_id: '', supplier_id: '', image_url: ''
}

function formatKz(value) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2 }).format(value || 0) + ' Kz'
}

export default function Products() {
  const { company, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('stock') === 'baixo')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [packagePrice, setPackagePrice] = useState('')
  const [packageUnits, setPackageUnits] = useState('')

  useEffect(() => { if (company?.id) loadAll() }, [company?.id])

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${company.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setForm(f => ({ ...f, image_url: data.publicUrl }))
    } catch (err) {
      setError('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function loadAll() {
    setLoading(true)
    const [{ data: products }, { data: cats }, { data: sups }] = await Promise.all([
      supabase.from('products').select('*, categories(name), suppliers(name)').eq('company_id', company.id).order('name'),
      supabase.from('categories').select('id, name').eq('company_id', company.id).order('name'),
      supabase.from('suppliers').select('id, name').eq('company_id', company.id).order('name'),
    ])
    setItems(products || [])
    setCategories(cats || [])
    setSuppliers(sups || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setPackagePrice('')
    setPackageUnits('')
    setError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      ...emptyForm,
      ...item,
      stock_quantity: String(item.stock_quantity ?? 0),
      minimum_stock: String(item.minimum_stock ?? 0),
      category_id: item.category_id || '',
      supplier_id: item.supplier_id || '',
    })
    setPackagePrice('')
    setPackageUnits('')
    setError('')
    setModalOpen(true)
  }

  function applyPackageCalc() {
    const price = Number(packagePrice)
    const units = Number(packageUnits)
    if (price > 0 && units > 0) {
      setForm(f => ({ ...f, cost_price: (price / units).toFixed(2) }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = {
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      stock_quantity: Number(form.stock_quantity || 0),
      minimum_stock: Number(form.minimum_stock || 0),
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      image_url: form.image_url || null,
    }

    try {
      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
        if (error) throw error

        const diff = payload.stock_quantity - Number(editing.stock_quantity ?? 0)
        if (diff !== 0) {
          await supabase.from('stock_movements').insert({
            company_id: company.id, product_id: editing.id, profile_id: profile.id,
            movement_type: 'ajuste', quantity: diff,
            stock_before: Number(editing.stock_quantity ?? 0), stock_after: payload.stock_quantity,
            notes: 'Ajuste manual via edição de produto',
          })
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('products')
          .insert({ ...payload, company_id: company.id, is_active: true })
          .select()
          .single()
        if (error) throw error

        if (payload.stock_quantity > 0) {
          await supabase.from('stock_movements').insert({
            company_id: company.id, product_id: inserted.id, profile_id: profile.id,
            movement_type: 'entrada', quantity: payload.stock_quantity,
            stock_before: 0, stock_after: payload.stock_quantity,
            notes: 'Stock inicial',
          })
        }
      }
      setModalOpen(false)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este produto?')) return
    await supabase.from('products').delete().eq('id', id)
    loadAll()
  }

  const filtered = items
    .filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    )
    .filter(p => !lowStockOnly || Number(p.stock_quantity) <= Number(p.minimum_stock ?? 0))

  function toggleLowStockOnly() {
    const next = !lowStockOnly
    setLowStockOnly(next)
    setSearchParams(next ? { stock: 'baixo' } : {})
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Produtos</h1>
          <p>Cadastro e controlo de stock dos teus produtos.</p>
        </div>
        {isAdmin && <button className="btn-primary" onClick={openNew}>+ Novo produto</button>}
      </div>

      <div className="toolbar">
        <input placeholder="Pesquisar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <button className={`category-pill ${lowStockOnly ? 'active' : ''}`} onClick={toggleLowStockOnly} style={{ flexShrink: 0 }}>
          Só stock baixo
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum produto encontrado</h3>
            <p>{isAdmin ? 'Cadastra o primeiro produto para começares a vender.' : 'Ainda não há produtos cadastrados nesta loja.'}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Stock</th>{isAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const low = Number(p.stock_quantity) <= Number(p.minimum_stock ?? 0)
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.sku || 'sem SKU'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.categories?.name || '—'}</td>
                    <td className="mono">{formatKz(p.sale_price)}</td>
                    <td><span className={`badge ${low ? 'low' : 'ok'}`}>{p.stock_quantity}</span></td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-ghost" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn-danger" onClick={() => handleDelete(p.id)}>Eliminar</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar produto' : 'Novo produto'}</h2>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Imagem do produto</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {form.image_url ? (
                    <img src={form.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                </div>
                {uploading && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>A enviar imagem...</p>}
              </div>
              <div className="field">
                <label>Nome</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>SKU</label>
                  <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="field">
                  <label>Código de barras</label>
                  <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                </div>
              </div>
              <div className="field" style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 8, padding: 12 }}>
                <label style={{ marginBottom: 8 }}>Calculadora: comprei uma embalagem, qual o custo por unidade?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontWeight: 400, fontSize: 12 }}>Preço pago pela embalagem</label>
                    <input type="number" step="0.01" placeholder="ex: 1000" value={packagePrice} onChange={e => setPackagePrice(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 400, fontSize: 12 }}>Unidades na embalagem</label>
                    <input type="number" placeholder="ex: 10" value={packageUnits} onChange={e => setPackageUnits(e.target.value)} />
                  </div>
                  <button type="button" className="btn-secondary" onClick={applyPackageCalc}>Aplicar</button>
                </div>
                {Number(packagePrice) > 0 && Number(packageUnits) > 0 && (
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
                    Custo por unidade: <strong>{formatKz(Number(packagePrice) / Number(packageUnits))}</strong> — clica em "Aplicar" para preencher o campo de custo abaixo.
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Preço de custo (por unidade)</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="field">
                  <label>Preço de venda</label>
                  <input type="number" step="0.01" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} required />
                </div>
              </div>
              {Number(form.cost_price) > 0 && Number(form.sale_price) > 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -8, marginBottom: 14 }}>
                  Lucro estimado por unidade: <strong style={{ color: 'var(--primary)' }}>{formatKz(form.sale_price - form.cost_price)}</strong>
                  {' '}({(((form.sale_price - form.cost_price) / form.sale_price) * 100).toFixed(1)}% de margem)
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Quantidade em stock</label>
                  <input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Stock mínimo</label>
                  <input type="number" value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Categoria</label>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Fornecedor</label>
                <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">Sem fornecedor</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
