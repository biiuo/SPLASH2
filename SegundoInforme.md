# Segundo Informe — Safe Splash 2: sistema de monitoreo del rendimiento de nadadores mediante visión por computador

## Resumen / Abstract

El seguimiento del rendimiento en natación depende hoy, en gran medida, de la observación y el cronometraje manual por parte del entrenador, lo que introduce imprecisiones y limita la posibilidad de construir un historial digital y objetivo del desempeño del deportista. Safe Splash 2 propone un sistema de visión por computador que, mediante una única cámara fija instalada sobre los carriles 4, 5 y 6 de la piscina semiolímpica de la Universidad del Norte, detecta y sigue automáticamente a los nadadores, identifica eventos de nado (inicio y fin de vuelta, cambios de dirección, períodos de descanso) y calcula métricas de desempeño: tiempo por vuelta, distancia recorrida, velocidad promedio y ritmo, sin necesidad de instrumentar al deportista con sensores portátiles. La solución se apoya en un modelo YOLO con tracking integrado (ByteTrack/DeepSORT), calibrado contra las medidas físicas predefinidas de la piscina, y se organiza en una arquitectura de dos servidores: un Servidor de IA encargado del procesamiento de video y del cálculo de métricas, y un Servidor Web encargado del almacenamiento, la autenticación y la visualización, sincronizados entre sí.

---

## 1. Introducción

El entrenamiento deportivo de alto rendimiento se apoya cada vez más en tecnologías capaces de capturar información cuantitativa objetiva sobre el desempeño de los atletas, y la natación no es la excepción. En los últimos años, la visión por computador y el aprendizaje profundo han pasado de ser técnicas experimentales a convertirse en herramientas viables para el análisis deportivo: modelos de detección de objetos como la familia YOLO, combinados con algoritmos de seguimiento multiobjeto como ByteTrack o DeepSORT, permiten hoy detectar, seguir e interpretar el movimiento de personas dentro de un video sin necesidad de instrumentación física. En el ámbito de la natación en particular, el software cumple un rol cada vez más central como intermediario entre el gesto del deportista en el agua y la información que el entrenador necesita para tomar decisiones, sustituyendo progresivamente tareas que tradicionalmente exigían observación directa y registro manual.

A pesar de este avance tecnológico, la situación actual en la mayoría de los entornos de entrenamiento —incluida la piscina semiolímpica de la Universidad del Norte— sigue dependiendo casi por completo de la observación y el cronometraje manual. Esto obliga al entrenador a repartir su atención entre dirigir la sesión, cronometrar a los nadadores y registrar la información relevante, lo cual introduce errores humanos en el inicio y la parada del cronómetro y hace prácticamente inviable cronometrar con precisión a varios nadadores de forma simultánea. Además, la ausencia de un registro digital estructurado impide construir un historial de rendimiento que permita comparar sesiones, identificar tendencias y evaluar objetivamente la progresión del deportista a lo largo del tiempo, una carencia que afecta tanto a entrenadores, que pierden capacidad de análisis longitudinal, como a los propios nadadores, que no cuentan con retroalimentación cuantitativa sistemática de su evolución.

De esta situación se desprende una necesidad técnica concreta: contar con un mecanismo automático, no invasivo y de bajo costo de instrumentación, capaz de observar a los nadadores durante el entrenamiento y traducir ese video en métricas objetivas de desempeño. La oportunidad de diseño tecnológico consiste en aprovechar los avances recientes en detección y seguimiento de objetos —ya demostrados en otros contextos de natación con configuraciones de mayor infraestructura, como sistemas de ocho cámaras o de captura aérea mediante drones— para plantear una solución equivalente pero adaptada a una restricción real y frecuente en entornos universitarios: la disponibilidad de una única cámara fija que solo cubre una zona parcial de la piscina.

Sobre esta base surge Safe Splash 2, un sistema de visión por computador orientado al seguimiento automático de nadadores en la piscina semiolímpica de la Universidad del Norte mediante una cámara fija instalada sobre los carriles 4, 5 y 6. Sus funcionalidades clave incluyen la detección y el seguimiento del nadador mediante un modelo YOLO con tracking integrado, la identificación automática de eventos de nado y el cálculo de métricas como tiempo por vuelta, distancia recorrida, velocidad promedio y ritmo, todo ello accesible mediante una plataforma web con autenticación para entrenadores y nadadores. El impacto esperado es ofrecer una herramienta objetiva, escalable y de bajo costo de instrumentación que complemente —y no reemplace— el criterio del entrenador, sirviendo de base para las secciones siguientes, en las que se detalla el problema, el alcance, los objetivos y la solución propuesta.

---

## 2. Marco conceptual

### 2.1. Visión por computador
La visión por computador es el conjunto de técnicas utilizadas para obtener información de interés a partir de imágenes y videos. En el contexto de Safe Splash 2, constituye el componente encargado de transformar las imágenes capturadas por la cámara en información sobre la presencia, posición y desplazamiento de los nadadores.

La visión por computador resulta especialmente relevante en este proyecto porque permite realizar mediciones sin necesidad de instalar sensores directamente sobre el cuerpo del deportista.

En investigaciones recientes de natación se han utilizado cámaras para detectar y analizar automáticamente el movimiento de los nadadores. Chern et al. (2025), por ejemplo, desarrollaron un sistema de análisis basado en video y aprendizaje automático para obtener información cuantitativa del desempeño.

### 2.2. Procesamiento de imágenes y video
El procesamiento de imágenes comprende las operaciones realizadas sobre los cuadros obtenidos por una cámara antes de ejecutar las etapas de detección y seguimiento.

En una piscina, esta etapa puede ser importante debido a que los reflejos, las ondas, las salpicaduras y otros elementos visuales pueden generar información que dificulte la detección del nadador.

Por ello, Safe Splash 2 contempla la posibilidad de aplicar operaciones de reducción de ruido, filtrado y segmentación antes de ejecutar el detector. El informe original identifica específicamente el ruido visual producido por el agua como una de las restricciones técnicas del proyecto.

### 2.3. Detección de objetos
La detección de objetos consiste en localizar objetos dentro de una imagen y determinar su posición mediante regiones delimitadoras, normalmente conocidas como bounding boxes.

En Safe Splash 2, el objeto de interés es el nadador. El detector deberá identificar su posición en cada cuadro del video para posteriormente proporcionar esta información al módulo de seguimiento.

Los modelos de la familia YOLO son especialmente relevantes para este problema porque fueron diseñados para realizar detección de objetos de manera eficiente. Además, investigaciones específicas sobre natación han utilizado YOLO adaptado al dominio para detectar nadadores. Chern et al. (2025) utilizaron YOLOv4 como modelo inicial y realizaron transferencia de aprendizaje utilizando más de 120.000 imágenes etiquetadas de nadadores.

### 2.4. YOLO y aprendizaje por transferencia
YOLO (You Only Look Once) corresponde a una familia de modelos de detección de objetos que realizan la localización y clasificación de objetos directamente a partir de la imagen.

Una dificultad importante del proyecto consiste en que los nadadores presentan una apariencia diferente a las personas en escenarios terrestres. Además, el agua y las salpicaduras pueden generar patrones visuales que dificultan la detección.

