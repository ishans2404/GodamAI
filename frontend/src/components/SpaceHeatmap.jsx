import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, TrendingDown, Zap } from 'lucide-react'

const HEAT_COLOR = (pct) => {
  if (pct >= 90) return { bg: '#fee2e2', bar: '#ef4444', text: '#dc2626', label: 'Critical' }
  if (pct >= 75) return { bg: '#fef3c7', bar: '#f59e0b', text: '#d97706', label: 'High' }
  if (pct >= 40) return { bg: '#d1fae5', bar: '#10b981', text: '#059669', label: 'Optimal' }
  if (pct >  0)  return { bg: '#e0f2fe', bar: '#0ea5e9', text: '#0284c7', label: 'Low' }
  return            { bg: '#f1f5f9', bar: '#94a3b8', text: '#64748b', label: 'Empty' }
}

const ZONE_TYPE_ICON = {
  rack: '🏗️', shelf: '📚', floor: '🟦',
  cold: '❄️', hazmat: '⚠️', bulk: '🧱',
}

export default function SpaceHeatmap({ zones = [], placements = [] }) {
  // Compute utilisation per zone from placements
  const zoneUtils = zones.map((z) => {
    const cap = (z.width_m || 1) * (z.depth_m || 1) * (z.height_m || 1)
    const used = z.utilized_m3 || 0
    const pct  = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
    const itemsInZone = placements.filter(p => p.zone_id === z.id)
    return { ...z, cap, used, pct: Math.round(pct), items: itemsInZone }
  }).sort((a, b) => b.pct - a.pct)

  if (zones.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-3">📊</div>
        <p className="text-navy/40 text-sm">No zones defined — add zones to see utilisation heatmap</p>
      </div>
    )
  }

  const avgUtil = zones.length
    ? Math.round(zoneUtils.reduce((s, z) => s + z.pct, 0) / zoneUtils.length)
    : 0

  const hotZones   = zoneUtils.filter(z => z.pct >= 90)
  const emptyZones = zoneUtils.filter(z => z.pct === 0)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center">
            <Zap size={18} className="text-teal" />
          </div>
          <div>
            <p className="font-display font-bold text-xl text-navy">{avgUtil}%</p>
            <p className="text-xs font-mono text-navy/40">Avg Utilisation</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-display font-bold text-xl text-navy">{hotZones.length}</p>
            <p className="text-xs font-mono text-navy/40">Critical Zones (≥90%)</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
            <TrendingDown size={18} className="text-slate-400" />
          </div>
          <div>
            <p className="font-display font-bold text-xl text-navy">{emptyZones.length}</p>
            <p className="text-xs font-mono text-navy/40">Empty Zones</p>
          </div>
        </div>
      </div>

      {/* Zone cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {zoneUtils.map((z, i) => {
          const heat = HEAT_COLOR(z.pct)
          return (
            <motion.div
              key={z.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card p-4"
              style={{ borderLeft: `4px solid ${heat.bar}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ZONE_TYPE_ICON[z.zone_type] || '📦'}</span>
                  <div>
                    <p className="font-display font-semibold text-navy text-sm">{z.name}</p>
                    <p className="text-[10px] font-mono text-navy/40 capitalize">{z.zone_type}
                      {z.near_exit && ' · Near Exit'}
                      {z.temperature_controlled && ' · Cold'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-display font-bold text-lg" style={{ color: heat.text }}>
                    {z.pct}%
                  </span>
                  <p className="text-[10px] font-mono" style={{ color: heat.text }}>{heat.label}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-bar mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${z.pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: heat.bar }}
                />
              </div>

              {/* Volume info */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-navy/40">
                  {z.used.toFixed(2)} / {z.cap.toFixed(2)} m³
                </span>
                <span className="font-mono text-navy/40">
                  {z.items.length} placement{z.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* High-utilisation warning */}
              {z.pct >= 90 && (
                <div className="mt-2 flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1">
                  <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                  <p className="text-[10px] text-red-600 font-mono">
                    Critical — re-optimise or expand zone capacity
                  </p>
                </div>
              )}
              {z.pct === 0 && (
                <div className="mt-2 flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1">
                  <CheckCircle size={11} className="text-slate-400 flex-shrink-0" />
                  <p className="text-[10px] text-slate-500 font-mono">
                    Empty — run optimisation to utilise this zone
                  </p>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
