import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import { warehouseAPI } from '../lib/api'
import api from '../lib/api'
import { TrendingUp, Package, Warehouse, Zap, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const PALETTE = ['#1f7a8c','#022b3a','#bfdbf7','#48cae4','#10b981','#f59e0b','#6366f1','#ec4899']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy text-white px-3 py-2 rounded-xl shadow-xl text-xs font-mono">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {
          typeof p.value === 'number' ? p.value.toFixed(1) : p.value
        }</p>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="card p-5 relative overflow-hidden"
    >
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-5"
        style={{ background: color }} />
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + '18' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <p className="font-display font-bold text-2xl text-navy">{value}</p>
      <p className="text-xs font-display font-semibold text-navy/50 tracking-wide mt-0.5">{label}</p>
      {sub && <p className="text-[11px] font-mono text-navy/30 mt-1">{sub}</p>}
    </motion.div>
  )
}

export default function Analytics() {
  const [overview, setOverview] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [selectedWH, setSelectedWH] = useState('')
  const [whData, setWhData] = useState(null)
  const [invData, setInvData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingWH, setLoadingWH] = useState(false)

  const loadOverview = async () => {
    try {
      const [ovRes, whRes] = await Promise.all([
        api.get('/analytics/overview'),
        warehouseAPI.list()
      ])
      setOverview(ovRes.data)
      const list = whRes.data.data || []
      setWarehouses(list)
      if (list.length && !selectedWH) setSelectedWH(list[0].id)
    } catch {
      toast.error('Failed to load analytics')
    } finally { setLoading(false) }
  }

  const loadWarehouseData = async (id) => {
    if (!id) return
    setLoadingWH(true)
    try {
      const [wdRes, invRes] = await Promise.all([
        api.get(`/analytics/warehouse/${id}`),
        api.get(`/analytics/inventory-breakdown/${id}`)
      ])
      setWhData(wdRes.data)
      setInvData(invRes.data)
    } catch { toast.error('Failed to load warehouse analytics') }
    finally { setLoadingWH(false) }
  }

  useEffect(() => { loadOverview() }, [])
  useEffect(() => { if (selectedWH) loadWarehouseData(selectedWH) }, [selectedWH])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner w-10 h-10" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-navy/50 text-sm">Platform-wide KPIs and per-warehouse intelligence</p>
        <button onClick={loadOverview} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Platform KPIs */}
      {overview && (
        <>
          <div>
            <h2 className="font-display font-bold text-navy text-lg mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-teal" /> Platform Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard index={0} icon={Warehouse} label="Warehouses"
                value={overview.warehouses} sub={`${overview.active_warehouses} active`} color="#1f7a8c" />
              <StatCard index={1} icon={Package} label="Total SKUs"
                value={overview.total_items_skus?.toLocaleString()}
                sub={`${overview.total_item_units?.toLocaleString()} units`} color="#022b3a" />
              <StatCard index={2} icon={Zap} label="Avg. Opt. Score"
                value={`${overview.avg_optimization_score ?? 0}/100`}
                sub={`${overview.total_optimizations} runs total`} color="#10b981" />
              <StatCard index={3} icon={TrendingUp} label="Platform Utilisation"
                value={`${overview.platform_utilization_pct}%`}
                sub={`${overview.total_capacity_m3?.toFixed(0)} m³ total`} color="#6366f1" />
            </div>
          </div>

          {/* Platform charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }} className="card p-6">
              <h3 className="font-display font-bold text-navy mb-4">Inventory by Category</h3>
              {overview.category_breakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overview.category_breakdown.slice(0, 8)}
                    margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1e5f2" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'DM Sans', fill: '#022b3a60' }}
                      angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: '#022b3a60' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Units" radius={[4, 4, 0, 0]}>
                      {overview.category_breakdown.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-navy/30 text-sm">
                  No inventory data
                </div>
              )}
            </motion.div>

            {/* Zone type breakdown */}
            <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }} className="card p-6">
              <h3 className="font-display font-bold text-navy mb-4">Zone Types</h3>
              {overview.zone_type_breakdown?.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={overview.zone_type_breakdown} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {overview.zone_type_breakdown.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {overview.zone_type_breakdown.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="text-sm text-navy/70 capitalize flex-1">{d.name}</span>
                        <span className="font-display font-bold text-navy text-sm">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-navy/30 text-sm">No zone data</div>
              )}
            </motion.div>
          </div>

          {/* Special item flags */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }} className="card p-6">
            <h3 className="font-display font-bold text-navy mb-4">Inventory Flags</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: '⚠️ Hazardous', value: overview.hazmat_count, color: '#f59e0b' },
                { label: '🔴 Fragile', value: overview.fragile_count, color: '#ef4444' },
                { label: '🌡️ Temp-Sensitive', value: overview.temp_sensitive_count, color: '#0ea5e9' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-frost rounded-xl p-4 flex items-center gap-3">
                  <p className="text-2xl">{label.split(' ')[0]}</p>
                  <div>
                    <p className="font-display font-bold text-xl text-navy">{value}</p>
                    <p className="text-xs font-mono text-navy/40">{label.slice(3)} items</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* ── Per-warehouse drill-down ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h2 className="font-display font-bold text-navy text-lg flex items-center gap-2">
            <Warehouse size={18} className="text-teal" /> Warehouse Drill-Down
          </h2>
          <select value={selectedWH} onChange={e => setSelectedWH(e.target.value)}
            className="select-field w-auto py-2 text-sm">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {loadingWH ? (
          <div className="flex items-center justify-center h-40">
            <div className="spinner w-10 h-10" />
          </div>
        ) : whData ? (
          <div className="space-y-6">
            {/* WH stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Zones', value: whData.total_zones },
                { label: 'SKUs', value: whData.total_items },
                { label: 'Units', value: whData.total_units?.toLocaleString() },
                { label: 'Opt. Score', value: whData.latest_optimization_score
                    ? `${whData.latest_optimization_score.toFixed(0)}/100` : 'N/A' },
              ].map(({ label, value }, i) => (
                <motion.div key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 }} className="card p-4">
                  <p className="font-display font-bold text-xl text-navy">{value}</p>
                  <p className="text-xs font-mono text-navy/40 mt-0.5">{label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Zone utilisation bars */}
              <div className="card p-6">
                <h3 className="font-display font-bold text-navy mb-4">Zone Utilisation</h3>
                {whData.zone_utilization?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={whData.zone_utilization} layout="vertical"
                      margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e1e5f2" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]}
                        tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: '#022b3a60' }} unit="%" />
                      <YAxis type="category" dataKey="name" width={80}
                        tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="utilization" name="Utilisation %" radius={[0, 4, 4, 0]}>
                        {whData.zone_utilization.map((z, i) => (
                          <Cell key={i} fill={
                            z.utilization >= 90 ? '#ef4444' :
                            z.utilization >= 75 ? '#f59e0b' :
                            z.utilization >= 30 ? '#10b981' : '#94a3b8'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-navy/30 text-sm">
                    No zone data
                  </div>
                )}
              </div>

              {/* Retrieval frequency pie */}
              <div className="card p-6">
                <h3 className="font-display font-bold text-navy mb-4">Retrieval Frequency</h3>
                {whData.frequency_breakdown?.some(d => d.value > 0) ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={whData.frequency_breakdown} cx="50%" cy="50%"
                          innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                          {whData.frequency_breakdown.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {whData.frequency_breakdown.map(d => (
                        <div key={d.name} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                          <span className="text-sm text-navy/70">{d.name}</span>
                          <span className="ml-auto font-display font-bold text-navy">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[150px] flex items-center justify-center text-navy/30 text-sm">No data</div>
                )}
              </div>
            </div>

            {/* Score trend */}
            {whData.score_trend?.length > 1 && (
              <div className="card p-6">
                <h3 className="font-display font-bold text-navy mb-4">Optimisation Score Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={whData.score_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1e5f2" />
                    <XAxis dataKey="date"
                      tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: '#022b3a60' }} />
                    <YAxis domain={[0, 100]}
                      tick={{ fontSize: 10, fontFamily: 'DM Sans', fill: '#022b3a60' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="score" name="Score" stroke="#1f7a8c"
                      fill="#bfdbf7" fillOpacity={0.5} strokeWidth={2} />
                    <Area type="monotone" dataKey="utilization" name="Utilisation %"
                      stroke="#022b3a" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Item flags */}
            {whData.item_flags && (
              <div className="card p-6">
                <h3 className="font-display font-bold text-navy mb-4">Warehouse Item Flags</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Hazardous', value: whData.item_flags.hazardous, icon: '⚠️' },
                    { label: 'Fragile', value: whData.item_flags.fragile, icon: '🔴' },
                    { label: 'Temp-Sensitive', value: whData.item_flags.temp_sensitive, icon: '🌡️' },
                    { label: 'Stackable', value: whData.item_flags.stackable, icon: '📦' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="bg-frost rounded-xl p-3 text-center">
                      <p className="text-xl mb-1">{icon}</p>
                      <p className="font-display font-bold text-navy text-lg">{value}</p>
                      <p className="text-xs font-mono text-navy/40">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top items by volume */}
            {invData?.items?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="font-display font-bold text-navy">Top Items by Volume</h3>
                  <span className="text-xs font-mono text-navy/40">
                    Total: {invData.total_volume_m3?.toFixed(2)} m³ · {invData.total_weight_kg?.toFixed(0)} kg
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th><th>Category</th><th>Qty</th>
                        <th>Vol/Unit</th><th>Total Vol</th><th>Frequency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invData.items.slice(0, 15).map((item, i) => (
                        <tr key={i}>
                          <td>
                            <div className="font-display font-semibold text-navy text-sm">{item.name}</div>
                            <div className="text-xs font-mono text-navy/40">{item.sku}</div>
                          </td>
                          <td><span className="badge badge-navy">{item.category}</span></td>
                          <td className="font-display font-bold text-navy">{item.quantity}</td>
                          <td className="font-mono text-xs">{item.volume_each} m³</td>
                          <td className="font-mono text-xs text-teal font-semibold">{item.total_volume} m³</td>
                          <td>
                            <span className={`badge ${
                              item.retrieval_frequency === 'high' ? 'badge-green' :
                              item.retrieval_frequency === 'medium' ? 'badge-yellow' : 'badge-navy'
                            }`}>{item.retrieval_frequency}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <p className="text-navy/40 text-sm">Select a warehouse to view analytics</p>
          </div>
        )}
      </div>
    </div>
  )
}