Por esta razón, una alternativa consiste en utilizar aprendizaje por transferencia, partiendo de un modelo previamente entrenado y adaptándolo mediante datos específicos de nadadores.

Este procedimiento fue utilizado por Chern et al. (2025), quienes adaptaron YOLOv4 mediante transferencia de aprendizaje para desarrollar un detector específico para nadadores.

### 2.5. Seguimiento de objetos
La detección permite localizar un nadador en un cuadro determinado; el seguimiento de objetos busca mantener la correspondencia entre las detecciones de diferentes cuadros.

Esto permite construir una trayectoria temporal del objeto.

En Safe Splash 2, el seguimiento es necesario porque las métricas no dependen únicamente de saber dónde está el nadador, sino de conocer cómo cambia su posición a través del tiempo.

### 2.6. Seguimiento multiobjeto
El Multiple Object Tracking (MOT) consiste en localizar diferentes objetos y mantener una identidad asociada a cada uno a lo largo de una secuencia de video.

Este concepto resulta relevante porque Safe Splash 2 debe contemplar la posibilidad de que existan varios nadadores dentro de la zona observada.

El seguimiento multiobjeto presenta problemas como pérdida de identidad, fragmentación de trayectorias y oclusiones. ByteTrack fue desarrollado precisamente para mejorar la asociación entre detecciones y trayectorias, utilizando también detecciones de menor confianza para recuperar objetos que podrían perderse durante el seguimiento.

### 2.7. ByteTrack
ByteTrack es un algoritmo de seguimiento multiobjeto propuesto por Zhang et al. (2022).

Su principal característica es que no descarta automáticamente todas las detecciones que presentan una confianza baja. En lugar de ello, intenta asociarlas con trayectorias existentes para recuperar objetos que pueden encontrarse parcialmente ocultos.

Los autores reportaron resultados de 80,3 MOTA y 77,3 IDF1 en MOT17, con una velocidad de aproximadamente 30 FPS utilizando una GPU V100 en el experimento presentado en su trabajo.

Estos valores corresponden a benchmarks generales de seguimiento y no deben interpretarse como resultados esperados para Safe Splash 2. El proyecto deberá evaluar experimentalmente el comportamiento del algoritmo en el entorno acuático específico.

### 2.8. Trayectoria
La trayectoria representa la evolución de la posición de un nadador a través del tiempo.

Si el detector proporciona las coordenadas del centro de la región delimitadora y el tracker mantiene la identidad del nadador, es posible construir una secuencia:

posición₁ → posición₂ → posición₃ → ... → posiciónₙ

Esta trayectoria constituye la información fundamental para posteriormente detectar desplazamientos, cruces de líneas y cambios de dirección.

### 2.9. Detección de eventos
Un evento corresponde a una situación identificable dentro de la trayectoria del nadador.

En Safe Splash 2, algunos eventos pueden definirse mediante líneas o zonas virtuales dentro de la imagen. Por ejemplo:

entrada a la zona observable;
salida de la zona observable;
cruce de una línea virtual;
cambio de dirección inferido;
inicio de un intervalo;
finalización de un intervalo.
Debido a que la cámara no observa directamente los extremos de la piscina, el sistema debe diferenciar entre eventos observados directamente y eventos inferidos. Esta distinción es fundamental para evitar atribuir al sistema capacidades que la cámara no posee.

### 2.10. Calibración de cámara
La calibración permite establecer la relación entre las coordenadas de la imagen y el espacio físico.

Una imagen representa posiciones en píxeles, mientras que las métricas deportivas requieren unidades físicas como metros y segundos.

La literatura sobre seguimiento de nadadores ha utilizado técnicas de transformación geométrica para calibrar videos y obtener información espacial. Un sistema de seguimiento de nadadores basado en un enfoque de objetivos relacionados utilizó transformación lineal directa para calibrar los videos y posteriormente estimar el movimiento y la velocidad.

### 2.11. Homografía
La homografía es una transformación proyectiva que permite establecer correspondencias entre dos planos.

En el proyecto puede utilizarse para transformar puntos identificados en la imagen hacia un sistema de coordenadas asociado al plano de la piscina.

Esta transformación es especialmente útil cuando se conocen puntos de referencia del entorno, como las líneas de los carriles o determinadas posiciones cuya distancia real sea conocida.

La calibración debe validarse experimentalmente, debido a que errores en la correspondencia entre píxeles y posiciones físicas se trasladan directamente a las métricas de distancia y velocidad.

### 2.12. Distancia, velocidad y ritmo
Una vez obtenida una estimación de la posición del nadador en coordenadas físicas, es posible calcular diferentes métricas.

La distancia recorrida corresponde a la longitud del desplazamiento estimado.

La velocidad promedio puede calcularse como:

v = d / Δt

donde:

v representa la velocidad promedio;
d representa la distancia recorrida;
Δt representa el intervalo de tiempo.
El ritmo puede expresarse como el tiempo requerido para recorrer una distancia determinada, por ejemplo minutos por cada 100 metros.

Sin embargo, debido a la cobertura parcial de Safe Splash 2, estas métricas deben definirse de acuerdo con la zona realmente observada y no asumir automáticamente que la cámara observa la totalidad de una piscina de 25 metros.

### 2.13. Tiempo de descanso
El tiempo de descanso puede estimarse identificando períodos durante los cuales la trayectoria del nadador permanece prácticamente estacionaria o permanece dentro de una zona determinada durante un intervalo de tiempo.

Esta métrica requiere definir experimentalmente un umbral de movimiento para distinguir entre una pausa real y pequeñas variaciones de posición producidas por el movimiento del agua o por fluctuaciones del detector.

### 2.14. Tiempo cercano al real
El término near real-time hace referencia a un sistema que procesa los datos con una latencia suficientemente baja para proporcionar información durante o inmediatamente después de la captura.

El informe propone explícitamente un procesamiento cercano al tiempo real, sin exigir que el sistema cumpla necesariamente una condición estricta de tiempo real.

Esta definición resulta apropiada porque permite evaluar experimentalmente la latencia sin establecer previamente un valor que todavía no ha sido medido.

---

## 3. Planteamiento del problema

### 3.1 Descripción del problema

En la piscina semiolímpica de la Universidad del Norte —al igual que en la mayoría de los entornos de entrenamiento de natación que no cuentan con infraestructura de análisis automatizado— el seguimiento del rendimiento de los nadadores depende casi exclusivamente de la observación directa y el cronometraje manual realizado por el entrenador. Esta situación no es un caso aislado, sino una carencia transferible a cualquier contexto de entrenamiento con recursos tecnológicos limitados: existen técnicas de visión por computador capaces de automatizar este análisis, pero no están siendo aprovechadas en la práctica cotidiana del entrenamiento.

Esta carencia se manifiesta de varias formas. En primer lugar, la carga cognitiva del entrenador se ve comprometida cuando debe simultáneamente dirigir la sesión, cronometrar y registrar datos, lo que le resta capacidad de atención a los aspectos cualitativos del entrenamiento. En segundo lugar, la precisión del cronometraje manual es limitada: los errores humanos en el inicio y la parada del cronómetro, sumados a la dificultad de cronometrar a múltiples nadadores de forma simultánea, introducen imprecisiones que pueden oscurecer la verdadera evolución del deportista. En tercer lugar, la falta de un registro digital estructurado impide construir un historial de rendimiento que permita comparar sesiones, identificar tendencias y evaluar objetivamente la progresión del nadador a lo largo del tiempo.

