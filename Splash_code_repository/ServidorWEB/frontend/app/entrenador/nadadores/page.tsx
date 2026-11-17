'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { carrilesDe, metricas, useDatosEntrenador } from '@/components/entrenador/datos'
import { GrupoPanel } from '@/components/grupo-panel'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, Tarjeta } from '@/components/nadador/ui'
import { fechaCorta, formatearMetros, formatearSegundos, formatearVel } from '@/lib/largos'
import { cumplimiento } from '@/lib/objetivos'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const POR_PAGINA = 10

/** Mis nadadores: los de mis grupos, con sus estadísticas, y la gestión de los grupos. */
export default function MisNadadores() {
  const { datos, problema, recargar } = useDatosEntrenador()
  const [texto, setTexto] = useState('')
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
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas)

  return (
    <>
      <Encabezado titulo="Mis nadadores" bajada="Los nadadores de tus grupos: su rendimiento, sus mejores marcas y sus objetivos." />
      {problema && <div className="mb-6"><Aviso tipo="error">{problema}</Aviso></div>}

      <Tarjeta titulo="Listado">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 focus-within:border-[#2563EB]">
            <Search className="size-4 text-[#94A3B8]" />
            <input value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1) }} placeholder="Buscar por nombre o correo" className="flex-1 text-sm outline-none" aria-label="Buscar nadador" />
          </label>
          <select value={grupo} onChange={(e) => { setGrupo(e.target.value); setPagina(1) }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Filtrar por grupo">
            <option value="">Todos mis grupos</option>
            {datos?.grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        {!datos && !problema && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {datos && filas.length === 0 && <Aviso>{datos.nadadores.length ? 'Ningún nadador coincide.' : 'Todavía no tenés nadadores: sumalos a un grupo por su correo (abajo).'}</Aviso>}
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
                    <td className="py-3 pr-4"><p className="font-medium">{n.nombre}</p><p className="text-xs text-[#94A3B8]">{n.email}{n.telefono ? ` · ${n.telefono}` : ''}</p></td>
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

      <div className="mt-6">
        <GrupoPanel alCambiar={() => void recargar()} />
      </div>
    </>
  )
}
