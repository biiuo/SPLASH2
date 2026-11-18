'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { conErrores, estimadosDe, tramosDe } from '@/components/admin/comun'
import { Encabezado } from '@/components/nadador/shell'
import { Aviso, BOTON, CAMPO, EstadoSesion, Tarjeta } from '@/components/nadador/ui'
import { ErrorApi, api } from '@/lib/api'
import { fechaCorta, formatearMetros, formatearVel, horaCorta } from '@/lib/largos'
import { formatearDuracion } from '@/lib/resultados'
import type { ResumenSesion, Sesion } from '@/lib/tipos'
import { useParametroUrl } from '@/shared/hooks/use-parametro-url'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const INICIAL = { nadador: '', entrenador: '', dia: '', estado: '' as '' | Sesion['estado'], errores: false }

/**
 * Las sesiones que puede ver quien mira (el backend filtra: el administrador ve todas; el entrenador, las que inició),
 * con filtros, errores de detección y registros estimados. `base`: a dónde lleva "Ver detalles".
 */
export function ListaSesiones({ base, titulo, bajada }: { base: string; titulo: string; bajada: string }) {
  const [sesiones, setSesiones] = useState<ResumenSesion[] | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [f, setF] = useState(INICIAL)
  const usuarioUrl = useParametroUrl('usuario')
  const [usuarioElegido, setUsuario] = useState<string | null | undefined>(undefined)
  const usuario = usuarioElegido === undefined ? usuarioUrl : usuarioElegido
  const [pagina, setPagina] = useState(1)
  const porPagina = 20

  useEffect(() => {
    api.sesionesRecientes(500).then(setSesiones).catch((e) => setProblema(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las sesiones.'))
  }, [])

  const visibles = useMemo(() => {
    if (!sesiones) return null
    return sesiones.filter((s) => {
      if (usuario && !s.por_carril.some((c) => c.usuario_id === usuario)) return false
      if (f.nadador && !s.por_carril.some((c) => normal(c.nadador ?? '').includes(normal(f.nadador)))) return false
      if (f.entrenador && !normal(s.iniciada_por ?? '').includes(normal(f.entrenador))) return false
      if (f.estado && s.estado !== f.estado) return false
      if (f.errores && !conErrores(s)) return false
      if (f.dia) {
        const d = new Date(s.inicio)
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (local !== f.dia) return false
      }
      return true
    })
  }, [sesiones, f, usuario])

  useEffect(() => setPagina(1), [f, usuario])

  const totalPaginas = visibles ? Math.max(1, Math.ceil(visibles.length / porPagina)) : 1
  const paginaSegura = Math.min(pagina, totalPaginas)
  const paginadas = visibles?.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina) ?? []

  const cambiado = JSON.stringify(f) !== JSON.stringify(INICIAL) || !!usuario
  return (
    <>
      <Encabezado titulo={titulo} bajada={bajada} />
      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] lg:items-end">
          <label className="text-sm text-[#64748B]">Nadador<input value={f.nadador} onChange={(e) => setF({ ...f, nadador: e.target.value })} className={CAMPO} placeholder="Nombre" /></label>
          <label className="text-sm text-[#64748B]">Entrenador<input value={f.entrenador} onChange={(e) => setF({ ...f, entrenador: e.target.value })} className={CAMPO} placeholder="Quién la inició" /></label>
          <label className="text-sm text-[#64748B]">Fecha<input type="date" value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} className={CAMPO} /></label>
          <label className="text-sm text-[#64748B]">
            Estado
            <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as typeof f.estado })} className={CAMPO}>
              <option value="">Todos</option>
              <option value="activa">En curso</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-[#64748B]"><input type="checkbox" checked={f.errores} onChange={(e) => setF({ ...f, errores: e.target.checked })} /> Solo con errores</label>
          <button onClick={() => { setF(INICIAL); setUsuario(null) }} disabled={!cambiado} className={BOTON.terciario}>Limpiar filtros</button>
        </div>
        {usuario && <p className="mt-3 text-xs text-[#64748B]">Mostrando las sesiones de un nadador.</p>}
      </Tarjeta>

      <Tarjeta className="mt-6" titulo="Sesiones" subtitulo={visibles ? `${visibles.length} de ${sesiones?.length ?? 0} (las 500 más recientes)` : undefined}>
        {problema && <Aviso tipo="error">{problema}</Aviso>}
        {!problema && visibles === null && <p className="text-sm text-[#64748B]">Cargando…</p>}
        {visibles?.length === 0 && <Aviso>Ninguna sesión coincide.</Aviso>}
        {!!visibles?.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm tabular-nums">
              <thead className="text-xs uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Fecha</th>
                  <th className="py-2 pr-4 font-semibold">Iniciada por</th>
                  <th className="py-2 pr-4 font-semibold">Nadadores</th>
                  <th className="py-2 pr-4 font-semibold">Duración</th>
                  <th className="py-2 pr-4 text-right font-semibold">Distancia</th>
                  <th className="py-2 pr-4 text-right font-semibold">Velocidad</th>
                  <th className="py-2 pr-4 text-right font-semibold">Largos</th>
                  <th className="py-2 pr-4 text-right font-semibold">Detectados / estimados</th>
                  <th className="py-2 pr-4 font-semibold">Estado</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {paginadas.map((s) => {
                  const t = tramosDe(s)
                  const e = estimadosDe(s)
                  return (
                    <tr key={s.id} className="border-t border-[#F1F5F9]">
                      <td className="py-3 pr-4">{fechaCorta(s.inicio)} <span className="text-[#94A3B8]">{horaCorta(s.inicio)}</span></td>
                      <td className="py-3 pr-4">{s.iniciada_por ?? '—'}{s.grupo && <span className="block text-xs text-[#94A3B8]">{s.grupo}</span>}</td>
                      <td className="py-3 pr-4 text-xs">{s.por_carril.map((c) => `${c.carril}: ${c.nadador ?? '—'}`).join(' · ') || '—'}</td>
                      <td className="py-3 pr-4">{s.fin ? formatearDuracion(Date.parse(s.fin) - Date.parse(s.inicio)) : '—'}</td>
                      <td className="py-3 pr-4 text-right">{formatearMetros(s.distancia_m)}</td>
                      <td className="py-3 pr-4 text-right">{formatearVel(s.velocidad_media_ms)}</td>
                      <td className="py-3 pr-4 text-right">{s.por_carril.reduce((a, c) => a + c.largos, 0)}</td>
                      <td className="py-3 pr-4 text-right">{t - e} / <span className={e ? 'text-[#C2410C]' : ''}>{e}</span></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col items-start gap-1">
                          <EstadoSesion estado={s.estado} />
                          {conErrores(s) && <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-semibold text-[#B91C1C]">Error de detección</span>}
                        </div>
                      </td>
                      <td className="py-3 text-right"><Link href={`${base}/${s.id}`} className={`${BOTON.primario} px-3 py-1.5 text-xs`}>Ver detalles</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!visibles?.length && totalPaginas > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-4">
            <p className="text-xs text-[#64748B]">
              {(paginaSegura - 1) * porPagina + 1}-{Math.min(paginaSegura * porPagina, visibles.length)} de {visibles.length}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPagina(paginaSegura - 1)} disabled={paginaSegura === 1} className={BOTON.terciario}>Anterior</button>
              <span className="text-xs font-semibold text-[#475569]">Página {paginaSegura} de {totalPaginas}</span>
              <button type="button" onClick={() => setPagina(paginaSegura + 1)} disabled={paginaSegura === totalPaginas} className={BOTON.terciario}>Siguiente</button>
            </div>
          </div>
        )}
      </Tarjeta>
    </>
  )
}