Las principales afectadas por esta carencia son dos poblaciones concretas: los entrenadores, que carecen de una herramienta objetiva y escalable para el análisis diario y la evaluación técnica, y los propios nadadores, que no reciben retroalimentación cuantitativa sistemática sobre su desempeño. La consecuencia directa es que las decisiones de entrenamiento —ajustes de ritmo, series, tiempos de descanso— terminan apoyándose en percepciones subjetivas en lugar de datos verificables, lo que limita la calidad del proceso de mejora deportiva.

### 3.2 Restricciones y supuestos de diseño

El planteamiento de la solución asume las siguientes restricciones y supuestos:

- **Cámara única (Axis Q1604), trípode y campo visual parcial:** el sistema dispone de una sola cámara fija instalada sobre los carriles 4, 5 y 6, no cubre el resto de los carriles.
- **Disponibilidad de la piscina y de usuarios de prueba:** el desarrollo y la validación dependen de la disponibilidad de horarios de acceso a la piscina semiolímpica y de la colaboración voluntaria de nadadores y entrenadores para las pruebas de campo.
- **Recursos computacionales acotados:** el proyecto se desarrolla con los recursos de cómputo disponibles en un contexto académico, sin garantía de acceso permanente a hardware GPU de alto rendimiento, lo cual condiciona las decisiones sobre el tamaño y la complejidad del modelo a emplear.
- **Condiciones ambientales variables no controladas en su totalidad:** aunque se busca mitigar el efecto de reflejos, salpicaduras e iluminación variable mediante preprocesamiento, no se garantiza un desempeño óptimo bajo condiciones ambientales extremas.
- **Tiempo de desarrollo acotado al calendario académico:** el alcance del prototipo y el plan de trabajo están condicionados por la duración del período académico en el que se desarrolla el proyecto.

Las restricciones identificadas en el Primer Informe se mantienen, con cuatro ajustes derivados de la retroalimentación recibida y del trabajo de campo realizado en este período:

- **Cobertura de cámara ampliada:** el montaje se elevó a 2.5 metros de altura (misma cámara), lo que amplió la cobertura de dos a **tres carriles** observables con claridad, en lugar de los dos carriles previstos originalmente.
- **Calibración basada en nodos de color:** la calibración ya no depende únicamente de medidas físicas generales de la piscina, sino específicamente de los cambios de color de los divisores de carril cada 5 metros, que actúan como puntos de referencia fijos.
- **Ejecución local del modelo (en evaluación):** el equipo confirma la preferencia por ejecutar YOLOv5 localmente, sin depender de servicios de inferencia en la nube, lo que refuerza la restricción de recursos computacionales acotados ya identificada. Sin embargo, dado que el sistema debe producir las métricas de una sesión completa (1-2 horas) poco tiempo después de finalizada, esta decisión queda condicionada a que la inferencia local alcance el rendimiento necesario para un procesamiento cercano al tiempo real; si las pruebas muestran que el hardware local disponible no es suficiente, el equipo evaluará el uso de aceleración por GPU (local o remota) como alternativa, decisión que se documentará con los resultados de las pruebas de desempeño correspondientes.
- **Procesamiento no continuo:** para reducir la carga sobre el modelo, la toma de datos no será completamente en tiempo real; el sistema se apoya en los nodos de referencia cada 5 metros en lugar de un registro constante cuadro a cuadro.

### 3.3 Alcance actualizado

- **Carriles declarados:** el sistema procesará los tres carriles que quedan cubiertos con claridad tras la elevación de la cámara a 2.5 metros de altura (antes solo dos), sin cobertura de los carriles restantes de la piscina ni de sus extremos.
- **Nadadores simultáneos:** el MVP se compromete a detectar y seguir de forma confiable hasta 3 nadadores simultáneos, uno por carril observado, dado que cada carril se procesa de forma independiente. Este número es un punto de partida de trabajo que el equipo ajustará según las pruebas reales de detección con múltiples nadadores.
- **Eventos comprometidos:** el evento central y directamente observable del MVP es el paso del nadador por cada nodo de color de los divisores de carril, ubicados cada 5 metros; dado que la camara cubre los tres carriles observados de extremo a extremo, el viraje contra la pared tambien es un evento directamente observable dentro de esos tres carriles, y por tanto forma parte de las metricas garantizadas del MVP para los nadadores que permanecen en un carril cubierto.
- **Métricas comprometidas para el MVP:** a partir de los eventos de paso por nodo, el sistema calculará distancia recorrida (en múltiplos de 5 metros), velocidad promedio por sesión, y, dado que la cámara cubre los tres carriles de extremo a extremo, también el tiempo por vuelta y el conteo de largos completos para los nadadores que permanecen en un carril cubierto; se excluyen explícitamente del MVP el tiempo de descanso entre series y las métricas fuera del rango cubierto por los tres carriles.

---

## 4. Objetivos

### 4.1 Objetivo general

Diseñar e implementar un sistema inteligente basado en visión por computador que permita realizar el seguimiento automático de nadadores durante sus sesiones de entrenamiento en la piscina semiolímpica de la Universidad del Norte, mediante una única cámara calibrada contra las medidas físicas predefinidas de la piscina, registrando tiempos, recorridos e indicadores de desempeño que apoyen el análisis objetivo del entrenamiento por parte de entrenadores y deportistas.

### 4.2 Objetivos específicos

1. Capturar y calibrar el video de entrenamiento mediante una cámara fija, estableciendo la correspondencia entre coordenadas de imagen y distancias reales a partir de las medidas estáticas predefinidas de la piscina (longitud de carril y nodos de color).
2. Preprocesar y estandarizar los frames capturados (redimensionamiento, corrección de iluminación, mejora de contraste, reducción de ruido, corrección de perspectiva y normalización), garantizando que únicamente frames estandarizados y validados sean enviados al modelo de inteligencia artificial.
3. Detectar y realizar seguimiento (tracking) automático de máximo tres nadadores presentes en los carriles 4, 5 y 6 mediante un modelo YOLO con capacidades integradas de detección y tracking (p. ej. YOLO + ByteTrack/DeepSORT), manteniendo la identidad de cada nadador durante toda la sesión, incluso ante oclusiones temporales o cambios de dirección.
4. Identificar automáticamente eventos de nado, tales como el inicio y fin de cada vuelta, cambios de dirección, períodos de descanso y finalización del entrenamiento.
5. Calcular métricas de desempeño por nadador —tiempo por vuelta, tiempo total, distancia recorrida, velocidad promedio, ritmo de entrenamiento, número de largos y tiempos de descanso— a partir de los datos generados por el módulo de tracking.
6. Diseñar una arquitectura de comunicación entre el Servidor de IA y el Servidor Web que permita el envío confiable de métricas, la validación de la información recibida y la sincronización del estado de ambos servicios (activo/inactivo, heartbeat).
7. Desarrollar una plataforma web (backend + frontend) que permita a entrenadores y nadadores visualizar estadísticas en tiempo real, consultar el historial de entrenamientos y comparar sesiones anteriores.
8. Generar reportes de desempeño exportables en formato PDF y CSV, que resuman las métricas individuales y la evolución del rendimiento del nadador.
9. Gestionar los roles de usuario (administrador, entrenador, nadador) mediante un módulo de autenticación y autorización que restrinja el acceso a las funciones según el perfil correspondiente.
---

