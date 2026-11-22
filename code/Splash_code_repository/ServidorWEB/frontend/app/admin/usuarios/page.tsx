'use client'

import { GestionUsuarios } from '@/components/admin/gestion-usuarios'
import { Encabezado } from '@/components/nadador/shell'

/** Usuarios y permisos: todas las cuentas, con su rol. */
export default function UsuariosAdmin() {
  return (
    <>
      <Encabezado
        titulo="Usuarios y permisos"
        bajada="Crear cuentas de cualquier rol, cambiar el rol, activar o desactivar y restablecer contraseñas. El rol define los permisos: el administrador configura el sistema, el entrenador maneja sus grupos y sesiones, el nadador ve lo suyo."
      />
      <GestionUsuarios />
    </>
  )
}
