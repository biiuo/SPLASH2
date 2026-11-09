// Quién puede ver qué sesión. Hay una sola cámara, pero cada sesión es de quien la inicia:
//   * la de un entrenador es la de su grupo: la ven él y los nadadores que asignó a esa sesión;
//   * la que inicia un nadador por su cuenta (sesión libre) es suya, distinta de la del entrenador;
//   * el administrador y el servidor de IA ven todas.
import type { Solicitante } from '../entities/usuario.entity'

/** El id de la persona a la que hay que filtrarle las sesiones, o null si ve todas (administrador o servidor de IA). */
export function visibilidadDe(s: Solicitante | undefined): string | null {
  return s?.tipo === 'usuario' && s.rol !== 'administrador' ? s.id : null
}

/** El id de quien tiene que haber iniciado la sesión para poder manejarla (finalizarla, mandarle datos), o null si cualquiera. */
export const duenoRequerido = visibilidadDe
