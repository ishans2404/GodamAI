import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Zap, X, Edit2, Trash2, Loader,
  CheckCircle, AlertTriangle, MoveRight, Lightbulb, RefreshCw
} from 'lucide-react'
import { warehouseAPI, zoneAPI, optimizationAPI } from '../lib/api'
import api from '../lib/api'
import WarehouseViewer3D from '../components/WarehouseViewer3D'
import SpaceHeatmap from '../components/SpaceHeatmap'
import toast from 'react-hot-toast'

const ZONE_TYPES = ['rack','shelf','floor','cold','hazmat','bulk']
const ZONE_COLORS = {
  rack:'#1f7a8c', shelf:'#2d9cdb', floor:'#7b68ee',
  cold:'#48cae4', hazmat:'#f4a261', bulk:'#a8dadc'
}

/* ─── Zone Modal ───────────────────────────────────────── */
function ZoneModal({ zone, warehouseId, onClose, onSave }) {
  const isEdit = !!zone?.id
  const [form, setForm] = useState(zone || {
    warehouse_id: warehouseId,
    name:'', zone_type:'rack',
    x_pos:0, y_pos:0, z_pos:0,
    width_m:2, depth_m:2, height_m:3,
    max_weight_kg:'', temperature_controlled:false, near_exit:false,
    color:'#1f7a8c'
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, max_weight_kg: form.max_weight_kg ? parseFloat(form.max_weight_kg) : null }
    try {
      if (isEdit) { await zoneAPI.update(zone.id, payload); toast.success('Zone updated') }
      else { await zoneAPI.create(payload); toast.success('Zone created') }
      onSave()
    } catch (err) { toast.error(err.response?.data?.detail||'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
        exit={{scale:0.95,opacity:0}}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden
        max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-navy px-6 py-5 flex items-center justify-between sticky top-0">
          <div>
            <h2 className="font-display font-bold text-white text-xl">
              {isEdit ? 'Edit Zone' : 'Add Zone / Rack'}
            </h2>
            <p className="text-sky/40 text-xs font-mono mt-0.5">
              Define zone dimensions and properties
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Zone Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)}
                className="input-field" placeholder="e.g. Rack A-01" required/>
            </div>
            <div>
              <label className="label">Zone Type</label>
              <select value={form.zone_type}
                onChange={e=>{set('zone_type',e.target.value);set('color',ZONE_COLORS[e.target.value]||'#1f7a8c')}}
                className="select-field">
                {ZONE_TYPES.map(t=>(
                  <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Max Weight (kg)</label>
              <input type="number" value={form.max_weight_kg}
                onChange={e=>set('max_weight_kg',e.target.value)}
                className="input-field" placeholder="No limit" min={0}/>
            </div>
          </div>

          {/* Zone type info banner */}
          <div className="bg-frost rounded-xl p-3 text-xs font-mono text-navy/50">
            {form.zone_type==='hazmat' && '⚠️ Hazmat zones are reserved for hazardous items only'}
            {form.zone_type==='cold'   && '❄️ Cold zones auto-accept temperature-sensitive items'}
            {form.zone_type==='rack'   && '🏗️ Rack zones support vertical stacking by height'}
            {form.zone_type==='shelf'  && '📚 Shelf zones: multi-level horizontal storage'}
            {form.zone_type==='bulk'   && '🧱 Bulk zones: large floor-level storage'}
            {form.zone_type==='floor'  && '🟦 Floor zones: ground-level, no stacking limit'}
          </div>

          {/* Position */}
          <div>
            <p className="label mb-2">Position — metres from warehouse origin</p>
            <div className="grid grid-cols-3 gap-3">
              {[['x_pos','X (left→right)'],['y_pos','Y (front→back)'],['z_pos','Z (floor→up)']].map(([k,l])=>(
                <div key={k}>
                  <label className="text-[10px] font-mono text-navy/40 mb-1 block">{l}</label>
                  <input type="number" value={form[k]}
                    onChange={e=>set(k,parseFloat(e.target.value)||0)}
                    className="input-field" min={0} step={0.5}/>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <p className="label mb-2">Zone Dimensions (metres)</p>
            <div className="grid grid-cols-3 gap-3">
              {[['width_m','Width'],['depth_m','Depth'],['height_m','Height']].map(([k,l])=>(
                <div key={k}>
                  <label className="text-[10px] font-mono text-navy/40 mb-1 block">{l} *</label>
                  <input type="number" value={form[k]}
                    onChange={e=>set(k,parseFloat(e.target.value)||0.5)}
                    className="input-field" min={0.5} step={0.5} required/>
                </div>
              ))}
            </div>
            {/* Volume preview */}
            <div className="mt-3 bg-teal/5 border border-teal/15 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs font-mono text-navy/50">Zone capacity</span>
              <span className="font-display font-bold text-teal">
                {((form.width_m||0)*(form.depth_m||0)*(form.height_m||0)).toFixed(2)} m³
              </span>
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {k:'near_exit',l:'Near Exit',d:'High-freq items placed here first'},
              {k:'temperature_controlled',l:'Temp. Controlled',d:'Accepts cold-sensitive items'},
            ].map(({k,l,d})=>(
              <label key={k}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${form[k]?'border-teal bg-teal/5':'border-frost hover:border-sky/50'}`}>
                <input type="checkbox" checked={form[k]}
                  onChange={e=>set(k,e.target.checked)} className="mt-0.5 accent-teal flex-shrink-0"/>
                <div>
                  <p className="text-sm font-display font-semibold text-navy">{l}</p>
                  <p className="text-[10px] text-navy/40 font-mono">{d}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader size={14} className="animate-spin"/> Saving…</>
                : isEdit ? 'Update Zone' : 'Add Zone'
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ─── Main Page ────────────────────────────────────────── */
export default function WarehouseDetail() {
  const { id } = useParams()
  const [warehouse, setWarehouse] = useState(null)
  const [zones, setZones] = useState([])
  const [placements, setPlacements] = useState([])
  const [stats, setStats] = useState(null)
  const [adjustments, setAdjustments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [optimizing, setOptimizing] = useState(false)
  const [loadingAdj, setLoadingAdj] = useState(false)
  const [activeTab, setActiveTab] = useState('3d')

  const load = async () => {
    try {
      const [wRes, zRes, pRes, sRes] = await Promise.all([
        warehouseAPI.get(id),
        zoneAPI.list(id),
        optimizationAPI.placements(id),
        warehouseAPI.stats(id),
      ])
      setWarehouse(wRes.data.data)
      setZones(zRes.data.data || [])
      setPlacements(pRes.data.data || [])
      setStats(sRes.data)
    } catch { toast.error('Failed to load warehouse') }
    finally { setLoading(false) }
  }

  const loadAdjustments = async () => {
    setLoadingAdj(true)
    try {
      const res = await api.get(`/optimization/space-adjustments/${id}`)
      setAdjustments(res.data.adjustments)
    } catch { toast.error('Failed to load space analysis') }
    finally { setLoadingAdj(false) }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (activeTab === 'heatmap') loadAdjustments()
  }, [activeTab])

  const handleOptimize = async () => {
    setOptimizing(true)
    try {
      const res = await optimizationAPI.run({
        warehouse_id: id,
        priorities: { space_utilization:0.4, retrieval_ease:0.3, weight_balance:0.2, hazard_separation:0.1 },
        clear_existing: true
      })
      toast.success(`✅ Score: ${res.data.metrics?.optimization_score?.toFixed(1)}/100 · `+
        `${res.data.metrics?.items_placed} items placed`)
      load()
      if (activeTab === 'heatmap') loadAdjustments()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Optimisation failed')
    } finally { setOptimizing(false) }
  }

  const handleDeleteZone = async (zoneId) => {
    if (!confirm('Delete this zone and all associated placements?')) return
    try { await zoneAPI.delete(zoneId); toast.success('Zone deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner w-10 h-10"/>
    </div>
  )
  if (!warehouse) return (
    <div className="text-center py-16">
      <p className="text-navy/50">Warehouse not found</p>
      <Link to="/warehouses" className="text-teal text-sm mt-2 inline-block">← Back</Link>
    </div>
  )

  const tabs = [
    { key:'3d',         label:'🏗️ 3D View'     },
    { key:'heatmap',    label:'🌡️ Space Heat'  },
    { key:'zones',      label:'📦 Zones'        },
    { key:'placements', label:'📍 Placements'   },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/warehouses"
          className="p-2 rounded-lg hover:bg-white text-navy/50 hover:text-navy transition-colors">
          <ArrowLeft size={20}/>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-2xl text-navy truncate">{warehouse.name}</h2>
          <p className="text-navy/40 text-sm font-mono">
            {warehouse.width_m}×{warehouse.depth_m}×{warehouse.height_m}m
            · {warehouse.total_capacity_m3?.toFixed(1)} m³ total
            {warehouse.address && ` · ${warehouse.address}`}
          </p>
        </div>
        <button onClick={()=>setModal('zone')} className="btn-secondary flex items-center gap-2">
          <Plus size={15}/> Add Zone
        </button>
        <button
          onClick={handleOptimize}
          disabled={optimizing || zones.length===0}
          title={zones.length===0 ? 'Add zones first' : ''}
          className="btn-primary flex items-center gap-2 min-w-[170px] justify-center"
        >
          {optimizing
            ? <><Loader size={15} className="animate-spin"/> Optimising…</>
            : <><Zap size={15}/> Run AI Optimisation</>
          }
        </button>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Zones',      value: stats.total_zones },
            { label:'Item SKUs',  value: stats.total_items },
            { label:'Item Units', value: stats.total_item_units },
            { label:'Last Score', value: stats.latest_optimization?.optimization_score
                ? `${stats.latest_optimization.optimization_score.toFixed(0)}/100`
                : 'Not run',
              color: stats.latest_optimization?.optimization_score >= 80
                ? 'text-emerald-600'
                : stats.latest_optimization?.optimization_score >= 60
                  ? 'text-amber-500' : 'text-navy'
            },
          ].map(({label,value,color})=>(
            <div key={label} className="card p-4">
              <p className={`font-display font-bold text-2xl ${color||'text-navy'}`}>{value}</p>
              <p className="text-xs font-display font-semibold text-navy/40 tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 w-fit border border-sky/30 flex-wrap">
        {tabs.map(({key,label})=>(
          <button key={key} onClick={()=>setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-display font-semibold tracking-wide transition-all
            ${activeTab===key?'bg-navy text-white shadow-sm':'text-navy/50 hover:text-navy'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 3D View ── */}
      {activeTab==='3d' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}}>
          {zones.length===0 ? (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-4">🏗️</div>
              <h3 className="font-display font-bold text-xl text-navy mb-2">No Zones Defined</h3>
              <p className="text-navy/50 text-sm mb-5 max-w-sm mx-auto">
                Add racks, shelves, or floor areas to see your warehouse visualised in 3D.
              </p>
              <button onClick={()=>setModal('zone')} className="btn-primary mx-auto flex items-center gap-2">
                <Plus size={14}/> Add First Zone
              </button>
            </div>
          ) : (
            <>
              <WarehouseViewer3D warehouse={warehouse} zones={zones}
                placements={placements} height="540px"/>
              {placements.length===0 && zones.length>0 && (
                <div className="card p-4 bg-teal/5 border-teal/20 flex items-center gap-3 mt-3">
                  <Zap size={16} className="text-teal flex-shrink-0"/>
                  <p className="text-sm text-navy/70">
                    Run <strong>AI Optimisation</strong> to see items placed in the 3D view.
                  </p>
                  <button onClick={handleOptimize} disabled={optimizing}
                    className="ml-auto btn-primary text-xs py-1.5 flex items-center gap-1.5">
                    <Zap size={12}/> Run Now
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ── Space Heatmap ── */}
      {activeTab==='heatmap' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-navy text-lg">Space Utilisation Heatmap</h3>
              <p className="text-navy/40 text-sm">Live zone utilisation · Congestion detection · Relocation advice</p>
            </div>
            <button onClick={loadAdjustments} disabled={loadingAdj}
              className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={13} className={loadingAdj?'animate-spin':''}/> Refresh
            </button>
          </div>

          {/* Zone capacity heatmap grid */}
          <SpaceHeatmap zones={zones} placements={placements}/>

          {loadingAdj ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner w-8 h-8"/>
            </div>
          ) : adjustments ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label:'Hot Zones',        value: adjustments.hot_zone_count??0,        icon:'🔥', danger: true },
                  { label:'Empty Zones',      value: adjustments.empty_zone_count??0,      icon:'⬜' },
                  { label:'Relocations',      value: adjustments.suggested_relocations?.length??0, icon:'🔄' },
                  { label:'Space Recoverable',value:`${adjustments.estimated_reclaim_m3??0} m³`,icon:'♻️' },
                ].map(({label,value,icon,danger})=>(
                  <div key={label} className={`card p-4 ${danger&&(value>0)?'border-red-200':''}`}>
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className={`font-display font-bold text-xl ${danger&&value>0?'text-red-500':'text-navy'}`}>
                      {value}
                    </p>
                    <p className="text-xs font-mono text-navy/40">{label}</p>
                  </div>
                ))}
              </div>

              {/* Hot zones warning */}
              {adjustments.hot_zones?.length > 0 && (
                <div className="card p-5 border-red-200 bg-red-50/50">
                  <h4 className="font-display font-bold text-red-600 mb-3 flex items-center gap-2">
                    <AlertTriangle size={16}/> Critically Overloaded Zones
                  </h4>
                  <div className="space-y-2">
                    {adjustments.hot_zones.map(z=>(
                      <div key={z.zone_id} className="flex items-center justify-between 
                      bg-white rounded-xl px-4 py-3 border border-red-100">
                        <div>
                          <p className="font-display font-semibold text-navy text-sm">{z.zone_name}</p>
                          <p className="text-xs font-mono text-navy/40">{z.zone_type} · {z.used_m3}/{z.capacity_m3} m³</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-bold text-red-500 text-lg">{z.utilization_pct}%</p>
                          <p className="text-[10px] font-mono text-red-400">CRITICAL</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relocation suggestions */}
              {adjustments.suggested_relocations?.length > 0 && (
                <div className="card p-5">
                  <h4 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <MoveRight size={16} className="text-amber-500"/> Suggested Relocations
                  </h4>
                  <div className="space-y-3">
                    {adjustments.suggested_relocations.map((r,i)=>(
                      <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}}
                        transition={{delay:i*0.07}}
                        className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <MoveRight size={15} className="text-amber-600"/>
                          </div>
                          <div className="flex-1">
                            <p className="font-display font-semibold text-navy text-sm">{r.item_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                              <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded">{r.from_zone}</span>
                              <MoveRight size={10} className="text-navy/40"/>
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{r.to_zone}</span>
                            </div>
                            <p className="text-xs text-navy/50 mt-2">{r.reason}</p>
                            <p className="text-[11px] font-mono text-emerald-600 mt-1">
                              💾 Recovers {r.space_freed_m3} m³
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fragile warnings */}
              {adjustments.fragile_warnings?.length > 0 && (
                <div className="card p-5">
                  <h4 className="font-display font-bold text-navy mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500"/> Fragile Item Warnings
                  </h4>
                  <div className="space-y-2">
                    {adjustments.fragile_warnings.map((w,i)=>(
                      <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
                        <div>
                          <p className="font-display font-semibold text-red-700 text-sm">{w.item_name}</p>
                          <p className="text-xs text-red-500 font-mono">
                            {w.zone_name} · Elevation: {parseFloat(w.z_pos||0).toFixed(2)}m
                          </p>
                          <p className="text-xs text-red-400 mt-1">{w.warning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stacking violations */}
              {adjustments.stacking_violations?.length > 0 && (
                <div className="card p-5">
                  <h4 className="font-display font-bold text-navy mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500"/> Stacking Violations
                  </h4>
                  <div className="space-y-2">
                    {adjustments.stacking_violations.map((v,i)=>(
                      <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0"/>
                        <div>
                          <p className="font-display font-semibold text-navy text-sm">{v.item_name}</p>
                          <p className="text-xs font-mono text-navy/50">
                            {v.zone_name} · z={parseFloat(v.z_pos||0).toFixed(2)}m (non-stackable)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All clear */}
              {!adjustments.hot_zones?.length &&
               !adjustments.suggested_relocations?.length &&
               !adjustments.fragile_warnings?.length &&
               !adjustments.stacking_violations?.length && (
                <div className="card p-12 text-center">
                  <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3"/>
                  <h3 className="font-display font-bold text-navy text-xl mb-1">No Issues Detected</h3>
                  <p className="text-navy/40 text-sm">
                    Warehouse space is healthy. Run optimisation to keep it optimal.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <Lightbulb size={32} className="text-teal/30 mx-auto mb-3"/>
              <p className="text-navy/40 text-sm">
                Run optimisation first to populate space analysis.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Zones List ── */}
      {activeTab==='zones' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <div className="card-header">
            <h3 className="font-display font-bold text-navy">
              Storage Zones ({zones.length})
            </h3>
            <button onClick={()=>setModal('zone')} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <Plus size={13}/> Add Zone
            </button>
          </div>
          {zones.length===0 ? (
            <div className="p-12 text-center">
              <p className="text-navy/40 text-sm mb-4">No zones yet.</p>
              <button onClick={()=>setModal('zone')} className="btn-primary mx-auto flex items-center gap-2">
                <Plus size={13}/> Add First Zone
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone</th><th>Type</th><th>Position</th><th>Dimensions</th>
                    <th>Capacity</th><th>Utilised</th><th>Flags</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(z=>{
                    const cap = (z.width_m*z.depth_m*z.height_m)
                    const util = cap>0 ? Math.round(((z.utilized_m3||0)/cap)*100) : 0
                    return (
                      <tr key={z.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{background:z.color||'#1f7a8c'}}/>
                            <span className="font-display font-semibold text-navy">{z.name}</span>
                          </div>
                        </td>
                        <td><span className="badge badge-teal capitalize">{z.zone_type}</span></td>
                        <td className="font-mono text-xs">
                          ({z.x_pos},{z.y_pos},{z.z_pos})
                        </td>
                        <td className="font-mono text-xs">
                          {z.width_m}×{z.depth_m}×{z.height_m}m
                        </td>
                        <td className="font-mono text-xs">{cap.toFixed(1)} m³</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 progress-bar">
                              <div className="h-full rounded-full"
                                style={{
                                  width:`${util}%`,
                                  background: util>=90?'#ef4444':util>=75?'#f59e0b':'#10b981'
                                }}/>
                            </div>
                            <span className="text-xs font-mono">{util}%</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1.5">
                            {z.near_exit&&<span title="Near exit" className="badge badge-green text-[9px]">EXIT</span>}
                            {z.temperature_controlled&&<span title="Cold" className="badge text-[9px] bg-blue-50 text-blue-600">COLD</span>}
                            {z.max_weight_kg&&<span title={`Max ${z.max_weight_kg}kg`} className="badge badge-navy text-[9px]">{z.max_weight_kg}kg</span>}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={()=>setModal(z)}
                              className="p-1.5 rounded text-navy/30 hover:text-teal hover:bg-frost">
                              <Edit2 size={13}/>
                            </button>
                            <button onClick={()=>handleDeleteZone(z.id)}
                              className="p-1.5 rounded text-navy/30 hover:text-red-500 hover:bg-red-50">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Placements ── */}
      {activeTab==='placements' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="card">
          <div className="card-header">
            <h3 className="font-display font-bold text-navy">
              Current Placements ({placements.length})
            </h3>
            <button onClick={handleOptimize} disabled={optimizing}
              className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <Zap size={12}/> Re-optimise
            </button>
          </div>
          {placements.length===0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📍</div>
              <p className="text-navy/40 text-sm mb-4">
                No placements yet. Run AI Optimisation to assign items to zones.
              </p>
              <button onClick={handleOptimize} disabled={optimizing}
                className="btn-primary mx-auto flex items-center gap-2">
                <Zap size={14}/> Run Optimisation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>Zone</th><th>Position (x,y,z)</th><th>Qty</th><th>Frequency</th></tr>
                </thead>
                <tbody>
                  {placements.map(p=>(
                    <tr key={p.id}>
                      <td>
                        <p className="font-display font-semibold text-navy text-sm">
                          {p.inventory_items?.name||'Unknown'}
                        </p>
                        <p className="text-xs text-navy/40">{p.inventory_items?.category||''}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm"
                            style={{background:p.zones?.color||'#1f7a8c'}}/>
                          <span className="text-sm">{p.zones?.name||'—'}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-navy/60">
                        ({parseFloat(p.x_pos||0).toFixed(2)},
                         {parseFloat(p.y_pos||0).toFixed(2)},
                         {parseFloat(p.z_pos||0).toFixed(2)})
                      </td>
                      <td className="font-display font-bold text-navy">{p.quantity_placed}</td>
                      <td>
                        <span className={`badge ${
                          p.inventory_items?.retrieval_frequency==='high'?'badge-green':
                          p.inventory_items?.retrieval_frequency==='medium'?'badge-yellow':'badge-navy'
                        }`}>{p.inventory_items?.retrieval_frequency||'medium'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {modal && (
          <ZoneModal
            zone={modal==='zone'?null:modal}
            warehouseId={id}
            onClose={()=>setModal(null)}
            onSave={()=>{setModal(null);load()}}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
