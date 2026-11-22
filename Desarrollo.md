# Manual de desarrollo — SafeSplash

## 1. Propósito del documento

Esta guía técnica sirve para entender, mantener, extender y continuar el desarrollo de SafeSplash. Está pensada para los
equipos que reciban el proyecto. Explica cómo está organizado el repositorio, qué hace cada componente, cómo se levantan
los contenedores, qué variables de entorno hacen falta y cómo se trabaja con el código.

La instalación y el despliegue paso a paso están en [Instalacion.md](Instalacion.md). Este documento no los repite: se
concentra en lo que hace falta saber para **modificar** el código.

Todas las rutas de código son relativas a `code/Splash_code_repository/`, salvo que se indique otra cosa.

## 2. Descripción general del proyecto desde la perspectiva de desarrollo

SafeSplash es un sistema de visión por computador que sigue a los nadadores de los carriles 4, 5 y 6 de una piscina de
25 m y calcula, sin cronómetro, cuándo cruzan cada marca (0, 5, 10, 15, 20 y 25 m), a qué velocidad nadan, cuántos largos
completan y cuándo descansan.

Tiene dos partes que se comunican solo por una API HTTP:

1. **Quien mide** (servidor de IA en Python o, como variante, el navegador del celular). Lee el video, detecta a los
   nadadores, los sigue y envía **solo posiciones en píxeles con la hora de captura del frame**.
2. **El servidor web** (backend NestJS y frontend Next.js). Convierte píxeles a metros con la homografía de la sesión,
   calcula los eventos y las métricas, los guarda en PostgreSQL y los muestra a entrenadores y nadadores.

```
cámara RTSP ─► MediaMTX (relé) ─► servidor de IA: recorte → YOLOv5s → zonas → ByteTrack → identidad por carril
                                                   → trayectoria (3 muestras/s) → POST /api/sesiones/{id}/trayectorias
backend: píxeles → metros (homografía) → motor de eventos → PostgreSQL → frontend
```

### 2.1 Tecnologías principales

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, componentes shadcn/ui, íconos lucide-react.
  En la variante celular, onnxruntime-web (WebGPU) cargado desde jsDelivr.
- **Backend:** NestJS 11 sobre Node.js 22, TypeScript 5.9, Swagger (`@nestjs/swagger`), JWT (`@nestjs/jwt`), bcryptjs.
- **Base de datos:** PostgreSQL 16 con Prisma 7 (`@prisma/adapter-pg`). En la práctica se usa Supabase; para trabajar
  sin internet hay un Postgres local en Docker.
- **Visión por computador:** Python 3.11, PyTorch 2.15 (CPU), YOLOv5s ajustado (`best.pt`, mAP@0.5 = 0.911) descargado
  vía `torch.hub`, boxmot 26 (ByteTrack con asociación `diou`), OpenCV, NumPy 2.
- **Contenedores:** Docker y Docker Compose (con `develop.watch` para recarga en desarrollo).
- **Infraestructura adicional:** MediaMTX 1.21.3 como relé RTSP de la cámara Axis; ffmpeg para simular la cámara con un
  video o publicar la webcam.

### 2.2 Componentes principales

- **Cliente web (`ServidorWEB/frontend`):** interfaz para tres roles (nadador, entrenador, administrador). Configuración de
  piscina y cámara, calibración de la homografía, dibujo de zonas, inicio y fin de sesiones, monitoreo en tiempo real,
  historial, comparaciones, objetivos y reportes PDF/CSV. Reenvía `/api/...` al backend por la red interna.
- **Servidor/API (`ServidorWEB/backend`):** API REST con arquitectura limpia. Autenticación con JWT para personas y con
  `IA_TOKEN` para el servidor de IA, calibración, sesiones por carril, recepción idempotente de trayectorias, motor de
  eventos y resultados.
- **Base de datos:** usuarios, nadadores, grupos, configuración, calibraciones, sesiones, eventos, tramos, latidos,
  objetivos y perfil del nadador. El esquema está en `prisma/schema.prisma` y los cambios en `prisma/migrations/`.
- **Servidor de IA (`ServidorIA/ProcesamientoServidor`):** pipeline concurrente en Python, con captura e inferencia en
  hilos separados. Solo corre el modelo cuando hay una sesión activa.
- **Procesamiento en el celular (`ServidorIA/ProcesamientoCelular` + `frontend/infrastructure/vision`):** variante
  experimental. Un servicio retransmite el video por WebSocket y el navegador corre el modelo ONNX.
- **Servicios externos:** Supabase (PostgreSQL), cámara IP Axis (RTSP), GitHub (`torch.hub` descarga el código de
  YOLOv5), Docker Hub y jsDelivr.

## 3. Estructura del repositorio

### 3.1 Árbol general del repositorio

```text
/
├── README.md                         resumen del proyecto y enlaces a los informes
├── PrimerInforme.md, SegundoInforme.md, InformeFinal.md
├── Instalacion.md                    instalación y despliegue
├── Desarrollo.md                     este documento
└── code/
    ├── .gitignore                    reglas para el código
    └── Splash_code_repository/
        ├── docker-compose.yml        entorno principal (base externa)
        ├── docker-compose.dev.yml    desarrollo con recarga automática
        ├── docker-compose.local.yml  se suma al de desarrollo: Postgres local, sin internet
        ├── docker-compose.webcam.yml se suma al de desarrollo: webcam en Linux
        ├── webcam.ps1                publica la webcam de Windows en el relé
        ├── .env.example              plantilla de variables
        ├── config/                   zones.json y calibración que lee la IA (montado en solo lectura)
        ├── videos/                   video de prueba para el perfil demo (no se versiona)
        ├── ServidorWEB/
        │   ├── backend/              NestJS + Prisma
        │   │   ├── prisma/           schema.prisma y migraciones SQL
        │   │   └── src/              domain · application · infrastructure · presentation
        │   └── frontend/             Next.js
        │       ├── app/              rutas por rol (admin/, entrenador/, nadador/, calibracion/, zonas/…)
        │       ├── features/         pantallas por funcionalidad (calibracion, sesion, zonas, grupo…)
        │       ├── domain/           lógica pura (proyección, carriles, resumen de sesión)
        │       ├── infrastructure/   API, almacenamiento local, visión en el navegador
        │       ├── lib/              utilidades (cliente API, PDF, CSV, tipos)
        │       ├── components/       componentes compartidos y de UI
        │       └── tests/            pruebas de la lógica pura
        └── ServidorIA/
            ├── ProcesamientoServidor/  variante B: pipeline Python
            │   ├── src/                código del pipeline
            │   ├── modelo/             best.pt y cuadernos de entrenamiento
            │   └── Dockerfile, entrypoint.sh, requirements.txt
            └── ProcesamientoCelular/   variante A: streaming WebSocket y exportación a ONNX
```

