'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ErrorApi, api } from '@/lib/api'
import type { CalibracionResumen } from '@/lib/tipos'
import { aArchivo, aJpeg, calcularRecorte, desdeArchivo, escalar, type Punto, type Zona } from '@/lib/zonas'

const PRESETS = [
  { name: 'lane4', etiqueta: 'Carril 4', color: '#2563eb' },
  { name: 'lane5', etiqueta: 'Carril 5', color: '#10b981' },
  { name: 'lane6', etiqueta: 'Carril 6', color: '#f59e0b' },
  { name: 'blocks', etiqueta: 'Bloques de salida', color: '#a855f7' },
  { name: 'deck', etiqueta: 'Borde / deck', color: '#ef4444' },
]

function colorDe(nombre: string) {
  return PRESETS.find((p) => p.name === nombre)?.color ?? '#64748b'
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
export const nombreDe = (c: CalibracionResumen) => c.nombre ?? `Calibración del ${fecha(c.creada)}`

/** Dos tamaños de imagen con la misma forma (las zonas se pueden reescalar de una a otra sin deformarse). */
const mismaProporcion = (a: [number, number], b: [number, number]) => Math.abs(a[0] / a[1] - b[0] / b[1]) < 0.01

/** El id que viene en ?calibracion=..., si hay. */
function calibracionDeLaUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('calibracion')
  } catch {
    return null
  }
}

