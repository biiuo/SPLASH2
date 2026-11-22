# Instalación y despliegue — SafeSplash

Todos los comandos se ejecutan en PowerShell dentro de `code/Splash_code_repository/`, salvo que se indique otra ruta.

## 1. Descripción general de la solución

SafeSplash mide, mediante visión por computador, los tiempos, velocidades y largos de los nadadores de los carriles 4, 5
y 6. Un servidor de IA detecta y sigue a los nadadores y envía sus posiciones en píxeles al backend, que las convierte a
metros, calcula los eventos y los almacena. La interfaz web presenta los resultados.

### 1.1 Lenguajes y tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Frontend | TypeScript, Next.js 16, React 19, Tailwind CSS 4 |
| Backend | TypeScript, NestJS 11, Node.js 22, Prisma 7 |
| Base de datos | PostgreSQL 16 (Supabase o local) |
| IA | Python 3.11, PyTorch 2.15 (CPU), YOLOv5s, boxmot 26 (ByteTrack) |
| Video | MediaMTX 1.21.3 (relé RTSP), ffmpeg |
| Contenedores | Docker, Docker Compose |

### 1.2 Componentes de la solución

| Componente | Ruta | Puerto |
|---|---|---|
| Frontend | `ServidorWEB/frontend` | 3000 |
| Backend (API y Swagger en `/docs`) | `ServidorWEB/backend` | 3001 |
| Base de datos | externa, o servicio `db` | 5432 |
| Relé de la cámara | servicio `mediamtx` | 8554 |
| Servidor de IA | `ServidorIA/ProcesamientoServidor` | — |
| Streaming al celular (opcional) | `ServidorIA/ProcesamientoCelular` | 8765 |

## 2. Requisitos previos

### 2.1 Software requerido

| Software | Versión | Uso |
|---|---|---|
| Git | cualquiera | Clonar el repositorio |
| Docker Desktop (con WSL 2 en Windows) | con Compose v2 | Instalación con contenedores |
| Node.js y npm | 22 y 10 | Instalación sin contenedores |
| Python | 3.11 | Servidor de IA sin contenedores |
| PostgreSQL | 16 | Solo si no se usa Supabase ni el contenedor `db` |
| ffmpeg | cualquiera | Modo demo o webcam sin contenedores (`winget install Gyan.FFmpeg`) |

Recursos: unos 6 GB de disco (la imagen de IA incluye PyTorch) y conexión a internet en la primera instalación.

### 2.2 Variables de entorno

Se definen en `code/Splash_code_repository/.env`, copiado de `.env.example`.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL. En Supabase se usa el *Session pooler* con `?sslmode=require&uselibpqcompat=true` |
| `JWT_SECRET` | Sí | Clave de firma de sesiones, de 32 caracteres como mínimo |
| `IA_TOKEN` | Sí | Token del servidor de IA ante el backend, distinto de `JWT_SECRET` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Recomendadas | Administrador inicial. Se crea solo si no existe ninguno |
| `CAMERA_RTSP_URL` | No | RTSP de la cámara. Si está vacía, el relé espera un publicador (demo o webcam) |
| `PROCESAR_EN` | No | `servidor` (por defecto) o `celular` |
| `DEMO_VIDEO` | No | Video de `videos/` que usa el perfil `demo` (por defecto `demo.mp4`) |

Generación de claves:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Instalación para ambiente de desarrollo

### 3.1 Desarrollo sin contenedores

#### 3.1.1 Clonar el repositorio

```powershell
git clone https://github.com/biiuo/SPLASH2.git
cd SPLASH2\code\Splash_code_repository
```

#### 3.1.2 Instalar dependencias

