import { Global, Module } from '@nestjs/common'

import type { ModoProceso } from '../../domain/entities/sesion.entity'

/** Dónde se procesan las sesiones cuando la configuración no elige ninguno: PROCESAR_EN del .env (servidor o celular). */
export const MODO_POR_DEFECTO = Symbol('ModoProcesamientoPorDefecto')

export function modoDesdeEnv(valor = process.env.PROCESAR_EN): ModoProceso {
  const v = (valor ?? '').trim().toLowerCase()
  if (v && v !== 'servidor' && v !== 'celular') {
    console.warn(`PROCESAR_EN="${valor}" no es "servidor" ni "celular": uso "servidor".`)
  }
  return v === 'celular' ? 'celular' : 'servidor'
}

/** Ajustes que salen del .env y usan varios módulos. */
@Global()
@Module({
  providers: [{ provide: MODO_POR_DEFECTO, useFactory: () => modoDesdeEnv() }],
  exports: [MODO_POR_DEFECTO],
})
export class AjustesModule {}