## 5. Estado del arte / soluciones relacionadas

La literatura especializada muestra una evolución desde sistemas basados exclusivamente en sensores portátiles hacia soluciones capaces de utilizar video para realizar mediciones sin instrumentar físicamente al nadador. A continuación se presentan cinco antecedentes representativos, evaluados frente a los criterios de funcionalidad, escalabilidad, costo/infraestructura, usabilidad y limitaciones técnicas, seguidos de los vacíos identificados que justifican la propuesta de Safe Splash 2.

**Chern et al. (2025) — Sistema de análisis de estilo mariposa.** Desarrollaron un sistema inteligente para registrar y analizar el estilo mariposa mediante ocho cámaras (cuatro sobre el agua y cuatro bajo el agua) distribuidas a lo largo de una piscina de 25 metros, junto con acelerómetros. El modelo de reconocimiento fue entrenado mediante transfer learning sobre 120.031 imágenes etiquetadas, utilizando YOLOv4 como base, y alcanzó un IoU de 81,51 % y un error absoluto medio de 0,36 segundos en tiempos parciales. Es un antecedente clave por demostrar la viabilidad de YOLO en el dominio acuático, pero su infraestructura (ocho cámaras + sensores portátiles) es considerablemente mayor que la de Safe Splash 2, lo que limita su escalabilidad a contextos con recursos reducidos.

**Dronaquatics (Tran et al., 2026) — Análisis de natación con drones.** Sistema completamente basado en visión que utiliza imágenes aéreas capturadas por drones para eliminar la necesidad de dispositivos portátiles o equipos subacuáticos. Reportó un error de estimación de velocidad inferior al 4 % (menos de 0,05 m/s) y un error en tiempo por vuelta de 0,03 segundos. Ofrece alta funcionalidad y buena usabilidad de operación (un solo operador de dron), pero su escalabilidad está condicionada por la necesidad de personal capacitado para el vuelo del dron y por restricciones normativas de uso de drones en instalaciones cerradas, además de un costo de hardware mayor al de una cámara fija.

**SwimmerNET (Giulietti et al., 2023) — Estimación de pose subacuática.** Método sin marcadores para estimación de pose 2D bajo el agua mediante una única cámara gran angular de 8 Megapíxeles y redes neuronales completamente convolucionales, probado en los estilos libre, mariposa y espalda con un error promedio de ~1 mm y una desviación estándar de ~10 mm en el peor escenario. Es el antecedente más cercano a Safe Splash 2 en términos de infraestructura (cámara única), lo que respalda la viabilidad técnica de esta configuración; sin embargo, su enfoque está orientado a la estimación de pose biomecánica y no a métricas de desplazamiento agregadas por sesión, ni incorpora una plataforma web de consulta.

**SMU y SUTD (2025) — Análisis con drones para nadadores de élite.** Sistema desplegado en marzo de 2025 por investigadores de Singapore Management University y Singapore University of Technology and Design para el equipo nacional de natación de Singapur, que analiza en tiempo real duración de la brazada, velocidad de nado y simetría corporal segmentando el cuerpo del atleta en 17 puntos. Tiene alta funcionalidad y validación en contexto de alto rendimiento, pero de nuevo depende de un dron operado por personal especializado, lo que eleva su costo y limita su replicabilidad en entornos universitarios con recursos acotados.

**Proyectos de código abierto en GitHub.** YOLO-swimmer-detection (DBDoco) implementa detección de nadadores en Python con YOLO, un frontend HTTP simple y un servidor Flask. SwimmingStyleAnalysis (Sapna24Sangmitra, 2024) implementa un pipeline más completo basado en YOLOv8 que combina extracción de cuadros, detección, estimación de pose (YOLOv8-pose) y clasificación de estilo de nado, con suavizado temporal. Ambos son gratuitos y de bajo costo de infraestructura, lo que los hace altamente escalables, pero carecen de módulos de calibración física de la piscina, de cálculo de métricas de entrenamiento (tiempo por vuelta, distancia, ritmo) y de una plataforma web orientada a entrenadores y nadadores, quedándose en el nivel de prueba de concepto técnico.

| Sistema | Funcionalidad | Escalabilidad | Costo / infraestructura | Usabilidad | Limitaciones técnicas |
|---|---|---|---|---|---|
| Chern et al. (2025) | Tiempos parciales, conteo de brazadas, ángulos de rodilla | Baja (8 cámaras + acelerómetros) | Alto | Requiere instalación fija compleja | No aplicado fuera del estilo mariposa validado |
| Dronaquatics (2026) | Velocidad, tiempo por vuelta, conteo de brazadas | Media (requiere operador de dron) | Medio-alto | Buena una vez en vuelo | Restricciones normativas y de espacio para volar en piscinas cubiertas |
| SwimmerNET (2023) | Pose 2D detallada del nadador | Alta (cámara única) | Bajo | Orientado a análisis técnico especializado | No calcula métricas agregadas de sesión ni tiene interfaz web |
| SMU/SUTD (2025) | Brazada, velocidad, simetría corporal en tiempo real | Media (requiere dron y personal) | Alto | Alta en contexto de selección nacional | Difícil de replicar con recursos universitarios limitados |
| Proyectos open-source (DBDoco; Sapna24Sangmitra, 2024) | Detección de nadadores; detección + pose + clasificación de estilo | Alta (gratuitos, cámara única) | Muy bajo | Nivel de prototipo técnico, sin UI orientada a usuario final | Sin calibración física, sin métricas de entrenamiento ni plataforma web |

**Resultados esperados de la revisión.** La revisión evidencia que existen soluciones consolidadas para partes aisladas del problema —detección de nadadores, seguimiento de objetos (ByteTrack, DeepSORT), estimación de pose y cálculo de métricas de desplazamiento—, pero ninguna de ellas combina, con una única cámara fija de bajo costo, la calibración física de la piscina, el cálculo de métricas de entrenamiento orientadas al entrenador (tiempo por vuelta, distancia, ritmo, descansos) y una plataforma web con roles diferenciados para consulta histórica. Los sistemas con mayor precisión reportada (Chern et al., 2025; Dronaquatics, 2026; SMU/SUTD, 2025) dependen de infraestructuras de captura amplias (múltiples cámaras o drones) inviables en un entorno universitario típico, mientras que las soluciones de cámara única (SwimmerNET, 2023; proyectos open-source) no cubren el cálculo de métricas de entrenamiento ni la capa de aplicación web. Esta combinación de restricciones —cámara única, bajo costo y orientación a entrenamiento— constituye el vacío técnico que Safe Splash 2 busca atender, y su aporte no debe plantearse como la creación de un nuevo algoritmo de detección o tracking, sino como la integración y adaptación de técnicas existentes a un escenario específico con restricciones reales de hardware, campo visual y procesamiento.

---

