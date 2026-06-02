import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as d3 from 'd3'
import {
  GitBranch, Plus, X, ArrowRight, Filter,
  Clock, CheckCircle2, MapIcon, ListIcon,
  Send, MessageSquare, Calendar, Flag, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const DEPARTAMENTOS = [
  { nombre: 'CDG',                      inicial: 'CDG' },
  { nombre: 'Maquinarias',              inicial: 'MAQ' },
  { nombre: 'Compra y Abastecimiento',  inicial: 'CyA' },
  { nombre: 'Administración',           inicial: 'ADM' },
  { nombre: 'Personas',                 inicial: 'PER' },
  { nombre: 'SST',                      inicial: 'SST' },
  { nombre: 'Gerencia',                 inicial: 'GER' },
  { nombre: 'Bodega',                   inicial: 'BOD' },
  { nombre: 'Finanzas',                 inicial: 'FIN' },
  { nombre: 'SAP',                      inicial: 'SAP' },
  { nombre: 'Producción',               inicial: 'PRO' },
]

const INICIALES = DEPARTAMENTOS.reduce((acc, d) => { acc[d.nombre] = d.inicial; return acc }, {})

const ESTADO_OPCIONES = [
  { value: 'solicitado',  label: 'Solicitado',  color: 'bg-blue-900 text-blue-300',     dot: 'bg-blue-400' },
  { value: 'en_proceso',  label: 'En proceso',  color: 'bg-amber-900 text-amber-300',   dot: 'bg-amber-400' },
  { value: 'entregado',   label: 'Entregado',   color: 'bg-green-900 text-green-300',   dot: 'bg-green-400' },
  { value: 'atrasado',    label: 'Atrasado',    color: 'bg-red-900 text-red-300',       dot: 'bg-red-400' },
]
const ESTADO_MAP = ESTADO_OPCIONES.reduce((acc, e) => { acc[e.value] = e; return acc }, {})

const PRIORIDAD_OPCIONES = [
  { value: 'alta',  label: 'Alta',  color: 'bg-red-900 text-red-300',    grosor: 3 },
  { value: 'media', label: 'Media', color: 'bg-amber-900 text-amber-300', grosor: 2 },
  { value: 'baja',  label: 'Baja',  color: 'bg-gray-700 text-gray-300',   grosor: 1 },
]
const PRIORIDAD_MAP = PRIORIDAD_OPCIONES.reduce((acc, p) => { acc[p.value] = p; return acc }, {})

const COLOR_ESTADO_HEX = {
  solicitado: '#60a5fa',
  en_proceso: '#fbbf24',
  entregado:  '#34d399',
  atrasado:   '#f87171',
  por_vencer: '#fbbf24',
}

const COLOR_DEPENDENCIA = '#a78bfa'

const ESTADO_TAREA_MAP = {
  pendiente:             { label: 'Pendiente',    color: 'bg-gray-700 text-gray-300' },
  con_atraso:            { label: 'Atrasada',     color: 'bg-red-900 text-red-300' },
  completada:            { label: 'Completada',   color: 'bg-green-900 text-green-300' },
  completada_con_atraso: { label: 'Entregada',    color: 'bg-yellow-900 text-yellow-300' },
  no_completada:         { label: 'No completada',color: 'bg-gray-800 text-gray-500' },
}

const NODO_GLOW = {
  verde: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.7))',
  ambar: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.7))',
  rojo:  'drop-shadow(0 0 12px rgba(248, 113, 113, 0.7))',
  gris:  'drop-shadow(0 0 6px rgba(75, 85, 99, 0.4))',
}

const NODO_FILL = {
  verde: '#064e3b',
  ambar: '#78350f',
  rojo:  '#7f1d1d',
  gris:  '#1f2937',
}

const NODO_STROKE = {
  verde: '#34d399',
  ambar: '#fbbf24',
  rojo:  '#f87171',
  gris:  '#4b5563',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function diasHasta(fechaStr) {
  if (!fechaStr) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  return Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24))
}

function urgenciaColor(fechaStr, estado) {
  if (estado === 'entregado') return 'text-gray-500'
  const d = diasHasta(fechaStr)
  if (d === null) return 'text-gray-400'
  if (d < 0) return 'text-red-400'
  if (d <= 3) return 'text-amber-400'
  return 'text-gray-400'
}