export function ZoneEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [base, setBase] = useState<HTMLCanvasElement | null>(null) // el frame de la piscina
  /** true si la imagen en pantalla es la guardada con la calibración (no una que subió la persona). */
  const baseDeCalibracion = useRef(false)
  const [tam, setTam] = useState<[number, number] | null>(null) // tamaño de la imagen sobre la que están las zonas
  const [zonas, setZonas] = useState<Zona[]>([])
  const [actual, setActual] = useState<Punto[]>([]) // polígono que se está dibujando
  const [nombre, setNombre] = useState('lane4')
  const [cursor, setCursor] = useState<Punto | null>(null)
  const [margen, setMargen] = useState(3) // %
  const [mostrarRecorte, setMostrarRecorte] = useState(true)
  const [video, setVideo] = useState<{ duracion: number; t: number } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // ---- posición de la cámara (calibración) a la que pertenecen las zonas ----
  const [calibraciones, setCalibraciones] = useState<CalibracionResumen[] | null>(null)
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [sinGuardar, setSinGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [problemaApi, setProblemaApi] = useState<string | null>(null)
  const elegida = calibraciones?.find((c) => c.id === elegidaId) ?? null

  const cambiarZonas = useCallback((f: (z: Zona[]) => Zona[]) => {
    setZonas(f)
    setSinGuardar(true)
  }, [])

  const cargarLista = useCallback(async () => {
    try {
      const lista = await api.historialCalibraciones()
      setCalibraciones(lista)
      setProblemaApi(null)
      return lista
    } catch (e) {
      setProblemaApi(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las calibraciones.')
      return null
    }
  }, [])

  // Al entrar: la de ?calibracion=..., o la activa, o la más nueva.
  useEffect(() => {
    void cargarLista().then((lista) => {
      if (!lista || lista.length === 0) return
      const pedida = calibracionDeLaUrl()
      const c = lista.find((x) => x.id === pedida) ?? lista.find((x) => x.activa) ?? lista[0]
      setElegidaId(c.id)
    })
  }, [cargarLista])

  // Al elegir una posición: cargar sus zonas y la imagen sobre la que se calibró (las dos desde la base de datos).
  // Si la persona subió su propia imagen, se respeta y las zonas se reescalan a ella.
  useEffect(() => {
    if (!elegidaId) return
    let vigente = true
    const usarImagenGuardada = !base || baseDeCalibracion.current
    Promise.all([
      api.zonasDeCalibracion(elegidaId),
      usarImagenGuardada ? api.imagenDeCalibracion(elegidaId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([archivo, imagen]) => {
        if (!vigente) return
        const deCal = archivo?.zones ?? []
        const tamCal = archivo?.image_size ?? calibraciones?.find((c) => c.id === elegidaId)?.image_size ?? null
        const fondo = imagen ?? (usarImagenGuardada ? null : base)
        if (imagen) {
          baseDeCalibracion.current = true
          setVideo(null)
          setBase(imagen)
          setTam([imagen.width, imagen.height])
        } else if (usarImagenGuardada) {
          baseDeCalibracion.current = false
          setBase(null)
        }
        if (fondo && tamCal && (tamCal[0] !== fondo.width || tamCal[1] !== fondo.height)) {
          setZonas(escalar(deCal, tamCal[0], tamCal[1], fondo.width, fondo.height))
        } else {
          setZonas(deCal)
          if (!fondo) setTam(tamCal)
        }
        setActual([])
        setSinGuardar(false)
        const avisos: string[] = []
        if (usarImagenGuardada && !imagen) {
          avisos.push(
            'Esta calibración no tiene la imagen guardada (se guardó antes de que se guardaran las imágenes): subí una foto ' +
              'o un video de la misma cámara. Al guardar las zonas se guarda también la imagen.',
          )
        }
        if (deCal.length === 0) avisos.push('Esta posición todavía no tiene zonas: dibujalas y guardalas.')
        setAviso(avisos.length ? avisos.join(' ') : null)
      })
      .catch((e) => vigente && setAviso(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las zonas.'))
    return () => {
      vigente = false
    }
    // base no va en las dependencias: cambiar de imagen no tiene que pisar lo que se está dibujando
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegidaId])

  function elegir(id: string) {
    if (id === elegidaId) return
    if (sinGuardar && !window.confirm('Hay cambios en las zonas sin guardar. ¿Descartarlos y cambiar de posición?')) return
    setElegidaId(id)
  }

  const recorte = useMemo(() => (tam ? calcularRecorte(zonas, tam[0], tam[1], margen / 100) : null), [zonas, tam, margen])

  // ---- cargar el frame de referencia ----
  function fijarBase(c: HTMLCanvasElement) {
    const nuevo: [number, number] = [c.width, c.height]
    const avisos: string[] = []
    if (tam && (tam[0] !== nuevo[0] || tam[1] !== nuevo[1]) && zonas.length > 0) {
      setZonas((z) => escalar(z, tam[0], tam[1], nuevo[0], nuevo[1]))
      avisos.push(`La imagen cambió de ${tam[0]}x${tam[1]} a ${nuevo[0]}x${nuevo[1]}: las zonas se reescalaron.`)
    }
    if (elegida && !mismaProporcion(elegida.image_size, nuevo)) {
      avisos.push(
        `Esta imagen (${nuevo[0]}x${nuevo[1]}) no tiene la forma de la de la calibración (${elegida.image_size[0]}x${elegida.image_size[1]}): ` +
          'las zonas no van a coincidir con lo que ve la cámara. Usá un frame de la misma cámara.',
      )
    }
    setAviso(avisos.length > 0 ? avisos.join(' ') : null)
    setTam(nuevo)
    setBase(c)
    setActual([])
  }

  function cargarImagenOVideo(file: File) {
    baseDeCalibracion.current = false
    const url = URL.createObjectURL(file)
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.muted = true
      v.preload = 'auto'
      v.onloadedmetadata = () => {
        setVideo({ duracion: v.duration, t: 0 })
        v.currentTime = 0
      }
      v.onseeked = () => {
        const c = document.createElement('canvas')
        c.width = v.videoWidth
        c.height = v.videoHeight
        c.getContext('2d')?.drawImage(v, 0, 0)
        fijarBase(c)
      }
      v.src = url
      videoRef.current = v
    } else {
      setVideo(null)
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d')?.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        fijarBase(c)
      }
      img.src = url
    }
  }

  function moverVideo(t: number) {
    setVideo((v) => (v ? { ...v, t } : v))
    if (videoRef.current) videoRef.current.currentTime = t
  }

  // ---- dibujar polígonos ----
  function aImagen(e: React.MouseEvent<HTMLCanvasElement>): Punto {
    const canvas = e.currentTarget
    const r = canvas.getBoundingClientRect()
    return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height]
  }

  function cerrarPoligono() {
    if (actual.length < 3) return
    cambiarZonas((z) => [...z.filter((x) => x.name !== nombre), { name: nombre, polygon: actual }])
    setActual([])
    setCursor(null)
    // salta a la próxima zona que todavía no está definida
    const hechas = new Set([...zonas.map((z) => z.name), nombre])
    const siguiente = PRESETS.find((p) => !hechas.has(p.name))
    if (siguiente) setNombre(siguiente.name)
  }

  // atajos: Enter cierra, Esc cancela, Retroceso/Z deshace
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'Enter') cerrarPoligono()
      else if (e.key === 'Escape') setActual([])
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') setActual((a) => a.slice(0, -1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // avisar antes de cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!sinGuardar) return
    const antes = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', antes)
    return () => window.removeEventListener('beforeunload', antes)
  }, [sinGuardar])

  // ---- pintar el canvas ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !base) return
    canvas.width = base.width
    canvas.height = base.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(base, 0, 0)

    const g = Math.max(2, Math.round(base.width / 400))
    ctx.lineWidth = g
    ctx.lineJoin = 'round'
    ctx.font = `${Math.max(14, Math.round(base.width / 55))}px sans-serif`

    const trazar = (pts: Punto[], cerrar: boolean) => {
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      if (cerrar) ctx.closePath()
    }

    for (const z of zonas) {
      const color = colorDe(z.name)
      trazar(z.polygon, true)
      ctx.fillStyle = color + '33'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.stroke()
      ctx.fillStyle = color
      ctx.fillText(z.name, z.polygon[0][0] + g * 3, z.polygon[0][1] + g * 8)
    }

    if (actual.length > 0) {
      const color = colorDe(nombre)
      const camino = cursor ? [...actual, cursor] : actual
      trazar(camino, false)
      ctx.strokeStyle = color
      ctx.stroke()
      for (const [x, y] of actual) {
        ctx.beginPath()
        ctx.arc(x, y, g * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    }

    if (mostrarRecorte && recorte) {
      ctx.setLineDash([g * 4, g * 3])
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = g
      ctx.strokeRect(recorte.x1, recorte.y1, recorte.x2 - recorte.x1, recorte.y2 - recorte.y1)
      ctx.setLineDash([])
    }
  }, [base, zonas, actual, nombre, cursor, recorte, mostrarRecorte])

  // ---- guardar en el servidor ----
  async function guardarEnServidor() {
    if (!elegida || !tam) return
    // las zonas se guardan en píxeles de la imagen de la calibración, que puede tener otro tamaño que la de pantalla
    const [w, h] = elegida.image_size
    const aGuardar = escalar(zonas, tam[0], tam[1], w, h).map((z) => ({
      name: z.name,
      polygon: z.polygon.map(([x, y]) => [Math.min(Math.max(Math.round(x), 0), w), Math.min(Math.max(Math.round(y), 0), h)] as Punto),
    }))
    setGuardando(true)
    try {
      // si la calibración es de antes de guardar imágenes, se guarda también la que se subió (con el mismo tamaño)
      const guardarImagen = !elegida.tiene_imagen && base && base.width === w && base.height === h
      await api.actualizarCalibracion(elegida.id, {
        zonas: aGuardar.length > 0 ? aGuardar : null,
        ...(guardarImagen ? { imagen: aJpeg(base) } : {}),
      })
      setSinGuardar(false)
      setAviso(
        `Zonas guardadas en "${nombreDe(elegida)}".` +
          (elegida.activa ? ' Las usarán las sesiones que empiecen desde ahora.' : ' Activá esta posición para que las usen las sesiones nuevas.'),
      )
      await cargarLista()
    } catch (e) {
      setAviso(e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudieron guardar las zonas.')
    } finally {
      setGuardando(false)
    }
  }

  // ---- importar / exportar ----
  function descargar() {
    if (!tam || zonas.length === 0) return
    const blob = new Blob([aArchivo(zonas, tam[0], tam[1])], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'zones.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importar(file: File) {
    try {
      const a = desdeArchivo(await file.text())
      if (base && a.image_size && (a.image_size[0] !== base.width || a.image_size[1] !== base.height)) {
        cambiarZonas(() => escalar(a.zones, a.image_size![0], a.image_size![1], base.width, base.height))
        setAviso('El archivo era de otra resolución: las zonas se reescalaron a la imagen actual.')
      } else {
        cambiarZonas(() => a.zones)
        setTam(base ? [base.width, base.height] : a.image_size)
        setAviso(base ? null : 'Zonas cargadas. Subí una imagen o un video de la piscina para verlas.')
      }
      setActual([])
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  const hechas = new Set(zonas.map((z) => z.name))

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-blue-600">
          <Link href="/" className="hover:underline">← Volver al inicio</Link>
          <Link href="/calibracion" className="hover:underline">Calibración</Link>
          <Link href="/calibracion/historial" className="hover:underline">Posiciones de la cámara</Link>
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-blue-600">Calibración</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Zonas de análisis</h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          Marcá sobre un frame de la piscina los tres carriles centrales. El modelo analizará solo el rectángulo que los
          contiene (línea amarilla), y no verá el resto de la imagen. Cada posición de la cámara tiene sus propias zonas:
          si la cámara se mueve, calibrá de nuevo y dibujá las zonas de la posición nueva.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---- lienzo ---- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {base ? (
              <canvas
                ref={canvasRef}
                onClick={(e) => {
                  // la posición se calcula YA: dentro de setActual(...) React la calcularía más tarde, cuando el
                  // evento ya no tiene el canvas (e.currentTarget = null) y la página se rompía
                  const p = aImagen(e)
                  setActual((a) => [...a, p])
                }}
                onMouseMove={(e) => setCursor(aImagen(e))}
                onMouseLeave={() => setCursor(null)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setActual((a) => a.slice(0, -1))
                }}
                className="w-full cursor-crosshair rounded-xl"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                Subí una foto o un video de la piscina para empezar
                {zonas.length > 0 && ` (esta posición ya tiene ${zonas.length} zonas: se van a dibujar encima)`}
              </div>
            )}

            {video && (
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-700">
                  Elegí el instante del video: {video.t.toFixed(1)} s
                  <input
                    type="range"
                    min={0}
                    max={video.duracion}
                    step={0.1}
                    value={video.t}
                    onChange={(e) => moverVideo(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-400">Conviene un instante en el que nadie tape los bordes de los carriles.</p>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Clic: agregar punto · Enter: cerrar polígono · Clic derecho o Retroceso: deshacer · Esc: cancelar
            </p>
          </div>

          {/* ---- panel ---- */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">1. Posición de la cámara</h2>
              {problemaApi && <p className="mt-3 text-sm text-rose-600">{problemaApi}</p>}
              {calibraciones && calibraciones.length === 0 && (
                <p className="mt-3 text-sm text-slate-500">
                  Todavía no hay ninguna calibración. Las zonas se guardan junto con una:{' '}
                  <Link href="/calibracion" className="font-semibold text-blue-600 underline">calibrá primero</Link>.
                </p>
              )}
              {calibraciones && calibraciones.length > 0 && (
                <>
                  <select
                    value={elegidaId ?? ''}
                    onChange={(e) => elegir(e.target.value)}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    {calibraciones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nombreDe(c)}
                        {c.activa ? ' (activa)' : ''}
                        {c.zonas.length > 0 ? ` · ${c.zonas.length} zonas` : ' · sin zonas'}
                      </option>
                    ))}
                  </select>
                  {elegida && (
                    <p className="mt-2 text-xs text-slate-400">
                      Calibrada sobre una imagen de {elegida.image_size[0]} × {elegida.image_size[1]} px
                      {elegida.activa ? '. Es la que usan las sesiones nuevas.' : '. No es la activa.'}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">2. Imagen de referencia</h2>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => e.target.files?.[0] && cargarImagenOVideo(e.target.files[0])}
                className="mt-3 w-full text-sm"
              />
              {tam && <p className="mt-2 text-xs text-slate-400">Tamaño: {tam[0]} × {tam[1]} px</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">3. Dibujá las zonas</h2>
              <div className="mt-3 flex flex-col gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setNombre(p.name)
                      setActual([])
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      nombre === p.name ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="size-3 rounded-full" style={{ background: p.color }} />
                    <span className="flex-1 font-medium">{p.etiqueta}</span>
                    {hechas.has(p.name) && (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Borrar esta zona"
                        onClick={(e) => {
                          e.stopPropagation()
                          cambiarZonas((z) => z.filter((x) => x.name !== p.name))
                        }}
                        className="text-xs font-semibold text-emerald-600 hover:text-rose-500"
                      >
                        ✓ lista
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={cerrarPoligono}
                  disabled={actual.length < 3}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Cerrar polígono ({actual.length} puntos)
                </button>
                <button
                  onClick={() => setActual((a) => a.slice(0, -1))}
                  disabled={actual.length === 0}
                  className="rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:text-slate-300"
                >
                  Deshacer
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Los carriles se llaman <b>lane…</b> o <b>carril…</b> con su número: solo esos definen el recorte y el
                carril de cada nadador. Los bloques y el borde se guardan, pero no agrandan el recorte.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">4. Recorte para el modelo</h2>
              {recorte && tam ? (
                <>
                  <p className="mt-3 text-sm text-slate-600">
                    Rectángulo: ({recorte.x1}, {recorte.y1}) a ({recorte.x2}, {recorte.y2}) · {recorte.x2 - recorte.x1} ×{' '}
                    {recorte.y2 - recorte.y1} px
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-700">
                    El modelo verá el {(recorte.fraccionArea * 100).toFixed(0)} % de la imagen
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Dibujá al menos una zona para calcularlo.</p>
              )}
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Margen: {margen} %
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={margen}
                  onChange={(e) => setMargen(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={mostrarRecorte} onChange={(e) => setMostrarRecorte(e.target.checked)} />
                Mostrar el recorte sobre la imagen
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">5. Guardar</h2>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={guardarEnServidor}
                  disabled={!elegida || !tam || guardando || !sinGuardar}
                  className="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {guardando
                    ? 'Guardando…'
                    : !elegida
                      ? 'Elegí una posición de la cámara'
                      : sinGuardar
                        ? `Guardar en "${nombreDe(elegida)}"`
                        : 'Guardado'}
                </button>
                {sinGuardar && <p className="text-xs font-medium text-amber-600">Hay cambios sin guardar.</p>}
                <button
                  onClick={descargar}
                  disabled={zonas.length === 0}
                  className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                >
                  Descargar zones.json
                </button>
                <label className="cursor-pointer rounded-xl border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Abrir un zones.json existente
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void importar(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                {zonas.length > 0 && (
                  <button
                    onClick={() => {
                      cambiarZonas(() => [])
                      setActual([])
                      setNombre('lane4')
                    }}
                    className="text-sm font-medium text-rose-500 hover:underline"
                  >
                    Borrar todas las zonas
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Al iniciar una sesión, el servidor de IA usa las zonas de la posición activa. El archivo zones.json sirve
                para las herramientas de Python sin servidor.
              </p>
            </div>

            {aviso && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
