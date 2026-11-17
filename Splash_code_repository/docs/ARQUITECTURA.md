# Arquitectura del frontend

La reorganización está en curso. La estructura actual convive temporalmente con
`components/` y `lib/`; todavía no se debe interpretar como una arquitectura
limpia completa.

```text
ServidorWEB/frontend/
├── app/                         Rutas y adaptador HTTP del servidor
├── features/
│   ├── calibracion/             Editor y calibraciones guardadas
│   ├── configuracion/           Editor de configuración
│   ├── cuenta/                  Ingreso, registro y perfil
│   ├── grupo/                   Panel de grupos
│   ├── historial/               Historial de sesiones
│   ├── landing/                 Pantalla inicial y carrusel
│   ├── sesion/                  Panel y procesamiento en el dispositivo
│   └── zonas/                   Editor de zonas
├── domain/
│   ├── calibracion/             Geometría y proyección puras
│   ├── sesion/                  Resultados y resumen por carril
│   └── zonas/                   Polígonos, carriles y formato de zonas
├── infrastructure/
│   ├── api/                     Adaptadores de los puertos de aplicación
│   ├── storage/                 Acceso seguro al almacenamiento del navegador
│   └── vision/                  Algoritmos de visión y ejecución de ONNX
├── shared/                      Hooks y componentes compartidos
├── components/                  Componentes aún no reorganizados
└── lib/                         API, tipos y lógica aún no reorganizados
```

## Regla de dependencias

El objetivo es que presentación dependa de aplicación y esta de dominio.
Infraestructura implementará las interfaces necesarias para acceder a servicios
externos. Los archivos de `lib/` y algunos componentes todavía mezclan estas
responsabilidades; deben migrarse antes de considerar cumplida la regla.

Cada funcionalidad expone sus componentes públicos desde su `index.ts`. Los
detalles internos permanecen dentro de su carpeta.

## Decisiones durante la migración

- Se conservaron los algoritmos de visión; solo cambiaron sus rutas e imports.
- Las claves y los valores existentes de almacenamiento no cambian de formato.
- La API permanece temporalmente en `lib/api.ts` hasta separar sus contratos y
  cliente HTTP sin modificar las respuestas ni los endpoints.
- Los tipos geométricos se definen en dominio y se reexportan desde
  `lib/tipos.ts` durante la migración para conservar los imports existentes.
- La administración de calibraciones guardadas usa un puerto definido por la
  funcionalidad y un hook para el estado. El adaptador delega al cliente
  existente, sin cambiar endpoints ni errores.
  El resumen de calibración se define en dominio y se reexporta desde
  `lib/tipos.ts` para conservar compatibilidad.
- `calibraciones-guardadas-con-api.tsx` conecta el adaptador concreto con el
  componente. Falta migrar las demás pantallas y operaciones.
- Las operaciones puras de zonas viven en dominio. `lib/zonas.ts` conserva
  las exportaciones existentes y la conversión de canvas a JPEG.