## 6. Solución propuesta

Safe Splash 2 propone construir un sistema compuesto por una cámara fija, un **Servidor de IA** y un **Servidor Web** que trabajan de forma coordinada para transformar video en información útil de entrenamiento. A alto nivel, el flujo de procesamiento sigue la secuencia: *Cámara → Captura de video → Preprocesamiento → Detector de nadadores (YOLO) → Tracker (ByteTrack/DeepSORT) → Motor de eventos → Calibración/transformación espacial → Cálculo de métricas → Base de datos → API/Backend → Dashboard web*.

El **Servidor de IA** concentra el procesamiento más intensivo: recibe el video capturado, lo estandariza (redimensionamiento, corrección de iluminación y contraste, reducción de ruido, corrección de perspectiva), detecta y sigue al nadador mediante un modelo YOLO con tracking integrado, identifica eventos de nado a partir de la trayectoria (cruces de líneas virtuales, cambios de dirección) y calcula las métricas de desempeño. El **Servidor Web**, por su parte, recibe estas métricas ya calculadas, las almacena en una base de datos, gestiona la autenticación y los roles de usuario, y expone la información mediante una plataforma con frontend accesible a entrenadores y nadadores. Ambos servidores se comunican mediante una arquitectura con sincronización de estado (heartbeat), lo que permite detectar caídas de servicio y mantener la confiabilidad del envío de métricas.

Los usuarios del sistema son tres: **nadadores**, que consultan su historial y evolución de desempeño; **entrenadores**, que además pueden hacer seguimiento a los nadadores a su cargo y generar reportes exportables; y **administradores**, encargados de la gestión general de usuarios y roles. Esta solución constituye una respuesta adecuada al problema planteado porque automatiza precisamente las tareas que hoy recaen por completo en el entrenador —cronometraje, registro y cálculo de métricas—, sin requerir instrumentación física del nadador ni una infraestructura de cámaras múltiples, ajustándose así a una restricción real y común en entornos universitarios: la disponibilidad de una sola cámara fija con cobertura parcial de la piscina.

---

## 7. Metodología de desarrollo

El desarrollo de Safe Splash 2 seguirá un enfoque de **prototipado iterativo**, en el cual la solución se construye mediante ciclos sucesivos de diseño, construcción, prueba y ajuste, en lugar de intentar entregar el sistema completo en una sola etapa. Esta elección responde a la naturaleza incierta de varios componentes del proyecto —en particular, la precisión alcanzable del detector y del tracker en condiciones reales de la piscina de la Universidad del Norte, que no puede conocerse con certeza antes de experimentar— por lo que resulta más apropiado avanzar validando supuestos técnicos en cada ciclo (p. ej. calidad de detección, estabilidad del tracking, viabilidad de la calibración) antes de comprometer decisiones de arquitectura definitivas para las etapas siguientes.

### 7.2 Iteraciones o fases de desarrollo

- **Fase 0 — Investigación y preparación:** definición de requerimientos, medición y documentación física de la piscina (longitud de carril, marcas de fondo, banderas de vuelta), y revisión del estado del arte para fijar la línea base técnica.
- **Fase 1 — Prototipo de detección:** construcción de un conjunto de datos propio de imágenes de nadadores en la piscina de la universidad, y ajuste (fine-tuning) de un modelo YOLO para la detección del nadador dentro de la zona observable.
- **Fase 2 — Integración de tracking y motor de eventos:** incorporación de un algoritmo de seguimiento multiobjeto (ByteTrack o DeepSORT) sobre las detecciones del modelo, y diseño del motor de eventos basado en líneas o zonas virtuales para identificar entradas, salidas y cruces.
- **Fase 3 — Calibración y cálculo de métricas:** implementación de la homografía para transformar coordenadas de imagen a coordenadas físicas, y cálculo de las métricas de desempeño (tiempo por vuelta, distancia, velocidad, ritmo, descansos).
- **Fase 4 — Arquitectura Servidor de IA / Servidor Web:** desarrollo del canal de comunicación entre ambos servidores, incluyendo el mecanismo de sincronización de estado (heartbeat) y la persistencia de métricas en base de datos.
- **Fase 5 — Plataforma web:** desarrollo del backend y frontend, del módulo de autenticación con roles diferenciados (administrador, entrenador, nadador) y de la generación de reportes exportables (PDF/CSV).
- **Fase 6 — Integración, pruebas de campo y ajuste final:** pruebas del sistema completo en la piscina semiolímpica, recolección de retroalimentación de entrenadores y nadadores, y ajustes finales antes de la entrega.

### 7.3 Estrategia de validación

La validación de cada iteración combinará varias estrategias complementarias:

- **Comparación contra registros manuales de referencia:** contraste de los tiempos y distancias calculados por el sistema frente a cronometraje manual realizado en paralelo, empleando el error absoluto medio como métrica principal (siguiendo el precedente metodológico de Chern et al., 2025).
- **Pruebas funcionales por módulo:** verificación independiente del detector, el tracker, el motor de eventos, el cálculo de métricas y la plataforma web antes de su integración.
- **Métricas estándar de seguimiento multiobjeto:** evaluación del módulo de tracking mediante métricas MOTA e IDF1, conforme al protocolo CLEAR MOT (Bernardin & Stiefelhagen, 2008).
- **Retroalimentación cualitativa de usuarios:** sesiones breves con entrenadores y nadadores voluntarios al cierre de cada fase relevante, para evaluar la usabilidad de la plataforma web y la utilidad percibida de las métricas presentadas.
- **Pruebas de robustez:** evaluación del comportamiento del sistema ante escenarios de oclusión, múltiples nadadores simultáneos y variaciones de iluminación, documentando explícitamente los casos en los que el sistema no logra un desempeño confiable.

### 7.4 Plan de trabajo, cronograma o hitos

| Fase | Actividades principales | Entregable esperado | Duración estimada |
|---|---|---|---|
| Fase 0 | Definición de requerimientos, medición física de la piscina, revisión de literatura | Documento de requerimientos y estado del arte | 2 semanas |
| Fase 1 | Captura y etiquetado de dataset propio, fine-tuning del detector YOLO | Modelo de detección entrenado y evaluado (IoU) | 3 semanas |
| Fase 2 | Integración de tracker y motor de eventos | Módulo de tracking + detección de eventos funcional | 2 semanas |
| Fase 3 | Calibración por homografía y cálculo de métricas | Módulo de métricas validado con datos de prueba | 2 semanas |
| Fase 4 | Arquitectura Servidor de IA / Servidor Web, heartbeat, base de datos | Comunicación entre servidores operativa | 2 semanas |
| Fase 5 | Backend, frontend, autenticación por roles, reportes exportables | Plataforma web funcional | 3 semanas |
| Fase 6 | Pruebas de campo, retroalimentación de usuarios, ajustes finales | Prototipo validado y documentación final | 1 semanas |

---

## 8. Requerimientos

### 8.1 Funcionales

