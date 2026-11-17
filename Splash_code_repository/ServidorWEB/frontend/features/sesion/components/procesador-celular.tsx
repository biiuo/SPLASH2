'use client'

import { Cpu, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ProcesadorCelular, type EstadoProceso, type VistaFrame } from '@/lib/celular/procesador'
import { marcarQueProcesoAqui, procesoAqui, puedeProcesarAqui, urlModelo, urlStream } from '@/lib/modo'
import type { Sesion } from '@/lib/tipos'

const COLOR_FASE: Record<EstadoProceso['fase'], string> = {
  cargando: 'bg-slate-100 text-slate-700',
  conectando: 'bg-amber-50 text-amber-700',
  procesando: 'bg-emerald-50 text-emerald-700',
  error: 'bg-rose-50 text-rose-700',
  terminada: 'bg-slate-100 text-slate-700',
  detenido: 'bg-slate-100 text-slate-700',
}

/**
 * Sesión con modo "celular": el modelo corre en el dispositivo que la inició (ver lib/modo.ts). Ese dispositivo procesa
 * solo; en los demás se ofrece tomar el relevo (por ejemplo, si el primero se quedó sin batería).
 */
export function ProcesadorCelularPanel({ sesion }: { sesion: Sesion }) {
  const [aqui, setAqui] = useState(false)
  const [estado, setEstado] = useState<EstadoProceso | null>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)

  useEffect(() => setAqui(procesoAqui(sesion.id)), [sesion.id])

  useEffect(() => {
    if (!aqui || !sesion.calibracion_id) return
    const dibujar = (v: VistaFrame) => {
      const c = lienzo.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      c.width = v.imagen.width
      c.height = v.imagen.height
      ctx.drawImage(v.imagen, 0, 0)
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(37,99,235,.9)'
      for (const z of v.zonas) {
        ctx.beginPath()
        z.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.stroke()
      }
      ctx.strokeStyle = '#f97316'
      for (const [x1, y1, x2, y2] of v.cajas) ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    }
    const p = new ProcesadorCelular({
      sesionId: sesion.id,
      calibracionId: sesion.calibracion_id,
      urlStream: urlStream(),
      urlModelo: urlModelo(),
      alCambiar: setEstado,
      alFrame: dibujar,
    })
    void p.iniciar()
    return () => p.detener()
  }, [aqui, sesion.id, sesion.calibracion_id])

  function tomar() {
    marcarQueProcesoAqui(sesion.id)
    setAqui(true)
  }

  function soltar() {
    marcarQueProcesoAqui(null)
    setAqui(false)
    setEstado(null)
  }

  if (!aqui) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="flex items-center gap-2 font-semibold text-slate-700"><Smartphone className="size-4" /> Esta sesión se procesa en un celular</p>
        <p className="mt-1">La procesa el dispositivo que la inició. Si ese dispositivo se apagó, este puede seguir.</p>
        {puedeProcesarAqui() && (
          <button onClick={tomar} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Procesar en este dispositivo
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Cpu className="size-4" /> Procesando en este dispositivo</p>
        {estado && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR_FASE[estado.fase]}`}>{estado.fase}</span>}
      </div>
      {estado && <p className="mt-2 text-sm text-slate-600">{estado.mensaje}</p>}
      {estado && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Dato nombre="Velocidad" valor={`${estado.fps} fps`} />
          <Dato nombre="Modelo en" valor={estado.backend ?? '—'} />
          <Dato nombre="Posiciones enviadas" valor={String(estado.enviadas)} />
          <Dato nombre="Cruces / tramos" valor={`${estado.eventos} / ${estado.tramos}`} />
        </dl>
      )}
      <canvas ref={lienzo} className="mt-3 w-full rounded-lg bg-slate-900" aria-label="Vista de lo que procesa el modelo" />
      <button onClick={soltar} className="mt-3 text-xs font-semibold text-slate-500 underline hover:text-slate-700">
        Dejar de procesar en este dispositivo
      </button>
    </div>
  )
}

function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-400">{nombre}</dt>
      <dd className="mt-0.5 font-semibold text-slate-700">{valor}</dd>
    </div>
  )
}
