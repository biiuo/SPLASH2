'use client'

// El cuestionario inicial del nadador: una pregunta por pantalla, con un personaje que lo acompaña, barra de progreso,
// guardado progresivo (cada respuesta se guarda al continuar) y la opción de saltar preguntas o completarlo más tarde.
// Con ?editar (o si ya lo terminó) se abre por etapas, para cambiar solo una parte y actualizar la historia.
import { ArrowLeft, ArrowRight, Check, Pencil, SkipForward, Waves } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useEffect, useMemo, useState } from 'react'

import { Personaje } from '@/components/nadador/personaje'
import { FichaPerfil, RegistroTiempos, TablaMarcas } from '@/components/nadador/perfil-deportivo'
import { ErrorApi, api } from '@/lib/api'
import { useCuenta } from '@/lib/cuenta'
import { ETAPAS, opcionesDe, visibles, type Clave, type Opcion, type Pregunta } from '@/lib/perfil-nadador'
import type { RespuestasPerfil, VistaPerfil } from '@/lib/tipos'

type Pantalla = 'cargando' | 'bienvenida' | 'pregunta' | 'resumen' | 'etapas'

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const hoyIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudo conectar con el servidor.')

export default function Cuestionario({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = use(searchParams)
  const router = useRouter()
  const { usuario } = useCuenta()

  const [vista, setVista] = useState<VistaPerfil | null>(null)
  const [borrador, setBorrador] = useState<RespuestasPerfil>({})
  const [pantalla, setPantalla] = useState<Pantalla>('cargando')
  /** En edición: la etapa que se está cambiando (null = el cuestionario completo). */
  const [etapaEditando, setEtapaEditando] = useState<number | null>(null)
  const [indice, setIndice] = useState(0)
  const [direccion, setDireccion] = useState<1 | -1>(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    api
      .miPerfilDeportivo()
      .then((v) => {
        setVista(v)
        setBorrador(v.respuestas)
        if (editar !== undefined || v.estado === 'completo') setPantalla('etapas')
        else setPantalla('bienvenida')
      })
      .catch((e) => setError(mensajeDe(e)))
  }, [editar])

  const lista = useMemo(() => visibles(borrador, etapaEditando ?? undefined), [borrador, etapaEditando])
  const pregunta: Pregunta | undefined = lista[Math.min(indice, lista.length - 1)]
  const editando = etapaEditando !== null
  const nombre = usuario?.nombre.split(' ')[0] ?? ''

  function empezar() {
    if (!vista) return
    const todas = visibles(vista.respuestas)
    // retoma donde quedó (la etapa guardada es el índice de la pregunta)
    setEtapaEditando(null)
    setIndice(vista.estado === 'nuevo' ? 0 : Math.min(vista.etapa, Math.max(0, todas.length - 1)))
    setDireccion(1)
    setPantalla('pregunta')
  }

  function editarEtapa(n: number) {
    setEtapaEditando(n)
    setIndice(0)
    setDireccion(1)
    setAviso(null)
    setPantalla('pregunta')
  }

  /** Guarda la respuesta actual (si cambió) y pasa a la siguiente. `saltar` no guarda lo elegido. */
  async function avanzar(saltar = false) {
    if (!vista || !pregunta) return
    setError(null)
    const clave = pregunta.clave
    const cambios: Partial<Record<Clave, unknown>> = {}
    if (clave && !saltar && !igual(borrador[clave], vista.respuestas[clave])) cambios[clave] = borrador[clave] ?? null
    let respuestas = vista.respuestas
    if (saltar && clave) setBorrador((b) => ({ ...b, [clave]: vista.respuestas[clave] }))

    // en el cuestionario completo se guarda también por dónde va; en una edición, solo lo que cambia
    const siguiente = indice + 1
    if (Object.keys(cambios).length || !editando) {
      setGuardando(true)
      try {
        const v = await api.guardarPerfilDeportivo(cambios as RespuestasPerfil, editando ? undefined : siguiente)
        setVista(v)
        setBorrador(v.respuestas)
        respuestas = v.respuestas
      } catch (e) {
        setError(mensajeDe(e))
        setGuardando(false)
        return
      }
      setGuardando(false)
    }

    // la lista puede cambiar con la respuesta (por ejemplo, sin experiencia no se piden tiempos)
    const nueva = visibles(respuestas, etapaEditando ?? undefined)
    const aqui = nueva.findIndex((p) => p.id === pregunta.id)
    const proxima = (aqui === -1 ? indice : aqui) + 1
    if (proxima >= nueva.length) return void terminar()
    setDireccion(1)
    setIndice(proxima)
  }

  function atras() {
    setError(null)
    if (indice === 0) {
      setPantalla(editando ? 'etapas' : 'bienvenida')
      return
    }
    setDireccion(-1)
    setIndice(indice - 1)
  }

  async function terminar() {
    setGuardando(true)
    setError(null)
    try {
      const v = await api.finalizarPerfilDeportivo()
      setVista(v)
      setBorrador(v.respuestas)
      if (editando) {
        setAviso('Listo: tu perfil y tu historia deportiva se actualizaron.')
        setEtapaEditando(null)
        setPantalla('etapas')
      } else {
        setPantalla('resumen')
      }
    } catch (e) {
      // faltan datos obligatorios: se vuelve a la primera pregunta obligatoria sin contestar
      setError(mensajeDe(e))
      const todas = visibles(borrador, etapaEditando ?? undefined)
      const falta = todas.findIndex((p) => p.obligatoria && p.clave && borrador[p.clave] === undefined)
      if (falta >= 0) {
        setDireccion(-1)
        setIndice(falta)
      }
    } finally {
      setGuardando(false)
    }
  }

  async function masTarde() {
    try {
      await api.omitirPerfilDeportivo()
    } catch {
      // aunque falle, se lo deja salir: el cuestionario se puede retomar desde Mi perfil
    }
    router.push('/nadador')
  }

  // ---------------------------------------------------------------- pantallas

  const progreso = pantalla === 'pregunta' && lista.length ? (indice + 1) / lista.length : pantalla === 'resumen' ? 1 : 0
  const etapa = pregunta ? ETAPAS[pregunta.etapa - 1] : null

  return (
    <div className="min-h-screen bg-white text-[#123B5D]">
      <header className="sticky top-0 z-10 border-b border-[#F3F6F9] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          {/* sin enlace: con el cuestionario a medias, /nadador lo volvería a abrir (para salir está "Completar más tarde") */}
          <span className="flex items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#1677B8] text-white"><Waves className="size-4" /></span>
            <span>Safe<span className="text-[#36C5C9]">Splash</span></span>
          </span>
          {pantalla === 'pregunta' && !editando && (
            <button onClick={() => void masTarde()} className="rounded-xl px-3 py-2 text-sm font-semibold text-[#64748B] hover:bg-[#F3F6F9]">
              Completar más tarde
            </button>
          )}
          {(editando || pantalla === 'etapas') && (
            <Link href="/nadador/perfil" className="rounded-xl px-3 py-2 text-sm font-semibold text-[#64748B] hover:bg-[#F3F6F9]">Volver a Mi perfil</Link>
          )}
        </div>
        {/* barra de progreso */}
        <div className="h-1.5 bg-[#F3F6F9]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso * 100)} aria-label="Progreso del cuestionario">
          <div className="h-full rounded-r-full bg-gradient-to-r from-[#1677B8] to-[#36C5C9] transition-[width] duration-500" style={{ width: `${progreso * 100}%` }} />
        </div>
      </header>

      <main
        className={
          pantalla === 'pregunta' || pantalla === 'bienvenida'
            ? 'mx-auto flex min-h-[calc(100dvh-62px)] max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10 lg:py-8'
            : 'mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12'
        }
      >
        {pantalla === 'cargando' && !error && <p className="text-center text-sm text-[#64748B]">Cargando…</p>}
        {pantalla === 'cargando' && error && <p role="alert" className="text-center text-sm text-[#DC2626]">{error}</p>}

        {pantalla === 'bienvenida' && vista && (
          <section className="grid w-full items-center gap-6 md:grid-cols-[minmax(260px,40%)_1fr] lg:gap-14 animate-in fade-in duration-500">
            <div className="flex justify-center"><Personaje sexo={borrador.sexo} className="h-56 w-auto sm:h-72 md:h-[min(70dvh,640px)]" /></div>
            <div className="mx-auto max-w-2xl md:mx-0">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#36C5C9]">Hola{nombre ? `, ${nombre}` : ''}</p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">¡Comencemos a conocer tu historia como nadador!</h1>
              <p className="mt-4 text-base text-[#475569] lg:text-lg">
                Son unas preguntas cortas sobre tu experiencia, tus estilos, tus tiempos y tus objetivos. Con ellas armamos tu perfil
                deportivo y tu entrenador puede planificar mejor. Puedes saltar las que no quieras contestar y seguir más tarde.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-[#1677B8]">
                {ETAPAS.map((e) => <li key={e.n} className="rounded-full bg-[#D9F0FF] px-3 py-1">{e.corto}</li>)}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={empezar} className="inline-flex items-center gap-2 rounded-2xl bg-[#1677B8] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-[#1677B8]/25 transition hover:brightness-110">
                  {vista.estado === 'nuevo' ? 'Empezar' : 'Continuar donde quedé'} <ArrowRight className="size-5" />
                </button>
                <button onClick={() => void masTarde()} className="rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#64748B] hover:bg-[#F3F6F9]">
                  Completar más tarde
                </button>
              </div>
            </div>
          </section>
        )}

        {pantalla === 'pregunta' && vista && pregunta && (
          <section className="grid w-full items-center gap-4 sm:gap-6 md:grid-cols-[minmax(230px,34%)_1fr] lg:grid-cols-[minmax(300px,36%)_1fr] lg:gap-12">
            {/* celular: la muñeca chica arriba, junto a la etapa · computador: grande a la izquierda */}
            <aside className="flex items-center justify-center gap-4 md:sticky md:top-24 md:flex-col md:self-center">
              <Personaje sexo={borrador.sexo} className="h-28 w-auto sm:h-40 md:h-[min(60dvh,560px)] lg:h-[min(68dvh,640px)]" />
              {etapa && (
                <p className="rounded-2xl bg-[#F3F6F9] px-4 py-2 text-center text-xs font-semibold text-[#123B5D] md:mt-2 lg:text-sm">
                  {editando ? `Editando: ${etapa.titulo}` : `Etapa ${etapa.n} de ${ETAPAS.length} · ${etapa.titulo}`}
                </p>
              )}
            </aside>

            <form
              key={pregunta.id}
              onSubmit={(e) => {
                e.preventDefault()
                void avanzar()
              }}
              className={`flex w-full flex-col justify-center rounded-3xl border border-[#F3F6F9] bg-white p-5 shadow-[0_12px_40px_-20px_rgba(18,59,93,0.35)] sm:p-8 lg:min-h-[min(68dvh,640px)] lg:p-12 animate-in fade-in duration-300 ${direccion > 0 ? 'slide-in-from-right-8' : 'slide-in-from-left-8'}`}
            >
              <p className="text-xs font-semibold text-[#36C5C9] lg:text-sm">Pregunta {indice + 1} de {lista.length}{pregunta.obligatoria ? ' · obligatoria' : ''}</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-snug sm:text-3xl lg:text-4xl">{pregunta.titulo}</h2>
              {pregunta.ayuda && <p className="mt-2 text-sm text-[#64748B] lg:text-base">{pregunta.ayuda}</p>}

              <div className="mt-6 lg:mt-8">
                <Campo
                  pregunta={pregunta}
                  respuestas={borrador}
                  vista={vista}
                  cambiar={(v) => pregunta.clave && setBorrador((b) => ({ ...b, [pregunta.clave as Clave]: v }))}
                  alCambiarVista={setVista}
                />
              </div>

              {error && <p role="alert" className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

              {/* celular: Continuar a lo ancho y debajo Regresar | Omitir · computador: Regresar … Omitir Continuar */}
              <div className="mt-8 grid grid-cols-2 items-center gap-2 sm:flex sm:gap-3 lg:mt-10">
                <button
                  type="submit"
                  disabled={guardando || !contestada(pregunta, borrador)}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1677B8] px-6 py-3.5 text-base font-bold text-white shadow-md shadow-[#1677B8]/25 transition hover:brightness-110 disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:shadow-none sm:order-3 lg:px-8"
                >
                  {guardando ? 'Guardando…' : indice + 1 === lista.length ? (editando ? 'Guardar cambios' : 'Terminar') : 'Continuar'}
                  {!guardando && (indice + 1 === lista.length ? <Check className="size-4" /> : <ArrowRight className="size-4" />)}
                </button>
                <button type="button" onClick={atras} className="inline-flex items-center justify-start gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-[#64748B] hover:bg-[#F3F6F9] sm:order-1 sm:mr-auto">
                  <ArrowLeft className="size-4" /> Regresar
                </button>
                {!pregunta.obligatoria && pregunta.tipo !== 'tiempos' && (
                  <button type="button" disabled={guardando} onClick={() => void avanzar(true)} className="inline-flex items-center justify-end gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-[#64748B] hover:bg-[#F3F6F9] disabled:opacity-50 sm:order-2">
                    Omitir <SkipForward className="size-4" />
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {pantalla === 'resumen' && vista && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#36C5C9]">¡Listo!</p>
            <h1 className="mt-1 text-3xl font-extrabold">Mi perfil de nadador</h1>
            <p className="mt-2 text-[#64748B]">Esta es tu historia deportiva inicial. Se actualiza cuando registras tiempos nuevos o editas tus respuestas.</p>
            <div className="mt-6 rounded-3xl border border-[#F3F6F9] p-5 shadow-[0_12px_40px_-24px_rgba(18,59,93,0.35)] sm:p-7">
              <FichaPerfil vista={vista} />
            </div>
            {vista.marcas.length > 0 && (
              <div className="mt-6 rounded-3xl border border-[#F3F6F9] p-5 sm:p-7">
                <h2 className="mb-3 font-semibold">Mis marcas</h2>
                <TablaMarcas marcas={vista.marcas} />
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/nadador" className="inline-flex items-center gap-2 rounded-2xl bg-[#1677B8] px-6 py-3.5 font-bold text-white shadow-lg shadow-[#1677B8]/25 hover:brightness-110">
                Ir a mi resumen <ArrowRight className="size-5" />
              </Link>
              <button onClick={() => setPantalla('etapas')} className="inline-flex items-center gap-2 rounded-2xl bg-[#D9F0FF] px-5 py-3.5 text-sm font-semibold text-[#123B5D] hover:brightness-95">
                <Pencil className="size-4" /> Editar respuestas
              </button>
            </div>
          </section>
        )}

        {pantalla === 'etapas' && vista && (
          <section className="animate-in fade-in duration-300">
            <h1 className="text-3xl font-extrabold">Editar mi perfil</h1>
            <p className="mt-2 text-[#64748B]">
              Elige qué parte quieres actualizar. Solo se te preguntará esa parte, y al guardar se actualiza tu historia deportiva
              (la anterior queda en tu historial).
            </p>
            {aviso && <p role="status" className="mt-4 rounded-xl bg-[#ECFDF5] px-4 py-3 text-sm font-medium text-[#047857]">{aviso}</p>}
            {error && <p role="alert" className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ETAPAS.map((e) => {
                const ps = visibles(vista.respuestas, e.n)
                const hechas = ps.filter((p) => (p.clave ? vista.respuestas[p.clave] !== undefined : vista.tiempos.length > 0)).length
                return (
                  <button
                    key={e.n}
                    onClick={() => editarEtapa(e.n)}
                    className="group flex flex-col items-start rounded-2xl border border-[#E2E8F0] bg-[#F3F6F9] p-4 text-left transition hover:border-[#1677B8] hover:bg-[#D9F0FF]"
                  >
                    <span className="text-xs font-semibold text-[#36C5C9]">Etapa {e.n}</span>
                    <span className="mt-1 font-bold">{e.titulo}</span>
                    <span className="mt-2 text-xs text-[#64748B]">{hechas} de {ps.length} respondidas</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1677B8]"><Pencil className="size-3.5" /> Editar</span>
                  </button>
                )
              })}
            </div>
            {vista.estado !== 'completo' && (
              <button onClick={empezar} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#1677B8] px-6 py-3 text-sm font-bold text-white hover:brightness-110">
                Hacer el cuestionario completo <ArrowRight className="size-4" />
              </button>
            )}
            <div className="mt-8 rounded-3xl border border-[#F3F6F9] p-5 shadow-[0_12px_40px_-24px_rgba(18,59,93,0.35)] sm:p-7">
              <FichaPerfil vista={vista} />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

/** Una pregunta se puede continuar si está contestada (las de tiempos, siempre: se guardan solas). */
function contestada(p: Pregunta, r: RespuestasPerfil): boolean {
  if (p.tipo === 'tiempos' || !p.clave) return true
  const v = r[p.clave]
  if (v === undefined || v === null || v === '') return false
  return true
}

function Campo({
  pregunta: p,
  respuestas: r,
  vista,
  cambiar,
  alCambiarVista,
}: {
  pregunta: Pregunta
  respuestas: RespuestasPerfil
  vista: VistaPerfil
  cambiar: (v: unknown) => void
  alCambiarVista: (v: VistaPerfil) => void
}) {
  const valor = p.clave ? r[p.clave] : undefined
  const entrada = 'w-full rounded-2xl border-2 border-[#E2E8F0] bg-white px-4 py-3.5 text-lg font-semibold text-[#123B5D] outline-none transition focus:border-[#1677B8] focus:ring-4 focus:ring-[#D9F0FF]'

  if (p.tipo === 'tiempos') return <RegistroTiempos vista={vista} alCambiar={alCambiarVista} />

  if (p.tipo === 'fecha') {
    return <input type="date" autoFocus required min="1926-01-01" max={hoyIso()} value={(valor as string) ?? ''} onChange={(e) => cambiar(e.target.value || undefined)} className={`${entrada} max-w-xs`} />
  }

  if (p.tipo === 'numero') {
    return (
      <div className="flex max-w-xs items-center gap-3">
        <input
          type="number"
          autoFocus
          inputMode="decimal"
          min={p.min}
          max={p.max}
          value={valor === undefined ? '' : String(valor)}
          onChange={(e) => cambiar(e.target.value === '' ? undefined : Number(e.target.value))}
          className={entrada}
        />
        {p.unidad && <span className="text-lg font-semibold text-[#64748B]">{p.unidad}</span>}
      </div>
    )
  }

  if (p.tipo === 'texto') {
    return (
      <div>
        <textarea autoFocus rows={4} maxLength={p.max} value={(valor as string) ?? ''} onChange={(e) => cambiar(e.target.value || undefined)} className={`${entrada} text-base font-medium`} />
        {p.max && <p className="mt-1 text-right text-xs text-[#94A3B8]">{((valor as string) ?? '').length}/{p.max}</p>}
      </div>
    )
  }

  const opciones = opcionesDe(p, r)
  const multiple = p.tipo === 'multiple'
  const lista = Array.isArray(valor) ? (valor as unknown[]) : []
  const elegida = (o: Opcion) => (multiple ? (o.valor === p.ninguna ? Array.isArray(valor) && lista.length === 0 : lista.includes(o.valor)) : valor === o.valor)

  function tocar(o: Opcion) {
    if (!multiple) return cambiar(o.valor)
    if (o.valor === p.ninguna) return cambiar(elegida(o) ? undefined : [])
    const nueva = lista.includes(o.valor) ? lista.filter((x) => x !== o.valor) : [...lista, o.valor]
    cambiar(nueva.length ? nueva : undefined)
  }

  const conDetalle = opciones.some((o) => o.detalle)
  return (
    <div role={multiple ? 'group' : 'radiogroup'} aria-label={p.titulo} className={`grid gap-3 lg:gap-4 ${conDetalle ? 'sm:grid-cols-2' : opciones.length > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {opciones.map((o) => {
        const on = elegida(o)
        return (
          <button
            key={String(o.valor)}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => tocar(o)}
            className={`relative flex min-h-[3.5rem] flex-col items-start justify-center rounded-2xl border-2 px-4 py-3 text-left lg:min-h-[4.75rem] lg:px-5 transition active:scale-[0.98] ${
              on ? 'border-[#1677B8] bg-[#D9F0FF] shadow-md shadow-[#1677B8]/10' : 'border-[#E2E8F0] bg-[#F3F6F9] hover:border-[#9CCFF0] hover:bg-white'
            }`}
          >
            <span className="pr-7 text-sm font-bold text-[#123B5D] sm:text-base lg:text-lg">{o.texto}</span>
            {o.detalle && <span className="mt-0.5 pr-7 text-xs text-[#64748B] lg:text-sm">{o.detalle}</span>}
            <span
              className={`absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center ${multiple ? 'rounded-md' : 'rounded-full'} border-2 transition ${
                on ? 'border-[#1677B8] bg-[#1677B8] text-white' : 'border-[#CBD5E1] bg-white'
              }`}
              aria-hidden="true"
            >
              {on && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
