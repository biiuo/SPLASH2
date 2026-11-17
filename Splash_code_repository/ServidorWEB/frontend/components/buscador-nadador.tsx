'use client'

import { UserPlus } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { api } from '@/lib/api'
import type { Nadador } from '@/lib/tipos'

/**
 * Campo para sumar un nadador a un grupo: mientras se escribe (desde 3 letras) sugiere nadadores por correo o nombre.
 * Se elige con el mouse o con ↑ ↓ y Enter. Si no se elige ninguno, Enter usa el correo escrito tal cual.
 * `excluir`: ids que ya están en el grupo (no se sugieren).
 */
export function BuscadorNadador({
  alElegir,
  alEscribirCorreo,
  excluir = [],
  deshabilitado = false,
  placeholder = 'Correo o nombre del nadador',
}: {
  alElegir: (n: Nadador) => unknown
  alEscribirCorreo: (email: string) => unknown
  excluir?: string[]
  deshabilitado?: boolean
  placeholder?: string
}) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [sugerencias, setSugerencias] = useState<Nadador[]>([])
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(-1)
  const [buscando, setBuscando] = useState(false)
  const pedido = useRef(0)

  // busca un ratito después de dejar de escribir; descarta respuestas viejas
  useEffect(() => {
    const t = texto.trim()
    if (t.length < 3) {
      setSugerencias([])
      return
    }
    const n = ++pedido.current
    setBuscando(true)
    const espera = setTimeout(() => {
      api
        .sugerirNadadores(t)
        .then((r) => {
          if (n !== pedido.current) return
          setSugerencias(r.filter((x) => !excluir.includes(x.id)))
          setActiva(-1)
        })
        .catch(() => n === pedido.current && setSugerencias([]))
        .finally(() => n === pedido.current && setBuscando(false))
    }, 250)
    return () => clearTimeout(espera)
    // excluir cambia de identidad en cada render del padre; alcanza con el texto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  async function elegir(n: Nadador) {
    setAbierto(false)
    setTexto('')
    setSugerencias([])
    await alElegir(n)
  }

  async function confirmar() {
    if (activa >= 0 && sugerencias[activa]) return elegir(sugerencias[activa])
    const t = texto.trim()
    if (t.includes('@')) {
      setAbierto(false)
      setTexto('')
      await alEscribirCorreo(t)
    }
  }

  const visible = abierto && texto.trim().length >= 3
  return (
    <div className="relative flex gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          role="combobox"
          aria-expanded={visible}
          aria-controls={`${id}-lista`}
          aria-activedescendant={activa >= 0 ? `${id}-op-${activa}` : undefined}
          aria-autocomplete="list"
          aria-label="Nadador a agregar: correo o nombre"
          value={texto}
          disabled={deshabilitado}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAbierto(true)
              setActiva((a) => Math.min(a + 1, sugerencias.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiva((a) => Math.max(a - 1, -1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              void confirmar()
            } else if (e.key === 'Escape') {
              setAbierto(false)
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        {visible && (
          <ul id={`${id}-lista`} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {buscando && sugerencias.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Buscando…</li>}
            {!buscando && sugerencias.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">
                {texto.includes('@') ? 'Ninguna cuenta coincide. Enter para intentar con este correo.' : 'Ningún nadador coincide.'}
              </li>
            )}
            {sugerencias.map((n, i) => (
              <li
                key={n.id}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === activa}
                onMouseDown={(e) => {
                  e.preventDefault() // que el input no pierda el foco antes del click
                  void elegir(n)
                }}
                onMouseEnter={() => setActiva(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === activa ? 'bg-blue-50' : ''}`}
              >
                <span className="block font-medium text-slate-900">{n.nombre}</span>
                <span className="block text-xs text-slate-500">{n.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={() => void confirmar()}
        disabled={deshabilitado || (!texto.includes('@') && activa < 0)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <UserPlus className="size-3.5" /> Agregar
      </button>
    </div>
  )
}
