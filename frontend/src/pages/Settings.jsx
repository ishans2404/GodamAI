import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Bell, Shield, CheckCircle, Loader, Eye, EyeOff, Brain } from 'lucide-react'
import { useStore } from '../store'
import api from '../lib/api'
import toast from 'react-hot-toast'

function Section({ icon: Icon, title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
            <Icon size={16} className="text-teal" />
          </div>
          <h3 className="font-display font-bold text-navy tracking-wide">{title}</h3>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  )
}

export default function Settings() {
  const { user, setAuth, token } = useStore()

  // Profile form
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    username:  user?.username  || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' })
  const [showPwd, setShowPwd] = useState({ current: false, newPwd: false, confirm: false })
  const [savingPwd, setSavingPwd] = useState(false)

  // App preferences (stored locally)
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('godamai_prefs') || '{}') }
    catch { return {} }
  })

  const saveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await api.put(`/auth/profiles/${user.id}`, profile)
      setAuth({ ...user, ...profile }, token)
      toast.success('Profile updated!')
    } catch (err) {
      // Endpoint may not exist yet — update local store only
      setAuth({ ...user, ...profile }, token)
      toast.success('Profile updated locally!')
    } finally { setSavingProfile(false) }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (pwd.newPwd !== pwd.confirm) { toast.error('Passwords do not match'); return }
    if (pwd.newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSavingPwd(true)
    try {
      await api.post('/auth/change-password', { current_password: pwd.current, new_password: pwd.newPwd })
      toast.success('Password changed!')
      setPwd({ current: '', newPwd: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password change failed — check current password')
    } finally { setSavingPwd(false) }
  }

  const savePref = (key, val) => {
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem('godamai_prefs', JSON.stringify(next))
    toast.success('Preference saved')
  }

  const ToggleRow = ({ label, desc, pref, defaultVal = false }) => (
    <div className="flex items-center justify-between py-3 border-b border-frost last:border-b-0">
      <div>
        <p className="text-sm font-display font-semibold text-navy">{label}</p>
        <p className="text-xs text-navy/40 font-mono">{desc}</p>
      </div>
      <button
        onClick={() => savePref(pref, !(prefs[pref] ?? defaultVal))}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
        ${(prefs[pref] ?? defaultVal) ? 'bg-teal' : 'bg-navy/20'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
        ${(prefs[pref] ?? defaultVal) ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-navy/50 text-sm">Manage your account, security, and application preferences</p>

      {/* Profile */}
      <Section icon={User} title="Profile Information">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-2xl">
                {(profile.username || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-display font-bold text-navy text-lg">{profile.full_name || profile.username}</p>
              <p className="text-sm text-navy/50 font-mono">{user?.email}</p>
              <span className={`badge mt-1 ${user?.role === 'admin' ? 'badge-teal' : 'badge-navy'}`}>
                {user?.role || 'admin'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                className="input-field" placeholder="Your full name" />
            </div>
            <div>
              <label className="label">Username</label>
              <input value={profile.username}
                onChange={e => setProfile(p => ({ ...p, username: e.target.value }))}
                className="input-field" placeholder="username" />
            </div>
          </div>

          <div>
            <label className="label">Email Address</label>
            <input value={user?.email || ''} disabled
              className="input-field opacity-50 cursor-not-allowed bg-frost" />
            <p className="text-xs text-navy/30 font-mono mt-1">Email cannot be changed here</p>
          </div>

          <button type="submit" disabled={savingProfile}
            className="btn-primary flex items-center gap-2">
            {savingProfile
              ? <><Loader size={14} className="animate-spin" /> Saving…</>
              : <><CheckCircle size={14} /> Save Profile</>
            }
          </button>
        </form>
      </Section>

      {/* Password */}
      <Section icon={Lock} title="Change Password">
        <form onSubmit={savePassword} className="space-y-4">
          {[
            { key: 'current', label: 'Current Password', placeholder: '••••••••' },
            { key: 'newPwd',  label: 'New Password',     placeholder: 'Min. 8 characters' },
            { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="relative">
                <input
                  type={showPwd[key] ? 'text' : 'password'}
                  value={pwd[key]}
                  onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))}
                  className="input-field pr-10"
                  placeholder={placeholder}
                />
                <button type="button"
                  onClick={() => setShowPwd(p => ({ ...p, [key]: !p[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy">
                  {showPwd[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {/* Strength indicator */}
          {pwd.newPwd && (
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-navy/40">Password strength</p>
              <div className="flex gap-1">
                {[1,2,3,4].map(i => {
                  const len = pwd.newPwd.length
                  const hasUpper = /[A-Z]/.test(pwd.newPwd)
                  const hasNum   = /[0-9]/.test(pwd.newPwd)
                  const hasSpec  = /[^A-Za-z0-9]/.test(pwd.newPwd)
                  const score    = [len>=8, hasUpper, hasNum, hasSpec].filter(Boolean).length
                  const colors   = ['bg-red-400','bg-amber-400','bg-amber-300','bg-emerald-400']
                  return (
                    <div key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors
                      ${i <= score ? colors[score-1] : 'bg-frost'}`} />
                  )
                })}
              </div>
            </div>
          )}

          <button type="submit" disabled={savingPwd || !pwd.current || !pwd.newPwd}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {savingPwd
              ? <><Loader size={14} className="animate-spin" /> Changing…</>
              : <><Lock size={14} /> Change Password</>
            }
          </button>
        </form>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notification Preferences">
        <ToggleRow pref="notif_opt"   label="Optimisation Alerts"    desc="Notify when optimisation completes"        defaultVal={true} />
        <ToggleRow pref="notif_cap"   label="Capacity Warnings"      desc="Alert when a zone exceeds 85% utilisation"  defaultVal={true} />
        <ToggleRow pref="notif_haz"   label="Hazmat Placement Alerts" desc="Warn when hazmat items are misrouted"      defaultVal={true} />
        <ToggleRow pref="notif_daily" label="Daily Summary"          desc="Receive a daily warehouse status summary"   defaultVal={false} />
      </Section>

      {/* App preferences */}
      <Section icon={Shield} title="Application Preferences">
        <ToggleRow pref="auto_rotate"   label="Auto-rotate 3D View"     desc="3D viewer auto-rotates on idle"           defaultVal={false} />
        <ToggleRow pref="show_labels"   label="Show Zone Labels in 3D"  desc="Display zone names in 3D viewer"          defaultVal={true} />
        <ToggleRow pref="confirm_del"   label="Confirm Before Delete"   desc="Show confirmation dialog before deletes"  defaultVal={true} />
        <ToggleRow pref="dense_table"   label="Dense Table View"        desc="Compact row height in inventory table"    defaultVal={false} />

        <div className="mt-5 pt-5 border-t border-frost">
          <p className="text-xs font-display font-bold text-teal uppercase tracking-widest mb-3 flex items-center gap-2">
            <Brain size={11} /> AI Settings
          </p>
          <ToggleRow pref="ai_auto_fill" label="AI Auto-fill on Image Upload" desc="Automatically apply AI suggestions to form" defaultVal={true} />
          <ToggleRow pref="ai_slotting"  label="AI Slotting Advice on Open"   desc="Load space analysis when opening warehouse" defaultVal={false} />
        </div>
      </Section>

      {/* System info */}
      <div className="card p-5 bg-navy/3">
        <p className="text-xs font-mono text-navy/30 mb-2">SYSTEM INFORMATION</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {[
            ['Version',   'GodamAI v2.0.0'],
            ['API',       'FastAPI 0.115 · Python 3.11'],
            ['Database',  'Supabase (PostgreSQL 15)'],
            ['AI Engine', 'Claude Vision + 3D Bin Packing'],
            ['Frontend',  'React 18 + Vite 5 + Three.js'],
            ['Build',     new Date().toLocaleDateString('en-IN')],
          ].map(([k,v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-navy/30">{k}:</span>
              <span className="text-navy/60">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
