import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, BarChart3, Brain, AlertTriangle, CheckCircle, Clock, Package,
  ArrowRight, RefreshCw, Lightbulb, TrendingUp, MoveRight, ChevronDown,
  ChevronUp, Loader, Target, Layers
} from 'lucide-react'
import { warehouseAPI, optimizationAPI } from '../lib/api'
import api from '../lib/api'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, AreaChart, Area
} from 'recharts'

// Priority slider
function PrioritySlider({ label, description, value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-display font-semibold text-navy">{label}</p>
          <p className="text-xs text-navy/40 font-mono">{description}</p>
        </div>
        <span className="font-display font-bold text-teal text-lg w-12 text-right">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range" min={0} max={100} value={Math.round(value * 100)}
        onChange={e => onChange(parseInt(e.target.value) / 100)}
        className="w-full h-2 appearance-none rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, #1f7a8c ${Math.round(value * 100)}%, #e1e5f2 ${Math.round(value * 100)}%)`
        }}
      />
    </div>
  )
}

// Score ring
function ScoreRing({ score, size = 120 }) {
  const r = 44; const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e1e5f2" strokeWidth="8" />
      <motion.circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700"
        fill="#022b3a" fontFamily="Rajdhani,sans-serif">{Math.round(score)}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#6b7280"
        fontFamily="DM Sans,sans-serif">/100</text>
    </svg>
  )
}

// Placement table
function PlacementsTable({ placements }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? placements : placements.slice(0, 8)

  if (!placements?.length) return (
    <p className="text-navy/40 text-sm text-center py-6">Run optimisation to see placements</p>
  )

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th><th>Zone</th><th>Position (x,y,z)</th><th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}>
                <td>
                  <span className="font-display font-semibold text-navy text-sm">{p.item_name}</span>
                </td>
                <td>
                  <span className="badge badge-teal">{p.zone_name}</span>
                </td>
                <td className="font-mono text-xs text-navy/60">
                  ({p.x_pos?.toFixed(2)}, {p.y_pos?.toFixed(2)}, {p.z_pos?.toFixed(2)})
                </td>
                <td className="font-display font-bold text-navy">{p.quantity_placed}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {placements.length > 8 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2 text-teal text-xs font-display font-semibold 
          hover:bg-frost transition-colors flex items-center justify-center gap-1 mt-1"
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show all {placements.length} placements</>}
        </button>
      )}
    </div>
  )
}

