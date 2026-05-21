import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import { useStore } from '../store'
import { useState } from 'react'

const PAGE_META = {
  '/dashboard':    { title: 'Dashboard',              sub: 'Platform overview & KPIs' },
  '/warehouses':   { title: 'Warehouses',             sub: 'Manage warehouse facilities' },
  '/inventory':    { title: 'Inventory Management',   sub: 'All items across warehouses' },
  '/optimization': { title: 'AI Optimization Engine', sub: '3D bin-packing & slotting' },
  '/analytics':    { title: 'Analytics & Reports',    sub: 'Performance intelligence' },
  '/settings':     { title: 'Settings',               sub: 'Account & preferences' },
}

export default function Layout() {
  const location = useLocation()
  const { user } = useStore()

  const meta = Object.entries(PAGE_META).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || { title: 'GodamAI', sub: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="flex h-screen bg-frost overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-sky/30 px-6 py-3.5 flex items-center
          justify-between flex-shrink-0 gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-navy text-xl tracking-wide truncate">
              {meta.title}
            </h1>
            <p className="text-navy/30 text-[11px] font-mono tracking-wider mt-0.5 hidden md:block">
              {dateStr}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* System status */}
            <div className="hidden sm:flex items-center gap-2 bg-frost px-3 py-1.5 rounded-full border border-sky/30">
              <div className="pulse-dot" />
              <span className="text-[10px] font-mono text-navy/50 tracking-widest">SYSTEM ONLINE</span>
            </div>

            {/* User badge */}
            <div className="flex items-center gap-2 bg-frost px-3 py-1.5 rounded-full border border-sky/30">
              <div className="w-5 h-5 rounded-md bg-teal/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-teal">
                  {(user?.username || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs font-display font-semibold text-navy hidden sm:block">
                {user?.username || 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 min-h-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}