- **RF-01:** El sistema debe capturar video en tiempo real desde la cámara fija instalada a 2.5 metros de altura sobre los tres carriles observados.
- **RF-02:** El sistema debe preprocesar cada cuadro capturado (redimensionamiento, corrección de iluminación y contraste, reducción de ruido, corrección de perspectiva y normalización) antes de enviarlo al detector.
- **RF-03:** El sistema debe detectar y seguir (tracking) a cada nadador presente en los tres carriles mediante YOLOv5 con ByteTrack o DeepSORT, manteniendo su identidad durante toda la sesión.
- **RF-04:** El sistema debe identificar el instante en que cada nadador cruza uno de los nodos de color ubicados cada 5 metros en los divisores de carril.
- **RF-05:** El sistema debe calcular, a partir de los eventos de paso por nodo, la distancia recorrida y la velocidad promedio por tramo.
- **RF-06:** El sistema debe enviar las métricas calculadas por el Servidor de IA al Servidor Web para su almacenamiento.
- **RF-07:** El sistema debe permitir la autenticación de usuarios con tres roles diferenciados: administrador, entrenador y nadador.
- **RF-08:** El sistema debe permitir a los nadadores consultar su propio historial y evolución de desempeño.
- **RF-09:** El sistema debe permitir a los entrenadores hacer seguimiento a los nadadores a su cargo y generar reportes exportables en PDF y CSV.
- **RF-10:** El sistema debe permitir a los administradores gestionar usuarios y roles.

### 8.2 No funcionales

- **RNF-01 (Desempeño):** el sistema debe operar en modo cercano al tiempo real (near real-time), evaluado por tramo de 5 metros y no cuadro a cuadro.
- **RNF-02 (Precisión):** el sistema debe apuntar a un error absoluto medio inferior a 2 segundos por tramo frente a un cronometraje manual de referencia.
- **RNF-03 (Recursos y portabilidad):** el modelo de detección debe poder ejecutarse localmente siempre que el rendimiento medido lo permita; el uso de GPU (local o remota) queda abierto como alternativa a evaluar si las pruebas de campo muestran que la inferencia en CPU no alcanza el procesamiento cercano al tiempo real exigido por RNF-01, dado que el proyecto no garantiza acceso permanente a hardware GPU de alto rendimiento.
- **RNF-04 (Escalabilidad del MVP):** el sistema debe soportar de forma confiable hasta 3 nadadores simultáneos, uno por carril observado, en esta primera versión.
- **RNF-05 (Seguridad):** el módulo de autenticación debe restringir el acceso a las funciones del sistema según el rol del usuario (administrador, entrenador, nadador), y las credenciales deben almacenarse de forma cifrada.
- **RNF-06 (Disponibilidad):** ante la caída de alguno de los dos componentes, el sistema debe conservar las métricas ya calculadas mediante el mecanismo de heartbeat con buffer, en lugar de perderlas.
- **RNF-07 (Usabilidad):** la plataforma web debe permitir a entrenadores y nadadores consultar sus estadísticas sin requerir conocimientos técnicos previos.
- **RNF-08 (Mantenibilidad):** el Servidor de IA y el Servidor Web deben mantenerse como componentes desacoplados, comunicados mediante una interfaz definida, de modo que puedan modificarse, probarse o sustituirse de forma independiente.

---

## 9. Evaluación de alternativas

### 9.1 ¿Cuál alternativa ofrece mejor desempeño bajo carga esperada?

La decisión evaluada aquí es cómo el Servidor de IA entrega las métricas calculadas al Servidor Web: mediante solicitudes HTTP síncronas iniciadas por el Servidor de IA cada vez que produce un resultado (REST push), mediante un esquema de sondeo (polling) en el que el Servidor Web consulta periódicamente al Servidor de IA, o mediante una cola de mensajes intermedia (p. ej. un broker tipo MQTT o RabbitMQ) que desacopla la emisión del consumo.

En cuanto a latencia promedio y máxima, el esquema de cola de mensajes ofrece el mejor comportamiento bajo la carga esperada del proyecto: el Servidor de IA publica cada evento o métrica tan pronto se calcula, sin esperar una respuesta síncrona del Servidor Web, mientras que el polling introduce una latencia adicional acotada por el intervalo de consulta, y el REST push síncrono puede bloquear el hilo de procesamiento del Servidor de IA si el Servidor Web tarda en responder. En cuanto a throughput, dado que Safe Splash 2 opera con un volumen de eventos bajo —eventos de paso por nodo cada 5 metros, hasta 3 nadadores simultáneos según el alcance definido—, tanto el REST push como la cola de mensajes son suficientes; la diferencia se vuelve relevante solo si el alcance se amplía a más carriles o nadadores. En cuanto al comportamiento bajo carga concurrente, la cola de mensajes es la opción más robusta porque absorbe picos de eventos sin que el Servidor de IA dependa de la disponibilidad inmediata del Servidor Web, mientras que el REST push síncrono degrada directamente el rendimiento del pipeline de video si el Servidor Web se satura.

**Alternativa seleccionada:** dado que la implementación de un broker de mensajería añade una pieza de infraestructura adicional que no se justifica en el alcance de un prototipo académico ejecutado localmente, se recomienda iniciar con REST push asíncrono (el Servidor de IA envía la métrica y no bloquea su pipeline esperando la respuesta) complementado con el mecanismo de heartbeat, dejando la migración a una cola de mensajes como una mejora de escalabilidad a evaluar si el alcance crece a más carriles o nadadores simultáneos.

### 9.2 ¿Qué grado de acoplamiento introduce cada opción?

La decisión evaluada aquí es la arquitectura general del sistema: mantener la separación en dos componentes independientes (Servidor de IA y Servidor Web, tal como se define en la Solución propuesta) frente a una alternativa monolítica, en la que el procesamiento de video y la plataforma web residen en un mismo proceso o aplicación.

En cuanto a dependencia de servicios externos, ambas alternativas dependen igualmente de la cámara física; esta dimensión no las diferencia de forma significativa en la versión local del proyecto. En cuanto a interdependencia entre módulos internos, la arquitectura de dos componentes reduce el acoplamiento de forma clara: un cambio en el modelo de detección o en el algoritmo de tracking no exige modificar el backend web, y un cambio en el frontend o en el esquema de autenticación no exige tocar el pipeline de IA, mientras que en un monolito ambos conjuntos de responsabilidades comparten código, dependencias y ciclo de ejecución, aumentando el riesgo de que un cambio en un módulo rompa involuntariamente al otro. En cuanto a facilidad de sustitución de componentes, la separación en dos componentes facilita, por ejemplo, reemplazar YOLOv5 por una versión más reciente, o migrar el backend web a otro framework, sin rediseñar el sistema completo, siempre que se preserve el contrato de comunicación (formato de las métricas) entre ambos; en el monolito, sustituir cualquiera de las dos partes implica un mayor riesgo de romper la otra.

**Alternativa seleccionada:** se confirma la arquitectura de dos componentes independientes ya definida en la Solución propuesta, ejecutados en esta primera versión sobre el mismo equipo local. El costo adicional de mantener un mecanismo de comunicación entre ambos se justifica por la reducción de acoplamiento que permite, entre otras cosas, que el Servidor de IA pueda desarrollarse, probarse y ajustarse (por ejemplo, reentrenando el modelo con nuevos datos) de forma independiente al ciclo de desarrollo de la plataforma web, e incluso permite que el Servidor Web migre a un servidor remoto en el futuro sin tocar el pipeline de video.

