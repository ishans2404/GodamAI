import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Brain, CheckCircle, AlertCircle, Image, X, Loader, Sparkles } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const CONFIDENCE_LABEL = (c) => {
  if (c >= 0.80) return { label: 'High Confidence', color: 'text-emerald-600', bg: 'bg-emerald-50' }
  if (c >= 0.55) return { label: 'Medium Confidence', color: 'text-amber-600', bg: 'bg-amber-50' }
  return { label: 'Low Confidence – Verify', color: 'text-red-600', bg: 'bg-red-50' }
}

export default function ImageAnalyzer({ onSuggest }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const fileRef = useRef()

  const processFile = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      toast.error('Please upload a JPEG, PNG, or WebP image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('context', 'Warehouse inventory item analysis')

      const res = await api.post('/ai/analyse-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(res.data)
      toast.success('AI analysis complete!')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Image analysis failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onFileInput = (e) => { if (e.target.files[0]) processFile(e.target.files[0]) }

  const handleApply = () => {
    if (!result?.suggested_fields) return
    onSuggest?.(result.suggested_fields)
    toast.success('AI suggestions applied to form!')
  }

  const clear = () => {
    setPreview(null); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const conf = result?.confidence ?? 0
  const confInfo = CONFIDENCE_LABEL(conf)

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center
            gap-3 cursor-pointer transition-all duration-200 min-h-[120px]
            ${dragging
              ? 'border-teal bg-teal/5 scale-[1.02]'
              : 'border-sky/50 hover:border-teal hover:bg-teal/3'}`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
            ${dragging ? 'bg-teal text-white' : 'bg-frost text-teal/60'}`}>
            {dragging ? <Upload size={22} /> : <Image size={22} />}
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-navy text-sm">
              {dragging ? 'Drop to analyse' : 'Upload item photo'}
            </p>
            <p className="text-xs text-navy/40 font-mono mt-0.5">
              Claude AI will auto-detect dimensions & storage flags
            </p>
          </div>
          <span className="text-[10px] font-mono text-navy/30">JPEG · PNG · WebP · max 10 MB</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} />

          {/* AI badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-navy/10 px-2 py-0.5 rounded-full">
            <Brain size={10} className="text-teal" />
            <span className="text-[9px] font-mono text-teal">AI POWERED</span>
          </div>
        </div>
      )}

      {/* Preview + result */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-sky/30 rounded-xl overflow-hidden bg-white"
          >
            {/* Image header */}
            <div className="flex items-center gap-3 p-3 border-b border-frost">
              <img src={preview} alt="Item preview"
                className="w-16 h-16 rounded-lg object-cover border border-frost flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-navy text-sm">Item Photo</p>
                {loading && (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader size={12} className="animate-spin text-teal" />
                    <span className="text-xs text-teal font-mono">Analysing with Claude AI...</span>
                  </div>
                )}
                {result && !loading && (
                  <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${confInfo.bg} ${confInfo.color}`}>
                    <CheckCircle size={9} />
                    {confInfo.label} · {Math.round(conf * 100)}%
                  </div>
                )}
                {error && !loading && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertCircle size={11} className="text-red-500" />
                    <span className="text-xs text-red-500 font-mono">{error}</span>
                  </div>
                )}
              </div>
              <button onClick={clear} className="text-navy/30 hover:text-red-500 transition-colors flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* AI results */}
            {result && !loading && (
              <div className="p-3 space-y-3">
                {/* Category + name */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-frost rounded-lg p-2.5">
                    <p className="text-[10px] font-mono text-navy/40 mb-1">DETECTED CATEGORY</p>
                    <p className="font-display font-bold text-navy text-sm">
                      {result.ai_analysis?.category || '—'}
                    </p>
                  </div>
                  <div className="bg-frost rounded-lg p-2.5">
                    <p className="text-[10px] font-mono text-navy/40 mb-1">SUGGESTED NAME</p>
                    <p className="font-display font-bold text-navy text-sm truncate">
                      {result.ai_analysis?.name_suggestion || '—'}
                    </p>
                  </div>
                </div>

                {/* Dimensions */}
                <div>
                  <p className="text-[10px] font-mono text-navy/40 mb-1.5">ESTIMATED DIMENSIONS</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Width', val: result.suggested_fields?.width_m },
                      { label: 'Depth', val: result.suggested_fields?.depth_m },
                      { label: 'Height', val: result.suggested_fields?.height_m },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-teal/5 border border-teal/20 rounded-lg p-2 text-center">
                        <p className="font-display font-bold text-teal text-base">{val}m</p>
                        <p className="text-[10px] font-mono text-navy/40">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <div className="flex-1 bg-frost rounded-lg px-2.5 py-1.5 text-center">
                      <p className="font-display font-bold text-navy text-sm">
                        {result.suggested_fields?.weight_kg} kg
                      </p>
                      <p className="text-[10px] font-mono text-navy/40">Weight</p>
                    </div>
                    <div className="flex-1 bg-frost rounded-lg px-2.5 py-1.5 text-center">
                      <p className="font-display font-bold text-navy text-sm capitalize">
                        {result.suggested_fields?.retrieval_frequency}
                      </p>
                      <p className="text-[10px] font-mono text-navy/40">Frequency</p>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'stackable', label: '📦 Stackable', active: result.suggested_fields?.stackable },
                    { key: 'fragile', label: '🔴 Fragile', active: result.suggested_fields?.fragile },
                    { key: 'hazardous', label: '⚠️ Hazmat', active: result.suggested_fields?.hazardous },
                    { key: 'temperature_sensitive', label: '🌡️ Cold', active: result.suggested_fields?.temperature_sensitive },
                  ].map(({ label, active }) => (
                    <span key={label}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border
                      ${active ? 'bg-teal/10 border-teal/30 text-teal' : 'bg-frost border-sky/30 text-navy/30 line-through'}`}>
                      {label}
                    </span>
                  ))}
                </div>

                {/* Storage note */}
                {result.storage_notes && (
                  <p className="text-xs text-navy/50 italic bg-frost rounded-lg px-3 py-2 font-mono">
                    💡 {result.storage_notes}
                  </p>
                )}

                {/* Apply button */}
                <button
                  onClick={handleApply}
                  className="w-full py-2.5 rounded-xl bg-navy text-white font-display font-semibold 
                  text-sm tracking-wide hover:bg-teal transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  Apply AI Suggestions to Form
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
