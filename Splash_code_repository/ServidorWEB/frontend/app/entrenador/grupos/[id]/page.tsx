'use client'

import { Activity, ArrowLeft, Clock, Gauge, Settings2, Timer, Trash2, UserMinus, Waves } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useState } from 'react'

import { BuscadorNadador } from '@/components/buscador-nadador'
import { carrilesDe, desdePeriodo, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { DIAS, DiasSemana, FondoAgua, NIVELES, Nivel, textoHorario } from '@/components/entrenador/grupos-ui'
import { Barras } from '@/components/graficos'
import { Aviso, BOTON, CAMPO, Kpi, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { formatearMetros, formatearSegundos, formatearVel } from '@/lib/largos'
import type { DiaSemana, Grupo, NivelGrupo } from '@/lib/tipos'

const PERIODOS: [string, string][] = [['30', '30 días'], ['90', '3 meses'], ['365', '1 año'], ['todo', 'Todo']]

/** Un grupo: su configuración, sus nadadores (acá se suman y se sacan) y sus estadísticas, del grupo e individuales. */
export default function DetalleGrupo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { datos, problema, recargar } = useDatosEntrenador()
  const [periodo, setPeriodo] = useState('30')
  const [aviso, setAviso] = useState<{ tipo: 'info' | 'error'; texto: string } | null>(null)
  const [configurando, setConfigurando] = useState(false)
  const g = datos?.grupos.find((x) => x.id === id) ?? null

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setAviso(null)
    try {
      await accion()
      setAviso({ tipo: 'info', texto: ok })
      await recargar()
      return true
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof ErrorApi ? [e.message, ...e.detalles].join(' ') : 'No se pudo hacer el cambio.' })
      return false
    }
  }

  if (problema) return <Aviso tipo="error">{problema}</Aviso>
  if (!datos) return <p className="text-sm text-[#64748B]">Cargando…</p>
  if (!g) return <Aviso>Ese grupo no existe o no es tuyo. <Link href="/entrenador/grupos" className="underline">Volver a mis grupos</Link></Aviso>

  // estadísticas del grupo: sus entrenamientos (sesiones de este grupo) en el período
  const desde = desdePeriodo(periodo)
  const sesionesGrupo = datos.sesiones.filter((s) => s.grupo_id === g.id && s.estado !== 'cancelada' && Date.parse(s.inicio) >= desde)
  const filasGrupo = sesionesGrupo.flatMap((s) => s.por_carril.map((c) => ({ sesion: s, carril: c })))
  const mg = metricas(filasGrupo)
  const individuales = g.nadadores
    .map((n) => ({ n, m: metricas(carrilesDe(n.usuario_id, sesionesGrupo)) }))
    .sort((a, b) => b.m.distancia_m - a.m.distancia_m)

  return (
    <>
      <Link href="/entrenador/grupos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline"><ArrowLeft className="size-4" /> Mis grupos</Link>

      <FondoAgua paleta={Math.max(0, datos.grupos.findIndex((x) => x.id === g.id))} className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{g.nombre}</h1>
              <Nivel n={g.nivel} claro />
            </div>
            {g.descripcion && <p className="mt-2 max-w-2xl text-blue-100">{g.descripcion}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <DiasSemana h={g.horario} claro />
              <span className="inline-flex items-center gap-1.5 text-sm text-blue-100"><Clock className="size-4" />{textoHorario(g.horario) ?? 'Sin horario de clases'}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-6xl font-bold leading-none">{g.nadadores.length}</p>
            <p className="mt-1 text-sm text-blue-100">{g.nadadores.length === 1 ? 'nadador' : 'nadadores'}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setConfigurando(!configurando)} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25">
            <Settings2 className="size-4" /> {configurando ? 'Cerrar configuración' : 'Configurar grupo'}
          </button>
          <button
            onClick={async () => {
              if (window.confirm(`¿Borrar el grupo "${g.nombre}"? Los nadadores no se borran.`) && (await hacer(() => api.borrarGrupo(g.id), 'Grupo borrado.'))) router.push('/entrenador/grupos')
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500/80"
          >
            <Trash2 className="size-4" /> Borrar
          </button>
        </div>
      </FondoAgua>

      {aviso && <div className="mt-4"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div>}
      {configurando && <Configuracion g={g} guardar={(d) => hacer(() => api.actualizarGrupo(g.id, d), 'Grupo actualizado.')} cerrar={() => setConfigurando(false)} />}

      {/* nadadores del grupo: acá se suman y se sacan */}
      <Tarjeta className="mt-6" titulo="Nadadores del grupo" subtitulo="Buscá por correo o nombre y elegí de la lista para sumarlo.">
        <BuscadorNadador
          excluir={g.nadadores.map((n) => n.id)}
          alElegir={(n) => hacer(() => api.agregarAGrupo(g.id, n.id), `${n.nombre} está ahora en "${g.nombre}".`)}
          alEscribirCorreo={(c) => hacer(() => api.agregarAGrupoPorEmail(g.id, c), `Nadador agregado a "${g.nombre}".`)}
        />
        {g.nadadores.length === 0 ? <div className="mt-4"><Aviso>Todavía no hay nadadores en este grupo.</Aviso></div> : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {g.nadadores.map((n) => (
              <li key={n.id} className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] text-sm font-bold text-white">
                  {n.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                </span>
                <Link href={`/entrenador/nadadores/${n.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-sm font-medium text-[#0F172A]">{n.nombre}</span>
                  <span className="block truncate text-xs text-[#94A3B8]">{n.email}{n.telefono ? ` · ${n.telefono}` : ''}</span>
                </Link>
                <button onClick={() => void hacer(() => api.quitarDeGrupo(g.id, n.id), `${n.nombre} salió del grupo.`)} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]" aria-label={`Sacar a ${n.nombre} del grupo`}>
                  <UserMinus className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {/* estadísticas */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">Estadísticas del grupo</h2>
          <p className="text-sm text-[#64748B]">De los entrenamientos de este grupo ({sesionesGrupo.length} {sesionesGrupo.length === 1 ? 'sesión' : 'sesiones'} en el período).</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {PERIODOS.map(([v, t]) => <button key={v} onClick={() => setPeriodo(v)} aria-pressed={periodo === v} className={periodo === v ? BOTON.primario : BOTON.terciario}>{t}</button>)}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icono={Waves} etiqueta="Distancia del grupo" valor={Math.round(mg.distancia_m).toLocaleString('es-CO')} unidad="m" />
        <Kpi icono={Gauge} etiqueta="Velocidad media" valor={mg.velocidad_media_ms ? mg.velocidad_media_ms.toFixed(2) : '—'} unidad="m/s" />
        <Kpi icono={Timer} etiqueta="Mejor largo del grupo" valor={formatearSegundos(mg.mejor_largo_s)} nota="largo detectado" />
        <Kpi icono={Activity} etiqueta="Largos completos" valor={String(mg.largos)} />
      </div>

      {individuales.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Tarjeta titulo="Distancia por nadador" subtitulo="Metros en los entrenamientos del grupo.">
            <Barras
              datos={individuales.map(({ n, m }) => ({ clave: n.id, etiqueta: n.nombre.split(' ')[0], valor: Math.round(m.distancia_m), detalle: [formatearMetros(m.distancia_m), n.nombre, `${m.sesiones} sesiones`] }))}
              formatoY={(v) => `${v} m`}
              etiquetaX="nadador"
              descripcion="Distancia por nadador del grupo"
            />
          </Tarjeta>
          <Tarjeta titulo="Estadísticas individuales" subtitulo="Cada nadador, en los entrenamientos de este grupo.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wider text-[#94A3B8]"><tr><th className="py-2 pr-4">Nadador</th><th className="py-2 pr-4 text-right">Sesiones</th><th className="py-2 pr-4 text-right">Distancia</th><th className="py-2 pr-4 text-right">Vel. media</th><th className="py-2 pr-4 text-right">Mejor vel.</th><th className="py-2 text-right">Mejor largo</th></tr></thead>
                <tbody>
                  {individuales.map(({ n, m }) => (
                    <tr key={n.id} className="border-t border-[#F1F5F9]">
                      <td className="py-2.5 pr-4"><Link href={`/entrenador/nadadores/${n.id}`} className="font-medium text-[#1D4ED8] hover:underline">{n.nombre}</Link></td>
                      <td className="py-2.5 pr-4 text-right">{m.sesiones}</td>
                      <td className="py-2.5 pr-4 text-right">{formatearMetros(m.distancia_m)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatearVel(m.velocidad_media_ms)}</td>
                      <td className="py-2.5 pr-4 text-right">{formatearVel(m.velocidad_max_ms)}</td>
                      <td className="py-2.5 text-right">{formatearSegundos(m.mejor_largo_s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </div>
      )}
    </>
  )
}

/** Nombre, descripción, nivel y horario de clases del grupo. */
function Configuracion({
  g,
  guardar,
  cerrar,
}: {
  g: Grupo
  guardar: (d: Parameters<typeof api.actualizarGrupo>[1]) => Promise<boolean>
  cerrar: () => void
}) {
  const [nombre, setNombre] = useState(g.nombre)
  const [descripcion, setDescripcion] = useState(g.descripcion ?? '')
  const [nivel, setNivel] = useState<NivelGrupo | ''>(g.nivel ?? '')
  const [dias, setDias] = useState<DiaSemana[]>(g.horario?.dias ?? [])
  const [inicio, setInicio] = useState(g.horario?.inicio ?? '06:00')
  const [fin, setFin] = useState(g.horario?.fin ?? '07:30')

  return (
    <Tarjeta className="mt-4" titulo="Configuración del grupo">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const ok = await guardar({
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            nivel: nivel || null,
            horario: dias.length ? { dias, inicio, fin } : null,
          })
          if (ok) cerrar()
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <label className="text-sm text-[#64748B]">Nombre<input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} /></label>
        <label className="text-sm text-[#64748B]">
          Nivel
          <select value={nivel} onChange={(e) => setNivel(e.target.value as NivelGrupo | '')} className={CAMPO}>
            <option value="">Sin nivel</option>
            {NIVELES.map((n) => <option key={n.id} value={n.id}>{n.texto}</option>)}
          </select>
        </label>
        <label className="text-sm text-[#64748B] md:col-span-2">Descripción<input maxLength={200} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Por ejemplo: técnica de crol y resistencia" className={CAMPO} /></label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm text-[#64748B]">Horario de clases</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {DIAS.map((d) => {
              const on = dias.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDias(on ? dias.filter((x) => x !== d.id) : [...dias, d.id])}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${on ? 'bg-[#2563EB] text-white' : 'bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]'}`}
                >
                  {d.largo}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#64748B]">Desde<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} /></label>
            <label className="text-sm text-[#64748B]">Hasta<input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className={CAMPO} /></label>
            {!dias.length && <span className="pb-3 text-xs text-[#94A3B8]">Sin días elegidos, el grupo queda sin horario.</span>}
          </div>
        </fieldset>
        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className={BOTON.primario}>Guardar</button>
          <button type="button" onClick={cerrar} className={BOTON.terciario}>Cancelar</button>
        </div>
      </form>
    </Tarjeta>
  )
}
