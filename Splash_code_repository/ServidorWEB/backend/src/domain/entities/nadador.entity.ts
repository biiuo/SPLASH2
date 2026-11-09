/** El perfil de nadador de una cuenta. `entrenador_id` dice a qué grupo pertenece (null = sin entrenador). */
export type Nadador = {
  id: string
  usuario_id: string | null
  entrenador_id: string | null
  nombre: string
  email: string | null
}
