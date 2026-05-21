import { useRef, Suspense, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Text, Environment, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

const ZONE_COLORS = {
  rack: '#1f7a8c',
  shelf: '#2d9cdb',
  floor: '#7b68ee',
  cold: '#48cae4',
  hazmat: '#f4a261',
  bulk: '#a8dadc',
}

const FREQ_COLORS = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#6b7280',
}

function Zone({ zone, placements = [], showLabels = true, selected = false, onClick }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Zone dimensions scaled down for visualization (1 meter = 1 unit)
  const w = zone.width_m || 2
  const d = zone.depth_m || 2
  const h = zone.height_m || 2
  const x = zone.x_pos || 0
  const y = zone.y_pos || 0  // z in warehouse = y in 3D (ground level)
  const z = zone.z_pos || 0

  const color = ZONE_COLORS[zone.zone_type] || '#1f7a8c'
  const utilization = zone.utilized_m3 != null && zone.capacity_m3
    ? (zone.utilized_m3 / zone.capacity_m3)
    : 0

  useFrame((state) => {
    if (meshRef.current && selected) {
      meshRef.current.material.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.05
    }
  })

  return (
    <group position={[x + w/2, z + h/2, -(y + d/2)]}>
      {/* Zone box (wireframe) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color={selected ? '#bfdbf7' : color} linewidth={1} />
      </lineSegments>

      {/* Zone fill */}
      <mesh ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[w, h, d]} />
        <meshPhongMaterial
          color={hovered ? '#bfdbf7' : color}
          transparent
          opacity={selected ? 0.15 : 0.08}
          depthWrite={false}
        />
      </mesh>

      {/* Utilization fill */}
      {utilization > 0 && (
        <mesh position={[0, -h/2 + (h * utilization)/2, 0]}>
          <boxGeometry args={[w - 0.1, h * utilization, d - 0.1]} />
          <meshPhongMaterial color={color} transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}

      {/* Zone item dots */}
      {placements.slice(0, 20).map((p, i) => {
        const cols = Math.ceil(Math.sqrt(Math.min(placements.length, 20)))
        const row = Math.floor(i / cols)
        const col = i % cols
        const px = -w/2 + 0.5 + (col * (w / cols))
        const pz = -d/2 + 0.5 + (row * (d / Math.ceil(placements.length / cols)))
        const freq = p.inventory_items?.retrieval_frequency || 'medium'
        return (
          <mesh key={i} position={[px, -h/2 + 0.25, pz]}>
            <boxGeometry args={[
              Math.min(p.inventory_items?.width_m || 0.3, 0.8),
              Math.min(p.inventory_items?.height_m || 0.3, 0.5),
              Math.min(p.inventory_items?.depth_m || 0.3, 0.8)
            ]} />
            <meshPhongMaterial color={FREQ_COLORS[freq] || '#6b7280'} />
          </mesh>
        )
      })}

      {/* Label */}
      {showLabels && (
        <Text
          position={[0, h/2 + 0.3, 0]}
          fontSize={0.3}
          color="#bfdbf7"
          anchorX="center"
          anchorY="bottom"
          font={undefined}
          characters="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. "
        >
          {zone.name}
        </Text>
      )}
    </group>
  )
}

function WarehouseFloor({ width, depth }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width/2, 0, -depth/2]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#e1e5f2" opacity={0.5} transparent />
    </mesh>
  )
}

function WarehouseWalls({ width, depth, height }) {
  const wallMat = <meshStandardMaterial color="#bfdbf7" transparent opacity={0.06} side={THREE.BackSide} />
  return (
    <mesh position={[width/2, height/2, -depth/2]}>
      <boxGeometry args={[width, height, depth]} />
      {wallMat}
    </mesh>
  )
}

function Scene({ warehouse, zones, placements, selectedZone, onSelectZone }) {
  const w = warehouse?.width_m || 20
  const d = warehouse?.depth_m || 20
  const h = warehouse?.height_m || 8

  const placementsByZone = useMemo(() => {
    const map = {}
    for (const p of (placements || [])) {
      const zid = p.zone_id
      if (!map[zid]) map[zid] = []
      map[zid].push(p)
    }
    return map
  }, [placements])

  return (
    <>
      <PerspectiveCamera makeDefault position={[w * 0.8, h * 1.2, d * 0.8]} fov={50} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[w, h * 2, d]} intensity={0.8} castShadow />
      <directionalLight position={[-w, h, -d]} intensity={0.3} />

      <WarehouseFloor width={w} depth={d} />
      <WarehouseWalls width={w} depth={d} height={h} />

      <Grid
        position={[w/2, 0.01, -d/2]}
        args={[w, d]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#bfdbf7"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#1f7a8c"
        fadeDistance={50}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {(zones || []).map(zone => (
        <Zone
          key={zone.id}
          zone={zone}
          placements={placementsByZone[zone.id] || []}
          selected={selectedZone?.id === zone.id}
          onClick={() => onSelectZone?.(zone)}
        />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={3}
        maxDistance={80}
        target={[w/2, 0, -d/2]}
      />

      <Environment preset="city" />
    </>
  )
}

export default function WarehouseViewer3D({
  warehouse,
  zones = [],
  placements = [],
  height = '500px',
  onSelectZone
}) {
  const [selectedZone, setSelectedZone] = useState(null)

  const handleSelectZone = (zone) => {
    setSelectedZone(prev => prev?.id === zone.id ? null : zone)
    onSelectZone?.(zone)
  }

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden bg-navy/95">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
        {Object.entries(ZONE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 bg-navy/80 backdrop-blur-sm 
          px-2.5 py-1 rounded-full border border-white/10">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span className="text-[10px] font-mono text-white/70 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Frequency legend */}
      <div className="absolute top-3 right-3 z-10 space-y-1">
        {Object.entries(FREQ_COLORS).map(([freq, color]) => (
          <div key={freq} className="flex items-center gap-1.5 bg-navy/80 backdrop-blur-sm 
          px-2.5 py-1 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px] font-mono text-white/70 capitalize">{freq} freq</span>
          </div>
        ))}
      </div>

      {/* Selected zone info */}
      {selectedZone && (
        <div className="absolute bottom-3 left-3 z-10 bg-navy/90 backdrop-blur-sm 
        border border-teal/30 rounded-xl p-3 text-white max-w-xs">
          <p className="font-display font-bold text-sm text-teal mb-1">{selectedZone.name}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono text-white/70">
            <span>Type:</span><span className="text-sky capitalize">{selectedZone.zone_type}</span>
            <span>Size:</span>
            <span className="text-sky">{selectedZone.width_m}×{selectedZone.depth_m}×{selectedZone.height_m}m</span>
            <span>Near Exit:</span>
            <span className="text-sky">{selectedZone.near_exit ? 'Yes' : 'No'}</span>
            {selectedZone.utilized_m3 != null && (
              <>
                <span>Used:</span>
                <span className="text-sky">{selectedZone.utilized_m3?.toFixed(1)}m³</span>
              </>
            )}
          </div>
        </div>
      )}

      <Canvas shadows gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <Scene
            warehouse={warehouse}
            zones={zones}
            placements={placements}
            selectedZone={selectedZone}
            onSelectZone={handleSelectZone}
          />
        </Suspense>
      </Canvas>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-white/30 text-right">
        <p>Click zone to inspect</p>
        <p>Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  )
}
