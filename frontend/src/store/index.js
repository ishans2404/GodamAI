import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user: JSON.parse(localStorage.getItem('godamai_user') || 'null'),
  token: localStorage.getItem('godamai_token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('godamai_user', JSON.stringify(user))
    localStorage.setItem('godamai_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('godamai_user')
    localStorage.removeItem('godamai_token')
    set({ user: null, token: null })
  },

  // Warehouses
  warehouses: [],
  selectedWarehouse: null,
  setWarehouses: (warehouses) => set({ warehouses }),
  setSelectedWarehouse: (warehouse) => set({ selectedWarehouse: warehouse }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Optimization
  lastOptimization: null,
  setLastOptimization: (result) => set({ lastOptimization: result }),
}))
