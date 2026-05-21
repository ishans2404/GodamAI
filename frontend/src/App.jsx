import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Warehouses from './pages/Warehouses'
import WarehouseDetail from './pages/WarehouseDetail'
import Inventory from './pages/Inventory'
import OptimizationPage from './pages/Optimization'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
  const token = useStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24">
      <p className="text-6xl font-display font-bold text-navy/10 mb-4">404</p>
      <p className="font-display font-bold text-navy text-xl mb-2">Page Not Found</p>
      <a href="/dashboard" className="text-teal text-sm hover:underline mt-2">← Back to Dashboard</a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#022b3a',
            color: '#ffffff',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            borderRadius: '10px',
            border: '1px solid rgba(31,122,140,0.3)',
          },
          success: { iconTheme: { primary: '#1f7a8c', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"         element={<Dashboard />} />
          <Route path="warehouses"        element={<Warehouses />} />
          <Route path="warehouses/:id"    element={<WarehouseDetail />} />
          <Route path="inventory"         element={<Inventory />} />
          <Route path="optimization"      element={<OptimizationPage />} />
          <Route path="analytics"         element={<Analytics />} />
          <Route path="settings"          element={<Settings />} />
          <Route path="*"                 element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
