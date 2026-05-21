import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Trash2, Edit2, X, Package,
  AlertTriangle, Thermometer, ChevronDown, ChevronUp, Download,
  Brain, Sparkles, Ruler, Weight, RotateCcw, Check, Loader
} from 'lucide-react'
import { warehouseAPI, inventoryAPI, aiAPI } from '../lib/api'
import api from '../lib/api'
import toast from 'react-hot-toast'

const CATEGORIES = [
  'Electronics','Food & Beverage','Raw Materials','Machinery',
  'Chemical','Textile','Packaging','Automotive','Pharma','Other'
]
const FREQUENCIES = ['high','medium','low']

/* ─── Dimension Preset Picker ─────────────────────────── */
function PresetPicker({ onSelect }) {
  const [presets, setPresets] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    aiAPI.dimensionPresets()
      .then(r => setPresets(r.data.presets || []))
      .catch(() => {})
  }, [])

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-teal font-display font-semibold 
        hover:text-navy transition-colors px-2 py-1 rounded-lg hover:bg-frost">
        <Ruler size={12} /> Dimension Presets {open ? '▲' : '▼'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.97 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-6, scale:0.97 }}
            className="absolute top-full left-0 mt-1 bg-white border border-sky/40 rounded-xl
            shadow-xl z-50 w-64 overflow-hidden"
          >
            <p className="px-3 py-2 text-[10px] font-mono text-navy/40 border-b border-frost">
              COMMON ITEM SIZES
            </p>
            <div className="max-h-52 overflow-y-auto py-1">
              {presets.map(p => (
                <button key={p.label} type="button"
                  onClick={() => { onSelect(p); setOpen(false) }}
                  className="w-full text-left px-3 py-2.5 hover:bg-frost transition-colors">
                  <p className="text-sm font-display font-semibold text-navy">{p.label}</p>
                  <p className="text-[10px] font-mono text-navy/40">
                    {p.w}×{p.d}×{p.h}m · {p.weight}kg
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── AI Image Uploader (inline in modal) ──────────────── */
function AIImageSection({ onApply }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const processFile = async (f) => {
    if (!f?.type?.startsWith('image/')) { toast.error('Upload a JPEG/PNG/WebP'); return }
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
    setFile(f); setLoading(true); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('context', 'Warehouse inventory item')
      const res = await api.post('/ai/analyse-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
      toast.success('AI analysis complete!')
    } catch(err) {
      toast.error(err.response?.data?.detail || 'Analysis failed')
    } finally { setLoading(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const conf = result?.confidence ?? 0
  const confColor = conf >= 0.8 ? '#10b981' : conf >= 0.55 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <p className="text-xs font-display font-bold text-teal uppercase tracking-widest mb-2 
      flex items-center gap-2">
        <Brain size={12} /> AI Image Analysis
        <span className="text-[9px] font-mono bg-teal/10 text-teal px-1.5 py-0.5 rounded-full normal-case tracking-normal">
          Powered by Claude Vision
        </span>
      </p>

      {!preview ? (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
          ${dragging ? 'border-teal bg-teal/5' : 'border-sky/50 hover:border-teal hover:bg-teal/3'}`}
        >
          <Brain size={22} className={`mx-auto mb-2 ${dragging ? 'text-teal' : 'text-navy/20'}`} />
          <p className="text-sm font-display font-semibold text-navy">
            {dragging ? 'Drop to analyse' : 'Upload item photo'}
          </p>
          <p className="text-xs text-navy/40 font-mono mt-0.5">
            Claude AI auto-detects dimensions, category & storage flags
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => processFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="border border-sky/30 rounded-xl overflow-hidden bg-white">
          {/* Preview header */}
          <div className="flex items-center gap-3 p-3 border-b border-frost">
            <img src={preview} alt="preview"
              className="w-14 h-14 rounded-lg object-cover border border-frost flex-shrink-0" />
            <div className="flex-1">
              {loading
                ? <div className="flex items-center gap-2">
                    <Loader size={13} className="animate-spin text-teal" />
                    <span className="text-xs text-teal font-mono">Analysing with Claude AI…</span>
                  </div>
                : result
                  ? <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: confColor }} />
                        <span className="text-xs font-mono" style={{ color: confColor }}>
                          {Math.round(conf * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-xs font-display font-semibold text-navy">
                        {result.ai_analysis?.category} — {result.ai_analysis?.name_suggestion}
                      </p>
                    </div>
                  : null
              }
            </div>
            <button onClick={() => { setPreview(null); setResult(null); setFile(null) }}
              className="text-navy/30 hover:text-red-400 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* AI result fields */}
          {result && !loading && (
            <div className="p-3 space-y-3">
              {/* Dimensions */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ['W', result.suggested_fields?.width_m],
                  ['D', result.suggested_fields?.depth_m],
                  ['H', result.suggested_fields?.height_m],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="bg-teal/5 border border-teal/20 rounded-lg p-1.5 text-center">
                    <p className="font-display font-bold text-teal text-sm">{val}m</p>
                    <p className="text-[9px] font-mono text-navy/40">{lbl}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-frost rounded-lg p-1.5 text-center">
                  <p className="font-display font-bold text-navy text-sm">{result.suggested_fields?.weight_kg}kg</p>
                  <p className="text-[9px] font-mono text-navy/40">Weight</p>
                </div>
                <div className="bg-frost rounded-lg p-1.5 text-center">
                  <p className="font-display font-bold text-navy text-sm capitalize">
                    {result.suggested_fields?.retrieval_frequency}
                  </p>
                  <p className="text-[9px] font-mono text-navy/40">Frequency</p>
                </div>
              </div>

              {/* Storage flags */}
              <div className="flex flex-wrap gap-1">
                {[
                  { k:'stackable', l:'📦 Stackable' },
                  { k:'fragile', l:'🔴 Fragile' },
                  { k:'hazardous', l:'⚠️ Hazmat' },
                  { k:'temperature_sensitive', l:'🌡️ Cold' },
                ].map(({ k, l }) => (
                  <span key={k}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full border
                    ${result.suggested_fields?.[k]
                      ? 'bg-teal/10 border-teal/30 text-teal'
                      : 'bg-frost border-sky/30 text-navy/30 line-through'}`}>
                    {l}
                  </span>
                ))}
              </div>

              {/* Storage note */}
              {result.storage_notes && (
                <p className="text-[11px] text-navy/50 italic bg-frost rounded-lg px-2.5 py-1.5 font-mono">
                  💡 {result.storage_notes}
                </p>
              )}

              {/* Apply button */}
              <button type="button" onClick={() => onApply(result.suggested_fields)}
                className="w-full py-2 rounded-xl bg-navy text-white font-display font-semibold 
                text-sm tracking-wide hover:bg-teal transition-all flex items-center justify-center gap-2">
                <Sparkles size={13} /> Apply AI Suggestions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Item Modal ───────────────────────────────────────── */
function ItemModal({ item, warehouseId, warehouses, onClose, onSave }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(item || {
    warehouse_id: warehouseId || (warehouses[0]?.id || ''),
    sku:'', name:'', category:'Other', description:'',
    width_m:0.5, depth_m:0.5, height_m:0.5, weight_kg:10,
    quantity:1, fragile:false, stackable:true,
    hazardous:false, temperature_sensitive:false,
    retrieval_frequency:'medium', image_url:''
  })
  const [saving, setSaving] = useState(false)
  const [genSku, setGenSku] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  /* Apply AI suggestions to form */
  const applyAI = (fields) => {
    setForm(f => ({
      ...f,
      name: fields.name || f.name,
      category: fields.category || f.category,
      description: fields.description || f.description,
      width_m: fields.width_m ?? f.width_m,
      depth_m: fields.depth_m ?? f.depth_m,
      height_m: fields.height_m ?? f.height_m,
      weight_kg: fields.weight_kg ?? f.weight_kg,
      stackable: fields.stackable ?? f.stackable,
      fragile: fields.fragile ?? f.fragile,
      hazardous: fields.hazardous ?? f.hazardous,
      temperature_sensitive: fields.temperature_sensitive ?? f.temperature_sensitive,
      retrieval_frequency: fields.retrieval_frequency || f.retrieval_frequency,
    }))
  }

  /* Apply dimension preset */
  const applyPreset = (p) => {
    setForm(f => ({ ...f, width_m: p.w, depth_m: p.d, height_m: p.h, weight_kg: p.weight }))
    toast.success(`Applied preset: ${p.label}`)
  }

  /* Auto-generate SKU */
  const generateSku = async () => {
    if (!form.name) { toast.error('Enter item name first'); return }
    setGenSku(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('category', form.category || 'Other')
      const res = await api.post('/ai/suggest-sku', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      set('sku', res.data.sku)
      toast.success('SKU generated!')
    } catch { toast.error('SKU generation failed') }
    finally { setGenSku(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await inventoryAPI.update(item.id, form)
        toast.success('Item updated')
      } else {
        await inventoryAPI.create(form)
        toast.success('Item added to inventory')
      }
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed')
    } finally { setSaving(false) }
  }

  const volume = ((form.width_m||0)*(form.depth_m||0)*(form.height_m||0)).toFixed(3)
  const totalVol = (parseFloat(volume) * (form.quantity||1)).toFixed(3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale:0.95, opacity:0, y:20 }}
        animate={{ scale:1, opacity:1, y:0 }}
        exit={{ scale:0.95, opacity:0 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] 
        overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-navy px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-white text-xl tracking-wide">
              {isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </h2>
            <p className="text-sky/40 text-xs font-mono mt-0.5">
              {isEdit ? 'Update item properties' : 'Use AI image analysis or enter manually'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* LEFT — AI image + basic info */}
            <div className="space-y-5">
              {/* AI image analyser */}
              {!isEdit && <AIImageSection onApply={applyAI} />}

              {/* Warehouse */}
              <div>
                <label className="label">Warehouse *</label>
                <select value={form.warehouse_id}
                  onChange={e => set('warehouse_id', e.target.value)}
                  className="select-field" required>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="label">Item Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  className="input-field" placeholder="e.g. Steel Coil 50kg" required />
              </div>

              {/* SKU */}
              <div>
                <label className="label">SKU / Item Code</label>
                <div className="flex gap-2">
                  <input value={form.sku} onChange={e => set('sku', e.target.value)}
                    className="input-field" placeholder="Auto-generated if empty" />
                  <button type="button" onClick={generateSku} disabled={genSku}
                    title="Auto-generate SKU"
                    className="px-3 py-2 rounded-lg border border-sky/40 text-teal 
                    hover:bg-frost transition-colors flex-shrink-0 text-xs font-mono">
                    {genSku ? <Loader size={13} className="animate-spin" /> : 'GEN'}
                  </button>
                </div>
              </div>

              {/* Category + Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)}
                    className="select-field text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Retrieval Frequency</label>
                  <select value={form.retrieval_frequency}
                    onChange={e => set('retrieval_frequency', e.target.value)}
                    className="select-field text-sm">
                    {FREQUENCIES.map(f => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className="input-field resize-none text-sm" rows={2}
                  placeholder="Optional storage notes or description" />
              </div>
            </div>

            {/* RIGHT — Dimensions + flags + quantity */}
            <div className="space-y-5">
              {/* Dimensions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-display font-bold text-teal uppercase tracking-widest">
                    Dimensions (meters)
                  </p>
                  <PresetPicker onSelect={applyPreset} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['Width','width_m'],['Depth','depth_m'],['Height','height_m']].map(([l,k]) => (
                    <div key={k}>
                      <label className="text-[10px] font-mono text-navy/40 mb-1 block">{l} *</label>
                      <input type="number" value={form[k]}
                        onChange={e => set(k, parseFloat(e.target.value)||0.01)}
                        className="input-field text-sm" min={0.01} step={0.05} required />
                    </div>
                  ))}
                </div>

                {/* Weight */}
                <div className="mt-3">
                  <label className="text-[10px] font-mono text-navy/40 mb-1 block">Weight (kg)</label>
                  <input type="number" value={form.weight_kg}
                    onChange={e => set('weight_kg', parseFloat(e.target.value)||0)}
                    className="input-field text-sm" min={0} step={0.5} />
                </div>

                {/* Volume preview card */}
                <div className="mt-3 bg-gradient-to-r from-teal/5 to-navy/5 rounded-xl p-3 
                border border-teal/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="font-display font-bold text-teal text-lg">{volume}</p>
                      <p className="text-[10px] font-mono text-navy/40">m³ per unit</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-navy text-lg">{totalVol}</p>
                      <p className="text-[10px] font-mono text-navy/40">m³ total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="label">Quantity *</label>
                <input type="number" value={form.quantity}
                  onChange={e => set('quantity', parseInt(e.target.value)||1)}
                  className="input-field" min={1} required />
              </div>

              {/* Image URL */}
              <div>
                <label className="label">Image URL (optional)</label>
                <input value={form.image_url} onChange={e => set('image_url', e.target.value)}
                  className="input-field text-sm" placeholder="https://..." />
              </div>

              {/* Storage flags */}
              <div>
                <p className="label mb-2">Storage Flags</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k:'stackable', icon:'📦', label:'Stackable', desc:'Can be stacked' },
                    { k:'fragile', icon:'🔴', label:'Fragile', desc:'Handle carefully' },
                    { k:'hazardous', icon:'⚠️', label:'Hazardous', desc:'Needs hazmat zone' },
                    { k:'temperature_sensitive', icon:'🌡️', label:'Temp. Sensitive', desc:'Needs cold storage' },
                  ].map(({ k, icon, label, desc }) => (
                    <label key={k}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer
                      transition-all ${form[k]
                        ? 'border-teal bg-teal/5'
                        : 'border-frost hover:border-sky/50'}`}>
                      <input type="checkbox" checked={form[k]}
                        onChange={e => set(k, e.target.checked)}
                        className="mt-0.5 accent-teal flex-shrink-0" />
                      <div>
                        <p className="text-xs font-display font-semibold text-navy">
                          {icon} {label}
                        </p>
                        <p className="text-[10px] text-navy/40 font-mono">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-frost border-t border-sky/20 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader size={14} className="animate-spin" /> Saving...</>
                : isEdit
                  ? <><Check size={14} /> Update Item</>
                  : <><Plus size={14} /> Add Item</>
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ─── Frequency Badge ──────────────────────────────────── */
function FreqBadge({ freq }) {
  const cls = { high:'badge-green', medium:'badge-yellow', low:'badge-navy' }
  return <span className={`badge ${cls[freq]||cls.medium}`}>{freq}</span>
}

/* ─── Main Page ────────────────────────────────────────── */
export default function Inventory() {
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [filterWH, setFilterWH] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [filterFreq, setFilterFreq] = useState('all')
  const [filterFlag, setFilterFlag] = useState('all')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(new Set())
  const [bulkDel, setBulkDel] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [iRes, wRes] = await Promise.all([inventoryAPI.listAll(), warehouseAPI.list()])
      setItems(iRes.data.data || [])
      setWarehouses(wRes.data.data || [])
    } catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this item?')) return
    try { await inventoryAPI.delete(id); toast.success('Item deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} items?`)) return
    setBulkDel(true)
    try {
      await Promise.all([...selected].map(id => inventoryAPI.delete(id)))
      toast.success(`${selected.size} items deleted`); setSelected(new Set()); load()
    } catch { toast.error('Bulk delete failed') }
    finally { setBulkDel(false) }
  }

  const exportCSV = () => {
    const h = ['SKU','Name','Category','Width','Depth','Height','Weight','Qty',
                'Frequency','Stackable','Fragile','Hazardous','TempSensitive','Warehouse']
    const rows = filtered.map(i => [
      i.sku,i.name,i.category,i.width_m,i.depth_m,i.height_m,i.weight_kg,
      i.quantity,i.retrieval_frequency,i.stackable,i.fragile,i.hazardous,
      i.temperature_sensitive,i.warehouses?.name||''
    ])
    const csv = [h,...rows].map(r=>r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'godamai_inventory.csv'; a.click()
    toast.success('Exported!')
  }

  const toggleSort = (k) => {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const filtered = items
    .filter(i => {
      const q = search.toLowerCase()
      const ms = !q || i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
      const mw = filterWH==='all' || i.warehouse_id===filterWH
      const mc = filterCat==='all' || i.category===filterCat
      const mf = filterFreq==='all' || i.retrieval_frequency===filterFreq
      const mfl = filterFlag==='all' ||
        (filterFlag==='hazardous'&&i.hazardous) ||
        (filterFlag==='fragile'&&i.fragile) ||
        (filterFlag==='temperature_sensitive'&&i.temperature_sensitive)
      return ms&&mw&&mc&&mf&&mfl
    })
    .sort((a,b) => {
      let av=a[sortKey], bv=b[sortKey]
      if(typeof av==='string') av=av.toLowerCase()
      if(typeof bv==='string') bv=bv.toLowerCase()
      if(av<bv) return sortDir==='asc'?-1:1
      if(av>bv) return sortDir==='asc'?1:-1
      return 0
    })

  const toggleSelect = id => setSelected(p => {
    const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n
  })
  const toggleAll = () =>
    setSelected(selected.size===filtered.length&&filtered.length>0
      ? new Set() : new Set(filtered.map(i=>i.id)))

  const SortIcon = ({ col }) => sortKey===col
    ? (sortDir==='asc'?<ChevronUp size={11} className="text-teal"/>:<ChevronDown size={11} className="text-teal"/>)
    : <ChevronDown size={11} className="opacity-0 group-hover:opacity-30"/>

  const totalVol = filtered.reduce((s,i)=>
    s+(i.width_m*i.depth_m*i.height_m*(i.quantity||1)),0)
  const totalUnits = filtered.reduce((s,i)=>s+(i.quantity||1),0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-navy/50 text-sm">
          All inventory items across warehouses
        </p>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Download size={14}/> Export CSV
          </button>
          <button onClick={()=>setModal('create')} className="btn-primary flex items-center gap-2">
            <Plus size={15}/> Add Item
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total SKUs',     value: filtered.length },
          { label:'Total Units',    value: totalUnits.toLocaleString() },
          { label:'Total Volume',   value: `${totalVol.toFixed(1)} m³` },
          { label:'Hazmat Items',   value: filtered.filter(i=>i.hazardous).length },
        ].map(({label,value})=>(
          <div key={label} className="card p-4">
            <p className="font-display font-bold text-xl text-navy">{value}</p>
            <p className="text-xs font-display font-semibold text-navy/40 tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="card">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search name, SKU, category…"
              className="input-field pl-9 py-2 text-sm"/>
          </div>
          <select value={filterWH} onChange={e=>setFilterWH(e.target.value)}
            className="select-field w-auto py-2 text-sm">
            <option value="all">All Warehouses</option>
            {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button onClick={()=>setShowFilters(f=>!f)}
            className={`btn-secondary flex items-center gap-2 py-2 text-sm
            ${showFilters?'border-teal text-teal':''}`}>
            <Filter size={13}/> More Filters
          </button>
          {selected.size>0 && (
            <button onClick={handleBulkDelete} disabled={bulkDel}
              className="btn-danger flex items-center gap-2 py-2 text-sm">
              <Trash2 size={13}/>
              {bulkDel?'Deleting…':`Delete ${selected.size}`}
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
              exit={{height:0,opacity:0}} className="overflow-hidden border-t border-frost">
              <div className="p-4 flex gap-4 flex-wrap items-end">
                <div>
                  <label className="label">Category</label>
                  <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
                    className="select-field w-44 py-2 text-sm">
                    <option value="all">All Categories</option>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Frequency</label>
                  <select value={filterFreq} onChange={e=>setFilterFreq(e.target.value)}
                    className="select-field w-36 py-2 text-sm">
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="label">Special Flag</label>
                  <select value={filterFlag} onChange={e=>setFilterFlag(e.target.value)}
                    className="select-field w-44 py-2 text-sm">
                    <option value="all">All Items</option>
                    <option value="hazardous">⚠️ Hazardous</option>
                    <option value="fragile">🔴 Fragile</option>
                    <option value="temperature_sensitive">🌡️ Temp. Sensitive</option>
                  </select>
                </div>
                <button onClick={()=>{setFilterCat('all');setFilterFreq('all');setFilterFlag('all');setSearch('')}}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors py-2.5">
                  ✕ Clear all
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-10 h-10"/>
        </div>
      ) : filtered.length===0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-frost flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-teal/30"/>
          </div>
          <h3 className="font-display font-bold text-xl text-navy mb-2">
            {items.length===0?'No Inventory Items':'No Results Found'}
          </h3>
          <p className="text-navy/40 text-sm mb-5 max-w-xs mx-auto">
            {items.length===0
              ? 'Add your first item. Upload a photo and let Claude AI fill in the details.'
              : 'Try adjusting your filters.'}
          </p>
          {items.length===0 && (
            <button onClick={()=>setModal('create')} className="btn-primary mx-auto flex items-center gap-2">
              <Plus size={14}/> Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="card-header py-3 px-4 bg-frost/50">
            <div className="flex items-center gap-3">
              <input type="checkbox"
                checked={selected.size===filtered.length&&filtered.length>0}
                onChange={toggleAll} className="accent-teal"/>
              <p className="text-xs font-mono text-navy/40">
                {filtered.length} SKUs · {totalUnits.toLocaleString()} units
              </p>
            </div>
            {selected.size>0 && (
              <span className="badge badge-teal">{selected.size} selected</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th/>
                  {[
                    {k:'sku',l:'SKU'},{k:'name',l:'Item'},{k:'category',l:'Category'},
                    {k:'quantity',l:'Qty'},{k:'weight_kg',l:'Weight'},
                    {k:'retrieval_frequency',l:'Freq.'}
                  ].map(({k,l})=>(
                    <th key={k}>
                      <button onClick={()=>toggleSort(k)}
                        className="flex items-center gap-1 group uppercase tracking-wider text-xs">
                        {l}<SortIcon col={k}/>
                      </button>
                    </th>
                  ))}
                  <th>Vol/unit</th><th>Flags</th><th>Warehouse</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const vol = (item.width_m*item.depth_m*item.height_m).toFixed(3)
                  return (
                    <motion.tr key={item.id} initial={{opacity:0}} animate={{opacity:1}}
                      className={selected.has(item.id)?'bg-teal/5':''}>
                      <td>
                        <input type="checkbox" checked={selected.has(item.id)}
                          onChange={()=>toggleSelect(item.id)} className="accent-teal"/>
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-frost px-2 py-0.5 rounded text-navy/50">
                          {item.sku||'—'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name}
                                className="w-8 h-8 rounded-lg object-cover border border-frost flex-shrink-0"/>
                            : <div className="w-8 h-8 rounded-lg bg-frost flex items-center justify-center flex-shrink-0">
                                <Package size={13} className="text-navy/30"/>
                              </div>
                          }
                          <div>
                            <p className="font-display font-semibold text-navy text-sm">{item.name}</p>
                            {item.description && (
                              <p className="text-[11px] text-navy/40 max-w-[180px] truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-navy">{item.category}</span></td>
                      <td><span className="font-display font-bold text-navy">{item.quantity}</span></td>
                      <td className="font-mono text-xs text-navy/60">{item.weight_kg}kg</td>
                      <td><FreqBadge freq={item.retrieval_frequency}/></td>
                      <td className="font-mono text-xs text-navy/60">{vol}m³</td>
                      <td>
                        <div className="flex gap-1.5">
                          {item.stackable&&<span title="Stackable" className="text-sm">📦</span>}
                          {item.fragile&&<span title="Fragile" className="text-sm">🔴</span>}
                          {item.hazardous&&<AlertTriangle size={13} title="Hazmat" className="text-amber-500"/>}
                          {item.temperature_sensitive&&<Thermometer size={13} title="Cold storage" className="text-blue-400"/>}
                        </div>
                      </td>
                      <td className="text-xs text-navy/50">{item.warehouses?.name||'—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={()=>setModal(item)}
                            className="p-1.5 rounded-lg text-navy/30 hover:text-teal hover:bg-frost transition-colors">
                            <Edit2 size={13}/>
                          </button>
                          <button onClick={()=>handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-navy/30 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <ItemModal
            item={modal==='create'?null:modal}
            warehouseId={warehouses[0]?.id||''}
            warehouses={warehouses}
            onClose={()=>setModal(null)}
            onSave={()=>{setModal(null);load()}}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