### 3.2 Descripción de directorios y archivos relevantes

#### 3.2.1 Raíz del repositorio y de `code/Splash_code_repository/`

| Carpeta / archivo | Contenido | Función |
|---|---|---|
| `/` (raíz) | `README.md`, informes, `Instalacion.md`, `Desarrollo.md` | Documentación académica y técnica del proyecto |
| `code/` | `.gitignore`, `.gitattributes`, `Splash_code_repository/` | Contenedor del código fuente dentro de `main` |
| `Splash_code_repository/` | Archivos `docker-compose*.yml`, `.env.example`, `webcam.ps1` | Orquestación de todos los servicios |
| `config/` | `zones.json` (opcional) | Configuración que lee el servidor de IA, montada en solo lectura. Es respaldo: las zonas vienen normalmente de la calibración de la sesión |
| `videos/` | `demo.mp4` (no versionado) | Video que el perfil `demo` publica como si fuera la cámara |
| `ServidorWEB/` | `backend/`, `frontend/` | Servidor web: API y aplicación |
| `ServidorIA/` | `ProcesamientoServidor/`, `ProcesamientoCelular/` | Las dos variantes que miden y envían posiciones. `ServidorIA/src/` es una carpeta heredada y vacía |

#### 3.2.2 Backend (`ServidorWEB/backend/`)

| Carpeta | Contenido | Función en el código |
|---|---|---|
| `prisma/` | `schema.prisma` | Modelo de datos: usuarios, nadadores, grupos, configuración, calibraciones, sesiones, eventos, tramos, latidos, objetivos y perfil del nadador |
| `prisma/migrations/` | Una carpeta por migración, con `migration.sql` | Historial del esquema en SQL escrito a mano (índices parciales, restricciones, vista `resumen_sesion`) |
| `src/` | `main.ts`, `app.module.ts`, `configurar-app.ts`, `cargar-env.ts` | Arranque: carga el `.env` local, registra módulos, filtros y Swagger, y escucha en el puerto 3001 |
| `src/domain/entities/` | Calibración, configuración, nadador, objetivo, perfil, sesión, usuario | Objetos de negocio y sus reglas, sin dependencias de framework |
| `src/domain/repositories/` | Interfaces `*.repository.ts` | Contratos de acceso a datos que implementa la infraestructura |
| `src/domain/services/` | `homografia.ts`, `motor-eventos.ts`, `largos.ts`, `evaluador-calibracion.ts`, `identificador.ts`, `zonas.ts`, `acceso-sesiones.ts`, `sumarse-sesion.ts`, `historia-nadador.ts` | Núcleo del cálculo: píxeles → metros, cruces, virajes, tramos, descansos, largos, calidad de la calibración, ids deterministas y reglas de acceso a sesiones |
| `src/application/use-cases/` | Subcarpetas `admin`, `auth`, `calibracion`, `configuracion`, `grupo`, `objetivos`, `perfil-nadador`, `sesiones` | Un caso de uso por operación. Por ejemplo: iniciar o finalizar sesión, recibir y repartir trayectorias, guardar y activar calibración |
| `src/application/dtos/` | DTOs de calibración, configuración y sesión | Validación y forma de los datos de entrada y salida de la API |
| `src/application/ports/` | Autenticación, avisos, frame de la cámara | Interfaces de servicios técnicos que no son repositorios |
| `src/application/exceptions/` | Excepciones de aplicación | Errores de negocio que el filtro HTTP traduce a códigos de respuesta |
| `src/infrastructure/repositories/` | `prisma-*.repository.ts` | Implementación con Prisma de cada repositorio |
| `src/infrastructure/mappers/` | Mappers de calibración y configuración | Conversión entre filas de la base y entidades |
| `src/infrastructure/persistence/` | `prisma.service.ts` (+ `generated/`, no versionado) | Conexión a PostgreSQL y cliente Prisma generado |
| `src/infrastructure/auth/` | Adaptadores de autenticación | bcrypt para contraseñas y JWT para sesiones |
| `src/infrastructure/avisos/`, `camara/` | Almacenes en memoria | Avisos al usuario y último frame publicado por la IA (para calibrar) |
| `src/presentation/controllers/` | `admin`, `auth`, `calibracion`, `configuracion`, `grupo`, `objetivos`, `perfil-nadador`, `salud`, `sesiones` | Endpoints HTTP bajo `/api/` |
| `src/presentation/auth/` | Guard y decoradores | Exigen JWT o `IA_TOKEN` y verifican el rol de cada endpoint |
| `src/presentation/modules/` | Módulos Nest | Inyección de dependencias: enlazan interfaces con implementaciones |
| `src/presentation/filters/` | `excepciones.filter.ts` | Respuestas de error uniformes |
| `src/presentation/swagger/` | `swagger.ts`, `ejemplos.ts` | Documentación interactiva en `/docs` |

#### 3.2.3 Frontend (`ServidorWEB/frontend/`)

