'use client'

import { Search, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { carrilesDe, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { FondoAgua } from '@/components/entrenador/grupos-ui'
import { Aviso, BOTON, Tarjeta } from '@/components/nadador/ui'
import { fechaCorta, formatearMetros, formatearSegundos, formatearVel } from '@/lib/largos'
import { cumplimiento } from '@/lib/objetivos'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const POR_PAGINA = 10

/**
 * Mis nadadores: todos los de mis grupos, de a 10 por página, con sus estadísticas. La búsqueda autocompleta por
 * correo o nombre y lleva al perfil. Los nadadores se suman desde cada grupo (Mis grupos).
 */
export default function MisNadadores() {
  const router = useRouter()
  const { datos, problema } = useDatosEntrenador()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)
  const [grupo, setGrupo] = useState('')
  const [pagina, setPagina] = useState(1)

  const filas = useMemo(() => {
    if (!datos) return []
    const q = normal(texto.trim())
    return datos.nadadores
      .filter((n) => !grupo || n.mis_grupos.includes(grupo))
      .filter((n) => !q || normal(n.nombre).includes(q) || normal(n.email ?? '').includes(q))
      .map((n) => {
        const m = metricas(carrilesDe(n.usuario_id, datos.sesiones))
        const objetivos = datos.objetivos.filter((o) => o.nadador_id === n.id)
        const pendientes = objetivos.filter((o) => !cumplimiento(o, datos.sesiones).alcanzado).length
        return { n, m, objetivos: objetivos.length, pendientes }
      })
  }, [datos, texto, grupo])
  const sugerencias = texto.trim().length >= 2 ? filas.slice(0, 6) : []
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas)

  return (
    <>
      <FondoAgua paleta={4} className="mb-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mis nadadores</h1>
            <p className="mt-1 max-w-xl text-blue-100">Todos los nadadores de tus grupos: su rendimiento, sus mejores marcas y sus objetivos.</p>
          </div>
          <div className="flex gap-8">
            <div className="text-right"><p className="text-5xl font-bold leading-none">{datos?.nadadores.length ?? '…'}</p><p className="mt-1 text-sm text-blue-100">nadadores</p></div>
            <div className="text-right"><p className="text-5xl font-bold leading-none">{datos?.grupos.length ?? '…'}</p><p className="mt-1 text-sm text-blue-100">grupos</p></div>
          </div>
        </div>
        <Link href="/entrenador/grupos" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25">
          <UsersRound className="size-4" /> Sumar nadadores en Mis grupos
        </Link>
      </FondoAgua>
      {problema && <div className="mb-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <Tarjeta titulo="Listado">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <label className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-[#EFF6FF]">
              <Search className="size-4 text-[#94A3B8]" />
              <input
                role="combobox"
                aria-expanded={abierto && sugerencias.length > 0}
                aria-controls="sugerencias-nadadores"
                aria-autocomplete="list"
                value={texto}
                onChange={(e) => { setTexto(e.target.value); setPagina(1); setAbierto(true); setActiva(-1) }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setTimeout(() => setAbierto(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiva((a) => Math.min(a + 1, sugerencias.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setActiva((a) => Math.max(a - 1, -1)) }
                  else if (e.key === 'Enter' && activa >= 0 && sugerencias[activa]) router.push(`/entrenador/nadadores/${sugerencias[activa].n.id}`)
                  else if (e.key === 'Escape') setAbierto(false)
                }}
                placeholder="Buscar por correo o nombre"
                autoComplete="off"
                className="flex-1 text-sm outline-none"
                aria-label="Buscar nadador por correo o nombre"
              />
            </label>
            {abierto && sugerencias.length > 0 && (
              <ul id="sugerencias-nadadores" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
                {sugerencias.map(({ n }, i) => (
                  <li
                    key={n.id}
                    role="option"
                    aria-selected={i === activa}
                    onMouseDown={(e) => { e.preventDefault(); router.push(`/entrenador/nadadores/${n.id}`) }}
                    onMouseEnter={() => setActiva(i)}
                    className={`cursor-pointer px-3 py-2 text-sm ${i === activa ? 'bg-[#EFF6FF]' : ''}`}
                  >
                    <span className="block font-medium text-[#0F172A]">{n.email ?? n.nombre}</span>
                    <span className="block text-xs text-[#64748B]">{n.nombre}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select value={grupo} onChange={(e) => { setGrupo(e.target.value); setPagina(1) }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por grupo">
            <option value="">Todos mis grupos</option>
            {datos?.grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        {!datos && !problema && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {datos && filas.length === 0 && <Aviso>{datos.nadadores.length ? 'Ningún nadador coincide.' : 'Todavía no tenés nadadores: sumalos desde Mis grupos.'}</Aviso>}
        {filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm tabular-nums">
              <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <th className="py-2 pr-4">Nadador</th><th className="py-2 pr-4 text-right">Sesiones</th><th className="py-2 pr-4 text-right">Distancia</th>
                  <th className="py-2 pr-4 text-right">Vel. media</th><th className="py-2 pr-4 text-right">Mejor velocidad</th><th className="py-2 pr-4 text-right">Mejor largo</th>
                  <th className="py-2 pr-4">Última</th><th className="py-2 pr-4">Objetivos</th><th className="py-2"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA).map(({ n, m, objetivos, pendientes }) => (
                  <tr key={n.id} className="border-t border-[#F1F5F9]">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{n.nombre}</p>
                      <p className="text-xs text-[#94A3B8]">{n.email}{n.telefono ? ` · ${n.telefono}` : ''}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {datos?.grupos.filter((g) => n.mis_grupos.includes(g.id)).map((g) => (
                          <Link key={g.id} href={`/entrenador/grupos/${g.id}`} className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]">{g.nombre}</Link>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">{m.sesiones}</td>
                    <td className="py-3 pr-4 text-right">{formatearMetros(m.distancia_m)}</td>
                    <td className="py-3 pr-4 text-right">{formatearVel(m.velocidad_media_ms)}</td>
                    <td className="py-3 pr-4 text-right">{formatearVel(m.velocidad_max_ms)}</td>
                    <td className="py-3 pr-4 text-right">{formatearSegundos(m.mejor_largo_s)}</td>
                    <td className="py-3 pr-4">{m.ultima ? fechaCorta(m.ultima) : '—'}</td>
                    <td className="py-3 pr-4">{objetivos ? `${objetivos - pendientes} de ${objetivos} alcanzados` : '—'}</td>
                    <td className="py-3 text-right"><Link href={`/entrenador/nadadores/${n.id}`} className={`${BOTON.primario} px-3 py-1.5 text-xs`}>Ver perfil</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filas.length > POR_PAGINA && (
          <div className="mt-4 flex items-center justify-between text-sm text-[#64748B]">
            <span>{(actual - 1) * POR_PAGINA + 1}–{Math.min(actual * POR_PAGINA, filas.length)} de {filas.length}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina(actual - 1)} disabled={actual <= 1} className={`${BOTON.terciario} px-3 py-1.5`}>Anterior</button>
              <button onClick={() => setPagina(actual + 1)} disabled={actual >= paginas} className={`${BOTON.terciario} px-3 py-1.5`}>Siguiente</button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-[#94A3B8]">Las estadísticas salen de las sesiones que iniciaste vos; las sesiones personales de cada nadador son privadas.</p>
      </Tarjeta>

    </>
  )
}
