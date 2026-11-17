/** El perfil de nadador de una cuenta. Puede estar en varios grupos (de uno o más entrenadores). */
export type Nadador = {
  id: string
  usuario_id: string | null
  nombre: string
  email: string | null
  telefono?: string | null
}

export const DIAS_SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]
export const NIVELES_GRUPO = ['principiante', 'intermedio', 'avanzado', 'competitivo'] as const
export type NivelGrupo = (typeof NIVELES_GRUPO)[number]
/** Cuándo entrena el grupo: días de la semana y franja horaria (HH:MM). */
export type HorarioGrupo = { dias: DiaSemana[]; inicio: string; fin: string }

/** Un grupo de un entrenador, con sus nadadores. */
export type Grupo = {
  id: string
  entrenador_id: string
  /** Nombre del entrenador. */
  entrenador: string
  /** Contacto del entrenador (lo ven los nadadores del grupo). */
  entrenador_email?: string | null
  entrenador_telefono?: string | null
  nombre: string
  descripcion?: string | null
  nivel?: NivelGrupo | null
  horario?: HorarioGrupo | null
  nadadores: Nadador[]
}