| Carpeta | Contenido | Función en el código |
|---|---|---|
| `app/` | `layout.tsx`, `page.tsx` (inicio), `error.tsx`, `globals.css` | Estructura general, página de inicio y manejo de errores |
| `app/api/[...ruta]/` | `route.ts` | Proxy: reenvía todo `/api/...` al backend según `BACKEND_URL` |
| `app/admin/` | `usuarios`, `entrenadores`, `nadadores`, `sesiones`, `monitoreo`, `reportes`, `configuracion` | Panel del administrador: gestión de cuentas y supervisión general |
| `app/entrenador/` | `grupos`, `nadadores`, `monitoreo`, `historial`, `rendimiento`, `comparaciones`, `objetivos`, `reportes`, `perfil` | Panel del entrenador: sesiones en vivo, seguimiento de nadadores, metas y reportes |
| `app/nadador/` | `bienvenida`, `sesiones`, `progreso`, `perfil` | Panel del nadador: su historial, su evolución y su perfil deportivo |
| `app/calibracion/`, `app/zonas/`, `app/configuracion/` | Páginas | Calibración de la homografía y su historial, dibujo de zonas y configuración de piscina y cámara |
| `features/calibracion/` | `components/`, `hooks/`, `model/` | Editor de puntos de calibración, lista de calibraciones guardadas y su acceso a la API |
| `features/zonas/` | `zone-editor.tsx` | Dibujo de los carriles `lane4`–`lane6` y otras zonas sobre el frame de la cámara |
| `features/sesion/` | `sesion-panel.tsx`, `procesador-celular.tsx` | Iniciar y finalizar sesión, resultados por carril en vivo y variante de procesamiento en el celular |
| `features/historial/` | Lista y detalle de sesiones | Consulta de sesiones pasadas |
| `features/grupo/` | `grupo-panel.tsx` | Grupos del entrenador y alta de nadadores por correo |
| `features/configuracion/` | `configuracion-editor.tsx` | Medidas de la piscina, cámara y modo de procesamiento |
| `features/cuenta/` | `auth-screen.tsx`, `perfil-cuenta.tsx` | Inicio de sesión, registro y datos de la cuenta |
| `features/landing/` | Carrusel y contenedor de la app | Página pública de presentación |
| `components/` | Gráficas (`grafica-velocidad.tsx`, `graficos.tsx`), `reportes.tsx`, `buscador-nadador.tsx`, `con-sesion.tsx`, `swimmer-bar.tsx` | Componentes compartidos entre roles. `con-sesion.tsx` protege las páginas que requieren usuario |
| `components/admin/`, `entrenador/`, `nadador/` | Shells (menú y marco) y componentes de cada rol | Estructura visual y piezas específicas de cada panel |
| `domain/` | `calibracion/`, `sesion/`, `zonas/` | Lógica pura sin React: proyección metros ↔ imagen, geometría, resumen por carril, reconocimiento de carriles |
| `infrastructure/api/` | `calibraciones.ts` | Acceso a la API de calibraciones |
| `infrastructure/storage/` | `almacenamiento-local.ts` | Preferencias del navegador (`localStorage`) |
| `infrastructure/vision/` | `ort.ts`, `detector.ts`, `procesador.ts`, `carriles.ts` | Variante celular: carga onnxruntime-web, corre el modelo en el navegador y asigna carriles |
| `lib/` | `api.ts`, `tipos.ts`, `pdf-reporte.ts`, `pdf.ts`, `csv-sesion.ts`, `largos.ts`, `velocidad-en-el-tiempo.ts`, `objetivos.ts`, etc. | Cliente HTTP, tipos compartidos, generación de reportes PDF/CSV y cálculos para gráficas |
| `shared/` | `hooks/use-parametro-url.ts`, `ui/limite-error.tsx` | Utilidades genéricas de React |
| `public/` | Logos, imágenes de personajes y de la piscina, `modelo/best_640.onnx` (no versionado) | Archivos estáticos servidos tal cual |
| `Images/` | Fotos de la piscina | Copias de `public/images/piscina/`; no las usa el código |
| `tests/` | `arquitectura.test.mjs` | Pruebas de la lógica pura con `node --test` |

#### 3.2.4 Servidor de IA (`ServidorIA/ProcesamientoServidor/`)

| Archivo / carpeta | Función |
|---|---|
| `Dockerfile`, `entrypoint.sh`, `requirements.txt` | Imagen Python 3.11. `entrypoint.sh` convierte las variables de entorno en argumentos del pipeline |
| `modelo/best.pt` | Pesos del detector YOLOv5s. Se monta en el contenedor, no se copia: cambiarlo solo requiere reiniciar `ia` |
| `modelo/entrenamiento/` | Cuadernos `entrenamiento.ipynb` (ajuste de YOLOv5) y `bytetrack.ipynb` (ajuste del tracker) |
| `src/pipeline_concurrente.py` | Punto de entrada: captura, inferencia, seguimiento y envío en hilos separados |
| `src/roi.py`, `zones.py`, `zonas_activas.py`, `zones.json` | Recorte a los carriles y zonas de análisis `lane4`/`lane5`/`lane6` |
| `src/tracker_util.py`, `conteo.py` | ByteTrack con `diou` y descarte de cajas contenidas en otras |
| `src/identidad.py` | Un nadador por carril con identidad estable aunque ByteTrack cambie el ID |
| `src/trayectoria.py` | Muestras a 3 Hz; extrapola posiciones perdidas y las marca como `estimada` |
| `src/fantasmas.py`, `fantasmas.json` | Filtro de detecciones falsas fijas (banderines de espalda) |
| `src/enviador.py` | Envío de posiciones al backend con buffer y reintentos, sin duplicar |
| `src/latido.py` | Latido periódico al backend: indica que el servidor de IA está activo |
| `src/publicador_frame.py` | Deja en el backend el último frame de la cámara para calibrar desde la web |
| `src/grabador.py`, `registro.py` | Depuración: clips de video y registro CSV de posiciones enviadas |
| `src/analizar_prueba.py`, `probar_enlace.py`, `realtime_local_test.py` | Depuración: análisis de corridas, prueba de conexión con la cámara y el backend, prueba local en tiempo real |

#### 3.2.5 Procesamiento en el celular (`ServidorIA/ProcesamientoCelular/`)

| Archivo / carpeta | Función |
|---|---|
| `servidor_stream.py`, `Dockerfile`, `requirements.txt` | Servicio `stream-ws`: lee el relé RTSP y envía los frames al navegador por WebSocket (puerto 8765) |
| `navegador/exportar_onnx.py`, `.ipynb` | Convierte `best.pt` en `best_640.onnx` para el navegador |
| `navegador/index.html` | Página independiente que mide cuántos FPS logra el modelo en un celular |
| `README.md` | Instrucciones de la variante celular |

## 4. Organización de la solución a nivel de código

### 4.1 Organización por módulos o capas

**Backend: arquitectura limpia en cuatro capas.** Las dependencias apuntan hacia adentro:

- **Dominio** (`domain/`): TypeScript puro, sin Nest ni Prisma. Se puede probar sin base de datos.
- **Aplicación** (`application/`): casos de uso que coordinan el dominio a través de interfaces (repositorios y puertos).
- **Infraestructura** (`infrastructure/`): Prisma, autenticación y almacenes en memoria. Implementa las interfaces.
- **Presentación** (`presentation/`): HTTP. Controladores delgados que validan, llaman a un caso de uso y responden.

Para agregar una funcionalidad: entidad o servicio en `domain/` → caso de uso en `application/use-cases/<área>/` →
repositorio Prisma en `infrastructure/repositories/` → controlador y módulo en `presentation/` → registrar el módulo
en `app.module.ts`.

**Frontend: organización por funcionalidad.** `app/` solo define rutas y compone pantallas, `features/<área>/` tiene los
componentes, hooks y modelo de cada funcionalidad, `domain/` la lógica pura y `infrastructure/` el acceso a la API, el
almacenamiento local y la visión. `tests/arquitectura.test.mjs` cubre funciones de `domain/` y `features/`.

**Servidor de IA: pipeline por etapas.** Un módulo por etapa, unidos en `pipeline_concurrente.py`. La captura corre en
su propio hilo y descarta frames viejos si la inferencia va más lenta que la cámara.

### 4.2 Relación entre componentes del sistema y código fuente