```powershell
cd ServidorWEB\backend;  npm install; npx prisma generate
cd ..\frontend;          npm install
cd ..\..\ServidorIA\ProcesamientoServidor
py -3.11 -m venv .venv;  .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### 3.1.3 Configurar variables de entorno

Fuera de Docker, el backend lee `ServidorWEB/backend/.env`, no el `.env` de `code/Splash_code_repository/`. Las
variables ya definidas en la terminal tienen prioridad.

```powershell
copy .env.example ServidorWEB\backend\.env   # completar DATABASE_URL, JWT_SECRET, IA_TOKEN, ADMIN_*
```

El frontend usa `BACKEND_URL`, que por defecto vale `http://localhost:3001`.

#### 3.1.4 Ejecutar servicios requeridos

- **Base de datos:** Supabase, o PostgreSQL local con `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up -d db`.
- **Migraciones:** `cd ServidorWEB\backend; npm run db:migrar`.
- **Relé de video:** `docker compose -f docker-compose.dev.yml up -d mediamtx`. Para publicar la webcam: `.\webcam.ps1`.

#### 3.1.5 Iniciar la aplicación

Cada servicio se inicia en una terminal distinta:

```powershell
# Backend
cd ServidorWEB\backend;  npm run start:dev

# Frontend
cd ServidorWEB\frontend; npm run dev

# Servidor de IA
cd ServidorIA\ProcesamientoServidor\src
python pipeline_concurrente.py --source rtsp://localhost:8554/cam --weights ..\modelo\best.pt `
  --swimmer-only --letterbox --asso-func diou --backend-url http://localhost:3001
```

El servidor de IA necesita `IA_TOKEN` en el entorno (`$env:IA_TOKEN = "..."`). Para probar sin modelo se agrega
`--simulado`.

### 3.2 Desarrollo con contenedores

#### 3.2.1 Construcción de contenedores

```powershell
copy .env.example .env      # completar las variables de la sección 2.2
docker compose -f docker-compose.dev.yml build
```

La primera construcción tarda entre 10 y 30 minutos.

#### 3.2.2 Ejecución del entorno

| Caso | Comando |
|---|---|
| Entorno completo con recarga automática | `docker compose -f docker-compose.dev.yml up --watch` |
| Solo web y API | `docker compose -f docker-compose.dev.yml up --build frontend backend` |
| Con base local, sin internet | `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up backend frontend` |
| Con video de prueba (`videos/demo.mp4`) | agregar `--profile demo` |
| Con streaming al celular | agregar `--profile phone` |

El significado de cada archivo, subcomando y opción se explica en el [Anexo A](#anexo-a-referencia-de-comandos-de-docker).
La lista completa de variantes de desarrollo y prueba está en la sección 5.3 de [Desarrollo.md](Desarrollo.md).

#### 3.2.3 Servicios disponibles

| Servicio | Dirección |
|---|---|
| Web | <http://localhost:3000> |
| API y Swagger | <http://localhost:3001/docs> (solo desde el equipo local) |
| RTSP | `rtsp://localhost:8554/cam` |
| PostgreSQL local | `localhost:5432`, usuario `safesplash`, contraseña `local` |

#### 3.2.4 Apagado del entorno

```powershell
docker compose -f docker-compose.dev.yml down      # conserva los datos
docker compose -f docker-compose.dev.yml down -v   # borra los volúmenes (dependencias y cachés)
```

Si se usó `docker-compose.local.yml`, se debe incluir también en el `down`. En ese caso, `-v` borra además la base local.

## 4. Despliegue

### 4.1 Arquitectura de despliegue

El despliegue es local (*on-premise*): un único equipo en la red de la piscina ejecuta todos los servicios con
`docker-compose.yml`, y la base de datos está en Supabase. No existe un despliegue en la nube.

```
Cámara Axis ──RTSP──► [ mediamtx ─► ia ] ──HTTP──► [ backend ◄── frontend :3000 ] ──► Supabase (PostgreSQL)
                         red "video"                        red "backend"
```

### 4.2 Proceso de actualización

1. `git pull` en la rama `main`.
2. Reconstruir los servicios modificados (sección 4.4.5).
3. El servicio `migraciones` aplica automáticamente las migraciones nuevas en cada `up`.
4. Verificar según la sección 5.

