import { MotorEventos } from '../domain/services/motor-eventos'

/**
 * Un motor de eventos por sesión activa, en memoria: recuerda por dónde iba cada nadador entre un lote de
 * trayectorias y el siguiente. Si el servidor se reinicia, el motor arranca de cero.
 */
export class RegistroMotores {
  private readonly motores = new Map<string, MotorEventos>()

  deSesion(sesionId: string, crear: () => MotorEventos): MotorEventos {
    let motor = this.motores.get(sesionId)
    if (!motor) {
      motor = crear()
      this.motores.set(sesionId, motor)
    }
    return motor
  }

  olvidar(sesionId: string): void {
    this.motores.delete(sesionId)
  }
}