### 9.3 ¿Qué nivel de disponibilidad y tolerancia a fallos ofrece cada alternativa?

La decisión evaluada aquí es cómo debe comportarse el sistema ante la caída de uno de los dos componentes: sin ningún mecanismo de tolerancia a fallos (si un componente cae, la información se pierde), con un mecanismo de heartbeat simple que detecta la caída pero no preserva datos, o con heartbeat combinado con almacenamiento temporal local (buffer) en el Servidor de IA que le permita retener métricas calculadas mientras el Servidor Web está inactivo y reenviarlas al recuperarse la conexión.

En cuanto a tiempo de disponibilidad esperado, ninguna de las tres opciones garantiza alta disponibilidad de nivel productivo —el proyecto no cuenta con redundancia ni balanceo de carga, dado su alcance de prototipo académico ejecutado localmente—, por lo que esta dimensión se evalúa en términos de disponibilidad percibida por el usuario más que de uptime formal. En cuanto a mecanismos de recuperación ante fallos, la opción sin tolerancia a fallos no ofrece ninguno; el heartbeat simple permite al sistema informar al usuario que un componente está caído, pero cualquier métrica calculada durante la caída se pierde; el heartbeat con buffer local permite recuperar esas métricas una vez restablecida la conexión, a costa de una mayor complejidad de implementación (gestión del buffer, control de duplicados al reenviar). En cuanto al impacto de fallos parciales, la arquitectura de dos componentes ya acota el impacto de una caída a la mitad del sistema —si el Servidor Web cae, la captura y el cálculo de métricas pueden continuar; si el Servidor de IA cae, la plataforma web sigue disponible para consultar el historial ya almacenado—, y esta propiedad se preserva en cualquiera de las tres opciones de tolerancia a fallos evaluadas, ya que depende de la separación de componentes y no del mecanismo de heartbeat en sí.

**Alternativa seleccionada:** se recomienda heartbeat con buffer en el Servidor de IA. Dado que las métricas de una sesión de entrenamiento son datos que no pueden recalcularse retroactivamente a partir de video no almacenado, perder información durante una caída temporal del Servidor Web —incluso si es breve— representa un costo alto para el valor del sistema; el mecanismo de buffer, aunque más complejo que un heartbeat simple, protege directamente el objetivo central del proyecto: construir un historial digital confiable del desempeño del nadador.

En esta etapa el sistema aún no cuenta con mediciones reales de latencia ni con pruebas de caída de servicio en campo; la alternativa seleccionada se sustenta en el análisis cualitativo de los tres criterios evaluados y quedará sujeta a ajuste una vez se disponga de mediciones experimentales durante la Fase 4 del cronograma (arquitectura de comunicación entre componentes).

---

## 10. Diseño y arquitectura

### 10.1 Descripción general de la arquitectura

Safe Splash 2 adopta una arquitectura de dos componentes especializados —el Servidor de IA y el Servidor Web— que se comunican entre sí mediante una interfaz definida, en lugar de residir en un único proceso monolítico. Es importante precisar que esta separación es lógica y no implica necesariamente dos máquinas físicas distintas: en esta primera versión, el Servidor de IA se ejecuta de forma local, en el mismo equipo (o red local) donde se procesa el video capturado por la cámara, sin depender de infraestructura de inferencia en la nube, decisión que responde directamente a la restricción de recursos computacionales acotados del proyecto. El Servidor Web puede convivir en un proveedor en la nube sin obligar a modificar el pipeline de procesamiento de video, precisamente porque ambos componentes se comunican mediante una interfaz y no comparten código ni proceso.

El Servidor de IA actúa como productor de información (métricas y eventos de paso por nodo), y el Servidor Web actúa como consumidor, persistidor y expositor de esa información hacia los usuarios finales a través de un frontend web.

### 10.2 Componentes del sistema

Los componentes principales identificados hasta el momento son: (1) el módulo de captura y preprocesamiento de video; (2) el módulo de detección y tracking (YOLOv5 + ByteTrack/DeepSORT); (3) el módulo de calibración por nodos de color; (4) el motor de eventos de paso por nodo; (5) el motor de cálculo de métricas por tramo; (6) el canal de comunicación y sincronización (REST push + heartbeat) entre componentes; (7) el backend del Servidor Web (API, autenticación, persistencia); y (8) el frontend de la plataforma web.


### 10.3 Interacción entre módulos

El flujo de datos entre componentes sigue el orden establecido en el componente anterior: el Servidor de IA produce, cuadro a cuadro, las coordenadas de detección y tracking de cada nadador, pero solo genera un registro hacia afuera del componente cuando el motor de eventos detecta un cruce de nodo. Ese registro viaja como un mensaje JSON con la identidad del nadador, el carril, el tramo recorrido, la distancia, la velocidad del tramo y la marca de tiempo del cruce, enviado mediante REST push asíncrono hacia la API del Servidor Web, que lo persiste en la base de datos.


### 10.4 Comportamiento

El comportamiento del sistema gira en torno a un único flujo crítico: el cálculo y envío de una métrica cada vez que un nadador cruza un nodo de color. La cámara entrega cuadros de forma continua, pero el Servidor de IA solo genera una métrica —y por tanto solo se comunica con el Servidor Web— en los instantes de cruce de nodo, en lugar de hacerlo cuadro a cuadro.

Este diseño reduce el riesgo de cuellos de botella en la comunicación entre componentes: el paso más costoso computacionalmente (detección y tracking) ocurre en cada cuadro dentro del Servidor de IA, pero el paso que involucra red y persistencia (envío al Servidor Web) ocurre solo en los instantes de cruce de nodo, mucho menos frecuentes. La interacción entre componentes es, por tanto, deliberadamente poco frecuente y asíncrona, lo que refleja el buen desacoplamiento buscado: el Servidor Web no participa del procesamiento de video en ningún momento, y su disponibilidad no condiciona la velocidad a la que el Servidor de IA detecta y sigue a los nadadores.

El principal riesgo de eficiencia identificado hasta el momento no está en la comunicación entre componentes, sino en el propio Servidor de IA: al ejecutarse localmente sin GPU dedicada garantizada, la etapa de detección y tracking cuadro a cuadro sobre tres carriles simultáneos es la que determinará si el sistema logra mantenerse dentro de la definición de tiempo cercano al real. Esta hipótesis deberá confirmarse experimentalmente una vez el modelo ajustado esté disponible.

---

## 11. Implementación y avance actual

### 11.1 Stack tecnológico

Se confirma YOLOv5 como modelo de detección para el Servidor de IA, ejecutado localmente, y Roboflow como plataforma de anotación del dataset propio. Para completar el stack se propone: Python con Ultralytics YOLOv5 sobre PyTorch, apoyado en OpenCV para la captura y el preprocesamiento de video, en el Servidor de IA; y un backend en NestJS, una base de datos relacional (PostgreSQL) para la persistencia de métricas y usuarios, y un frontend en Next.js, en el Servidor Web.

### 11.2 Componentes implementados

