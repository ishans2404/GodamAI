import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authAPI } from '../lib/api'
import { useStore } from '../store'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useStore()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter credentials')
      return
    }
    setLoading(true)
    try {
      const res = await authAPI.login(email, password)
      setAuth(res.data.user, res.data.access_token)
      toast.success(`Welcome back, ${res.data.user.username}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Demo fill
  const fillDemo = () => {
    setEmail('admin@godamai.com')
    setPassword('admin123')
  }

  return (
    <div className="min-h-screen flex bg-navy overflow-hidden relative">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      {/* Decorative circles */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 rounded-full bg-teal/10 blur-3xl" />
      <div className="absolute bottom-[-15%] right-[30%] w-80 h-80 rounded-full bg-sky/5 blur-3xl" />

      {/* Left — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex flex-col justify-between w-1/2 px-16 py-12 relative z-10"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-2xl tracking-widest">GodamAI</span>
            <p className="text-teal/60 text-[10px] font-mono tracking-[0.3em]">WAREHOUSE INTELLIGENCE</p>
          </div>
        </div>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-display font-bold text-5xl text-white leading-tight mb-6"
          >
            Intelligent<br />
            <span className="gradient-text">Warehouse</span><br />
            Optimization
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-sky/60 text-lg font-body leading-relaxed max-w-md"
          >
            AI-powered 3D space planning, dynamic slotting optimization, 
            and intelligent storage allocation for modern warehouses.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-10 grid grid-cols-3 gap-6"
          >
            {[
              { label: 'Space Saved', value: 'Up to 40%' },
              { label: 'Retrieval Time', value: '3× faster' },
              { label: 'Optimization', value: 'Real-time' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="font-display font-bold text-2xl text-teal">{value}</p>
                <p className="text-white/40 text-xs font-mono tracking-wide">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <p className="text-white/20 text-xs font-mono">© 2024 GodamAI · Intelligent Warehouse Systems</p>
      </motion.div>

      {/* Right — Login form */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center px-8 py-12 relative z-10"
      >
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center">
              <Brain size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-white text-xl tracking-widest">GodamAI</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h3 className="font-display font-bold text-2xl text-white mb-2">Sign In</h3>
            <p className="text-white/40 text-sm font-body mb-8">Access your warehouse intelligence platform</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-display font-semibold text-white/50 
                uppercase tracking-widest mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@godamai.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 
                  text-white placeholder-white/30 font-body text-sm focus:outline-none 
                  focus:ring-2 focus:ring-teal/50 focus:border-teal transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-semibold text-white/50 
                uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 
                    text-white placeholder-white/30 font-body text-sm focus:outline-none 
                    focus:ring-2 focus:ring-teal/50 focus:border-teal transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-teal hover:bg-teal-600 text-white 
                font-display font-semibold tracking-wider transition-all duration-200 
                flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="spinner w-5 h-5" />
                ) : (
                  <>Sign In <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 p-4 rounded-xl bg-teal/10 border border-teal/20">
              <p className="text-xs font-mono text-teal/80 mb-2 uppercase tracking-wider">Demo Credentials</p>
              <div className="space-y-1">
                <p className="text-xs font-mono text-white/60">
                  Email: <span className="text-sky">admin@godamai.com</span>
                </p>
                <p className="text-xs font-mono text-white/60">
                  Password: <span className="text-sky">admin123</span>
                </p>
              </div>
              <button
                onClick={fillDemo}
                className="mt-3 text-xs font-display font-semibold text-teal 
                hover:text-sky transition-colors tracking-wide"
              >
                Fill credentials →
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
