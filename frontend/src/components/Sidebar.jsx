import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Warehouse, Package, Zap, BarChart3,
  LogOut, ChevronLeft, ChevronRight, Settings, Brain
} from 'lucide-react'
import { useStore } from '../store'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/warehouses',   icon: Warehouse,        label: 'Warehouses'  },
  { to: '/inventory',    icon: Package,          label: 'Inventory'   },
  { to: '/optimization', icon: Zap,              label: 'Optimization'},
  { to: '/analytics',    icon: BarChart3,        label: 'Analytics'   },
]

export default function Sidebar() {
  const { user, logout, sidebarCollapsed, toggleSidebar } = useStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="flex flex-col h-full bg-navy relative overflow-hidden flex-shrink-0"
      style={{ minWidth: sidebarCollapsed ? 72 : 240 }}
    >
      {/* Grid watermark */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <pattern id="sg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#sg)"/>
        </svg>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal/20">
          <Brain size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <span className="font-display font-bold text-white text-lg tracking-widest">GodamAI</span>
              <p className="text-teal/50 text-[9px] font-mono tracking-[0.3em] mt-0.5">WAREHOUSE INTEL</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={sidebarCollapsed ? label : ''}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-medium
               tracking-wide transition-all duration-150
               ${isActive
                 ? 'bg-teal text-white shadow-lg shadow-teal/20'
                 : 'text-sky/70 hover:bg-white/8 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && !sidebarCollapsed && (
                  <motion.div layoutId="dot"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-sky/70 flex-shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-3 py-3 space-y-1 flex-shrink-0">
        {/* Settings */}
        <NavLink to="/settings" title={sidebarCollapsed ? 'Settings' : ''}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-medium
             tracking-wide transition-all
             ${isActive ? 'bg-teal text-white' : 'text-sky/70 hover:bg-white/8 hover:text-white'}`
          }>
          <Settings size={16} className="flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>

        {/* User chip */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl
          ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg bg-teal/30 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-display font-bold">
              {(user?.username || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="overflow-hidden flex-1 min-w-0">
                <p className="text-white text-xs font-display font-semibold truncate">
                  {user?.username || 'Admin'}
                </p>
                <p className="text-sky/40 text-[10px] capitalize">{user?.role || 'admin'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} title={sidebarCollapsed ? 'Logout' : ''}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sky/60
          hover:bg-white/8 hover:text-white transition-all text-sm font-display">
          <LogOut size={15} className="flex-shrink-0" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-[52px] -right-3 w-6 h-6 bg-teal rounded-full flex items-center
        justify-center text-white shadow-md hover:bg-teal-600 transition-colors z-20"
      >
        {sidebarCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </motion.aside>
  )
}