function estadoNodo(solicitudes) {
  if (!solicitudes || solicitudes.length === 0) return 'gris'
  const activas = solicitudes.filter(s => s.estado !== 'entregado')
  if (activas.length === 0) return 'verde'
  if (activas.some(s => s.estado === 'atrasado' || diasHasta(s.fecha_limite) < 0)) return 'rojo'
  if (activas.some(s => diasHasta(s.fecha_limite) !== null && diasHasta(s.fecha_limite) <= 3)) return 'ambar'
  return 'verde'
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '—'
  const d = new Date(fechaStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// ─── Mapa interactivo con D3 ──────────────────────────────────────────────────
function MapaFlujos({ solicitudes, dependencias = [], deptoSeleccionado, onSelectDepto, onClickSolicitud, onClickDependencia, departamentos = DEPARTAMENTOS }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const simulationRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (svgRef.current) {
        svgRef.current.setAttribute('width', w)
        svgRef.current.setAttribute('height', h)
        svgRef.current.setAttribute('viewBox', `0 0 ${w} ${h}`)
      }
    }
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Agregar conexiones según solicitudes activas
  const { nodos, enlaces } = useMemo(() => {
    const nodos = departamentos.map(d => {
      const sActivas = solicitudes.filter(s =>
        (s.depto_origen === d.nombre || s.depto_destino === d.nombre) &&
        s.estado !== 'entregado'
      )
      const estado = estadoNodo(sActivas)
      return {
        id: d.nombre,
        inicial: d.inicial,
        nombre: d.nombre,
        count: sActivas.length,
        estado,
      }
    })

    const mapaEnlaces = new Map()
    solicitudes.forEach(s => {
      const key = `${s.depto_origen}→${s.depto_destino}`
      if (!mapaEnlaces.has(key)) {
        mapaEnlaces.set(key, {
          source: s.depto_origen,
          target: s.depto_destino,
          solicitudes: [],
        })
      }
      mapaEnlaces.get(key).solicitudes.push(s)
    })

    const enlaces = Array.from(mapaEnlaces.values()).map(e => {
      // Activas first, then entregadas
      const activas = e.solicitudes.filter(s => s.estado !== 'entregado')
      const todas = [...activas, ...e.solicitudes.filter(s => s.estado === 'entregado')]
      const sorted = [...todas].sort((a, b) => {
        const prioOrd = { alta: 0, media: 1, baja: 2 }
        const estadoOrd = { atrasado: 0, en_proceso: 1, por_vencer: 1, solicitado: 2, entregado: 3 }
        const sDiff = (estadoOrd[a.estado] ?? 2) - (estadoOrd[b.estado] ?? 2)
        if (sDiff !== 0) return sDiff
        return (prioOrd[a.prioridad] ?? 2) - (prioOrd[b.prioridad] ?? 2)
      })
      const top = sorted[0]
      const esEntregado = activas.length === 0
      let estadoLinea = top.estado
      if (!esEntregado && estadoLinea !== 'atrasado' && estadoLinea !== 'entregado') {
        const d = diasHasta(top.fecha_limite)
        if (d !== null && d < 0) estadoLinea = 'atrasado'
        else if (d !== null && d <= 3) estadoLinea = 'por_vencer'
      }
      return {
        ...e,
        prioridad: top.prioridad,
        estado: estadoLinea,
        esEntregado,
        principal: top,
      }
    })

    return { nodos, enlaces }
  }, [solicitudes, departamentos])

  // Enlaces de dependencias (capa inferior, violetas)
  const depLinks = useMemo(() => {
    const mapaDepLinks = new Map()
    dependencias.forEach(d => {
      if (!d.task?.departamento || !d.depends_on?.departamento) return
      if (d.task.departamento === d.depends_on.departamento) return
      const key = `${d.task.departamento}→${d.depends_on.departamento}`
      if (!mapaDepLinks.has(key)) {
        mapaDepLinks.set(key, {
          source: d.task.departamento,
          target: d.depends_on.departamento,
          deps:   [],
        })
      }
      mapaDepLinks.get(key).deps.push(d)
    })
    return Array.from(mapaDepLinks.values()).map(l => ({
      ...l,
      conImpacto: l.deps.some(d => (d.impacto_atraso ?? 0) > 0),
    }))
  }, [dependencias])

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = containerRef.current.clientWidth
    const h = containerRef.current.clientHeight

    // Defs: marcadores de flecha
    const defs = svg.append('defs')
    Object.entries(COLOR_ESTADO_HEX).forEach(([key, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${key}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
    })

    // Marcador de flecha para dependencias (violeta)
    defs.append('marker')
      .attr('id', 'arrow-dep')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', COLOR_DEPENDENCIA)

    // Posición inicial en círculo
    const cx = w / 2
    const cy = h / 2
    const radio = Math.min(w, h) * 0.32
    nodos.forEach((n, i) => {
      const angle = (i / nodos.length) * 2 * Math.PI - Math.PI / 2
      n.x = cx + radio * Math.cos(angle)
      n.y = cy + radio * Math.sin(angle)
    })

    const sim = d3.forceSimulation(nodos)
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(cx, cy).strength(0.15))
      .force('collision', d3.forceCollide().radius(70))
      .force('link', d3.forceLink(enlaces).id(d => d.id).distance(180).strength(0.1))
      .force('bounds', () => {
        nodos.forEach(n => {
          n.x = Math.max(60, Math.min(w - 60, n.x))
          n.y = Math.max(60, Math.min(h - 60, n.y))
        })
      })
      .alphaDecay(0.05)

    simulationRef.current = sim

    // Mapa nombre → nodo para resolver source/target de dep links
    const nodoPorId = new Map(nodos.map(n => [n.id, n]))

    // ── Capa de DEPENDENCIAS (debajo de las solicitudes) ────────────────────
    const depGroup = svg.append('g').attr('class', 'dep-links')

    const depResolved = depLinks
      .map(d => ({
        ...d,
        sourceNode: nodoPorId.get(d.source),
        targetNode: nodoPorId.get(d.target),
      }))
      .filter(d => d.sourceNode && d.targetNode)

    const depSel = depGroup.selectAll('g.dep-link')
      .data(depResolved, d => `${d.source}→${d.target}`)
      .join('g')
      .attr('class', 'dep-link')
      .attr('opacity', d => {
        if (!deptoSeleccionado) return 0.5
        return (d.source === deptoSeleccionado || d.target === deptoSeleccionado) ? 0.7 : 0.08
      })

    depSel.append('path')
      .attr('class', 'dep-path')
      .attr('fill', 'none')
      .attr('stroke', COLOR_DEPENDENCIA)
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', '4,2')
      .attr('marker-end', 'url(#arrow-dep)')
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('stroke-width', 2.5)
        const rect = containerRef.current.getBoundingClientRect()
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          titulo: `${d.deps.length} ${d.deps.length === 1 ? 'dependencia' : 'dependencias'} entre ${d.source} y ${d.target}`,
          estado: d.conImpacto ? '⚠️ Con impacto registrado' : 'Sin impacto registrado',
          extra: null,
        })
      })
      .on('mousemove', function(event) {
        const rect = containerRef.current.getBoundingClientRect()
        setTooltip(t => t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : null)
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-width', 1.5)
        setTooltip(null)
      })
      .on('click', function(event) {
        event.stopPropagation()
        onClickDependencia?.()
      })

    // Capa de enlaces
    const linkGroup = svg.append('g').attr('class', 'links')

    const linkSel = linkGroup.selectAll('g.link')
      .data(enlaces, d => `${d.source.id ?? d.source}→${d.target.id ?? d.target}`)
      .join('g')
      .attr('class', 'link')
      .attr('opacity', d => {
        const base = d.esEntregado ? 0.35 : 1
        if (!deptoSeleccionado) return base
        const sourceId = d.source.id ?? d.source
        const targetId = d.target.id ?? d.target
        return (sourceId === deptoSeleccionado || targetId === deptoSeleccionado) ? base : 0.1
      })

    linkSel.append('path')
      .attr('class', 'link-path')
      .attr('fill', 'none')
      .attr('stroke', d => COLOR_ESTADO_HEX[d.estado] ?? '#60a5fa')
      .attr('stroke-width', d => PRIORIDAD_MAP[d.prioridad]?.grosor ?? 1)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', d => d.esEntregado ? '6,4' : null)
      .attr('marker-end', d => `url(#arrow-${d.estado in COLOR_ESTADO_HEX ? d.estado : 'solicitado'})`)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('stroke-width', (PRIORIDAD_MAP[d.prioridad]?.grosor ?? 1) + 1.5)
        const rect = containerRef.current.getBoundingClientRect()
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          titulo: d.principal.titulo,
          estado: ESTADO_MAP[d.principal.estado]?.label ?? d.principal.estado,
          extra: d.solicitudes.length > 1 ? `+${d.solicitudes.length - 1} más` : null,
        })
      })
      .on('mousemove', function(event) {
        const rect = containerRef.current.getBoundingClientRect()
        setTooltip(t => t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : null)
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).attr('stroke-width', PRIORIDAD_MAP[d.prioridad]?.grosor ?? 1)
        setTooltip(null)
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        if (d.solicitudes.length === 1) onClickSolicitud?.(d.principal)
        else onClickSolicitud?.(d.principal)
      })

    // Partículas animadas a lo largo del enlace (solo activos)
    linkSel.filter(d => !d.esEntregado)
      .append('circle')
      .attr('class', 'particle')
      .attr('r', d => Math.max(2, (PRIORIDAD_MAP[d.prioridad]?.grosor ?? 1) + 1))
      .attr('fill', d => COLOR_ESTADO_HEX[d.estado] ?? '#60a5fa')
      .style('pointer-events', 'none')

    // Capa de nodos
    const nodeGroup = svg.append('g').attr('class', 'nodes')

    const nodeSel = nodeGroup.selectAll('g.node')
      .data(nodos, d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('opacity', d => {
        if (!deptoSeleccionado) return 1
        return d.id === deptoSeleccionado ? 1 : 0.35
      })
      .style('cursor', 'pointer')
      .on('mouseenter', function() {
        d3.select(this).select('circle.main').transition().duration(150).attr('r', 38)
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle.main').transition().duration(150).attr('r', 34)
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        onSelectDepto?.(d.id === deptoSeleccionado ? null : d.id)
      })
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event) => {
            if (!event.active) sim.alphaTarget(0)
          })
      )

    nodeSel.append('circle')
      .attr('class', 'main')
      .attr('r', 34)
      .attr('fill', d => NODO_FILL[d.estado])
      .attr('stroke', d => NODO_STROKE[d.estado])
      .attr('stroke-width', 2)
      .style('filter', d => NODO_GLOW[d.estado])

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .style('pointer-events', 'none')
      .text(d => d.inicial)

    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 52)
      .attr('fill', '#d1d5db')
      .attr('font-size', '10px')
      .style('pointer-events', 'none')
      .text(d => d.nombre)

    // Badge contador
    const badge = nodeSel.filter(d => d.count > 0)
    badge.append('circle')
      .attr('cx', 26)
      .attr('cy', -26)
      .attr('r', 10)
      .attr('fill', '#dc2626')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none')

    badge.append('text')
      .attr('x', 26)
      .attr('y', -26)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .style('pointer-events', 'none')
      .text(d => d.count)

    function ticked() {
      linkSel.select('path.link-path').attr('d', d => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dr = Math.sqrt(dx * dx + dy * dy)
        // ligera curva
        return `M${d.source.x},${d.source.y} A${dr * 1.5},${dr * 1.5} 0 0,1 ${d.target.x},${d.target.y}`
      })
      depSel.select('path.dep-path').attr('d', d => {
        const sx = d.sourceNode.x
        const sy = d.sourceNode.y
        const tx = d.targetNode.x
        const ty = d.targetNode.y
        const dx = tx - sx
        const dy = ty - sy
        const dr = Math.sqrt(dx * dx + dy * dy)
        // curva opuesta (sweep flag 0) para que no se superponga con la solicitud
        return `M${sx},${sy} A${dr * 1.8},${dr * 1.8} 0 0,0 ${tx},${ty}`
      })
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`)
    }

    sim.on('tick', ticked)

    // Animación de partículas
    let raf
    const t0 = performance.now()
    function animate(now) {
      const phase = ((now - t0) / 2500) % 1
      linkSel.select('circle.particle').each(function(d) {
        if (!d.source.x || !d.target.x) return
        const path = d3.select(this.parentNode).select('path.link-path').node()
        if (!path) return
        const length = path.getTotalLength()
        if (length === 0) return
        const point = path.getPointAtLength(phase * length)
        d3.select(this).attr('cx', point.x).attr('cy', point.y)
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    // Click en fondo deselecciona
    svg.on('click', () => onSelectDepto?.(null))

    return () => {
      cancelAnimationFrame(raf)
      sim.stop()
    }
  }, [nodos, enlaces, depLinks, deptoSeleccionado, onSelectDepto, onClickSolicitud, onClickDependencia])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-950 rounded-2xl overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl z-10"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 240 }}
        >
          <p className="text-white font-medium leading-tight">{tooltip.titulo}</p>
          <p className="text-gray-400 mt-0.5">{tooltip.estado}</p>
          {tooltip.extra && <p className="text-gray-500 mt-0.5">{tooltip.extra}</p>}
        </div>
      )}
      {/* Leyenda */}
      <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur border border-gray-800 rounded-lg p-2 text-[10px] text-gray-400 space-y-1">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400" />Solicitado</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400" />En proceso / por vencer</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400" />Atrasado</div>
        <div className="flex items-center gap-2">
          <svg width="16" height="8">
            <line x1="0" y1="4" x2="16" y2="4" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4,2"/>
          </svg>
          Entregado
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="4" className="shrink-0">
            <line x1="0" y1="2" x2="14" y2="2" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="4,2" />
          </svg>
          Dependencia entre tareas
        </div>
      </div>
    </div>
  )
}

// ─── Card de solicitud ────────────────────────────────────────────────────────
function SolicitudCard({ solicitud, onClick }) {
  const estado = ESTADO_MAP[solicitud.estado] ?? ESTADO_MAP.solicitado
  const prioridad = PRIORIDAD_MAP[solicitud.prioridad] ?? PRIORIDAD_MAP.media

  return (
    <div
      onClick={onClick}
      className="bg-gray-950 border border-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-800/60 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-tight flex-1">{solicitud.titulo}</p>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${estado.color}`}>
          {estado.label}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
        <span className="font-medium text-gray-300">{INICIALES[solicitud.depto_origen] ?? solicitud.depto_origen}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-medium text-gray-300">{INICIALES[solicitud.depto_destino] ?? solicitud.depto_destino}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1 text-xs ${urgenciaColor(solicitud.fecha_limite, solicitud.estado)}`}>
          <Calendar className="w-3 h-3" />
          {formatFecha(solicitud.fecha_limite)}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${prioridad.color}`}>
          {prioridad.label}
        </span>
      </div>
    </div>
  )
}

// ─── Modal de detalle / crear ─────────────────────────────────────────────────
function SolicitudModal({ solicitud, modoCrear, onClose, onGuardado }) {
  const { user, profile, esSubgerente, deptosAsignados } = useAuth()
  const queryClient = useQueryClient()
  const esDestino = esSubgerente
    ? deptosAsignados.includes(solicitud?.depto_destino)
    : profile?.departamento === solicitud?.depto_destino

  // Estado para crear
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    depto_origen: esSubgerente ? (deptosAsignados[0] ?? '') : (profile?.departamento ?? ''),
    depto_destino: '',
    responsable_destino: '',
    responsable_origen: profile?.id ?? '',
    fecha_limite: '',
    prioridad: 'media',
    task_id: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [comentario, setComentario] = useState('')

  // Departamentos activos desde BD (mismo origen que el resto de selectores)
  const { data: departamentosDisponibles = [] } = useQuery({
    queryKey: ['departamentos-deps'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('departamento')
        .eq('activo', true)
      const unicos = [...new Set((data ?? []).map(u => u.departamento).filter(Boolean))].sort()
      return unicos
    }
  })

  // Cargar usuarios para selectores
  const { data: usuariosDestino = [] } = useQuery({
    queryKey: ['usuarios-depto-flujos', form.depto_destino],
    enabled: modoCrear && !!form.depto_destino,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .eq('departamento', form.depto_destino)
        .order('nombre')
      if (error) throw error
      return data ?? []
    }
  })

  const { data: usuariosOrigen = [] } = useQuery({
    queryKey: ['usuarios-origen-flujos', esSubgerente ? form.depto_origen : profile?.departamento],
    enabled: modoCrear && !!(esSubgerente ? form.depto_origen : profile?.departamento),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .eq('departamento', esSubgerente ? form.depto_origen : profile?.departamento)
        .order('nombre')
      if (error) throw error
      return data ?? []
    }
  })

  // Tareas del ciclo activo para vinculación opcional
  const { data: tareasCiclo = [] } = useQuery({
    queryKey: ['tareas-ciclo-activo-vincular', profile?.departamento],
    enabled: modoCrear && !!profile?.departamento,
    queryFn: async () => {
      const { data: cicloActivo } = await supabase
        .from('monthly_cycles')
        .select('id')
        .eq('estado', 'activo')
        .maybeSingle()
      if (!cicloActivo) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('id, nombre_tarea')
        .eq('ciclo_id', cicloActivo.id)
        .eq('departamento', profile?.departamento)
        .order('nombre_tarea')
      if (error) throw error
      return data ?? []
    }
  })

  async function handleCrear(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        depto_origen: esSubgerente ? form.depto_origen : profile.departamento,
        depto_destino: form.depto_destino,
        responsable_origen: form.responsable_origen || null,
        responsable_destino: form.responsable_destino || null,
        fecha_limite: form.fecha_limite || null,
        prioridad: form.prioridad,
        estado: 'solicitado',
        task_id: form.task_id || null,
        creado_por: user.id,
        creado_at: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('department_requests').insert(payload).select().single()
      if (error) throw error
      if (payload.responsable_destino) {
        await supabase.from('notifications').insert({
          user_id:   payload.responsable_destino,
          tipo:      'novedad',
          titulo:    '📨 Nueva solicitud de flujo',
          mensaje:   `${profile.nombre} (${profile.departamento}) te envió una solicitud: "${payload.titulo}"`,
          leida:     false,
          link_id:   data.id,
          link_tipo: 'department_request',
          creado_at: new Date().toISOString(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['department_requests'] })
      onGuardado?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(nuevoEstado) {
    setLoading(true)
    setError('')
    try {
      const updates = { estado: nuevoEstado }
      if (nuevoEstado === 'entregado') updates.completado_at = new Date().toISOString()

      const { error: updErr } = await supabase
        .from('department_requests')
        .update(updates)
        .eq('id', solicitud.id)
      if (updErr) throw updErr

      await supabase.from('department_request_updates').insert({
        request_id: solicitud.id,
        user_id: user.id,
        comentario: null,
        cambio_estado: nuevoEstado,
        creado_at: new Date().toISOString(),
      })

      if (solicitud.responsable_origen && (nuevoEstado === 'entregado' || nuevoEstado === 'en_proceso')) {
        await supabase.from('notifications').insert({
          user_id:   solicitud.responsable_origen,
          tipo:      'novedad',
          titulo:    nuevoEstado === 'entregado'
                     ? '✅ Solicitud entregada'
                     : '⏳ Solicitud en proceso',
          mensaje:   nuevoEstado === 'entregado'
                     ? `Tu solicitud "${solicitud.titulo}" fue entregada por ${profile.nombre}`
                     : `Tu solicitud "${solicitud.titulo}" está siendo procesada por ${profile.nombre}`,
          leida:     false,
          link_id:   solicitud.id,
          link_tipo: 'department_request',
          creado_at: new Date().toISOString(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['department_requests'] })
      onGuardado?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function agregarComentario() {
    if (!comentario.trim()) return
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.from('department_request_updates').insert({
        request_id: solicitud.id,
        user_id: user.id,
        comentario: comentario.trim(),
        cambio_estado: null,
        creado_at: new Date().toISOString(),
      })
      if (error) throw error
      setComentario('')
      queryClient.invalidateQueries({ queryKey: ['department_requests'] })
      onGuardado?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scroll-dark"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-green-400" />
            {modoCrear ? 'Nueva solicitud' : 'Solicitud'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl px-3 py-2 text-red-300 text-sm">
              {error}
            </div>
          )}

          {modoCrear ? (
            <form onSubmit={handleCrear} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                />
              </div>

              {esSubgerente && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Depto origen</label>
                  <select
                    required
                    value={form.depto_origen}
                    onChange={e => setForm(f => ({ ...f, depto_origen: e.target.value, responsable_origen: '' }))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  >
                    {deptosAsignados.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Depto destino</label>
                  <select
                    required
                    value={form.depto_destino}
                    onChange={e => setForm(f => ({ ...f, depto_destino: e.target.value, responsable_destino: '' }))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  >
                    <option value="">Seleccionar…</option>
                    {(departamentosDisponibles.length > 0
                      ? departamentosDisponibles
                      : DEPARTAMENTOS.map(d => d.nombre))
                      .filter(d => d !== (esSubgerente ? form.depto_origen : profile?.departamento))
                      .map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Resp. destino</label>
                  <select
                    value={form.responsable_destino}
                    onChange={e => setForm(f => ({ ...f, responsable_destino: e.target.value }))}
                    disabled={!form.depto_destino}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700 disabled:opacity-50"
                  >
                    <option value="">Seleccionar…</option>
                    {usuariosDestino.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Resp. origen</label>
                  <select
                    value={form.responsable_origen}
                    onChange={e => setForm(f => ({ ...f, responsable_origen: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  >
                    <option value="">Seleccionar…</option>
                    {usuariosOrigen.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={form.fecha_limite}
                    onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
                <div className="flex gap-2">
                  {PRIORIDAD_OPCIONES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, prioridad: p.value }))}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border
                        ${form.prioridad === p.value
                          ? `${p.color} border-transparent`
                          : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {tareasCiclo.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vincular a tarea (opcional)</label>
                  <select
                    value={form.task_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, task_id: e.target.value || null }))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  >
                    <option value="">Sin vincular</option>
                    {tareasCiclo.map(t => <option key={t.id} value={t.id}>{t.nombre_tarea}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Crear solicitud
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Detalle */}
              <div>
                <p className="text-white font-medium leading-tight">{solicitud.titulo}</p>
                {solicitud.descripcion && (
                  <p className="text-gray-400 text-sm mt-1.5">{solicitud.descripcion}</p>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 bg-gray-950 border border-gray-800 rounded-xl p-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Origen</p>
                  <p className="text-white font-medium text-sm">{INICIALES[solicitud.depto_origen]}</p>
                  <p className="text-gray-500 text-[10px]">{solicitud.depto_origen}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500" />
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Destino</p>
                  <p className="text-white font-medium text-sm">{INICIALES[solicitud.depto_destino]}</p>
                  <p className="text-gray-500 text-[10px]">{solicitud.depto_destino}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Resp. origen</p>
                  <p className="text-white">{solicitud.origen?.nombre ?? '—'}</p>
                  {solicitud.origen?.cargo && <p className="text-gray-500 text-xs">{solicitud.origen.cargo}</p>}
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Resp. destino</p>
                  <p className="text-white">{solicitud.destino?.nombre ?? '—'}</p>
                  {solicitud.destino?.cargo && <p className="text-gray-500 text-xs">{solicitud.destino.cargo}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className={`text-sm ${urgenciaColor(solicitud.fecha_limite, solicitud.estado)}`}>
                    {formatFecha(solicitud.fecha_limite)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_MAP[solicitud.prioridad]?.color}`}>
                    <Flag className="w-3 h-3 inline mr-0.5" />{PRIORIDAD_MAP[solicitud.prioridad]?.label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_MAP[solicitud.estado]?.color}`}>
                    {ESTADO_MAP[solicitud.estado]?.label}
                  </span>
                </div>
              </div>

              {/* Botones cambio estado: solo destino */}
              {esDestino && solicitud.estado !== 'entregado' && (
                <div className="flex gap-2">
                  {solicitud.estado === 'solicitado' && (
                    <button
                      onClick={() => cambiarEstado('en_proceso')}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Marcar en proceso
                    </button>
                  )}
                  <button
                    onClick={() => cambiarEstado('entregado')}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar entregado
                  </button>
                </div>
              )}

              {/* Historial */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Historial
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto scroll-dark">
                  {(solicitud.updates ?? []).length === 0 ? (
                    <p className="text-gray-600 text-xs text-center py-3">Sin actualizaciones aún</p>
                  ) : (
                    [...(solicitud.updates ?? [])]
                      .sort((a, b) => new Date(a.creado_at) - new Date(b.creado_at))
                      .map(u => (
                        <div key={u.id} className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs text-gray-300 font-medium">{u.autor?.nombre ?? 'Usuario'}</p>
                            <p className="text-[10px] text-gray-600">
                              {new Date(u.creado_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                          {u.cambio_estado && (
                            <p className="text-[11px] text-amber-400 mb-0.5">
                              → Cambió estado a <strong>{ESTADO_MAP[u.cambio_estado]?.label ?? u.cambio_estado}</strong>
                            </p>
                          )}
                          {u.comentario && <p className="text-sm text-gray-300">{u.comentario}</p>}
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Agregar comentario */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Agregar comentario…"
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-700"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarComentario() } }}
                />
                <button
                  onClick={agregarComentario}
                  disabled={loading || !comentario.trim()}
                  className="px-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Panel lateral de solicitudes ─────────────────────────────────────────────
// ─── Card de dependencia ──────────────────────────────────────────────────────
function DependenciaCard({ dependencia }) {
  const t = dependencia.task
  const d = dependencia.depends_on
  const estadoT = ESTADO_TAREA_MAP[t?.estado] ?? ESTADO_TAREA_MAP.pendiente
  const estadoD = ESTADO_TAREA_MAP[d?.estado] ?? ESTADO_TAREA_MAP.pendiente
  const impacto = dependencia.impacto_atraso ?? 0

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-2">
      <div className="space-y-2">
        <div>
          <p className="text-white text-sm font-medium leading-tight">{t?.nombre_tarea ?? '—'}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 font-medium">
              {INICIALES[t?.departamento] ?? t?.departamento ?? '—'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${estadoT.color}`}>
              {estadoT.label}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center text-gray-500">
          <ArrowRight className="w-4 h-4" />
        </div>
        <div>
          <p className="text-white text-sm font-medium leading-tight">{d?.nombre_tarea ?? '—'}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 font-medium">
              {INICIALES[d?.departamento] ?? d?.departamento ?? '—'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${estadoD.color}`}>
              {estadoD.label}
            </span>
          </div>
        </div>
      </div>

      {impacto > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg px-2.5 py-1.5">
          <p className="text-amber-300 text-[11px] font-medium">
            ⚠️ Impacto: {impacto}d atraso
          </p>
        </div>
      )}
    </div>
  )
}

function PanelSolicitudes({
  solicitudes, dependencias = [], cicloActivoId, deptoSeleccionado, profile,
  esSubgerente, deptosAsignados = [],
  onAbrirSolicitud, onNueva, tab, onTabChange,
}) {
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas')

  const puedeCrear = profile?.rol === 'admin' || profile?.rol === 'gerente' || profile?.rol === 'subgerente'
  const miDepto = profile?.departamento
  const deptosDelUsuario = esSubgerente ? deptosAsignados : [miDepto]
  const esTabDeps = tab === 'dependencias'

  const filtradas = useMemo(() => {
    if (esTabDeps) return []
    let arr = solicitudes
    if (deptoSeleccionado) {
      arr = arr.filter(s => s.depto_origen === deptoSeleccionado || s.depto_destino === deptoSeleccionado)
    }
    if (tab === 'entrantes') arr = arr.filter(s => deptosDelUsuario.includes(s.depto_destino))
    if (tab === 'salientes') arr = arr.filter(s => deptosDelUsuario.includes(s.depto_origen))
    if (filtroEstado !== 'todos') arr = arr.filter(s => s.estado === filtroEstado)
    if (filtroPrioridad !== 'todas') arr = arr.filter(s => s.prioridad === filtroPrioridad)
    return arr
  }, [solicitudes, deptoSeleccionado, tab, filtroEstado, filtroPrioridad, miDepto, esTabDeps, esSubgerente, deptosAsignados])

  const depsFiltradas = useMemo(() => {
    if (!esTabDeps) return []
    let arr = dependencias
    if (cicloActivoId) {
      arr = arr.filter(d => d.task?.ciclo_id === cicloActivoId)
    }
    if (deptoSeleccionado) {
      arr = arr.filter(d =>
        d.task?.departamento === deptoSeleccionado ||
        d.depends_on?.departamento === deptoSeleccionado
      )
    }
    return arr
  }, [dependencias, cicloActivoId, deptoSeleccionado, esTabDeps])

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { value: 'todas',         label: 'Todas' },
          { value: 'entrantes',     label: 'Entrantes' },
          { value: 'salientes',     label: 'Salientes' },
          { value: 'dependencias',  label: 'Dependencias' },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => onTabChange?.(t.value)}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition
              ${tab === t.value
                ? (t.value === 'dependencias'
                    ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/10'
                    : 'text-green-300 border-b-2 border-green-500 bg-green-900/10')
                : 'text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros — solo en tabs de solicitudes */}
      {!esTabDeps && (
        <div className="px-3 py-2 border-b border-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
            >
              <option value="todos">Todos los estados</option>
              {ESTADO_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={filtroPrioridad}
              onChange={e => setFiltroPrioridad(e.target.value)}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
            >
              <option value="todas">Todas prioridades</option>
              {PRIORIDAD_OPCIONES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {deptoSeleccionado && (
            <p className="text-[10px] text-amber-400">
              Filtrando por depto: <span className="font-semibold">{deptoSeleccionado}</span>
            </p>
          )}
        </div>
      )}

      {/* Info en tab Dependencias */}
      {esTabDeps && deptoSeleccionado && (
        <div className="px-3 py-2 border-b border-gray-800">
          <p className="text-[10px] text-purple-400">
            Filtrando por depto: <span className="font-semibold">{deptoSeleccionado}</span>
          </p>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-dark">
        {esTabDeps ? (
          depsFiltradas.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Sin dependencias interdepartamentales</p>
          ) : (
            depsFiltradas.map(d => (
              <DependenciaCard key={d.id} dependencia={d} />
            ))
          )
        ) : (
          filtradas.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">Sin solicitudes</p>
          ) : (
            filtradas.map(s => (
              <SolicitudCard key={s.id} solicitud={s} onClick={() => onAbrirSolicitud(s)} />
            ))
          )
        )}
      </div>

      {/* Botón crear — solo en tabs de solicitudes */}
      {puedeCrear && !esTabDeps && (
        <div className="border-t border-gray-800 p-3">
          <button
            onClick={onNueva}
            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            Nueva solicitud
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Flujos({ cicloSeleccionado }) {
  const { profile, esSubgerente, deptosAsignados } = useAuth()
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null)
  const [solicitudAbierta, setSolicitudAbierta] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [vistaMobile, setVistaMobile] = useState('mapa')
  const [tabPanel, setTabPanel] = useState('todas')

  const { data: departamentosDisponibles = [] } = useQuery({
    queryKey: ['departamentos-flujos'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('departamento').eq('activo', true)
      const unicos = [...new Set((data ?? []).map(u => u.departamento).filter(Boolean))].sort()
      return unicos.map(nombre => ({ nombre, inicial: INICIALES[nombre] ?? nombre.slice(0, 3).toUpperCase() }))
    }
  })

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['department_requests', cicloSeleccionado?.id],
    enabled: !!cicloSeleccionado?.id,
    queryFn: async () => {
      const primerDia = `${cicloSeleccionado.anio}-${String(cicloSeleccionado.mes).padStart(2,'0')}-01`
      const ultimoDia = new Date(cicloSeleccionado.anio, cicloSeleccionado.mes, 0)
        .toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('department_requests')
        .select(`
          *,
          origen:responsable_origen(nombre, cargo),
          destino:responsable_destino(nombre, cargo),
          creador:creado_por(nombre),
          updates:department_request_updates(
            id, comentario, cambio_estado, creado_at,
            autor:user_id(nombre)
          )
        `)
        .lte('creado_at', ultimoDia + 'T23:59:59')
        .or(`fecha_limite.gte.${primerDia},fecha_limite.is.null`)
        .order('creado_at', { ascending: false })
      if (error) throw error
      return data ?? []
    }
  })

  const { data: dependencias = [] } = useQuery({
    queryKey: ['task-dependencies-flujos', cicloSeleccionado?.mes, cicloSeleccionado?.anio],
    enabled: !!cicloSeleccionado?.mes && !!cicloSeleccionado?.anio,
    queryFn: async () => {
      const { data: ciclosPeriodo } = await supabase
        .from('monthly_cycles')
        .select('id')
        .eq('mes', cicloSeleccionado.mes)
        .eq('anio', cicloSeleccionado.anio)

      const cicloIds = ciclosPeriodo?.map(c => c.id) ?? []
      if (cicloIds.length === 0) return []

      const { data: tareasDelPeriodo } = await supabase
        .from('tasks')
        .select('id')
        .in('ciclo_id', cicloIds)

      const idsDelPeriodo = tareasDelPeriodo?.map(t => t.id) ?? []
      if (idsDelPeriodo.length === 0) return []

      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          id, tipo, impacto_atraso,
          task:task_id(id, nombre_tarea, departamento, estado, ciclo_id),
          depends_on:depends_on_id(id, nombre_tarea, departamento, estado, ciclo_id)
        `)
        .in('task_id', idsDelPeriodo)
      if (error) throw error
      return (data ?? []).filter(d =>
        d.task?.departamento &&
        d.depends_on?.departamento &&
        d.task.departamento !== d.depends_on.departamento
      )
    }
  })

  // Las dependencias ya vienen filtradas por el ciclo seleccionado
  const dependenciasMapa = dependencias

  const nombreCiclo = cicloSeleccionado
    ? `${MESES[cicloSeleccionado.mes - 1]} ${cicloSeleccionado.anio}`
    : ''

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-green-400" />
            Flujos interdepartamentales
          </h1>
          <p className="text-gray-400 text-sm">
            {nombreCiclo && <span className="text-gray-300 font-medium">{nombreCiclo}</span>}
            {nombreCiclo && ' · '}
            Solicitudes y dependencias entre departamentos
          </p>
        </div>
        {/* Tabs mobile */}
        <div className="flex gap-1 sm:hidden">
          <button
            onClick={() => setVistaMobile('mapa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${vistaMobile === 'mapa' ? 'bg-green-800 text-green-300' : 'bg-gray-800 text-gray-400'}`}
          >
            <MapIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVistaMobile('panel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${vistaMobile === 'panel' ? 'bg-green-800 text-green-300' : 'bg-gray-800 text-gray-400'}`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(!cicloSeleccionado || isLoading) ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Mapa */}
          <div className={`sm:col-span-3 ${vistaMobile === 'mapa' ? 'block' : 'hidden'} sm:block h-full min-h-0 overflow-hidden`}>
            <MapaFlujos
              solicitudes={solicitudes}
              dependencias={dependenciasMapa}
              departamentos={departamentosDisponibles.length > 0 ? departamentosDisponibles : DEPARTAMENTOS}
              deptoSeleccionado={deptoSeleccionado}
              onSelectDepto={setDeptoSeleccionado}
              onClickSolicitud={s => setSolicitudAbierta(s)}
              onClickDependencia={() => {
                setTabPanel('dependencias')
                setVistaMobile('panel')
              }}
            />
          </div>

          {/* Panel */}
          <div className={`sm:col-span-2 ${vistaMobile === 'panel' ? 'block' : 'hidden'} sm:block h-full min-h-0 overflow-hidden`}>
            <PanelSolicitudes
              solicitudes={solicitudes}
              dependencias={dependencias}
              cicloActivoId={cicloSeleccionado?.id}
              deptoSeleccionado={deptoSeleccionado}
              profile={profile}
              esSubgerente={esSubgerente}
              deptosAsignados={deptosAsignados}
              onAbrirSolicitud={s => setSolicitudAbierta(s)}
              onNueva={() => setMostrarNueva(true)}
              tab={tabPanel}
              onTabChange={setTabPanel}
            />
          </div>
        </div>
      )}

      {solicitudAbierta && (
        <SolicitudModal
          solicitud={solicitudAbierta}
          modoCrear={false}
          onClose={() => setSolicitudAbierta(null)}
        />
      )}

      {mostrarNueva && (
        <SolicitudModal
          modoCrear={true}
          onClose={() => setMostrarNueva(false)}
        />
      )}
    </div>
  )
}