// Relocation card
function RelocationCard({ rel, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="border border-amber-200 bg-amber-50 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <MoveRight size={15} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-navy text-sm">{rel.item_name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs font-mono">
            <span className="text-red-500">{rel.from_zone}</span>
            <ArrowRight size={10} className="text-navy/40" />
            <span className="text-emerald-600">{rel.to_zone}</span>
          </div>
          <p className="text-xs text-navy/50 mt-1.5">{rel.reason}</p>
          <p className="text-[10px] font-mono text-emerald-600 mt-1">
            💾 Frees {rel.space_freed_m3} m³
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default function OptimizationPage() {
  const [warehouses, setWarehouses]         = useState([])
  const [selectedWH, setSelectedWH]         = useState('')
  const [priorities, setPriorities]         = useState({
    space_utilization: 0.40,
    retrieval_ease:    0.30,
    weight_balance:    0.20,
    hazard_separation: 0.10,
  })
  const [running, setRunning]               = useState(false)
  const [result, setResult]                 = useState(null)
  const [history, setHistory]               = useState([])
  const [advice, setAdvice]                 = useState(null)
  const [loadingAdvice, setLoadingAdvice]   = useState(false)
  const [activeTab, setActiveTab]           = useState('run')

  // Load warehouses
  useEffect(() => {
    warehouseAPI.list().then(r => {
      const list = r.data.data || []
      setWarehouses(list)
      if (list.length) setSelectedWH(list[0].id)
    }).catch(() => toast.error('Failed to load warehouses'))
  }, [])

  // Load history when warehouse changes
  useEffect(() => {
    if (!selectedWH) return
    optimizationAPI.history(selectedWH).then(r => setHistory(r.data.data || []))
  }, [selectedWH])

  // Normalize priorities to sum=1
  const normPriorities = useCallback(() => {
    const sum = Object.values(priorities).reduce((a, b) => a + b, 0)
    if (sum === 0) return priorities
    return Object.fromEntries(Object.entries(priorities).map(([k, v]) => [k, v / sum]))
  }, [priorities])

  const handleRun = async () => {
    if (!selectedWH) { toast.error('Select a warehouse first'); return }
    setRunning(true)
    setResult(null)
    try {
      const res = await optimizationAPI.run({
        warehouse_id: selectedWH,
        priorities: normPriorities(),
        clear_existing: true,
      })
      setResult(res.data)
      toast.success(`✅ Optimisation complete! Score: ${res.data.metrics?.optimization_score?.toFixed(1)}/100`)
      // Refresh history
      optimizationAPI.history(selectedWH).then(r => setHistory(r.data.data || []))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Optimisation failed')
    } finally { setRunning(false) }
  }

  const loadSlottingAdvice = async () => {
    if (!selectedWH) return
    setLoadingAdvice(true)
    try {
      const res = await api.get(`/ai/slotting-advice/${selectedWH}`)
      setAdvice(res.data)
    } catch (err) {
      toast.error('Failed to load slotting advice')
    } finally { setLoadingAdvice(false) }
  }

  useEffect(() => {
    if (selectedWH && activeTab === 'advice') loadSlottingAdvice()
  }, [selectedWH, activeTab])

  // Radar data from metrics
  const radarData = result ? [
    { subject: 'Space', value: result.metrics?.space_utilization_pct ?? 0 },
    { subject: 'Retrieval', value: result.metrics?.retrieval_score ?? 0 },
    { subject: 'Placement', value: result.metrics?.placement_ratio_pct ?? 0 },
    { subject: 'Score', value: result.metrics?.optimization_score ?? 0 },
    { subject: 'Zones', value: result.metrics?.zones_used
        ? Math.min(100, (result.metrics.zones_used / Math.max(advice?.adjustments?.total_zones || 1, 1)) * 100)
        : 0
    },
  ] : []

  const historyChartData = history.slice().reverse().map((h, i) => ({
    run: `#${i + 1}`,
    score: h.optimization_score ?? 0,
    utilization: h.space_utilization_pct ?? 0,
    date: h.created_at?.slice(5, 16) ?? '',
  }))

  const selectedWarehouse = warehouses.find(w => w.id === selectedWH)

  return (
    <div className="space-y-6">
      <p className="text-navy/50 text-sm">AI-powered 3D bin-packing with constraint solving</p>

      {/* Warehouse selector */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-teal" />
          <span className="text-sm font-display font-semibold text-navy">Target Warehouse</span>
        </div>
        <select value={selectedWH} onChange={e => setSelectedWH(e.target.value)}
          className="select-field w-64 py-2 text-sm flex-1 max-w-sm">
          {warehouses.length === 0 && <option value="">No warehouses — create one first</option>}
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {selectedWarehouse && (
          <span className="text-xs font-mono text-navy/40">
            {selectedWarehouse.width_m}×{selectedWarehouse.depth_m}×{selectedWarehouse.height_m}m
            · {selectedWarehouse.total_capacity_m3?.toFixed(0)} m³
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 w-fit border border-sky/30">
        {[
          { key: 'run',     label: '⚡ Run',        },
          { key: 'results', label: '📊 Results',    },
          { key: 'advice',  label: '🧠 AI Advice',  },
          { key: 'history', label: '🕒 History',    },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-display font-semibold tracking-wide transition-all
            ${activeTab === key ? 'bg-navy text-white shadow-sm' : 'text-navy/50 hover:text-navy'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── RUN TAB ─────────────────────────────────────────────── */}
      {activeTab === 'run' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority sliders */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Layers size={18} className="text-teal" />
              <h3 className="font-display font-bold text-navy text-lg">Optimisation Priorities</h3>
            </div>
            <p className="text-xs text-navy/40 font-mono mb-5">
              Adjust weights to control how the AI scores placement solutions.
              Values are auto-normalised to 100%.
            </p>
            <div className="space-y-6">
              <PrioritySlider
                label="Space Utilisation" value={priorities.space_utilization}
                description="Pack items as densely as possible"
                onChange={v => setPriorities(p => ({ ...p, space_utilization: v }))}
              />
              <PrioritySlider
                label="Retrieval Ease" value={priorities.retrieval_ease}
                description="Keep high-frequency items near exits"
                onChange={v => setPriorities(p => ({ ...p, retrieval_ease: v }))}
              />
              <PrioritySlider
                label="Weight Balance" value={priorities.weight_balance}
                description="Distribute load evenly across zones"
                onChange={v => setPriorities(p => ({ ...p, weight_balance: v }))}
              />
              <PrioritySlider
                label="Hazard Separation" value={priorities.hazard_separation}
                description="Isolate hazmat and temperature items"
                onChange={v => setPriorities(p => ({ ...p, hazard_separation: v }))}
              />
            </div>

            {/* Effective % display */}
            <div className="mt-6 bg-frost rounded-xl p-4">
              <p className="text-xs font-mono text-navy/40 mb-3">EFFECTIVE WEIGHTS (normalised)</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(normPriorities()).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-navy/60 capitalize">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="font-display font-bold text-teal">
                      {Math.round(v * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Algorithm info + run button */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="space-y-4">
            {/* Algorithm card */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={18} className="text-teal" />
                <h3 className="font-display font-bold text-navy text-lg">Algorithm</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: '3D Extreme-Point Bin Packing', desc: 'Places items at optimal anchor points' },
                  { label: 'Item Rotation (6 orientations)', desc: 'Tries all rotations to fit tighter' },
                  { label: 'Zone-Type Routing', desc: 'Hazmat→hazmat, cold→temp-controlled' },
                  { label: 'Weight Stacking Check', desc: 'Respects max_weight_kg per zone' },
                  { label: 'Frequency-Exit Pairing', desc: 'High-freq items placed near exits' },
                  { label: 'Fragile Floor Preference', desc: 'Fragile items placed at z=0 first' },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-display font-semibold text-navy">{label}</p>
                      <p className="text-xs text-navy/40 font-mono">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Run button */}
            <motion.button
              onClick={handleRun}
              disabled={running || !selectedWH}
              whileHover={{ scale: running ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 rounded-2xl bg-navy text-white font-display font-bold 
              text-xl tracking-wider flex items-center justify-center gap-3
              hover:bg-teal transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg hover:shadow-teal/20"
            >
              {running ? (
                <><Loader size={22} className="animate-spin" /> Optimising Warehouse...</>
              ) : (
                <><Zap size={22} /> Run AI Optimisation</>
              )}
            </motion.button>

            {running && (
              <div className="card p-4 bg-teal/5 border-teal/20">
                <p className="text-xs font-mono text-teal text-center animate-pulse">
                  🧠 3D bin-packing in progress · Evaluating extreme points · Routing by zone type...
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── RESULTS TAB ─────────────────────────────────────────── */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {!result ? (
            <div className="card p-16 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="font-display font-bold text-xl text-navy mb-2">No Results Yet</h3>
              <p className="text-navy/40 text-sm mb-4">Run optimisation to see placement results</p>
              <button onClick={() => setActiveTab('run')} className="btn-primary mx-auto">
                <Zap size={14} /> Go to Run Tab
              </button>
            </div>
          ) : (
            <>
              {/* Score + metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score ring */}
                <div className="card p-6 flex flex-col items-center">
                  <ScoreRing score={result.metrics?.optimization_score ?? 0} size={130} />
                  <p className="font-display font-bold text-navy mt-3">Optimisation Score</p>
                  <p className="text-xs font-mono text-navy/40 mt-1">
                    Completed in {result.metrics?.run_time_ms}ms
                  </p>
                </div>

                {/* Key numbers */}
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Space Used', value: `${result.metrics?.space_utilization_pct}%`, color: '#1f7a8c' },
                    { label: 'Items Placed', value: result.metrics?.items_placed, color: '#10b981' },
                    { label: 'Unplaced', value: result.metrics?.items_unplaced, color: result.metrics?.items_unplaced > 0 ? '#ef4444' : '#10b981' },
                    { label: 'Retrieval Score', value: `${result.metrics?.retrieval_score ?? 0}%`, color: '#f59e0b' },
                    { label: 'Zones Used', value: result.metrics?.zones_used, color: '#6366f1' },
                    { label: 'Total Units', value: result.metrics?.total_units, color: '#022b3a' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card p-4">
                      <p className="font-display font-bold text-2xl" style={{ color }}>{value}</p>
                      <p className="text-xs font-display font-semibold text-navy/50 tracking-wide mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar + Placements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4">Performance Breakdown</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e1e5f2" />
                      <PolarAngleAxis dataKey="subject"
                        tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="Score" dataKey="value" stroke="#1f7a8c"
                        fill="#1f7a8c" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Warnings / unplaced */}
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Warnings & Unplaced
                  </h3>
                  {(!result.warnings?.length && !result.unplaced_items?.length) ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle size={16} />
                      <span className="text-sm font-display font-semibold">All items placed successfully!</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {result.unplaced_items?.map((name, i) => (
                        <div key={i} className="flex items-start gap-2 bg-red-50 rounded-lg p-2">
                          <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs font-mono text-red-700">Unplaced: {name}</span>
                        </div>
                      ))}
                      {result.warnings?.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-lg p-2">
                          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs font-mono text-amber-700">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Recommendations */}
              {result.ai_recommendations?.length > 0 && (
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <Lightbulb size={16} className="text-teal" />
                    AI Recommendations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.ai_recommendations.map((rec, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="flex items-start gap-3 bg-teal/5 border border-teal/15 rounded-xl p-3">
                        <div className="w-6 h-6 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-teal">{i + 1}</span>
                        </div>
                        <p className="text-sm text-navy/70 font-body">{rec}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Placements table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="font-display font-bold text-navy">Placement Map</h3>
                  <span className="badge badge-teal">{result.placements?.length} zones allocated</span>
                </div>
                <div className="p-4">
                  <PlacementsTable placements={result.placements || []} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AI ADVICE TAB ───────────────────────────────────────── */}
      {activeTab === 'advice' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-navy text-lg">Space Adjustment Analysis</h3>
              <p className="text-navy/40 text-sm mt-1">Real-time congestion detection & relocation suggestions</p>
            </div>
            <button onClick={loadSlottingAdvice} disabled={loadingAdvice}
              className="btn-secondary flex items-center gap-2">
              <RefreshCw size={14} className={loadingAdvice ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loadingAdvice ? (
            <div className="flex items-center justify-center h-40">
              <div className="spinner w-10 h-10" />
            </div>
          ) : !advice ? (
            <div className="card p-12 text-center">
              <Brain size={40} className="text-teal/30 mx-auto mb-3" />
              <p className="text-navy/40 text-sm">Loading slotting advice...</p>
            </div>
          ) : (
            <>
              {/* Zone utilisation summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Zones', value: advice.adjustments?.total_zones ?? 0, icon: '🏗️' },
                  { label: 'Hot Zones (>85%)', value: advice.adjustments?.hot_zone_count ?? 0, icon: '🔥' },
                  { label: 'Empty Zones', value: advice.adjustments?.empty_zone_count ?? 0, icon: '⬜' },
                  { label: 'Reclaim Potential', value: `${advice.adjustments?.estimated_reclaim_m3 ?? 0} m³`, icon: '♻️' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="card p-4">
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className="font-display font-bold text-xl text-navy">{value}</p>
                    <p className="text-xs font-mono text-navy/40">{label}</p>
                  </div>
                ))}
              </div>

              {/* Zone heatmap table */}
              {advice.adjustments?.zone_utilization?.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="font-display font-bold text-navy">Zone Utilisation</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr><th>Zone</th><th>Type</th><th>Used</th><th>Capacity</th><th>Utilisation</th><th>Near Exit</th></tr>
                      </thead>
                      <tbody>
                        {advice.adjustments.zone_utilization.map(z => {
                          const pct = z.utilization_pct
                          const barColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : pct >= 30 ? '#10b981' : '#94a3b8'
                          return (
                            <tr key={z.zone_id}>
                              <td className="font-display font-semibold text-navy">{z.zone_name}</td>
                              <td><span className="badge badge-teal capitalize">{z.zone_type}</span></td>
                              <td className="font-mono text-xs">{z.used_m3} m³</td>
                              <td className="font-mono text-xs">{z.capacity_m3} m³</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 progress-bar">
                                    <div className="h-full rounded-full"
                                      style={{ width: `${pct}%`, background: barColor }} />
                                  </div>
                                  <span className="font-mono text-xs" style={{ color: barColor }}>{pct}%</span>
                                </div>
                              </td>
                              <td>{z.near_exit ? '✅' : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Relocation suggestions */}
              {advice.adjustments?.suggested_relocations?.length > 0 && (
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <MoveRight size={16} className="text-amber-500" />
                    Suggested Relocations
                  </h3>
                  <div className="space-y-3">
                    {advice.adjustments.suggested_relocations.map((rel, i) => (
                      <RelocationCard key={i} rel={rel} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Fragile warnings */}
              {advice.adjustments?.fragile_warnings?.length > 0 && (
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    Fragile Item Warnings
                  </h3>
                  <div className="space-y-2">
                    {advice.adjustments.fragile_warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                        <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-display font-semibold text-red-700 text-sm">{w.item_name}</p>
                          <p className="text-xs text-red-600 font-mono">
                            Zone: {w.zone_name} · z={w.z_pos?.toFixed(2)}m
                          </p>
                          <p className="text-xs text-red-500 mt-1">{w.warning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              {advice.ai_recommendations?.length > 0 && (
                <div className="card p-6">
                  <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                    <Brain size={16} className="text-teal" />
                    AI Recommendations
                  </h3>
                  <div className="space-y-3">
                    {advice.ai_recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 bg-teal/5 border border-teal/15 rounded-xl p-3">
                        <Lightbulb size={14} className="text-teal mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-navy/70">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!advice.adjustments?.suggested_relocations?.length &&
               !advice.adjustments?.fragile_warnings?.length &&
               !advice.ai_recommendations?.length && (
                <div className="card p-12 text-center">
                  <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                  <h3 className="font-display font-bold text-navy text-xl mb-1">All Good!</h3>
                  <p className="text-navy/40 text-sm">No critical issues detected. Run optimisation to generate detailed recommendations.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {historyChartData.length > 1 && (
            <div className="card p-6">
              <h3 className="font-display font-bold text-navy mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-teal" /> Score Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e5f2" />
                  <XAxis dataKey="run" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                  <Tooltip contentStyle={{
                    fontFamily: 'DM Sans', fontSize: 12, background: '#022b3a',
                    border: 'none', borderRadius: 8, color: 'white'
                  }} />
                  <Area type="monotone" dataKey="score" stroke="#1f7a8c" fill="#bfdbf7"
                    fillOpacity={0.4} strokeWidth={2} name="Score" />
                  <Area type="monotone" dataKey="utilization" stroke="#022b3a" fill="none"
                    strokeWidth={1.5} strokeDasharray="4 2" name="Utilisation %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h3 className="font-display font-bold text-navy">Run History</h3>
              <span className="text-xs font-mono text-navy/40">{history.length} runs</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Score</th><th>Utilisation</th>
                    <th>Placed</th><th>Unplaced</th><th>Time</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-navy/40 py-8">
                      No optimisation runs yet
                    </td></tr>
                  ) : history.map(h => (
                    <tr key={h.id}>
                      <td className="font-mono text-xs">{h.created_at?.slice(0, 16)}</td>
                      <td>
                        <span className={`font-display font-bold ${
                          (h.optimization_score || 0) >= 80 ? 'text-emerald-600' :
                          (h.optimization_score || 0) >= 60 ? 'text-amber-500' : 'text-red-500'
                        }`}>{h.optimization_score?.toFixed(1) ?? '—'}</span>
                      </td>
                      <td className="font-mono text-xs">{h.space_utilization_pct?.toFixed(1)}%</td>
                      <td className="font-display font-bold text-navy">{h.items_placed ?? '—'}</td>
                      <td className={h.items_unplaced > 0 ? 'text-red-500 font-bold' : 'text-emerald-600'}>
                        {h.items_unplaced ?? '—'}
                      </td>
                      <td className="font-mono text-xs text-navy/50">{h.run_time_ms}ms</td>
                      <td>
                        <span className={`badge ${
                          h.status === 'completed' ? 'badge-green' :
                          h.status === 'failed' ? 'badge-red' : 'badge-yellow'
                        }`}>{h.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