| Componente | Dónde está |
|---|---|
| Captura y relé de video | `docker-compose*.yml` (servicio `mediamtx`), `ServidorIA/ProcesamientoServidor/src/pipeline_concurrente.py` |
| Detección y seguimiento | `ServidorIA/ProcesamientoServidor/src/` (`tracker_util.py`, `identidad.py`, `trayectoria.py`) |
| Contrato IA → backend | `POST /api/sesiones/{id}/trayectorias`: `src/enviador.py` ↔ `backend/src/application/use-cases/sesiones/recibir-trayectorias.usecase.ts` |
| Píxeles → metros | `backend/src/domain/services/homografia.ts` |
| Eventos y métricas | `backend/src/domain/services/motor-eventos.ts`, `largos.ts` |
| Autenticación y roles | `backend/src/application/use-cases/auth/`, `presentation/auth/`, `infrastructure/auth/` |
| Persistencia | `backend/prisma/schema.prisma`, `backend/src/infrastructure/repositories/` |
| Calibración (UI) | `frontend/features/calibracion/`, `frontend/app/calibracion/` |
| Zonas (UI) | `frontend/features/zonas/`, `frontend/app/zonas/` |
| Sesión en vivo | `frontend/features/sesion/` |
| Reportes PDF/CSV | `frontend/lib/pdf-reporte.ts`, `frontend/lib/pdf.ts`, `frontend/lib/csv-sesion.ts` |
| Variante celular | `ServidorIA/ProcesamientoCelular/`, `frontend/infrastructure/vision/` |

## 5. Contenedores

### 5.1 Contenedores utilizados

| Servicio | Función | Perfil |
|---|---|---|
| `migraciones` | Aplica las migraciones de Prisma y termina con código 0 | siempre (solo en el compose principal) |
| `backend` | API NestJS en el puerto 3001 | siempre |
| `frontend` | Next.js en el puerto 3000 | siempre |
| `mediamtx` | Relé RTSP: lee la cámara Axis o espera que alguien publique | siempre |
| `ia` | Servidor de IA (variante B), en CPU | siempre |
| `stream-ws` | Retransmite el video al celular por WebSocket (8765) | `phone` |
| `camara-simulada` | ffmpeg que publica `videos/demo.mp4` en bucle como si fuera la cámara | `demo` |
| `db` | PostgreSQL 16 local | solo con `docker-compose.local.yml` |

### 5.2 Archivos relacionados con contenedores

- `docker-compose.yml`: entorno principal. Imágenes de producción y base externa obligatoria (`DATABASE_URL`).
- `docker-compose.dev.yml`: desarrollo. Monta el código con volúmenes, corre `nest start --watch` y `next dev --webpack`,
  y aplica las migraciones al arrancar el backend. La IA se recarga con `develop.watch`.
- `docker-compose.local.yml`: se suma al de desarrollo y cambia Supabase por un Postgres local.
- `docker-compose.webcam.yml`: se suma al de desarrollo y pasa `/dev/video0` a la IA (solo Linux).
- `ServidorWEB/backend/Dockerfile`: multi-etapa (`deps` → `prod-deps` → `build` → `migraciones` / `run`). Corre como
  usuario no root y tiene healthcheck sobre `/api/salud`.
- `ServidorWEB/frontend/Dockerfile`: multi-etapa con salida `standalone` de Next.js.
- `ServidorIA/ProcesamientoServidor/Dockerfile` + `entrypoint.sh`: Python 3.11-slim. El `entrypoint.sh` arma los
  argumentos de `pipeline_concurrente.py` a partir de las variables de entorno.
- `ServidorIA/ProcesamientoCelular/Dockerfile`: servicio `stream-ws`.
- `.dockerignore` en cada servicio.

### 5.3 Construcción y ejecución de contenedores

Todos los comandos se corren dentro de `code/Splash_code_repository/`. Para abreviar, en las tablas se usa:

- `DEV` = `docker compose -f docker-compose.dev.yml`
- `LOCAL` = `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml`
- `CAM` = `docker compose -f docker-compose.dev.yml -f docker-compose.webcam.yml`
- `PRIN` = `docker compose -f docker-compose.yml`

Son abreviaturas del documento, no comandos: en la terminal se escribe el comando completo.

#### 5.3.1 Variantes de desarrollo (`docker-compose.dev.yml`)

El código está montado en los contenedores: los cambios se aplican sin reconstruir.

| Objetivo | Comando | Servicios que inicia |
|---|---|---|
| Todo, con recarga | `DEV up --watch` | backend, frontend, mediamtx, ia |
| Todo, con video de prueba | `DEV --profile demo up --watch` | lo anterior + camara-simulada |
| Todo, con video de prueba y celular | `DEV --profile demo --profile phone up --watch` | lo anterior + stream-ws |
| Solo web y API | `DEV up --build frontend backend` | backend, frontend |
| Solo la API (probar con Swagger) | `DEV up backend` | backend |
| Solo el relé | `DEV up -d mediamtx` | mediamtx |
| IA con la webcam de Windows | `DEV up -d mediamtx` → `.\webcam.ps1` (otra terminal) → `DEV up --watch ia` | mediamtx, ia |
| IA con la webcam (Linux) | `CAM up --watch ia` | mediamtx, ia |
| Probar la conexión cámara/backend | `CAM run --rm --no-deps --entrypoint python ia probar_enlace.py` | contenedor temporal |
| IA fuera de Docker, con ventana | `DEV up -d mediamtx backend frontend` y luego Python con `--mostrar` (Anexo A.9 de [Instalacion.md](Instalacion.md)) | mediamtx, backend, frontend |

#### 5.3.2 Variantes de desarrollo sin internet (base local)

| Objetivo | Comando | Servicios que inicia |
|---|---|---|
| Web y API con base local | `LOCAL up backend frontend` | db, backend, frontend |
| Todo con base local | `LOCAL up --watch` | db, backend, frontend, mediamtx, ia |
| Todo con base local y video de prueba | `LOCAL --profile demo up --watch` | lo anterior + camara-simulada |
| Solo la base | `LOCAL up -d db` | db (para backend o IA ejecutados fuera de Docker) |
| Consola SQL | `LOCAL exec db psql -U safesplash -d safesplash` | — |
| Borrar la base local | `LOCAL down -v` | — |

#### 5.3.3 Variantes de prueba (`docker-compose.yml`)

Usa imágenes de producción: **cada cambio de código requiere `--build`**.