El módulo de detección se encuentra en fase de preparación de datos: se cuenta con el montaje físico de captura definitivo (cámara a 2.5 m, tres carriles visibles), con muestras de video divididas en aproximadamente 3000 frames, y con el proceso de anotación de ese subconjunto en curso dentro de Roboflow. El tracker, el motor de eventos por nodo, el cálculo de métricas y el backend/frontend del Servidor Web aún no cuentan con una implementación funcional; su desarrollo corresponde a las Fases 2 a 5 del cronograma.

### 11.3 Integraciones realizadas

Hasta el momento no se han realizado integraciones con servicios externos, base de datos ni autenticación. La única integración operativa es la conexión física de la cámara al equipo de captura en el nuevo montaje a 2.5 metros de altura, que ya permitió obtener las muestras de video usadas para construir el dataset.

### 11.4 Pendientes para la entrega final

- Completar la anotación del dataset en Roboflow y realizar el ajuste fino de YOLOv5 sobre los tres carriles observados.
- Integrar el tracker (ByteTrack o DeepSORT) y validar la identificación de eventos de paso por nodo de color.
- Implementar el cálculo de métricas por tramo y validar la calibración comparando distancias físicas conocidas contra las estimadas por el sistema.
- Implementar el canal de comunicación entre el Servidor de IA y el Servidor Web.
- Desarrollar el backend y el frontend del Servidor Web, incluyendo autenticación por roles y generación de reportes exportables.
- Ejecutar pruebas de campo comparando las métricas del sistema contra cronometraje manual, y recolectar retroalimentación de entrenadores y nadadores voluntarios.

---

## 12. Despliegue y operación preliminar

El sistema opera actualmente en modo completamente local: la cámara se conecta directamente al equipo que ejecutará el Servidor de IA, sin infraestructura de red ni servicios en la nube involucrados en esta fase. El Servidor Web, al no contar aún con una implementación funcional, no se encuentra desplegado; se prevé que, al igual que el Servidor de IA, corra inicialmente en modo local o en la red interna de la universidad, evaluando un despliegue remoto solo en fases posteriores si el alcance del proyecto lo justifica.

---

## 13. Validación preliminar

### 13.1 Pruebas por componentes

Aún no se cuenta con resultados cuantitativos de pruebas por componente, dado que el detector se encuentra en fase de ajuste sobre el dataset propio. Estos resultados (IoU del detector, MOTA/IDF1 del tracker, error de la calibración por nodos) se reportarán una vez completado el entrenamiento de YOLOv5.

### 13.2 Pruebas de integración

El flujo completo detección → tracking → eventos de paso → métricas → envío al Servidor Web aún no se ha probado de forma integrada, ya que varios de sus componentes están en desarrollo. Esta prueba se realizará al cierre de la Fase 4 del cronograma, una vez exista el canal de comunicación entre componentes.

### 13.3 Pruebas de usabilidad

No se han realizado aún sesiones de retroalimentación con entrenadores o nadadores voluntarios. Estas se planean para la Fase 6, una vez la plataforma web cuente con una versión navegable.

---

## 14. Resultados parciales y discusión

Dado que el proyecto se encuentra en la fase de preparación del dataset y ajuste del detector, aún no hay resultados de desempeño cuantitativos que discutir frente a los objetivos específicos. El avance más significativo de este período es de carácter conceptual y de diseño: la definición del alcance del MVP, la profundización del marco conceptual y la evaluación de alternativas arquitectónicas, que sientan las bases técnicas para las fases de implementación restantes y para el objetivo verificable que guiará la validación en campo.

---

## 15. Plan de cierre hacia la entrega final

1. Completar la anotación del dataset en Roboflow y realizar el ajuste fino de YOLOv5 sobre los tres carriles observados.
2. Integrar el tracker y validar la identificación de eventos de paso por nodo de color.
3. Implementar el cálculo de métricas por tramo y validar la calibración comparando distancias conocidas contra las estimadas por el sistema.
4. Desarrollar el canal de comunicación entre el Servidor de IA y el Servidor Web.
5. Construir el backend y el frontend del Servidor Web, incluyendo autenticación por roles y reportes exportables.
6. Ejecutar pruebas de campo comparando las métricas del sistema contra cronometraje manual, y recolectar retroalimentación de entrenadores y nadadores voluntarios.

**Riesgos identificados:** la disponibilidad de horarios de acceso a la piscina para las pruebas de campo; la dependencia de recursos computacionales locales (sin GPU dedicada garantizada) para completar el ajuste fino de YOLOv5 dentro del tiempo restante del calendario académico; y el riesgo de que la inferencia local en CPU no alcance el rendimiento cercano al tiempo real exigido por RNF-01 durante sesiones largas (1-2 horas), lo que obligaría a evaluar aceleración por GPU antes de la entrega final.

---

## 16. Referencias

Bernardin, K., & Stiefelhagen, R. (2008). Evaluating multiple object tracking performance: the CLEAR MOT metrics. *EURASIP Journal on Image and Video Processing*.

Chern, Y.-R., Chen, Y.-H., Lin, F.-S., Lin, H.-C., Chen, G.-T., Chu, C.-P., Machtsiras, G., Huang, T.-H., Lien, J.-J. J., & Huang, C.-H. (2025). A butterfly stroke swimming recording and performance analysis system based on computer vision and machine learning. *Measurement, 251*, 117171. https://doi.org/10.1016/j.measurement.2025.117171

Giulietti, N., Caputo, A., Chiariotti, P., & Castellini, P. (2023). SwimmerNET: Underwater 2D Swimmer Pose Estimation Exploiting Fully Convolutional Neural Networks. *Sensors, 23*(4), 2364. https://doi.org/10.3390/s23042364

Tran, T., Joseph, H. A., Lee, K., Choo, K. T. W., Ma, D., Foong, S., Kandappu, T., Ko, J., & Balan, R. (2026). Dronaquatics: Real-time Swimming Analytics Using Drone Captured Imagery. *Proceedings of the IEEE/CVF Winter Conference on Applications of Computer Vision (WACV)*, 4881-4889. https://doi.org/10.1109/WACV61042.2026.00474

Wojke, N., Bewley, A., & Paulus, D. (2017). Simple online and realtime tracking with a deep association metric. *IEEE International Conference on Image Processing (ICIP)*, 3645-3649.

Zhang, Y., Sun, P., Jiang, Y., Yu, D., Weng, F., Yuan, Z., Luo, P., Liu, W., & Wang, X. (2022). ByteTrack: Multi-object tracking by associating every detection box. *Computer Vision – ECCV 2022: 17th European Conference, Tel Aviv, Israel, Proceedings, Part XXII*, 1-21.

Ultralytics. (2023). *YOLOv8 Documentation*. https://docs.ultralytics.com/

SMU and SUTD. (2025). SMU and SUTD Deploy Drone and AI-Driven Analytics To Improve Performance of National Swimmers. *SMU Newsroom*, 4 de marzo de 2025. https://news.smu.edu.sg/news/2025/03/04/smu-and-sutd-deploy-drone-and-ai-driven-analytics-improve-performance-national

DBDoco. (2024). *YOLO-swimmer-detection*. GitHub repository. https://github.com/DBDoco/YOLO-swimmer-detection

Sapna24Sangmitra. (2024). *SwimmingStyleAnalysis*. GitHub repository. https://github.com/Sapna24Sangmitra/SwimmingStyleAnalysis