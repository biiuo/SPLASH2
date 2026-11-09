import { Global, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'

import {
  CrearAdministradorInicialUseCase,
  IngresarUseCase,
  ObtenerPerfilUseCase,
  RegistrarseUseCase,
} from '../../application/use-cases/auth/auth.usecases'
import { CIFRADOR_CONTRASENAS, EMISOR_TOKENS, type CifradorContrasenas, type EmisorTokens } from '../../application/ports/autenticacion.ports'
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../domain/repositories/usuario.repository'
import { BcryptCifrador, JwtEmisor, claveJwt } from '../../infrastructure/auth/autenticacion.adapters'
import { AutenticacionGuard } from '../auth/autenticacion.guard'
import { AuthController } from '../controllers/auth.controller'

/** Una sesión dura 12 horas: un turno de entrenamiento largo, sin tener que volver a ingresar. */
const DURACION_SESION = '12h'

@Global()
@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => ({ secret: claveJwt(), signOptions: { expiresIn: DURACION_SESION } }) })],
  controllers: [AuthController],
  providers: [
    { provide: CIFRADOR_CONTRASENAS, useFactory: () => new BcryptCifrador(Number(process.env.BCRYPT_COSTO) || undefined) },
    { provide: EMISOR_TOKENS, useFactory: (jwt: JwtService) => new JwtEmisor(jwt), inject: [JwtService] },
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    {
      provide: RegistrarseUseCase,
      useFactory: (u: UsuarioRepository, c: CifradorContrasenas, t: EmisorTokens) => new RegistrarseUseCase(u, c, t),
      inject: [USUARIO_REPOSITORY, CIFRADOR_CONTRASENAS, EMISOR_TOKENS],
    },
    {
      provide: IngresarUseCase,
      useFactory: (u: UsuarioRepository, c: CifradorContrasenas, t: EmisorTokens) => new IngresarUseCase(u, c, t),
      inject: [USUARIO_REPOSITORY, CIFRADOR_CONTRASENAS, EMISOR_TOKENS],
    },
    { provide: ObtenerPerfilUseCase, useFactory: (u: UsuarioRepository) => new ObtenerPerfilUseCase(u), inject: [USUARIO_REPOSITORY] },
    {
      provide: CrearAdministradorInicialUseCase,
      useFactory: (u: UsuarioRepository, c: CifradorContrasenas) => new CrearAdministradorInicialUseCase(u, c),
      inject: [USUARIO_REPOSITORY, CIFRADOR_CONTRASENAS],
    },
  ],
  exports: [EMISOR_TOKENS],
})
export class AuthModule implements OnApplicationBootstrap {
  private readonly log = new Logger('Auth')

  constructor(private readonly adminInicial: CrearAdministradorInicialUseCase) {}

  /** Crea el primer administrador con ADMIN_EMAIL / ADMIN_PASSWORD. Si la base no responde, no impide arrancar. */
  async onApplicationBootstrap() {
    try {
      const r = await this.adminInicial.execute({
        email: process.env.ADMIN_EMAIL,
        contrasena: process.env.ADMIN_PASSWORD,
        nombre: process.env.ADMIN_NOMBRE,
      })
      if (r === 'creado') this.log.log(`Administrador inicial creado: ${process.env.ADMIN_EMAIL}`)
    } catch (e) {
      this.log.error(`No se pudo crear el administrador inicial: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
