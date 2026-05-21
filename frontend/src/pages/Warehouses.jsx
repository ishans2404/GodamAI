import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Warehouse, Edit2, Trash2, ArrowRight, X, MapPin } from 'lucide-react'
import { warehouseAPI } from '../lib/api'
import toast from 'react-hot-toast'

function WarehouseModal({ warehouse, onClose, onSave }) {
  const isEdit = !!warehouse?.id
  const [form, setForm] = useState(warehouse || {
    name: '', description: '', width_m: 20, depth_m: 15, height_m: 8,
    address: '', status: 'active'
  })
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await warehouseAPI.update(warehouse.id, form)
        toast.success('Warehouse updated')
      } else {
        await warehouseAPI.create(form)
        toast.success('Warehouse created')
      }
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="bg-navy px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-white text-xl tracking-wide">
              {isEdit ? 'Edit Warehouse' : 'Create Warehouse'}
            </h2>
            <p className="text-sky/50 text-xs font-mono mt-0.5">Define your warehouse dimensions</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Warehouse Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input-field" placeholder="e.g. Main Distribution Center" required />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className="input-field resize-none" rows={2} placeholder="Optional description" />
            </div>
            <div>
              <label className="label">Width (meters) *</label>
              <input type="number" value={form.width_m} onChange={e => set('width_m', parseFloat(e.target.value))}
                className="input-field" min={1} step={0.5} required />
            </div>
            <div>
              <label className="label">Depth (meters) *</label>
              <input type="number" value={form.depth_m} onChange={e => set('depth_m', parseFloat(e.target.value))}
                className="input-field" min={1} step={0.5} required />
            </div>
            <div>
              <label className="label">Height (meters) *</label>
              <input type="number" value={form.height_m} onChange={e => set('height_m', parseFloat(e.target.value))}
                className="input-field" min={2} step={0.5} required />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select-field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                className="input-field" placeholder="Warehouse location address" />
            </div>
          </div>

          {/* Volume preview */}
          <div className="bg-frost rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm font-display font-semibold text-navy/60">Total Volume</span>
            <span className="font-display font-bold text-teal text-xl">
              {((form.width_m || 0) * (form.depth_m || 0) * (form.height_m || 0)).toFixed(1)} m³
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <div className="spinner w-4 h-4 mx-auto" /> : isEdit ? 'Update' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | warehouse object

  const load = async () => {
    try {
      const res = await warehouseAPI.list()
      setWarehouses(res.data.data || [])
    } catch (e) { toast.error('Failed to load warehouses') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this warehouse and all its data?')) return
    try {
      await warehouseAPI.delete(id)
      toast.success('Warehouse deleted')
      load()
    } catch { toast.error('Delete failed') }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-navy/50 text-sm">Manage and monitor all warehouse facilities</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Warehouse
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-10 h-10" />
        </div>
      ) : warehouses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-16 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-frost flex items-center justify-center mx-auto mb-5">
            <Warehouse size={36} className="text-teal/40" />
          </div>
          <h3 className="font-display font-bold text-xl text-navy mb-2">No Warehouses Yet</h3>
          <p className="text-navy/50 text-sm mb-6 max-w-sm mx-auto">
            Create your first warehouse to start optimizing your storage space with AI.
          </p>
          <button onClick={() => setModal('create')} className="btn-primary mx-auto">
            Create First Warehouse
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {warehouses.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="p-6">
                {/* Status + type */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`badge ${
                    w.status === 'active' ? 'badge-green' :
                    w.status === 'maintenance' ? 'badge-yellow' : 'badge-navy'
                  }`}>{w.status}</span>
                  <span className="text-xs font-mono text-navy/30">
                    {new Date(w.created_at).toLocaleDateString('en-IN')}
                  </span>
                </div>

                {/* Name */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                    <Warehouse size={18} className="text-teal" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-navy text-lg leading-tight">{w.name}</h3>
                    {w.address && (
                      <p className="text-xs text-navy/40 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {w.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Width', val: `${w.width_m}m` },
                    { label: 'Depth', val: `${w.depth_m}m` },
                    { label: 'Height', val: `${w.height_m}m` },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-frost rounded-lg p-2.5 text-center">
                      <p className="font-display font-bold text-navy text-sm">{val}</p>
                      <p className="text-navy/40 text-[10px] font-mono">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm mb-5">
                  <span className="text-navy/50 font-body">Total Volume</span>
                  <span className="font-display font-bold text-teal text-lg">
                    {w.total_capacity_m3?.toFixed(1)} m³
                  </span>
                </div>

                {w.description && (
                  <p className="text-xs text-navy/40 mb-4 line-clamp-2">{w.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-frost">
                  <Link to={`/warehouses/${w.id}`}
                    className="flex-1 btn-primary text-center flex items-center justify-center gap-2 text-xs py-2">
                    Open <ArrowRight size={12} />
                  </Link>
                  <button onClick={() => setModal(w)}
                    className="p-2 rounded-lg text-navy/40 hover:text-teal hover:bg-frost transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(w.id)}
                    className="p-2 rounded-lg text-navy/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <WarehouseModal
            warehouse={modal === 'create' ? null : modal}
            onClose={() => setModal(null)}
            onSave={() => { setModal(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