| Objetivo | Comando | Servicios que inicia |
|---|---|---|
| Validar el archivo y las variables | `PRIN config` | — |
| Prueba completa con video de prueba | `PRIN --profile demo up -d --build` | migraciones, backend, frontend, mediamtx, ia, camara-simulada |
| Prueba con la cámara real | `PRIN up -d --build` (con `CAMERA_RTSP_URL` en `.env`) | migraciones, backend, frontend, mediamtx, ia |
| Prueba de la variante celular | `PRIN --profile demo --profile phone up -d --build` | lo anterior + stream-ws |
| Solo web y API | `PRIN up -d --build frontend` | migraciones, backend, frontend (por dependencia) |
| Otro video o punto de inicio | `$env:DEMO_VIDEO="otro.mp4"; $env:DEMO_INICIO="120"; PRIN --profile demo up -d camara-simulada` | camara-simulada (las variables de la terminal tienen prioridad sobre `.env`) |
| Probar otros parámetros del tracker | `$env:CONF="0.15"; $env:TRACK_THRESH="0.4"; PRIN up -d ia` | ia, recreada con los valores nuevos |
| Grabar clips anotados | `PRIN stop ia` → `PRIN run --name ia-clips -e GRABAR_ANOTADO=1 ia --guardar-video /data/clips` | contenedor temporal (Anexo A.9.2 de [Instalacion.md](Instalacion.md)) |

#### 5.3.4 Aplicar cambios y operar

| Cambio u operación | Desarrollo (`DEV`) | Prueba (`PRIN`) |
|---|---|---|
| Código de backend o frontend | Automático | `PRIN up -d --build backend` o `frontend` |
| Código Python de la IA | Automático con `--watch` | `PRIN up -d --build ia` |
| `requirements.txt` o `Dockerfile` de la IA | Automático con `--watch` (reconstruye) | `PRIN up -d --build ia` |
| `package.json` | `DEV restart backend` o `frontend` (instala al arrancar) | `PRIN up -d --build <servicio>` |
| Migración nueva | `DEV restart backend` (migra al arrancar) | `PRIN up -d --build migraciones backend` |
| Modelo `best.pt` | `DEV restart ia` | `PRIN restart ia` |
| `.env` | `DEV up -d` | `PRIN up -d` |
| Estado | `DEV ps -a` | `PRIN ps -a` |
| Registro en vivo | `DEV logs -f <servicio>` | `PRIN logs -f <servicio>` |
| Apagar sin borrar datos | `DEV down` | `PRIN down` |
| Limpiar huérfanos | `DEV --profile demo --profile phone down --remove-orphans` | `PRIN --profile demo --profile phone down --remove-orphans` |

Con `up --watch`, el entorno queda en primer plano: `Ctrl+C` lo detiene. La explicación de cada subcomando y opción está
en el Anexo A de [Instalacion.md](Instalacion.md).

La primera construcción de `ia` tarda entre 10 y 30 minutos porque descarga PyTorch. La caché de pip queda fuera de la
imagen, así que si una construcción falla, la siguiente no vuelve a descargar lo que ya tenía. La explicación de cada
comando y opción está en el Anexo A de [Instalacion.md](Instalacion.md).

### 5.4 Redes, puertos y volúmenes

**Redes:**
- `backend`: frontend, backend, IA (y `db` si está). La IA llega al backend por `http://backend:3001`.
- `video`: mediamtx, IA, stream-ws y camara-simulada. La IA lee `rtsp://mediamtx:8554/cam`.

**Puertos publicados:**

| Puerto | Servicio | Alcance |
|---|---|---|
| 3000 | frontend | toda la red local |
| 3001 | backend (API y Swagger en `/docs`) | solo `127.0.0.1` |
| 5432 | db (solo local) | solo `127.0.0.1` |
| 8554 | mediamtx (RTSP) | red local (VLC o celular, forzando TCP) |
| 8765 | stream-ws | red local, perfil `phone` |

**Volúmenes:**
- `torch_cache`: caché de `torch.hub` (YOLOv5). Se puede borrar sin perder datos.
- `ia_data`: salidas del servidor de IA (detecciones, clips).
- `pgdata`: datos del Postgres local. `down -v` lo borra.
- `backend_node_modules`, `frontend_node_modules`, `frontend_next` (desarrollo): las dependencias viven en el contenedor,
  no en la PC.
- Montajes: `modelo/best.pt` → `/models/best.pt:ro`, `config/` → `/config:ro`, `videos/` → `/videos:ro`.

### 5.5 Recomendaciones para modificar contenedores

- Las **variables nuevas** se agregan en los dos compose (principal y desarrollo) y en `.env.example`. Las obligatorias
  usan la forma `${VAR:?mensaje}` para que el arranque falle con un mensaje claro.
- Los **ajustes del tracker** (`CONF`, `TRACK_THRESH`, `MATCH_THRESH`, etc.) tienen valores por defecto en tres lugares:
  `docker-compose.yml`, `docker-compose.dev.yml` y `entrypoint.sh`. Al cambiar uno, cambiar los tres.
- No copiar `best.pt` dentro de la imagen: se monta para poder cambiarlo sin reconstruir.
- Si se cambia `package.json`, regenerar el lock con **npm 10** (`npx npm@10 install --package-lock-only`). Si no, `npm ci`
  falla en la imagen.
- El backend en desarrollo usa DNS públicos (1.1.1.1 y 8.8.8.8) porque el DNS del router a veces no resuelve Supabase
  (error `P1001`). Mantenerlos.
- El pooler de Supabase en modo sesión admite 15 conexiones en total. `DB_POOL_MAX` limita las del backend (5 por defecto
  en desarrollo).
- Para usar GPU NVIDIA hay que cambiar la imagen base y el índice de torch, y descomentar el bloque `deploy` del servicio
  `ia` (requiere nvidia-container-toolkit).
- Validar cualquier cambio en un compose con `docker compose -f <archivo> config` antes de construir.
- `docker system prune` puede dejar el error `network … not found`. Se arregla con `down --remove-orphans`.

## 6. Scripts y automatizaciones

### 6.1 Scripts principales

**Backend** (`ServidorWEB/backend`):

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Nest en modo observación |
| `npm run build` | Corre `prisma generate` (prebuild) y compila a `dist/` |
| `npm start` | Corre `dist/main` |
| `npm run db:generar` | Regenera el cliente Prisma (en `src/infrastructure/persistence/generated/`, no se versiona) |
| `npm run db:migrar` | `prisma migrate deploy`: aplica migraciones pendientes |

