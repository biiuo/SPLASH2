'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useConfiguracion } from '@/lib/almacen-config'
import { ErrorApi, api } from '@/lib/api'
import { metrosAImagen } from '@/lib/proyeccion'
import { aJpeg } from '@/lib/zonas'
import type {
  Configuracion,
  Derivados,
  Marca,
  MarcaCuerda,
  Nivel,
  Punto,
  PrecisionNodo,
  PuntosReferencia,
  ResultadoEvaluacion,
  Llegada,
} from '@/lib/tipos'


const ESTILO_NIVEL: Record<Nivel, string> = {
  sin_puntos: 'border-slate-200 bg-slate-50 text-slate-700',
  insuficiente: 'border-amber-200 bg-amber-50 text-amber-800',
  parcial: 'border-amber-200 bg-amber-50 text-amber-800',
  revisar: 'border-rose-200 bg-rose-50 text-rose-800',
  completo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

function PantallaEstado({ mensaje, error = false }: { mensaje: string; error?: boolean }) {
  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">← Volver al inicio</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Homografía de la piscina</h1>
        <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{mensaje}</p>
      </div>
    </main>
  )
}

function CalibracionPantalla({
  referencia,
  config,
  precision,
  derivados: dv,
}: {
  referencia: PuntosReferencia
  config: Configuracion
  precision: PrecisionNodo[]
  derivados: Derivados
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const arrastrando = useRef<string | null>(null)

  const [base, setBase] = useState<HTMLCanvasElement | null>(null)
  const [tam, setTam] = useState<[number, number] | null>(null)
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [omitidos, setOmitidos] = useState<string[]>([]) // puntos que no se ven en la imagen
  const [objetivo, setObjetivo] = useState<string | null>(null) // null = el siguiente pendiente
  const [mostrarRejilla, setMostrarRejilla] = useState(true)
  /** Qué tan fuertes se ven las líneas guía (rejilla y llegada): más bajo = se ve mejor la imagen debajo. */
  const [opacidadGuias, setOpacidadGuias] = useState(0.9)
  const [video, setVideo] = useState<{ duracion: number; t: number } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargandoFrame, setCargandoFrame] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [nombrePosicion, setNombrePosicion] = useState('') // para reconocer esta posición de la cámara en el historial
  const [guardadaId, setGuardadaId] = useState<string | null>(null)
  // puntos sobre las corcheras: se marcan en cualquier lugar de su largo y afirman la calibración
  const [marcasCuerda, setMarcasCuerda] = useState<MarcaCuerda[]>([])
  const [modo, setModo] = useState<'nodos' | 'cuerdas'>('nodos')
  const [cuerdaActiva, setCuerdaActiva] = useState(0)
  const arrastrandoCuerda = useRef<number | null>(null)
  // dónde se cuenta la llegada a cada pared, si la cámara no la ve (null = en la pared)
  const [llegada, setLlegada] = useState<Llegada>({ inicio_m: null, fin_m: null })

  const g = referencia.geometria
  const refs = referencia.puntos
  const ancho = referencia.anchoTotal_m
  const umbrales = referencia.umbrales_error_m

  // La evaluación la calcula el backend: se pide cada vez que cambian las marcas (con una pequeña espera).
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const ev = resultado?.evaluacion ?? null
  const Hinv = ev?.Hinv ?? null
  const dist = ev?.distorsion ?? null
  const objetivoId = objetivo ?? ev?.siguiente?.id ?? null
  const objetivoRef = refs.find((r) => r.id === objetivoId) ?? null

  const colorError = (e: number | undefined) => {
    if (e === undefined) return '#2563eb'
    if (e <= umbrales.bueno) return '#10b981'
    if (e <= umbrales.aceptable) return '#f59e0b'
    return '#ef4444'
  }
  /** Los nodos se juzgan por el error del clic en píxeles: en metros, los lejanos siempre parecerían mal. */
  const umbralesPx = referencia.umbrales_error_px
  const colorErrorPx = (e: number | undefined) => {
    if (e === undefined) return '#2563eb'
    if (e <= umbralesPx.bueno) return '#10b981'
    if (e <= umbralesPx.aceptable) return '#f59e0b'
    return '#ef4444'
  }

  useEffect(() => {
    let vigente = true
    const espera = setTimeout(() => {
      api
        .evaluarCalibracion({ marcas, omitidos, cuerdas: marcasCuerda, image_size: tam ?? undefined })
        .then((r) => {
          if (!vigente) return
          setResultado(r)
          setErrorApi(null)
        })
        .catch((e: Error) => vigente && setErrorApi(e.message))
    }, 120)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [marcas, omitidos, marcasCuerda, tam])

  // ---- al abrir: la calibración activa, desde la base de datos ----
  // (se parte de lo guardado; si la cámara se movió, se corrigen los puntos o se empieza de nuevo y se guarda otra)
  useEffect(() => {
    let vigente = true
    api
      .calibracionActiva()
      .then((c) => {
        if (!vigente || !c) return
        setMarcas(c.puntos.map((p): Marca => ({ id: p.id, px: p.px })))
        setMarcasCuerda((c.cuerdas ?? []).map((q): MarcaCuerda => ({ cuerda: q.cuerda, px: q.px })))
        setOmitidos(c.omitidos ?? [])
        if (c.llegada) setLlegada(c.llegada)
        setTam(c.image_size)
        // y la imagen sobre la que se marcó, si se guardó (así no hay que volver a subirla)
        return api.imagenDeCalibracion(c.id).then((img) => {
          if (!vigente || !img) return
          setBase((actual) => actual ?? img)
        })
      })
      .catch(() => {
        /* sin calibración o sin base: se empieza vacío */
      })
      .finally(() => vigente && setCargado(true))
    return () => {
      vigente = false
    }
  }, [])

  // ---- cargar el frame de referencia ----
  function fijarBase(c: HTMLCanvasElement) {
    const nuevo: [number, number] = [c.width, c.height]
    if (tam && (marcas.length > 0 || marcasCuerda.length > 0) && (tam[0] !== nuevo[0] || tam[1] !== nuevo[1])) {
      const sx = nuevo[0] / tam[0]
      const sy = nuevo[1] / tam[1]
      setMarcas((m) => m.map((x) => ({ id: x.id, px: [x.px[0] * sx, x.px[1] * sy] as Punto })))
      setMarcasCuerda((m) => m.map((x) => ({ cuerda: x.cuerda, px: [x.px[0] * sx, x.px[1] * sy] as Punto })))
      setAviso(`La imagen cambió de ${tam[0]}x${tam[1]} a ${nuevo[0]}x${nuevo[1]}: los puntos se reescalaron.`)
    } else {
      setAviso(null)
    }
    setTam(nuevo)
    setBase(c)
  }

  function cargarImagenOVideo(file: File) {
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

  /** Toma el último frame de la cámara (lo deja el servidor de IA) como imagen de referencia. */
  async function usarFrameDeCamara() {
    setCargandoFrame(true)
    try {
      const c = await api.frameDeCamara()
      setVideo(null)
      fijarBase(c)
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No se pudo traer el frame de la cámara.')
    } finally {
      setCargandoFrame(false)
    }
  }

  function moverVideo(t: number) {
    setVideo((v) => (v ? { ...v, t } : v))
    if (videoRef.current) videoRef.current.currentTime = t
  }

  // ---- interacción con el lienzo ----
  function aImagen(e: React.PointerEvent<HTMLCanvasElement>): Punto {
    const canvas = e.currentTarget
    const r = canvas.getBoundingClientRect()
    return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height]
  }

  function marcaCercana(p: Punto, canvas: HTMLCanvasElement): string | null {
    const r = canvas.getBoundingClientRect()
    let limite = 14 * (canvas.width / r.width) // 14 px de pantalla
    let mejor: string | null = null
    for (const m of marcas) {
      const d = Math.hypot(m.px[0] - p[0], m.px[1] - p[1])
      if (d < limite) {
        limite = d
        mejor = m.id
      }
    }
    return mejor
  }

  /** El punto de corchera más cercano (índice en marcasCuerda), a menos de 14 px de pantalla. */
  function cuerdaCercana(p: Punto, canvas: HTMLCanvasElement): number | null {
    const r = canvas.getBoundingClientRect()
    let limite = 14 * (canvas.width / r.width)
    let mejor: number | null = null
    marcasCuerda.forEach((m, i) => {
      const d = Math.hypot(m.px[0] - p[0], m.px[1] - p[1])
      if (d < limite) {
        limite = d
        mejor = i
      }
    })
    return mejor
  }

  function alPresionar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const p = aImagen(e)
    if (modo === 'cuerdas') {
      const i = cuerdaCercana(p, e.currentTarget)
      if (i !== null) {
        arrastrandoCuerda.current = i
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      setMarcasCuerda((m) => [...m, { cuerda: cuerdaActiva, px: p }])
      return
    }
    const cerca = marcaCercana(p, e.currentTarget)
    if (cerca) {
      arrastrando.current = cerca // para corregir un punto, se arrastra
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (!objetivoId) return
    setMarcas((m) => [...m.filter((x) => x.id !== objetivoId), { id: objetivoId, px: p }])
    setOmitidos((o) => o.filter((id) => id !== objetivoId))
    setObjetivo(null)
  }

  /** Elegir un punto para (volver a) marcarlo. Si estaba como "no se ve", deja de estarlo. */
  function elegirObjetivo(id: string) {
    setOmitidos((o) => o.filter((x) => x !== id))
    setObjetivo(id)
  }

  /** El punto indicado no se ve en la imagen (queda fuera del cuadro o tapado): se salta. */
  function noSeVe() {
    if (!objetivoId) return
    setMarcas((m) => m.filter((x) => x.id !== objetivoId))
    setOmitidos((o) => (o.includes(objetivoId) ? o : [...o, objetivoId]))
    setObjetivo(null)
  }

  function alMover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (arrastrandoCuerda.current !== null) {
      const p = aImagen(e)
      const i = arrastrandoCuerda.current
      setMarcasCuerda((m) => m.map((x, j) => (j === i ? { cuerda: x.cuerda, px: p } : x)))
      return
    }
    if (!arrastrando.current) return
    const p = aImagen(e)
    const id = arrastrando.current
    setMarcas((m) => m.map((x) => (x.id === id ? { id, px: p } : x)))
  }

  function alSoltar() {
    arrastrando.current = null
    arrastrandoCuerda.current = null
  }

  function quitarCercana(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = e.currentTarget
    const r = canvas.getBoundingClientRect()
    const p: Punto = [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height]
    if (modo === 'cuerdas') {
      const i = cuerdaCercana(p, canvas)
      if (i !== null) setMarcasCuerda((m) => m.filter((_, j) => j !== i))
      return
    }
    const id = marcaCercana(p, canvas)
    if (id) {
      setMarcas((m) => m.filter((x) => x.id !== id))
      setObjetivo(id)
    }
  }

  // ---- pintar el lienzo ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !base || !ev) return
    canvas.width = base.width
    canvas.height = base.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(base, 0, 0)

    const gr = Math.max(2, Math.round(base.width / 400))
    const radio = gr * 3.2
    ctx.font = `bold ${Math.max(14, Math.round(base.width / 60))}px sans-serif`
    ctx.lineJoin = 'round'

    // rejilla: los carriles y los nodos proyectados con la homografía calculada
    if (mostrarRejilla && Hinv) {
      ctx.save()
      ctx.globalAlpha = opacidadGuias
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)'
      ctx.lineWidth = gr
      const linea = (a: Punto, b: Punto) => {
        ctx.beginPath()
        let ok = true
        // con muchos tramos cortos, para que se vea la curva que hace el lente
        for (let i = 0; i <= 80; i++) {
          const t = i / 80
          const q = metrosAImagen(Hinv, dist, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
          if (!q) {
            ok = false
            break
          }
          if (i === 0) ctx.moveTo(q[0], q[1])
          else ctx.lineTo(q[0], q[1])
        }
        if (ok) ctx.stroke()
      }
      for (let k = 0; k <= g.n_carriles; k++) linea([0, k * g.ancho_carril_m], [g.largo_m, k * g.ancho_carril_m])
      for (const x of g.nodos_m) linea([x, 0], [x, ancho])
      // marcando corcheras: la línea de la corchera elegida resaltada, para comparar con la corchera real
      if (modo === 'cuerdas') {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = gr * 1.6
        ctx.setLineDash([gr * 4, gr * 3])
        linea([0, cuerdaActiva * g.ancho_carril_m], [g.largo_m, cuerdaActiva * g.ancho_carril_m])
        ctx.setLineDash([])
      }

      // cada línea de marca con sus metros, del lado derecho (así se sabe cuál es la de 0 m aunque quede fuera)
      const etiqueta = (texto: string, m: Punto, color: string) => {
        const q = metrosAImagen(Hinv, dist, m)
        if (!q || q[0] < 0 || q[1] < 0 || q[0] > base.width || q[1] > base.height) return
        ctx.font = `bold ${Math.max(13, Math.round(base.width / 75))}px sans-serif`
        ctx.lineWidth = gr * 1.5
        ctx.strokeStyle = '#0f172a'
        ctx.strokeText(texto, q[0] + gr * 2, q[1])
        ctx.fillStyle = color
        ctx.fillText(texto, q[0] + gr * 2, q[1])
      }
      for (const x of g.nodos_m) etiqueta(`${x} m`, [x, ancho + 0.15], 'rgba(250, 204, 21, 1)')

      // líneas de llegada (si la cámara no ve la pared): ahí se cuentan la llegada, el viraje y el largo
      // NO es la pared: es dónde se cuenta que el nadador llegó a ella, cuando la cámara no ve la pared
      const lineasLlegada: [number | null, string][] = [
        [llegada.inicio_m, 'llegada a la pared de salida'],
        [llegada.fin_m, 'llegada a la pared del fondo'],
      ]
      for (const [x, texto] of lineasLlegada) {
        if (x === null) continue
        ctx.strokeStyle = '#22d3ee'
        ctx.lineWidth = gr * 2
        linea([x, 0], [x, ancho])
        // la etiqueta en el medio de la piscina (a los costados suele quedar fuera de la imagen)
        etiqueta(`${texto}: ${x.toFixed(1)} m`, [x, ancho / 2], '#22d3ee')
      }
      ctx.restore()
    }

    // puntos sobre las corcheras (cuadrados chicos; los de la corchera elegida, más grandes)
    marcasCuerda.forEach((m, i) => {
      const activa = modo === 'cuerdas' && m.cuerda === cuerdaActiva
      const lado = radio * (activa ? 1.6 : 1.1)
      ctx.fillStyle = colorError(ev.errorPorPuntoCuerda[i])
      ctx.fillRect(m.px[0] - lado / 2, m.px[1] - lado / 2, lado, lado)
      ctx.lineWidth = gr * 0.8
      ctx.strokeStyle = activa ? '#ffffff' : 'rgba(255,255,255,0.7)'
      ctx.strokeRect(m.px[0] - lado / 2, m.px[1] - lado / 2, lado, lado)
    })

    // dónde debería estar cada punto pendiente (se ve desde que hay 4 puntos)
    if (Hinv) {
      for (const r of ev.pendientes) {
        const q = metrosAImagen(Hinv, dist, r.mundo)
        if (!q || q[0] < 0 || q[1] < 0 || q[0] > base.width || q[1] > base.height) continue
        const esObjetivo = r.id === objetivoId
        ctx.setLineDash([gr * 2, gr * 2])
        ctx.strokeStyle = esObjetivo ? '#ffffff' : 'rgba(255,255,255,0.55)'
        ctx.lineWidth = esObjetivo ? gr * 1.5 : gr
        ctx.beginPath()
        ctx.arc(q[0], q[1], radio * (esObjetivo ? 2.4 : 1.6), 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // puntos marcados
    for (const m of marcas) {
      const idx = refs.findIndex((r) => r.id === m.id) + 1
      const color = colorErrorPx(ev.errorPxPorPunto[m.id])
      ctx.beginPath()
      ctx.arc(m.px[0], m.px[1], radio, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = gr
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = gr * 1.5
      ctx.strokeText(String(idx), m.px[0] + radio + gr, m.px[1] - radio)
      ctx.fillText(String(idx), m.px[0] + radio + gr, m.px[1] - radio)
    }
  }, [base, marcas, marcasCuerda, modo, cuerdaActiva, llegada, ev, Hinv, dist, objetivoId, mostrarRejilla, opacidadGuias, g, ancho, refs, umbrales])

  // ---- guardar ----
  function archivoJson(): string | null {
    const archivo = resultado?.archivo
    return archivo ? JSON.stringify(archivo, null, 2) : null
  }

  function descargar() {
    const texto = archivoJson()
    if (!texto) return
    const blob = new Blob([texto], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'calibracion.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function guardarEnServidor() {
    if (!tam || !ev?.H) return
    try {
      const c = await api.guardarCalibracion({
        image_size: tam,
        marcas,
        omitidos,
        cuerdas: marcasCuerda,
        llegada: llegada.inicio_m === null && llegada.fin_m === null ? null : llegada,
        nombre: nombrePosicion.trim() || null,
        // la imagen sobre la que se marcó: la usan las zonas y este editor, sin volver a subirla
        imagen: base && base.width === tam[0] && base.height === tam[1] ? aJpeg(base) : null,
      })
      setGuardadaId(c.id)
      setAviso('Calibración guardada en el servidor y activada. Falta dibujar sus zonas de análisis.')
    } catch (e) {
      const detalle = e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'Error desconocido.'
      setAviso(`No se pudo guardar: ${detalle}`)
    }
  }

  if (!ev) return <PantallaEstado mensaje={errorApi ?? 'Calculando…'} error={errorApi !== null} />
  const calidad = ev.cruzado_m ?? ev.rmse_m

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-blue-600">
          <Link href="/" className="hover:underline">← Volver al inicio</Link>
          <Link href="/zonas" className="hover:underline">Zonas de análisis</Link>
          <Link href="/configuracion" className="hover:underline">Configuración de la piscina y la cámara</Link>
          <Link href="/calibracion/historial" className="hover:underline">Calibraciones guardadas</Link>
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-blue-600">Calibración</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Homografía de la piscina</h1>
        <p className="mt-2 max-w-3xl text-slate-500">
          Marcá en la imagen las marcas de las cuerdas de los dos lados, a las distancias que se indican. Con eso el
          sistema convierte lo que ve la cámara en metros reales, y de ahí salen las distancias y las velocidades.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---- lienzo ---- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              {(['nodos', 'cuerdas'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className={`rounded-lg py-2 transition ${modo === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {m === 'nodos' ? `1. Nodos (${ev.marcados} de ${ev.total})` : `2. Corcheras (${marcasCuerda.length} puntos)`}
                </button>
              ))}
            </div>
            {modo === 'cuerdas' && (
              <div className="mb-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-semibold">Marcando sobre: {referencia.cuerdas[cuerdaActiva]?.etiqueta}</p>
                <p className="mt-0.5 text-blue-700">
                  Hacé clic en 4 o 5 lugares a lo largo de esta corchera, de cerca a lejos, sobre todo donde no hay nodos
                  (cerca de la cámara). No hace falta que sean marcas: cualquier punto de la corchera sirve. La línea
                  blanca punteada es donde la calibración cree que está.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {referencia.cuerdas.map((c) => (
                    <button
                      key={c.indice}
                      onClick={() => setCuerdaActiva(c.indice)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        c.indice === cuerdaActiva ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      Corchera {c.indice + 1} · {marcasCuerda.filter((m) => m.cuerda === c.indice).length}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {modo === 'nodos' && objetivoRef && (
              <div className="mb-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-semibold">
                  Punto {refs.findIndex((r) => r.id === objetivoRef.id) + 1} de {refs.length}: {objetivoRef.etiqueta}
                </p>
                <p className="mt-0.5 text-blue-700">{objetivoRef.ayuda}</p>
                <button
                  onClick={noSeVe}
                  className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Este punto no se ve en la imagen
                </button>
              </div>
            )}
            {base ? (
              <canvas
                ref={canvasRef}
                onPointerDown={alPresionar}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onContextMenu={quitarCercana}
                className="w-full cursor-crosshair touch-none rounded-xl"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-center text-sm text-slate-400">
                Subí una foto o un video de la piscina para empezar
              </div>
            )}
            {video && (
              <div className="mt-4">
                <label className="text-sm font-medium text-slate-700">
                  Instante del video: {video.t.toFixed(1)} s
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
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mostrarRejilla} onChange={(e) => setMostrarRejilla(e.target.checked)} />
                Líneas guía
              </label>
              <label className={`flex items-center gap-2 ${mostrarRejilla ? '' : 'opacity-40'}`}>
                Intensidad
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacidadGuias}
                  disabled={!mostrarRejilla}
                  onChange={(e) => setOpacidadGuias(Number(e.target.value))}
                  className="w-32 accent-amber-400"
                  aria-label="Intensidad de las líneas guía"
                />
                {Math.round(opacidadGuias * 100)}%
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {modo === 'nodos'
                ? 'Clic: marcar el punto indicado · Arrastrar un punto: corregirlo · Clic derecho sobre un punto: quitarlo y volver a marcarlo'
                : 'Clic: agregar un punto a la corchera elegida · Arrastrar un cuadrado: corregirlo · Clic derecho sobre un cuadrado: quitarlo'}
            </p>
          </div>

          {/* ---- panel ---- */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Imagen de referencia</h2>
              <button
                type="button"
                onClick={usarFrameDeCamara}
                disabled={cargandoFrame}
                className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {cargandoFrame ? 'Trayendo el frame…' : 'Usar la imagen de la cámara'}
              </button>
              <p className="mt-3 text-xs text-slate-400">O subí una foto o un video de la piscina:</p>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => e.target.files?.[0] && cargarImagenOVideo(e.target.files[0])}
                className="mt-1 w-full text-sm"
              />
              {tam && <p className="mt-2 text-xs text-slate-400">Tamaño: {tam[0]} × {tam[1]} px</p>}
            </div>

            {/* evaluador */}
            <div className={`rounded-2xl border p-5 ${ESTILO_NIVEL[ev.nivel]}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">{ev.titulo}</h2>
                <span className="text-sm font-semibold">
                  {ev.marcados} de {ev.total}
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${ev.progreso * 100}%` }} />
              </div>
              <p className="mt-3 text-sm">{ev.mensaje}</p>
              {ev.advertencias.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {ev.advertencias.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              {dist ? (
                <p className="mt-3 text-xs opacity-80">
                  Curvatura del lente corregida (k1 = {dist.k1.toFixed(3)}): en las esquinas de la imagen mueve los puntos
                  unos {Math.round(Math.abs(dist.k1) * dist.escala)} px. Por eso la rejilla se ve curva.
                </p>
              ) : (
                marcasCuerda.length > 0 &&
                marcasCuerda.length < 6 && (
                  <p className="mt-3 text-xs opacity-80">Con 6 puntos de corchera o más se estima también la curvatura del lente.</p>
                )
              )}
              {calidad !== null && (
                <p className="mt-3 text-xs opacity-80">
                  Error estimado: {(calidad * 100).toFixed(1)} cm
                  {ev.cruzado_m !== null ? ' (validación cruzada)' : ' (ajuste; con 5 puntos o más se mide mejor)'} · bueno ≤{' '}
                  {umbrales.bueno * 100} cm · aceptable ≤ {umbrales.aceptable * 100} cm
                </p>
              )}
            </div>

            {/* corcheras */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Corcheras <span className="text-xs font-normal text-slate-400">(recomendado)</span></h2>
              <p className="mt-1 text-xs text-slate-500">
                Los nodos lejanos ocupan pocos píxeles y un clic apenas corrido tuerce toda la rejilla. Las corcheras son
                rectas largas que se ven en toda la imagen: marcar puntos sobre ellas hace que la rejilla las siga, también
                cerca de la cámara, donde no hay nodos.
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {referencia.cuerdas.map((c) => {
                  const resumen = ev.cuerdas.find((x) => x.indice === c.indice)
                  const n = marcasCuerda.filter((m) => m.cuerda === c.indice).length
                  return (
                    <div
                      key={c.indice}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${modo === 'cuerdas' && c.indice === cuerdaActiva ? 'bg-blue-50' : ''}`}
                    >
                      <button
                        onClick={() => {
                          setModo('cuerdas')
                          setCuerdaActiva(c.indice)
                        }}
                        className="flex-1 text-left hover:text-blue-700"
                      >
                        <span className="mr-2 text-xs text-slate-400">{c.indice + 1}</span>
                        {c.etiqueta}
                      </button>
                      {n === 0 ? (
                        <span className="text-xs text-slate-300">sin puntos</span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: colorError(resumen?.error_m ?? undefined) }}>
                          {n} pts{resumen?.error_m != null ? ` · ${(resumen.error_m * 100).toFixed(1)} cm` : ''}
                        </span>
                      )}
                      {n > 0 && (
                        <button
                          onClick={() => setMarcasCuerda((m) => m.filter((x) => x.cuerda !== c.indice))}
                          title="Borrar los puntos de esta corchera"
                          className="text-xs text-slate-400 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                El número es a qué distancia, a lo ancho, quedan los puntos de la línea que dibuja la calibración. Si una
                corchera da mucho, revisá que los puntos estén sobre ella y no sobre la de al lado.
              </p>
            </div>

            {/* llegada a la pared */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Llegada a la pared</h2>
              <p className="mt-1 text-xs text-slate-500">
                El sistema cuenta que el nadador llegó a la pared (viraje y largo) cuando cruza esta línea. Si la cámara no
                ve hasta la pared (por ejemplo, la tapa la baranda), corré la línea a un lugar donde el nadador todavía se
                vea, un poco antes de donde deja de verse. La hora de llegada a la pared se estima con su velocidad.
              </p>
              {(() => {
                const nodos = [...g.nodos_m].sort((a, b) => a - b)
                const lados: { clave: keyof Llegada; titulo: string; min: number; max: number; defecto: number }[] = [
                  { clave: 'inicio_m', titulo: `Pared de salida (${nodos[0]} m)`, min: nodos[0], max: nodos[1] - 0.5, defecto: nodos[0] + 1 },
                  {
                    clave: 'fin_m',
                    titulo: `Pared del fondo (${nodos[nodos.length - 1]} m)`,
                    min: nodos[nodos.length - 2] + 0.5,
                    max: nodos[nodos.length - 1],
                    defecto: nodos[nodos.length - 1] - 1,
                  },
                ]
                return lados.map((l) => {
                  const valor = llegada[l.clave]
                  return (
                    <div key={l.clave} className="mt-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={valor !== null}
                          onChange={(e) => {
                            const v = e.target.checked ? l.defecto : null
                            setLlegada((x) => ({ ...x, [l.clave]: v }))
                          }}
                        />
                        {l.titulo}: la cámara no la ve
                      </label>
                      {valor !== null ? (
                        <label className="mt-2 block text-xs text-slate-500">
                          Contar la llegada a {valor.toFixed(1)} m
                          <input
                            type="range"
                            min={l.min}
                            max={l.max}
                            step={0.1}
                            value={valor}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setLlegada((x) => ({ ...x, [l.clave]: v }))
                            }}
                            className="mt-1 w-full accent-cyan-500"
                          />
                        </label>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400">Se cuenta junto a la pared.</p>
                      )}
                    </div>
                  )
                })
              })()}
              <p className="mt-3 text-xs text-slate-400">La línea celeste sobre la imagen muestra dónde queda.</p>
            </div>

            {/* mapa de la piscina */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Mapa de puntos</h2>
              <p className="mt-1 text-xs text-slate-400">Vista desde arriba de la piscina. 0 m = pared de salida.</p>
              <svg viewBox={`-3 -1.6 ${g.largo_m + 6} ${ancho + 4.4}`} className="mt-3 w-full">
                <rect x={0} y={0} width={g.largo_m} height={ancho} fill="#eff6ff" stroke="#93c5fd" strokeWidth={0.12} />
                {Array.from({ length: g.n_carriles - 1 }, (_, i) => i + 1).map((k) => (
                  <line key={k} x1={0} x2={g.largo_m} y1={k * g.ancho_carril_m} y2={k * g.ancho_carril_m} stroke="#bfdbfe" strokeWidth={0.1} strokeDasharray="0.4 0.3" />
                ))}
                {Array.from({ length: g.n_carriles }, (_, i) => String(g.primer_carril + i)).map((n, i) => (
                  <text key={n} x={-0.4} y={i * g.ancho_carril_m + g.ancho_carril_m / 2 + 0.3} fontSize={0.9} textAnchor="end" fill="#94a3b8">
                    {n}
                  </text>
                ))}
                {g.nodos_m.map((x) => (
                  <text key={x} x={x} y={ancho + 1.4} fontSize={0.9} textAnchor="middle" fill="#64748b">
                    {x} m
                  </text>
                ))}
                {refs.map((r) => {
                  const hecho = marcas.some((m) => m.id === r.id)
                  const omitido = omitidos.includes(r.id)
                  const esObjetivo = r.id === objetivoId
                  const color = hecho ? colorErrorPx(ev.errorPxPorPunto[r.id]) : omitido ? '#e2e8f0' : '#ffffff'
                  return (
                    <g key={r.id} onClick={() => elegirObjetivo(r.id)} className="cursor-pointer">
                      {esObjetivo && <circle cx={r.mundo[0]} cy={r.mundo[1]} r={0.95} fill="none" stroke="#2563eb" strokeWidth={0.14} />}
                      <circle cx={r.mundo[0]} cy={r.mundo[1]} r={0.5} fill={color} stroke={hecho ? '#ffffff' : '#94a3b8'} strokeWidth={0.12} />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* precisión esperada */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Precisión esperada</h2>
              <p className="mt-1 text-xs text-slate-400">
                Con {config.camara.focal_mm} mm, {config.camara.altura_m} m de altura y {config.camara.distancia_borde_m} m al borde
                (ángulo de {dv.fovHorizontal.toFixed(0)}°). Cuánto se equivoca la posición por cada píxel mal marcado.
              </p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {precision.map((f) => (
                    <tr key={f.nodo_m} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-500">{f.nodo_m} m</td>
                      <td className="py-1.5 text-right font-medium">{f.cm_por_px.toFixed(1)} cm/px</td>
                      <td className="py-1.5 text-right text-xs text-slate-400">{f.s_por_px.toFixed(2)} s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">Los segundos son el error de tiempo para un nadador a 1,5 m/s.</p>
            </div>

            {/* lista de puntos */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Puntos</h2>
              <div className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {refs.map((r, i) => {
                  const hecho = marcas.some((m) => m.id === r.id)
                  const omitido = omitidos.includes(r.id)
                  const e = ev.errorPorPunto[r.id]
                  return (
                    <button
                      key={r.id}
                      onClick={() => elegirObjetivo(r.id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        r.id === objetivoId ? 'bg-blue-50 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                      <span className="flex-1">{r.etiqueta}</span>
                      {hecho ? (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: colorErrorPx(ev.errorPxPorPunto[r.id]) }}
                          title="Cuánto se aleja el clic de donde lo ubican los demás puntos (en píxeles) y cuánto es eso en la piscina"
                        >
                          ✓{ev.errorPxPorPunto[r.id] !== undefined ? ` ${ev.errorPxPorPunto[r.id].toFixed(1)} px` : ''}
                          {e !== undefined ? <span className="font-normal text-slate-400"> · {(e * 100).toFixed(0)} cm</span> : ''}
                        </span>
                      ) : omitido ? (
                        <span className="text-xs text-slate-400">no se ve</span>
                      ) : (
                        <span className="text-xs text-slate-300">pendiente</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="block text-sm font-medium text-slate-700">
                Nombre de esta posición de la cámara (opcional)
                <input
                  value={nombrePosicion}
                  maxLength={80}
                  placeholder="Por ejemplo: Tribuna, lado norte"
                  onChange={(e) => setNombrePosicion(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                />
              </label>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={guardarEnServidor}
                  disabled={!ev.H}
                  className="rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  Guardar calibración
                </button>
                {guardadaId && (
                  <Link
                    href={`/zonas?calibracion=${encodeURIComponent(guardadaId)}`}
                    className="rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Dibujar las zonas de esta posición →
                  </Link>
                )}
                <button
                  onClick={descargar}
                  disabled={!ev.H}
                  className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
                >
                  Descargar calibracion.json
                </button>
                {(marcas.length > 0 || omitidos.length > 0 || marcasCuerda.length > 0) && (
                  <button
                    onClick={() => {
                      setMarcas([])
                      setOmitidos([])
                      setMarcasCuerda([])
                      setObjetivo(null)
                      setModo('nodos')
                    }}
                    className="text-sm font-medium text-rose-500 hover:underline"
                  >
                    Empezar de nuevo
                  </button>
                )}
              </div>
              {ev.H && ev.nivel !== 'completo' && (
                <p className="mt-3 text-xs text-slate-400">Se puede guardar ya, pero conviene completar los {ev.total} puntos.</p>
              )}
            </div>

            {aviso && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

/** Trae de la API la configuración, los puntos a marcar y la precisión esperada; cuando está todo, muestra la pantalla. */
export function CalibracionEditor() {
  const { efectiva, error } = useConfiguracion()
  const [referencia, setReferencia] = useState<PuntosReferencia | null>(null)
  const [analisis, setAnalisis] = useState<Awaited<ReturnType<typeof api.analizarConfiguracion>> | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (!efectiva) return
    let vigente = true
    Promise.all([api.puntosReferencia(), api.analizarConfiguracion(efectiva.configuracion)])
      .then(([r, a]) => {
        if (!vigente) return
        setReferencia(r)
        setAnalisis(a)
      })
      .catch((e: Error) => vigente && setFallo(e.message))
    return () => {
      vigente = false
    }
  }, [efectiva])

  const problema = error ?? fallo
  if (problema) return <PantallaEstado mensaje={problema} error />
  if (!efectiva || !referencia || !analisis) return <PantallaEstado mensaje="Cargando…" />
  if (!analisis.derivados) {
    return <PantallaEstado mensaje="La configuración guardada no es válida: corregila en «Configuración de la piscina y la cámara»." error />
  }
  return <CalibracionPantalla referencia={referencia} config={efectiva.configuracion} precision={analisis.precision} derivados={analisis.derivados} />
}
