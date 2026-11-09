/** El perfil de nadador de una cuenta. Puede estar en varios grupos (de uno o más entrenadores). */
export type Nadador = {
  id: string
  usuario_id: string | null
  nombre: string
  email: string | null
}

/** Un grupo de un entrenador, con sus nadadores. */
export type Grupo = {
  id: string
  entrenador_id: string
  /** Nombre del entrenador. */
  entrenador: string
  nombre: string
  nadadores: Nadador[]
}