**Frontend** (`ServidorWEB/frontend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Next.js |
| `npm run build` | Compilación de producción (`standalone`) |
| `npm start` | Corre la compilación |
| `npm run lint` | ESLint con `eslint-config-next` |
| `node --test tests/` | Pruebas de la lógica pura (Node ≥ 23.6, porque importa `.ts`; en Node 22 agregar `--experimental-strip-types`) |

**Servidor de IA** (`ServidorIA/ProcesamientoServidor/src`):

| Comando | Qué hace |
|---|---|
| `python pipeline_concurrente.py --source <rtsp/video/0> --weights ../modelo/best.pt --zones zones.json` | Pipeline completo. `--backend-url http://localhost:3001` para enviar |
| `python pipeline_concurrente.py --simulado ...` | Detector simulado, sin modelo (para probar el envío y el backend) |
| `python probar_enlace.py` | Prueba la conexión con la cámara y el backend |
| `python analizar_prueba.py` | Analiza el registro CSV de una corrida |
| `--mostrar`, `--ver-crudas`, `--guardar-video`, `--registro-csv`, `--aprender-fantasmas` | Opciones de depuración (ventana en vivo, detecciones sin filtrar, clips, registro, aprender detecciones falsas fijas) |

**Raíz de `code/Splash_code_repository`:**
- `webcam.ps1`: publica la webcam de Windows en el relé (`-Listar` muestra las disponibles, `-Camara "nombre"` elige una).

### 6.2 Ubicación de scripts auxiliares

- `webcam.ps1`
- `ServidorIA/ProcesamientoServidor/entrypoint.sh`
- `ServidorIA/ProcesamientoServidor/src/` (herramientas de depuración listadas arriba)
- `ServidorIA/ProcesamientoServidor/modelo/entrenamiento/` (cuadernos `entrenamiento.ipynb` y `bytetrack.ipynb`)
- `ServidorIA/ProcesamientoCelular/navegador/exportar_onnx.py` y `.ipynb` (genera `best_640.onnx`)

### 6.3 Consideraciones para su uso

- `webcam.ps1` requiere ffmpeg (`winget install Gyan.FFmpeg`) y que `mediamtx` esté arriba. Si Windows lo bloquea:
  `powershell -ExecutionPolicy Bypass -File .\webcam.ps1`.
- El pipeline de IA fuera de Docker requiere Python 3.11 y `pip install -r requirements.txt`. boxmot debe ser ≥ 26
  (`ByteTrackConfig` y `diou` no existen antes) y torch ≥ 2.3 (por NumPy 2).
- La IA queda **en pausa** sin sesión activa: el mensaje `en pausa: sin sesión` es normal.
- La variante celular necesita `ServidorWEB/frontend/public/modelo/best_640.onnx` **antes** de construir el frontend. Los
  `.onnx` no se versionan.

## 7. Variables de entorno

### 7.1 Variables requeridas

| Variable | Uso | Obligatoria |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (backend y migraciones) | Sí en el compose principal |
| `JWT_SECRET` | Firma los tokens de sesión de la web. Mínimo 32 caracteres | Sí |
| `IA_TOKEN` | Token con el que el backend reconoce al servidor de IA. Distinto de `JWT_SECRET` | Sí |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Primer administrador: se crea solo si no hay ninguno | Recomendadas |
| `CAMERA_RTSP_URL` | RTSP de la cámara real. Vacía = espera un publicador (demo o webcam) | No |

### 7.2 Variables por ambiente

| Variable | Desarrollo | Principal / producción |
|---|---|---|
| `DATABASE_URL` | Supabase o el Postgres local (`docker-compose.local.yml` la sobrescribe) | Supabase (Session pooler, con `?sslmode=require&uselibpqcompat=true`) |
| `NODE_ENV` | `development` | `production` |
| `DB_POOL_MAX` | 5 (10 con base local) | sin definir |
| `SWAGGER` | `on` | `on` (poner `off` para ocultarlo) |
| `PROCESAR_EN` | `servidor` / `celular`: dónde procesar si en la web se deja "Según el archivo .env" | igual |
| `CAMERA_SOURCE` | `rtsp://mediamtx:8554/cam` (o `0` con webcam en Linux) | `rtsp://mediamtx:8554/cam` |
| `DEMO_VIDEO`, `DEMO_INICIO` | video y segundo inicial del perfil `demo` | igual |
| `IA_BACKEND_URL` | a dónde envía la IA (vacía = solo procesa) | `http://backend:3001` |
| `HZ_ENVIO`, `FRAME_CADA_S`, `CONF`, `TRACK_THRESH`, `MATCH_THRESH`, `TRACK_BUFFER_S`, `FPS_PROCESO`, `ASSO_FUNC`, `CONTENIDAS` | ajustes de la IA, con valores por defecto en el compose | igual |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | solo para un Postgres local propio | no se usan |

### 7.3 Archivos de configuración

- `.env.example`: plantilla versionada, sin secretos. Se copia como `.env` (`copy .env.example .env`) y se completa.
- `.env`: valores reales que leen los compose.
- `ServidorWEB/backend/.env`: lo lee `backend/src/cargar-env.ts` cuando el backend se corre sin Docker. Las variables ya
  definidas en la terminal tienen prioridad.
- `config/zones.json`: zonas de respaldo para la IA. Normalmente no hace falta: al unirse a una sesión, la IA pide las
  zonas de la calibración de esa sesión.

### 7.4 Manejo seguro de secretos

- **Sensibles:** `DATABASE_URL` (incluye la contraseña de la base), `JWT_SECRET`, `IA_TOKEN`, `ADMIN_PASSWORD` y
  `CAMERA_RTSP_URL` (incluye usuario y contraseña de la cámara).
- `code/.gitignore` excluye `.env`, `.env.*` (menos `.env.example`), `*.pem` y `*.key`. Antes de cada commit, revisar que
  no se haya colado un secreto en `.env.example` o en un compose.
- Generar claves al azar: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- La contraseña del administrador solo se usa la primera vez: cambiar `ADMIN_PASSWORD` después no la cambia.
- Los secretos se comparten entre el equipo por un canal privado, nunca en el repositorio ni en issues.

## 8. Flujo de trabajo de desarrollo

### 8.1 Preparación del entorno

1. Instalar Docker Desktop (en Windows, con WSL 2) y Git. Para trabajar sin Docker: Node.js 22 y Python 3.11.
2. Clonar el repositorio y entrar a `code/Splash_code_repository/`.
3. `copy .env.example .env` y completar `DATABASE_URL`, `JWT_SECRET`, `IA_TOKEN`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
4. Para probar sin cámara, copiar un video de la piscina a `videos/demo.mp4`.
5. `docker compose -f docker-compose.dev.yml up --watch`.
6. Abrir <http://localhost:3000> (web) y <http://localhost:3001/docs> (Swagger).

### 8.2 Desarrollo de nuevas funcionalidades

- Crear una rama desde `main_codigo` con el prefijo correspondiente: `feat/…`, `fix/…`.
- En el backend, respetar las capas (sección 4.1). La lógica de cálculo va en `domain/services/`, nunca en un controlador.
- **Quien mide solo manda posiciones en píxeles y la hora de captura.** Metros, cruces y velocidades se calculan una vez,
  en el backend. No duplicar el motor de eventos en Python ni en el navegador.
- Todo tiempo es la **hora de captura del frame**, nunca la hora de procesamiento.
- Un cambio en la base de datos es **una migración nueva** en `prisma/migrations/<AAAAMMDDhhmmss>_<nombre>/migration.sql`
  más el cambio equivalente en `schema.prisma`. Nunca se edita una migración ya aplicada.
- Un endpoint nuevo lleva sus ejemplos de Swagger (`presentation/swagger/ejemplos.ts`) y su guard de rol.
- Al agregar una variable de entorno, actualizar `.env.example`, los compose y la sección 7 de este documento.

### 8.3 Ejecución de pruebas y validaciones

Antes de integrar:

```powershell
# Frontend
cd ServidorWEB/frontend
npm run lint
npx tsc --noEmit
npm run build
node --test tests/

# Backend
cd ../backend
npm run build

# Todo junto, con el video de prueba
cd ../..
docker compose -f docker-compose.yml --profile demo up -d --build
docker compose -f docker-compose.yml ps -a   # backend healthy, migraciones exited (0)
```

Para la IA, correr `pipeline_concurrente.py` con `--simulado` contra un backend local y revisar que los resultados de la
sesión (`GET /api/sesiones/{id}/resultados`) tengan sentido. Con video real, usar `--mostrar`, `--registro-csv` y
`analizar_prueba.py`.

> `next.config.mjs` tiene `typescript.ignoreBuildErrors: true`: `npm run build` del frontend **no detecta errores de
> tipos**. Por eso se incluye `npx tsc --noEmit`.
>
> En el repositorio actual **no hay pruebas automatizadas del backend ni de la IA**: solo
> `frontend/tests/arquitectura.test.mjs`. Ver la sección 11.2.

### 8.4 Integración de cambios

- **Ramas:**
  - El código se integra en **`main_codigo`** mediante pull requests desde la rama de la funcionalidad (por ejemplo, el
    PR #12 desde `fix/graphs-and-model`).
  - **`main`** contiene la documentación y una copia del código en `code/`. Después de integrar en `main_codigo`, la
    copia en `main` se actualiza.
  - Los cambios que se hagan directamente en `code/` de `main` deben llevarse también a `main_codigo`, para que las dos
    ramas no diverjan.
- **Mínimo para integrar:** el frontend y el backend compilan, `npm run lint` pasa, las migraciones nuevas se aplican
  sobre una base limpia y el entorno levanta con `--profile demo`.
- **Revisión:** al menos otra persona del equipo revisa el PR, sobre todo si toca `motor-eventos.ts`, `homografia.ts`,
  las migraciones o el contrato de trayectorias.

## 9. Dependencias y servicios externos

### 9.1 Servicios externos integrados

| Servicio | Para qué |
|---|---|
| **Supabase** (PostgreSQL) | Base de datos del entorno principal |
| **Cámara Axis** (RTSP) | Video de la piscina, a través de MediaMTX |
| **GitHub / torch.hub** | El servidor de IA descarga el código de YOLOv5 la primera vez (queda en `torch_cache`) |
| **Índice de PyTorch** (`download.pytorch.org/whl/cpu`) | Ruedas de torch para CPU |
| **Docker Hub** | Imágenes base (`node:22-alpine`, `python:3.11-slim`, `postgres:16-alpine`, `bluenviron/mediamtx`, `linuxserver/ffmpeg`) |
| **jsDelivr** | onnxruntime-web para la variante celular |
| **Google Drive / Roboflow** | Datasets de entrenamiento (no se versionan) |

### 9.2 Requisitos de acceso

- Acceso al proyecto de Supabase (o la `DATABASE_URL` que entregue el equipo). La contraseña es la de la **base**
  (Project Settings → Database), no la de la cuenta, y no debe contener `@ : / # ? %`.
- Usuario y contraseña de la cámara Axis, y estar en la misma red.
- Acceso al repositorio en GitHub.
- Acceso a la carpeta de Drive o al proyecto de Roboflow para reentrenar el modelo.

### 9.3 Consideraciones de desarrollo y pruebas

- **Sin cámara:** perfil `demo` con `videos/demo.mp4`, o la webcam (`webcam.ps1` en Windows,
  `docker-compose.webcam.yml` en Linux).
- **Sin modelo:** `pipeline_concurrente.py --simulado` genera detecciones falsas.
- **Sin internet** (en la piscina): `docker-compose.local.yml` con Postgres local y la IA corriendo con Python.
- **Base de pruebas:** no usar la base de Supabase de producción para experimentos. Usar la base local, que se borra con
  `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml down -v`.
- El pooler de Supabase limita las conexiones (15 en total): no abrir varios backends contra la misma base.

## 10. Convenciones del proyecto

### 10.1 Convenciones de código

- **Idioma:** el código de dominio, los nombres de archivos, las rutas de la API, las tablas y los comentarios están en
  **español** (`sesiones`, `calibracion`, `motor-eventos.ts`). Se mantienen los términos técnicos en inglés cuando son
  estándar (`tracker`, `guard`, `mapper`).
- **Backend:** archivos en kebab-case con sufijo de rol: `*.usecase.ts`, `*.repository.ts`, `*.controller.ts`,
  `*.module.ts`, `*.entity.ts`, `*.dto.ts`, `*.mapper.ts`. Repositorios Prisma con prefijo `prisma-`.
- **Frontend:** componentes en kebab-case (`sesion-panel.tsx`). Una carpeta por funcionalidad en `features/` con
  `components/`, `hooks/` y `model/`. ESLint con la configuración de Next.
- **Python:** snake_case, un módulo por etapa del pipeline, opciones de la línea de comandos con guiones
  (`--track-buffer-s`).
- **API:** rutas bajo `/api/`, en español y en plural (`/api/sesiones/{id}/resultados`).

### 10.2 Convenciones de repositorio

- **Ramas:** `main` (documentación y copia del código), `main_codigo` (integración del código) y ramas cortas por
  tarea: `feat/<tema>`, `fix/<tema>` (por ejemplo `feat/graph-and-csv`, `fix/admin-active-session`).
- **Commits:** en español o inglés, en imperativo y describiendo el cambio (*"IA: filtro de saltos de posición"*). Evitar
  mensajes sin contenido como `?????` o `whatever`, que hoy existen en el historial y no ayudan a nadie.
- **Archivos que no se versionan:** videos, `.onnx`, `.tflite`, datasets, `.csv`, `.npz`, `node_modules`, `.next`, `dist`
  y el cliente Prisma generado (ver `code/.gitignore`).
- **Migraciones:** con fecha y nombre descriptivo (`20261121000000_eliminar_historial_perfil`).

### 10.3 Convenciones de documentación

- `Instalacion.md`: cómo levantar, desplegar y operar el sistema. `Desarrollo.md`: cómo modificarlo.
- Al cambiar un compose, una variable, un script o una decisión técnica, actualizar en el mismo PR el documento que la
  menciona.
- Swagger (`/docs`) es la referencia de la API: cada endpoint lleva su descripción y su ejemplo.
- Los comentarios del código explican **por qué** (como hacen hoy los compose y Dockerfiles), no qué.

## 11. Problemas frecuentes y recomendaciones

### 11.1 Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `migraciones` termina en `Exited (1)` con `P1001` | No llega a la base: revisar `DATABASE_URL` y el DNS |
| `backend` queda `unhealthy` | `JWT_SECRET` corto o falta conexión a la base: `docker compose logs backend` |
| `npm ci … not in sync` | El lock se generó con otra versión de npm: `npx npm@10 install --package-lock-only` |
| `THESE PACKAGES DO NOT MATCH THE HASHES` al construir `ia` | Descarga cortada: repetir `docker compose build ia` |
| `ia` se reinicia una y otra vez | No hay video: falta `CAMERA_RTSP_URL` o el perfil `demo` |
| `network … not found` | Después de `docker system prune`: `down --remove-orphans` y volver a levantar |
| Los cambios no se recargan en desarrollo | En Windows/Mac hace falta polling (`WATCHPACK_POLLING`, `TSC_WATCHFILE`): ya está en `docker-compose.dev.yml` |
| La webcam no funciona con `CAMERA_SOURCE=0` en Windows | Docker no da acceso a la webcam en Windows: usar `webcam.ps1` |
| "Correo o contraseña incorrectos" con el administrador | Es la de `ADMIN_PASSWORD` de cuando se creó; cambiar el `.env` después no la cambia |

La lista completa está en la sección 6 de [Instalacion.md](Instalacion.md).

### 11.2 Deuda técnica conocida

- **Dos copias del código:** `main_codigo` y `code/` en `main` deben mantenerse sincronizadas a mano.
- **Pruebas:** no hay pruebas del backend ni de la IA versionadas, y ningún `npm test`. Solo existen las de
  `frontend/tests/`. No hay integración continua.
- **El build del frontend ignora los errores de TypeScript** (`ignoreBuildErrors: true`).
- **Valores sin respaldo con datos reales:** velocidad mínima de descanso (0,2 m/s), ventana de confirmación (3 s),
  histéresis (0,3 m), margen de pared (0,4 m) y umbrales de error de calibración (10 y 25 cm).
- **Medición pendiente:** MOTA e IDF1 del tracker, IoU promedio del detector y error frente a cronómetro manual
  (RNF-02: < 2 s por tramo).
- **Sin corrección de distorsión del lente** (calibración con tablero de ajedrez).
- **Distancia de la cámara al borde sin confirmar:** 5 m medidos con cinta contra ~6,6 m del ajuste.
- **Variante celular experimental:** ~2,8 FPS con WebGPU a 640 px, insuficiente para seguir bien a los nadadores.
- **Avisos y último frame en memoria** (`infrastructure/avisos`, `infrastructure/camara`): se pierden al reiniciar el
  backend y no sirven con más de una instancia.
- **IA solo en CPU:** la GPU requiere cambiar la imagen.
- Banderines de espalda que generan detecciones falsas: se mitigan con `fantasmas.py` y el filtro de saltos, pero hace
  falta sumar esos casos al dataset.

### 11.3 Recomendaciones para continuidad

1. Agregar pruebas al motor de eventos y a la homografía (son el corazón del cálculo), con `npm test` y un workflow de
   GitHub Actions que corra lint, verificación de tipos, build y pruebas en cada PR.
2. Unificar el código en una sola rama para eliminar la copia manual entre `main_codigo` y `main`.
3. Grabar una sesión real con cronometraje manual en paralelo y usarla para ajustar los umbrales de descanso y medir el
   error por tramo.
4. Anotar a mano un video corto y medir MOTA e IDF1 antes de tocar el tracker, para comparar cada cambio con datos.
5. Decidir con datos entre la variante celular y la de servidor (FPS, latencia, precisión, costo) antes de invertir más
   en la del celular.

## 12. Historial de decisiones técnicas relevantes

| Decisión | Razón |
|---|---|
| Quien mide envía solo píxeles y la hora de captura; el backend calcula todo lo demás | Un solo motor de eventos, sin duplicarlo en Python y JavaScript |
| Todo se mide con la hora de captura del frame | La latencia de procesamiento no altera las métricas |
| La homografía siempre la calcula el servidor | No se confía en matrices enviadas por el cliente |
| Cada sesión conserva la calibración con la que empezó | Los resultados no cambian si después se activa otra calibración |
| Las zonas se guardan junto con la calibración (una "posición de la cámara") | Al mover la cámara cambian las dos cosas a la vez |
| Un nadador por carril, con identidad estable | ByteTrack fragmentaba identidades; con `diou` y el gestor, los IDs bajaron de 695 a 175 en la prueba |
| Las posiciones perdidas se estiman y se marcan como inferidas, no como quietas | Un nadador que no se ve no está descansando |
| Ids de evento deterministas (sesión, nadador, tipo, hora) | Reenviar un lote no duplica nada; necesario con conexión inestable |
| NestJS con arquitectura limpia + Prisma | Mantenible y probable sin base real |
| Migraciones SQL escritas a mano | Índices parciales, restricciones y vistas que Prisma no expresa |
| Un contenedor por responsabilidad, con perfiles `demo` y `phone` | Mismo arranque en cualquier máquina; lo opcional no se levanta si no hace falta |
| MediaMTX como relé RTSP | Varios consumidores (IA, celular, VLC) leen una sola conexión a la cámara |
| Base externa (Supabase) en el entorno principal y Postgres local como opción | Datos compartidos por el equipo, con la posibilidad de trabajar en la piscina sin internet |
| Recorte a los carriles antes del detector | Más FPS sin bajar la resolución |
| Dos variantes de procesamiento (servidor y celular) elegibles desde la web | Hay que compararlas con datos; hoy se usa el servidor |

## 13. Referencias relacionadas

- [Instalacion.md](Instalacion.md): instalación, despliegue, comandos de Docker y problemas comunes.
- [InformeFinal.md](InformeFinal.md): documento principal del proyecto.
- [ServidorIA/ProcesamientoCelular/README.md](code/Splash_code_repository/ServidorIA/ProcesamientoCelular/README.md): variante celular y exportación a ONNX.
- Swagger de la API: <http://localhost:3001/docs> (con el backend corriendo).
- NestJS: <https://docs.nestjs.com> · Prisma: <https://www.prisma.io/docs> · Next.js: <https://nextjs.org/docs>
- YOLOv5: <https://github.com/ultralytics/yolov5> · boxmot: <https://github.com/mikel-brostrom/boxmot>
- MediaMTX: <https://github.com/bluenviron/mediamtx> · Docker Compose: <https://docs.docker.com/compose/>
- Supabase (conexión con pooler): <https://supabase.com/docs/guides/database/connecting-to-postgres>