### 4.3 Despliegue sin contenedores

#### 4.3.1 Preparación del servidor

Instalar Node.js 22, Python 3.11, Git y MediaMTX (binario de <https://github.com/bluenviron/mediamtx/releases>).
Abrir el puerto 3000 en el firewall.

#### 4.3.2 Instalación de dependencias

```powershell
cd ServidorWEB\backend;  npm ci; npm run build
cd ..\frontend;          npm ci; npm run build
cd ..\..\ServidorIA\ProcesamientoServidor; pip install -r requirements.txt
```

#### 4.3.3 Configuración de la aplicación

- Backend: `ServidorWEB/backend/.env` con `NODE_ENV=production` y las variables de la sección 2.2.
- Frontend: variable `BACKEND_URL` apuntando al backend.
- MediaMTX: definir la ruta `cam` con `source: <CAMERA_RTSP_URL>` en `mediamtx.yml`.

#### 4.3.4 Ejecución de la aplicación

```powershell
cd ServidorWEB\backend;  npm run db:migrar; npm start
cd ServidorWEB\frontend; npm start
cd ServidorIA\ProcesamientoServidor\src; python pipeline_concurrente.py <argumentos de 3.1.5>
```

Para que los servicios se reinicien solos, conviene registrarlos con un gestor de procesos (pm2, NSSM o systemd).

#### 4.3.5 Actualización de versiones

`git pull`, repetir 4.3.2, aplicar `npm run db:migrar` y reiniciar los tres procesos.

### 4.4 Despliegue con contenedores

#### 4.4.1 Construcción de imágenes

```powershell
docker compose -f docker-compose.yml config   # valida el archivo y las variables
docker compose -f docker-compose.yml build
```

#### 4.4.2 Ejecución en servidor

```powershell
docker compose -f docker-compose.yml up -d                    # con la cámara real (CAMERA_RTSP_URL definida)
docker compose -f docker-compose.yml --profile demo up -d     # con video de prueba
```

Todos los servicios tienen `restart: unless-stopped` y se reinician con Docker.

#### 4.4.3 Variables de entorno y secretos

- Se leen de `code/Splash_code_repository/.env`, que no se versiona.
- Las variables obligatorias usan `${VAR:?mensaje}`: Compose no arranca si falta alguna.
- Son secretos `DATABASE_URL`, `JWT_SECRET`, `IA_TOKEN`, `ADMIN_PASSWORD` y `CAMERA_RTSP_URL`. Se comparten solo por un
  canal privado.

#### 4.4.4 Persistencia y redes

| Elemento | Tipo | Contenido |
|---|---|---|
| Supabase | externo | Todos los datos de la aplicación |
| `torch_cache` | volumen | Código de YOLOv5 (regenerable) |
| `ia_data` | volumen | Salidas del servidor de IA |
| `modelo/best.pt`, `config/`, `videos/` | montajes de solo lectura | Modelo, zonas, video de prueba |
| `backend` | red | frontend, backend, ia |
| `video` | red | mediamtx, ia, stream-ws, camara-simulada |

El backend publica el puerto 3001 solo en `127.0.0.1`; el frontend publica el 3000 en toda la red local.

#### 4.4.5 Actualización del despliegue

| Cambio | Comando |
|---|---|
| Frontend o backend | `docker compose -f docker-compose.yml up -d --build frontend backend` |
| Migraciones | `docker compose -f docker-compose.yml up -d --build migraciones backend` |
| Código o dependencias de IA | `docker compose -f docker-compose.yml up -d --build ia` |
| Modelo `best.pt` | `docker compose -f docker-compose.yml restart ia` |
| `.env` | `docker compose -f docker-compose.yml up -d` |

## 5. Verificación de funcionamiento

1. `docker compose -f docker-compose.yml ps -a` debe mostrar:
   - `backend` en `running (healthy)`,
   - `migraciones` en `exited (0)`,
   - `frontend`, `ia` y `mediamtx` en `running`.
2. <http://localhost:3001/api/salud> responde correctamente.
3. Se puede iniciar sesión en <http://localhost:3000> con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
4. Se calibra la cámara, se definen las zonas `lane4`, `lane5` y `lane6`, y se inicia una sesión.
5. En `docker compose -f docker-compose.yml logs -f ia`, el servidor de IA sale del estado `en pausa: sin sesión` y
   empieza a enviar posiciones; en el panel de la sesión aparecen marcas y velocidades.

Para ver las detecciones del modelo sobre el video, ver el [Anexo A.9](#a9-ver-el-modelo-en-funcionamiento).

## 6. Solución de problemas frecuentes

| Síntoma | Solución |
|---|---|
| `migraciones` en `Exited (1)` con `P1001` | Revisar `DATABASE_URL` y la conectividad con la base |
| `backend` en `unhealthy` | Revisar `JWT_SECRET` (32 caracteres como mínimo) y la base: `logs backend` |
| `npm ci … not in sync` | `npx npm@10 install --package-lock-only` en la carpeta afectada |
| `THESE PACKAGES DO NOT MATCH THE HASHES` | Descarga interrumpida: repetir `docker compose build ia` |
| `ia` se reinicia continuamente | No hay fuente de video: definir `CAMERA_RTSP_URL` o usar `--profile demo` |
| `network … not found` | `docker compose -f docker-compose.yml --profile demo --profile phone down --remove-orphans` |
| `wsl --version` falla con *"Clase no registrada"* | Reinstalar WSL desde <https://github.com/microsoft/WSL/releases> |
| Credenciales del administrador rechazadas | El administrador conserva la contraseña con la que se creó la primera vez; modificar el `.env` después no la cambia |
| La webcam no funciona en Docker en Windows | Usar `webcam.ps1` con `mediamtx` en ejecución |
| La web muestra *"This page couldn't load"* tras reconstruir | Pestaña con versión anterior: recargar con `Ctrl+F5` |

## 7. Mantenimiento y actualización

- **Respaldos:** los datos residen en Supabase; se respaldan desde su panel o con `pg_dump "$DATABASE_URL"`.
- **Esquema:** cada cambio es una migración nueva en `ServidorWEB/backend/prisma/migrations/`. No se modifican
  migraciones ya aplicadas.
- **Modelo:** reemplazar `ServidorIA/ProcesamientoServidor/modelo/best.pt` y reiniciar `ia`.
- **Dependencias:** revisar periódicamente con `npm audit` y regenerar los lockfiles con npm 10.
- **Espacio:** `docker system df` para consultar el uso. `docker builder prune` libera la caché de construcción, a costa
  de volver a descargar todo en la siguiente construcción.
- **Recalibración:** cada vez que se mueva la cámara, desde la web (Calibración y Zonas).

## 8. Referencias relacionadas

- [Desarrollo.md](Desarrollo.md): manual de desarrollo.
- [InformeFinal.md](InformeFinal.md): documento principal del proyecto.
- [ServidorIA/ProcesamientoCelular/README.md](code/Splash_code_repository/ServidorIA/ProcesamientoCelular/README.md): variante celular.
- Docker Compose: <https://docs.docker.com/compose/> · Prisma Migrate: <https://www.prisma.io/docs/orm/prisma-migrate>
- Supabase: <https://supabase.com/docs/guides/database/connecting-to-postgres> · MediaMTX: <https://github.com/bluenviron/mediamtx>

## Anexo A. Referencia de comandos de Docker

### A.1 Archivos de Compose

| Archivo | Propósito | Base de datos | Recarga de código | Migraciones |
|---|---|---|---|---|
| `docker-compose.yml` | Entorno principal y despliegue. Construye imágenes de producción | Externa (`DATABASE_URL` obligatoria) | No: hay que reconstruir | Servicio `migraciones` |
| `docker-compose.dev.yml` | Desarrollo. Monta el código fuente en los contenedores | Externa, o local si se suma `local.yml` | Sí | Las aplica el backend al arrancar |
| `docker-compose.local.yml` | Complemento de `dev.yml`. Agrega el servicio `db` (PostgreSQL local) y apunta el backend a él | Local (`safesplash`/`local`) | — | — |
| `docker-compose.webcam.yml` | Complemento de `dev.yml`, solo Linux. Entrega `/dev/video0` al servicio `ia` | — | — | — |

Los complementos no funcionan solos: siempre se combinan con `docker-compose.dev.yml` (sección A.2).

### A.2 Estructura de un comando

```text
docker compose  -f <archivo> [-f <complemento>]  [--profile <perfil>]  <subcomando>  [opciones]  [servicio ...]
```

| Parte | Significado |
|---|---|
| `-f <archivo>` | Archivo de Compose a usar. Si se omite, se usa `docker-compose.yml`. Con varios `-f`, los archivos se fusionan en orden y cada uno sobrescribe al anterior |
| `--profile <perfil>` | Activa servicios opcionales: `demo` agrega `camara-simulada` y `phone` agrega `stream-ws`. Se puede repetir |
| `<subcomando>` | Acción a ejecutar (sección A.3) |
| `[servicio ...]` | Limita la acción a los servicios indicados (por ejemplo `backend frontend`). Si se omite, aplica a todos. `up` levanta también las dependencias declaradas en `depends_on` |

El mismo `-f` y los mismos `--profile` deben repetirse en todos los comandos del mismo entorno (`ps`, `logs`, `down`…).
Si no se repiten, Compose no ve los servicios de esos archivos o perfiles.

### A.3 Subcomandos

| Subcomando | Función |
|---|---|
| `up` | Crea e inicia los contenedores. Si la imagen no existe, la construye |
| `build` | Solo construye las imágenes, sin iniciar contenedores |
| `down` | Detiene y elimina contenedores y redes. Conserva los volúmenes (los datos) |
| `stop` / `start` | Detiene / reanuda los contenedores sin eliminarlos |
| `restart` | Reinicia los contenedores sin reconstruirlos. Sirve para cambios en archivos montados (`best.pt`, video de demo), no para cambios de código en el entorno principal |
| `ps` | Lista los servicios y su estado |
| `logs` | Muestra la salida de los servicios |
| `exec <servicio> <comando>` | Ejecuta un comando dentro de un contenedor en ejecución |
| `run <servicio> <comando>` | Crea un contenedor nuevo y temporal del servicio para ejecutar un comando |
| `config` | Muestra la configuración final, ya fusionada y con las variables resueltas. Detecta errores de sintaxis sin iniciar nada |

### A.4 Opciones

| Opción | Subcomando | Efecto |
|---|---|---|
| `-d` | `up` | Ejecuta en segundo plano y devuelve la terminal. Sin `-d`, los logs se ven en pantalla y `Ctrl+C` detiene los servicios |
| `--build` | `up` | Reconstruye las imágenes antes de iniciar. Necesaria después de cambiar código en el entorno principal |
| `--watch` | `up` | Observa el código y aplica las reglas `develop.watch`. Solo `ia` las tiene: si cambia un `.py`, lo copia y reinicia el servicio; si cambian `requirements.txt`, `entrypoint.sh` o el `Dockerfile`, reconstruye la imagen. Backend y frontend se recargan solos porque su código está montado |
| `--no-cache` | `build` | Construye desde cero, sin reutilizar capas |
| `--remove-orphans` | `up`, `down` | Elimina contenedores de servicios que ya no figuran en los archivos o perfiles usados |
| `-v` | `down` | **También elimina los volúmenes:** la base local (`pgdata`), las dependencias instaladas y las cachés. No afecta a la base externa |
| `-a` | `ps` | Incluye los contenedores detenidos. Así se ve `migraciones` en `exited (0)` |
| `-f` | `logs` | Sigue la salida en vivo hasta `Ctrl+C`. Aquí `-f` significa *follow*, no *file* |
| `--tail <n>` | `logs` | Muestra solo las últimas `n` líneas |
| `--rm` | `run` | Elimina el contenedor temporal al terminar |
| `--no-deps` | `run`, `up` | No inicia los servicios de los que depende el indicado |
| `--entrypoint <cmd>` | `run` | Reemplaza el programa de inicio de la imagen (por ejemplo, `python` en lugar de `entrypoint.sh`) |

### A.5 Combinaciones frecuentes

| Comando | Explicación |
|---|---|
| `docker compose -f docker-compose.dev.yml up --watch` | Desarrollo completo en primer plano, con recarga de backend, frontend e IA |
| `docker compose -f docker-compose.dev.yml up --build frontend backend` | Solo web y API. `mediamtx` e `ia` no se inician |
| `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up backend frontend` | Web y API contra PostgreSQL local; `db` arranca por dependencia. Sirve para trabajar sin internet |
| `docker compose -f docker-compose.dev.yml -f docker-compose.local.yml exec db psql -U safesplash -d safesplash` | Consola SQL de la base local (`\dt` lista tablas, `\q` sale) |
| `docker compose -f docker-compose.dev.yml up -d mediamtx` y luego `.\webcam.ps1` | Inicia solo el relé y publica en él la webcam de Windows |
| `docker compose -f docker-compose.dev.yml -f docker-compose.webcam.yml up --watch ia` | IA con la webcam de la PC (solo Linux) |
| `docker compose -f docker-compose.dev.yml -f docker-compose.webcam.yml run --rm --no-deps --entrypoint python ia probar_enlace.py` | Contenedor temporal que solo prueba la conexión con la cámara y el backend |
| `docker compose -f docker-compose.yml up -d --build` | Entorno principal en segundo plano, reconstruyendo imágenes |
| `docker compose -f docker-compose.yml --profile demo up -d --build` | Igual, con `videos/demo.mp4` como cámara |
| `docker compose -f docker-compose.yml --profile demo --profile phone up -d --build` | Igual, más el streaming al celular por el puerto 8765 |
| `docker compose -f docker-compose.yml up -d --build migraciones backend` | Aplica migraciones nuevas y reinicia el backend |
| `docker compose -f docker-compose.yml logs -f ia` | Salida del servidor de IA en vivo |
| `docker compose -f docker-compose.yml logs --tail 30 backend` | Últimas 30 líneas del backend |
| `docker compose -f docker-compose.yml exec backend printenv DATABASE_URL` | Muestra a qué base está conectado el backend |
| `docker compose -f docker-compose.yml --profile demo --profile phone down --remove-orphans` | Elimina todo el entorno principal, incluidos los perfiles. Resuelve el error `network … not found` |
| `docker compose -f docker-compose.yml config` | Valida el archivo antes de construir |

### A.6 Comandos generales de Docker

| Comando | Función | Precaución |
|---|---|---|
| `docker version`, `docker compose version` | Verifican la instalación | — |
| `docker stats` | CPU y memoria por contenedor, en vivo | — |
| `docker system df` | Espacio usado por imágenes, contenedores, volúmenes y caché | — |
| `docker volume ls` | Lista los volúmenes (`safesplash_*`, `safesplash-dev_*`) | — |
| `docker system prune` | Borra contenedores detenidos, redes e imágenes sin uso | Puede causar `network … not found` |
| `docker builder prune` | Borra la caché de construcción | La siguiente construcción vuelve a descargar PyTorch |

### A.7 Orden de ejecución

#### A.7.1 Primera instalación (entorno principal)

| Paso | Comando | Propósito |
|---|---|---|
| 1 | `docker version` y `docker compose version` | Verificar que Docker está instalado y en ejecución |
| 2 | `cd code\Splash_code_repository` y `copy .env.example .env` | Crear el archivo de variables y completarlo (sección 2.2) |
| 3 | Copiar el video a `videos/demo.mp4` | Solo si se usará el perfil `demo` |
| 4 | `docker compose -f docker-compose.yml config` | Validar el archivo y las variables antes de construir |
| 5 | `docker compose -f docker-compose.yml build` | Construir las imágenes (entre 10 y 30 minutos la primera vez) |
| 6 | `docker compose -f docker-compose.yml --profile demo up -d` | Iniciar los servicios (sin `--profile demo` si se usa la cámara real) |
| 7 | `docker compose -f docker-compose.yml ps -a` | Verificar los estados (sección 5) |
| 8 | `docker compose -f docker-compose.yml logs --tail 30 <servicio>` | Solo si algún servicio no quedó en el estado esperado |
| 9 | Abrir <http://localhost:3000> | Iniciar sesión, calibrar, definir zonas e iniciar una sesión |

Los pasos 5 y 6 se pueden unir en `up -d --build`.

#### A.7.2 Uso diario en desarrollo

| Paso | Comando |
|---|---|
| 1 | `git pull` |
| 2 | `docker compose -f docker-compose.dev.yml up --watch` |
| 3 | Programar: los cambios se aplican solos |
| 4 | `Ctrl+C` y luego `docker compose -f docker-compose.dev.yml down` |

#### A.7.3 Orden de arranque de los servicios

Compose inicia los servicios en el orden que define `depends_on`. No hace falta iniciarlos a mano en este orden:

```text
Entorno principal:
  migraciones ──(termina con código 0)──► backend ──(healthy)──► frontend
  mediamtx ──► ia · stream-ws (phone) · camara-simulada (demo)

Entorno de desarrollo (+ local.yml):
  db ──(healthy)──► backend (instala, migra, inicia) ──(healthy)──► frontend
  mediamtx ──► ia · stream-ws · camara-simulada
```

En consecuencia:
- Si `migraciones` falla, el backend y el frontend no arrancan. Hay que revisar primero `logs migraciones`.
- El frontend espera a que el backend responda en `/api/salud`. En desarrollo, la primera vez puede tardar hasta tres
  minutos, mientras instala las dependencias.
- `ia` solo espera a que el contenedor `mediamtx` exista, no a que haya video ni sesión. Hasta entonces queda en
  `en pausa: sin sesión`.

#### A.7.4 Orden de los archivos `-f`

El archivo base va primero y los complementos después, porque cada archivo sobrescribe al anterior:

```powershell
docker compose -f docker-compose.dev.yml -f docker-compose.local.yml up backend frontend    # correcto
```

Con el orden invertido, el `DATABASE_URL` del archivo de desarrollo reemplaza al de la base local.

#### A.7.5 Orden para aplicar cambios

| Cambio | Secuencia |
|---|---|
| Código (entorno principal) | `git pull` → `up -d --build <servicio>` → `ps -a` |
| Migración nueva | `git pull` → `up -d --build migraciones backend` → `logs migraciones` |
| `.env` | Editar `.env` → `up -d` (Compose recrea solo los servicios afectados) |
| Error de red o de contenedores huérfanos | `down --remove-orphans` (con los mismos `--profile`) → `up -d` |
| Reinstalación limpia en desarrollo | `down -v` → `build --no-cache` → `up --watch` |

### A.8 El relé de video (MediaMTX)

El relé es el servicio `mediamtx`, un servidor RTSP que actúa como intermediario único entre la fuente de video y los
servicios que la consumen.

```text
Fuente (una sola)                       Relé                         Consumidores (varios)
cámara Axis ───────────┐                                           ┌─► ia (servidor de IA)
camara-simulada (demo) ─┼──► mediamtx  rtsp://…:8554/cam ──────────┼─► stream-ws (celular)
webcam.ps1 (Windows) ───┘                                           └─► VLC u otro reproductor
```

- **Por qué existe:** la cámara admite pocas conexiones simultáneas. El relé abre una sola conexión con ella y la
  reparte a todos los consumidores. Además, el resto del sistema siempre lee la misma dirección
  (`rtsp://mediamtx:8554/cam`), sin importar si el video viene de la cámara, de un archivo o de una webcam.
- **Modo de operación:** se define con `CAMERA_RTSP_URL`.
  - Con un valor, el relé se conecta a la cámara (modo *pull*).
  - Vacía, espera que alguien publique en `/cam` (modo *publisher*). Así funcionan `camara-simulada` y `webcam.ps1`.
- **Direcciones:**
  - Dentro de Docker: `rtsp://mediamtx:8554/cam`.
  - Desde el equipo: `rtsp://localhost:8554/cam`.
  - Desde otro dispositivo de la red: `rtsp://IP-DEL-EQUIPO:8554/cam`.
  - Se recomienda forzar el transporte TCP.
- **Comprobación:** abrir la dirección en VLC (Medio → Abrir ubicación de red). Si se ve el video, el relé funciona; si
  no, el problema está en la fuente, no en la IA.

### A.9 Ver el modelo en funcionamiento

La web muestra los resultados (marcas, velocidades, estados), pero no el video con las detecciones. Para ver lo que
detecta el modelo hay tres alternativas.

#### A.9.1 Ventana en vivo (Python local, recomendado)

Docker no puede abrir ventanas, así que el servidor de IA se ejecuta fuera de Docker con `--mostrar`.

1. Detener la IA de Docker para que no haya dos instancias enviando datos:

   ```powershell
   docker compose -f docker-compose.yml stop ia
   ```

2. Desde `ServidorIA/ProcesamientoServidor/src`, con el entorno de la sección 3.1.2 activo, ejecutar:

   ```powershell
   $env:IA_TOKEN = "<mismo valor que en .env>"
   python pipeline_concurrente.py --source rtsp://localhost:8554/cam --weights ..\modelo\best.pt `
     --swimmer-only --letterbox --asso-func diou --backend-url http://localhost:3001 --mostrar --ver-crudas
   ```

| Opción | Efecto |
|---|---|
| `--mostrar` | Abre una ventana con el video, las cajas, las zonas y los IDs. Teclas: `q` salir, `z` mostrar u ocultar zonas, `s` guardar captura |
| `--ver-crudas` | Además dibuja las detecciones sin filtrar del modelo (blanco, con confianza) y los tracks de ByteTrack (azul, con ID) |
| `--source videos\demo.mp4` | Procesa un archivo en lugar del relé |
| `--segundos <n>` | Termina después de `n` segundos |
| Sin `--backend-url` | Procesa sin enviar nada al backend. El modelo corre sin necesidad de una sesión |

Con `--backend-url`, el modelo solo procesa mientras hay una sesión activa iniciada desde la web.

#### A.9.2 Clips grabados (desde Docker)

Esta alternativa graba video anotado en el volumen `ia_data` y luego lo copia al equipo:

```powershell
docker compose -f docker-compose.yml stop ia
docker compose -f docker-compose.yml run --name ia-clips -e GRABAR_ANOTADO=1 ia --guardar-video /data/clips --ver-crudas
# iniciar una sesión en la web; detener con Ctrl+C
docker cp ia-clips:/data/clips .\clips
docker rm ia-clips
docker compose -f docker-compose.yml start ia
```

| Opción | Efecto |
|---|---|
| `--guardar-video <carpeta>` | Graba clips `.avi` solo mientras hay nadadores |
| `--video-continuo` | Graba un único clip con todo lo procesado en la sesión |
| `GRABAR_ANOTADO=1` | El clip incluye cajas, zonas y hora. Sin ella, el clip es el video limpio de la cámara |
| `--registro-csv <archivo>` | Guarda cada posición enviada, para analizarla con `analizar_prueba.py` |

Los argumentos después de `ia` se agregan a los de `entrypoint.sh`.

#### A.9.3 Registro del servicio

```powershell
docker compose -f docker-compose.yml logs -f ia
```

El registro no muestra imágenes, pero confirma el funcionamiento:
- `en pausa: sin sesión` indica que el modelo está detenido a la espera de una sesión;
- al iniciar una sesión, el servicio informa el procesamiento y el envío de posiciones.
