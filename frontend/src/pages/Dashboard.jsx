import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Warehouse, Package, Zap, TrendingUp, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'
import { warehouseAPI, inventoryAPI } from '../lib/api'
import { useStore } from '../store'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } })
}

function StatCard({ icon: Icon, label, value, sub, color, index }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="stat-card"
    >
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 overflow-hidden rounded-xl">
        <Icon size={80} strokeWidth={1} />
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4`}
        style={{ background: color + '20' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-3xl font-display font-bold text-navy">{value}</p>
      <p className="text-sm font-display font-semibold text-navy/50 tracking-wide mt-1">{label}</p>
      {sub && <p className="text-xs font-mono text-navy/30 mt-1">{sub}</p>}
    </motion.div>
  )
}

const COLORS = ['#1f7a8c', '#bfdbf7', '#022b3a', '#e1e5f2', '#48cae4']

export default function Dashboard() {
  const { user } = useStore()
  const [warehouses, setWarehouses] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [wRes, sRes] = await Promise.all([
          warehouseAPI.list(),
          inventoryAPI.summary()
        ])
        setWarehouses(wRes.data.data || [])
        setSummary(sRes.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalCapacity = warehouses.reduce((s, w) => s + (w.total_capacity_m3 || 0), 0)

  const categoryData = summary?.by_category
    ? Object.entries(summary.by_category).map(([name, value]) => ({ name, value }))
    : []

  const freqData = summary?.by_frequency
    ? [
        { name: 'High', value: summary.by_frequency.high || 0, color: '#10b981' },
        { name: 'Medium', value: summary.by_frequency.medium || 0, color: '#f59e0b' },
        { name: 'Low', value: summary.by_frequency.low || 0, color: '#6b7280' },
      ]
    : []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner w-10 h-10" />
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="font-display font-bold text-2xl text-navy">
            Welcome back, <span className="text-teal">{user?.username || 'Admin'}</span>
          </h2>
          <p className="text-navy/50 text-sm mt-1">Here's your warehouse intelligence overview</p>
        </div>
        <Link to="/optimization" className="btn-primary flex items-center gap-2">
          <Zap size={16} />
          Run Optimization
        </Link>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard index={0} icon={Warehouse} label="Total Warehouses" value={warehouses.length}
          sub={`${totalCapacity.toFixed(0)} m³ total`} color="#1f7a8c" />
        <StatCard index={1} icon={Package} label="Inventory Items"
          value={summary?.total_items || 0} sub={`${summary?.total_units || 0} total units`} color="#022b3a" />
        <StatCard index={2} icon={AlertTriangle} label="Hazmat Items"
          value={summary?.hazmat_count || 0} sub="Require special handling" color="#f59e0b" />
        <StatCard index={3} icon={TrendingUp} label="Active Warehouses"
          value={warehouses.filter(w => w.status === 'active').length}
          sub="Fully operational" color="#10b981" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="font-display font-bold text-navy text-lg tracking-wide">Inventory by Category</h3>
          </div>
          <div className="p-6">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e5f2" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: '#022b3a80' }} />
                  <Tooltip
                    contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, background: '#022b3a', border: 'none', borderRadius: 8, color: 'white' }}
                  />
                  <Bar dataKey="value" fill="#1f7a8c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-navy/30 text-sm">
                No inventory data yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Frequency breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="font-display font-bold text-navy text-lg tracking-wide">Retrieval Frequency</h3>
          </div>
          <div className="p-6 flex items-center gap-8">
            {freqData.some(d => d.value > 0) ? (
              <>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={freqData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={3} dataKey="value">
                      {freqData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {freqData.map(d => (
                    <div key={d.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm font-body text-navy/70">{d.name} Frequency</span>
                      <span className="ml-auto font-display font-bold text-navy">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-[160px] flex items-center justify-center text-navy/30 text-sm">
                No inventory data yet
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Warehouse list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <div className="card-header">
          <h3 className="font-display font-bold text-navy text-lg tracking-wide">Warehouses</h3>
          <Link to="/warehouses" className="text-teal text-sm font-display font-semibold 
          hover:text-teal-600 flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Dimensions</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-navy/40 py-8">
                  No warehouses yet. <Link to="/warehouses" className="text-teal">Create one →</Link>
                </td></tr>
              ) : (
                warehouses.slice(0, 5).map(w => (
                  <tr key={w.id}>
                    <td>
                      <div className="font-display font-semibold text-navy">{w.name}</div>
                      <div className="text-xs text-navy/40 font-mono">{w.address || 'No address'}</div>
                    </td>
                    <td className="font-mono text-xs text-navy/70">
                      {w.width_m}m × {w.depth_m}m × {w.height_m}m
                    </td>
                    <td className="font-mono text-sm">{w.total_capacity_m3?.toFixed(1)} m³</td>
                    <td>
                      <span className={`badge ${
                        w.status === 'active' ? 'badge-green' :
                        w.status === 'maintenance' ? 'badge-yellow' : 'badge-navy'
                      }`}>{w.status}</span>
                    </td>
                    <td>
                      <Link to={`/warehouses/${w.id}`}
                        className="text-teal text-xs font-display font-semibold hover:text-teal-600 flex items-center gap-1">
                        Open <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
