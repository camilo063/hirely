# MANUAL COMPLETO — HIRELY: Plataforma de Reclutamiento Inteligente

---

## 1. QUE ES HIRELY

Hirely es una plataforma SaaS de reclutamiento inteligente disenada para empresas que necesitan gestionar todo el ciclo de contratacion desde un solo lugar. Automatiza y optimiza cada etapa del proceso: desde publicar una vacante hasta firmar el contrato del candidato seleccionado.

### 1.1 Problema que resuelve

El reclutamiento tradicional es fragmentado: las empresas usan hojas de calculo para rastrear candidatos, envian emails manuales, agendan entrevistas por WhatsApp, calculan scores en su cabeza, y generan contratos en Word. Hirely centraliza todo esto en una plataforma con IA integrada.

### 1.2 Para quien es

- **Empresas medianas y grandes** con procesos de contratacion recurrentes
- **Equipos de Recursos Humanos** que manejan multiples vacantes simultaneamente
- **Reclutadores** que necesitan evaluar candidatos de forma objetiva y rapida
- **Hiring Managers** que participan en entrevistas y decisiones de contratacion

### 1.3 Propuesta de valor

- **Scoring con IA**: Claude AI parsea CVs y analiza entrevistas automaticamente
- **Entrevistas de voz con IA**: Un agente de voz (Dapta) llama al candidato por telefono y conduce una entrevista preliminar
- **Evaluaciones tecnicas**: Portal publico donde el candidato responde preguntas cronometradas
- **Pipeline visual**: Ve todos tus candidatos organizados por etapa en tiempo real
- **Firma digital**: Genera contratos y envialos a firmar electronicamente (SignWell)
- **Portal publico**: Los candidatos aplican, suben documentos y responden evaluaciones sin necesitar cuenta

---

## 2. ARQUITECTURA GENERAL

### 2.1 Stack tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui + Radix UI |
| Backend | Next.js API Routes (serverless) |
| Base de datos | PostgreSQL 16 (SQL directo con pg, sin ORM) |
| Autenticacion | NextAuth.js v5 beta (JWT) |
| IA — CV Parsing | Claude API (Anthropic) — modelo claude-sonnet-4 |
| IA — Entrevistas voz | Dapta (agente de voz por telefono) |
| IA — Scoring | Claude API para respuestas abiertas y codigo |
| Email | Resend |
| Firma digital | SignWell (produccion) / Mock (desarrollo) |
| Calendario | Google Calendar API + Google Meet |
| LinkedIn | Unipile (automatizado) / API directa / Deeplink (manual) |
| Charts | Recharts |
| Validacion | Zod |
| Notificaciones UI | Sonner (toasts) |

### 2.2 Multi-tenancy

Hirely es multi-tenant: cada organizacion tiene sus propios datos completamente aislados. Todas las consultas a la base de datos filtran por `organization_id`. Un usuario de la Organizacion A nunca puede ver datos de la Organizacion B.

### 2.3 Roles de usuario

Existen 3 roles en el sistema:

| Rol | Descripcion |
|-----|------------|
| **admin** | Control total de la organizacion. Accede a configuracion, plantillas, integraciones. Se crea automaticamente al registrar una nueva organizacion. |
| **recruiter** | Reclutador/HR. Gestiona vacantes, candidatos, entrevistas, evaluaciones, contratos. Rol por defecto. |
| **interviewer** | Entrevistador. Participa en entrevistas humanas y registra evaluaciones. |

**Nota:** En el MVP actual, todos los usuarios autenticados tienen acceso completo a los recursos de su organizacion. La infraestructura de roles existe (el JWT transporta el rol) pero las restricciones de acceso por rol aun no estan enforced.

---

## 3. ACCESO AL SISTEMA

### 3.1 Pantalla de login

**URL:** `http://localhost:3500/login`

La pantalla de login muestra:
- Logo de Hirely (H en circulo teal)
- Campo de email
- Campo de password
- Boton "Ingresar"
- Link "Registrarse" para crear nueva organizacion
- Seccion "Credenciales de demo" con boton de llenado rapido

**Usuarios de prueba (seed):**

| Email | Nombre | Rol |
|-------|--------|-----|
| camilo@nivelics.com | Camilo Garcia | admin |
| ana@nivelics.com | Ana Martinez | recruiter |
| david@nivelics.com | David Lopez | interviewer |

En modo desarrollo, cualquier password funciona para estos usuarios.

### 3.2 Registrar nueva organizacion

**URL:** `http://localhost:3500/register`

Campos del formulario:
- Nombre de la empresa
- Nombre del usuario
- Apellido
- Email
- Password (minimo 8 caracteres)

Al registrarse:
1. Se crea una nueva organizacion con slug auto-generado
2. Se crea el usuario con rol `admin` automaticamente
3. Se redirige al login para iniciar sesion

### 3.3 Navegacion principal (Sidebar)

Una vez autenticado, el sidebar izquierdo muestra:

| Seccion | Items |
|---------|-------|
| **General** | Dashboard |
| **Reclutamiento** | Vacantes, Candidatos, Entrevistas, Evaluaciones |
| **Gestion** | Contratos, Onboarding, Reportes |
| **Sistema** | Configuracion |

El sidebar es colapsable (boton chevron en la parte inferior). En movil se oculta y aparece como hamburger menu.

### 3.4 Header

La barra superior contiene:
- Boton de menu (solo en movil)
- Barra de busqueda (expandible)
- Icono de notificaciones con badge
- Menu de usuario (avatar con iniciales) → "Mi perfil" y "Cerrar sesion"

---

## 4. DASHBOARD

**URL:** `/dashboard`

El dashboard es la pantalla principal despues del login. Muestra un resumen en tiempo real de toda la actividad de reclutamiento.

### 4.1 Tarjetas de metricas (4 cards)

| Metrica | Descripcion |
|---------|------------|
| Vacantes activas | Numero de vacantes con estado "publicada" |
| Total candidatos | Numero total de candidatos en la organizacion |
| En proceso | Aplicaciones que no estan descartadas ni contratadas |
| Contratados | Aplicaciones con estado "contratado" |

### 4.2 Pipeline visual

Barra de progreso que muestra la distribucion de candidatos por etapa:
- Nuevo (indigo)
- Revision (violeta)
- Preseleccionado (cyan)
- Entrevista IA (azul)
- Entrevista Humana (verde)
- Seleccionado (naranja)
- Contratado (verde oscuro)

Cada segmento es proporcional al numero de candidatos en esa etapa. Debajo aparece una leyenda con los conteos exactos.

### 4.3 Vacantes recientes

Muestra las 5 vacantes mas recientes con:
- Titulo de la vacante
- Departamento y ubicacion
- Numero de candidatos y en proceso
- Tiempo desde la creacion

### 4.4 Actividad reciente

Timeline con las ultimas 8 acciones del sistema:
- Nuevas aplicaciones recibidas
- Entrevistas IA completadas
- Cada item muestra: candidato, vacante, y fecha relativa

### 4.5 Acciones rapidas

4 botones de acceso directo:
- Crear vacante
- Ver candidatos
- Entrevistas
- Contratos

---

## 5. MODULO DE VACANTES

### 5.1 Listado de vacantes

**URL:** `/vacantes`

Muestra todas las vacantes de la organizacion con:
- Barra de busqueda por titulo
- Filtro por estado (Todas, Borrador, Publicada, Pausada, Cerrada, Archivada)
- Boton "Nueva Vacante"

Cada tarjeta de vacante muestra:
- Titulo
- Departamento y ubicacion
- Estado (badge de color)
- Numero de candidatos
- Fecha de creacion

### 5.2 Crear vacante

**URL:** `/vacantes/nueva`

**Formulario con 3 secciones:**

**Seccion 1 — Informacion basica:**
- Titulo de la vacante (obligatorio)
- Descripcion detallada (textarea, obligatorio)
- Departamento (selector)
- Ubicacion (texto, obligatorio)
- Tipo de contrato (selector: tiempo completo, medio tiempo, freelance, etc.)
- Modalidad (selector: remoto, hibrido, presencial)
- Experiencia minima en anos (numero)
- Moneda (selector)
- Salario minimo y maximo (numeros)

**Seccion 2 — Habilidades requeridas:**
- Campo de texto para agregar habilidades una por una
- Cada habilidad aparece como tag removible
- Ejemplos: React, TypeScript, Next.js, PostgreSQL

**Seccion 3 — Criterios de evaluacion:**
- Pesos ponderados para el scoring ATS
- Dimensiones: experiencia, habilidades tecnicas, educacion, idiomas, certificaciones, keywords
- Score minimo para preseleccion

**Acciones:**
- "Cancelar" → vuelve al listado
- "Crear vacante" → guarda y redirige al detalle

La vacante se crea en estado **Borrador**. Aun no es visible publicamente.

### 5.3 Detalle de vacante

**URL:** `/vacantes/[id]`

**Encabezado:**
- Titulo de la vacante
- Selector de estado (dropdown para cambiar estado)
- Badges: ubicacion, departamento, fecha de creacion
- Botones de accion:
  - "Publicar vacante" (icono globo) — publica en portal y opcionalmente en LinkedIn
  - "Editar" (icono lapiz) — abre formulario de edicion
  - "Eliminar" (icono basura)

**Tab "Detalles":**
- Descripcion completa
- Rango salarial (si se definio)
- Criterios de evaluacion con pesos en %
- Habilidades requeridas (tags teal)
- Estadisticas del portal publico (visitas y aplicaciones)

**Tab "Candidatos":**
- Pipeline visual con candidatos en cada etapa
- Cada tarjeta de candidato muestra: nombre, score ATS (si existe), estado
- Se puede hacer click en un candidato para ver su detalle

### 5.4 Maquina de estados de vacantes

```
borrador → publicada → pausada → cerrada → archivada
                ↕
           publicada (republicar)
```

| Estado | Significado |
|--------|------------|
| Borrador | Vacante creada pero no visible publicamente |
| Publicada | Visible en portal publico, acepta aplicaciones |
| Pausada | Temporalmente oculta, no acepta nuevas aplicaciones |
| Cerrada | Proceso terminado, no acepta aplicaciones |
| Archivada | Guardada para referencia historica |

### 5.5 Publicar vacante

Al hacer click en "Publicar":
1. Se genera un **slug unico** para la URL publica (ej: `desarrollador-frontend-react-senior-acme-x7k2`)
2. La vacante cambia a estado "Publicada"
3. Se genera la URL del portal publico: `/empleo/[slug]`
4. Opcionalmente se comparte en LinkedIn (segun el modo configurado)

**Modos de LinkedIn:**
- **Unipile** (recomendado): Publica automaticamente via API de Unipile
- **API directa**: Usa OAuth de LinkedIn para publicar como job posting
- **Deeplink** (fallback): Copia el contenido al clipboard y abre LinkedIn para que el usuario pegue manualmente

### 5.6 Portal publico de empleo

**URL:** `/empleo/[slug]` (sin autenticacion requerida)

Lo que ve el candidato:
- Logo y nombre de la empresa
- Titulo de la vacante (grande, destacado)
- Badges: modalidad, ubicacion, tipo de contrato, rango salarial
- Boton "Postularme ahora" (CTA prominente, teal)
- Seccion "Sobre la posicion" con descripcion completa
- Seccion "Requisitos" con experiencia, educacion, habilidades
- Formulario de aplicacion

**Formulario de aplicacion del candidato:**

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| Nombre completo | texto | Si |
| Email | email | Si |
| Telefono | tel | Si |
| Ciudad/Ubicacion | texto | No |
| Anos de experiencia | selector (sin exp, 1, 1-3, 3-5, 5-10, 10+) | No |
| Nivel de estudios | selector (bachiller a doctorado) | No |
| Habilidades principales | tags (muestra sugeridas de la vacante) | No |
| LinkedIn URL | url | No |
| Hoja de vida (CV) | archivo PDF/DOC, max 10MB | Si |
| Carta de presentacion | textarea, max 500 chars | No |
| Como te enteraste | selector (LinkedIn, referido, redes, portal, otro) | No |

Al enviar:
1. Se crea o actualiza el candidato en la base de datos
2. Se crea la aplicacion con estado "nuevo" y origen "portal"
3. Se incrementa el contador de aplicaciones de la vacante
4. Se ejecuta el **scoring pipeline** en segundo plano (si hay CV y API key de Anthropic):
   - Parsea el CV con Claude AI
   - Calcula score ATS automaticamente
5. Se redirige a pagina de agradecimiento

**Pagina de agradecimiento:** `/empleo/[slug]/gracias`
- Checkmark verde
- "Gracias, [nombre]!"
- "Tu postulacion para [cargo] en [empresa] ha sido recibida"
- Link para volver a la vacante

---

## 6. MODULO DE CANDIDATOS

### 6.1 Listado de candidatos

**URL:** `/candidatos`

- Barra de busqueda por nombre o email
- Filtros por rango de score: Excelente (85+), Bueno (70-84), Regular (50-69), Bajo (<50), Sin score
- Boton "Nuevo Candidato"
- Cada fila muestra: nombre, email, score maximo (badge de color), fecha de creacion

### 6.2 Crear candidato manualmente

**URL:** `/candidatos/nuevo`

Campos:
- Nombre (obligatorio)
- Apellido
- Email (obligatorio, unico)
- Telefono
- Habilidades (tags)

Util para agregar candidatos que llegaron por canales fuera de la plataforma (referidos, ferias, etc.)

### 6.3 Detalle del candidato

**URL:** `/candidatos/[id]`

**Encabezado:**
- Avatar con iniciales
- Nombre completo
- Email, telefono, anos de experiencia
- Badge de fuente (portal, manual, LinkedIn)

**Tab "Perfil":**
- Informacion de contacto completa
- Link a LinkedIn (si existe)
- Link de descarga del CV
- Habilidades (tags)
- Salario esperado
- Notas

**Tab "CV Parseado":**
Este tab muestra los datos extraidos del CV por Claude AI:
- **Resumen profesional**: parrafo resumido del perfil
- **Experiencia laboral**: lista de posiciones con cargo, empresa, duracion, descripcion
- **Educacion**: titulo, institucion
- **Habilidades tecnicas**: extraidas automaticamente del CV
- **Idiomas y certificaciones**

Si el CV no ha sido parseado, muestra un estado vacio con opcion de parsear.

**Tab "Aplicaciones":**
Historial de todas las vacantes a las que el candidato ha aplicado con estado y scores.

### 6.4 CV Parsing con IA

Cuando se sube un CV (PDF), el sistema:
1. Envia el documento a Claude API con soporte nativo de PDFs
2. Claude extrae datos estructurados: experiencia, educacion, habilidades, idiomas, certificaciones
3. Los datos se guardan en formato JSON en la base de datos
4. Se muestran en el tab "CV Parseado"

**Cadena de fallback:**
- Si Claude API no esta disponible → extrae texto del PDF con pdf-parse y lo envia como texto
- Si eso falla → usa datos de LinkedIn del candidato (si aplico por LinkedIn)
- Si nada funciona → usa los datos minimos ingresados manualmente

### 6.5 Scoring ATS

El Score ATS es un puntaje de 0 a 100 que mide que tan bien el perfil del candidato coincide con los requisitos de la vacante. **No usa IA** — es un algoritmo deterministico con 6 dimensiones:

| Dimension | Que evalua |
|-----------|-----------|
| **Experiencia** | Anos de experiencia vs experiencia minima requerida. Bonus por cantidad de posiciones previas |
| **Habilidades** | Match entre habilidades del candidato y las requeridas por la vacante. Normaliza alias (JS=JavaScript, React.js=React) |
| **Educacion** | Nivel educativo (bachiller=1 a doctorado=6). Bonus por multiples titulos |
| **Idiomas** | Match de idiomas. Bonus por idiomas adicionales |
| **Certificaciones** | Match de certificaciones relevantes |
| **Keywords** | Busqueda full-text de palabras clave del CV contra requisitos |

Cada dimension tiene un peso configurable desde los criterios de evaluacion de la vacante. El score final es la suma ponderada.

**Rangos de recomendacion:**
- 85+ = Alta recomendacion
- 70-84 = Media recomendacion
- 50-69 = Baja recomendacion
- <50 = No apto

---

## 7. MODULO DE ENTREVISTAS

### 7.1 Pantalla principal

**URL:** `/entrevistas`

Dos tabs:
- **Entrevistas IA**: Listado de entrevistas realizadas por el agente de voz Dapta
- **Entrevistas Humanas**: Listado de entrevistas presenciales/videollamada

Cada card muestra: candidato, vacante, score (si existe), estado, fecha.

### 7.2 Entrevistas IA (Dapta)

**Que es:** Un agente de voz con IA (Dapta) llama al candidato por telefono y conduce una entrevista preliminar automatizada. Hace preguntas sobre experiencia, motivacion y fit cultural. La conversacion se graba y transcribe.

**Flujo completo:**

1. **Reclutador inicia la entrevista**: Desde el pipeline de la vacante o desde la seccion de Entrevistas, selecciona un candidato y crea una entrevista IA
2. **Sistema llama al candidato**: Dapta realiza una llamada telefonica real al numero del candidato
3. **Conversacion automatizada**: El agente IA conduce la entrevista con preguntas relevantes al cargo
4. **Webhook de resultado**: Al terminar la llamada, Dapta envia un webhook con la transcripcion
5. **Analisis con Claude**: La transcripcion se envia a Claude AI para analisis profundo
6. **Score generado**: Se calculan scores en 5 dimensiones

**5 dimensiones de evaluacion IA:**

| Dimension | Peso | Que evalua |
|-----------|------|-----------|
| Competencia Tecnica | 35% | Conocimiento demostrado del area |
| Motivacion | 20% | Interes genuino en la posicion y empresa |
| Conexion Cultural | 20% | Alineacion con valores y cultura |
| Comunicacion | 15% | Claridad, articulacion, estructura |
| Tono Emocional | 10% | Actitud, entusiasmo, profesionalismo |

Cada dimension incluye:
- Score numerico (0-100)
- Evidencia textual (citas directas de la transcripcion)

**Detalle de entrevista IA:**
- Transcripcion completa de la conversacion
- Scores por dimension con barra de progreso
- Evidencia textual por cada dimension
- Score total
- Boton "Re-analizar" para ejecutar el analisis nuevamente

### 7.3 Entrevistas Humanas

**Que es:** Entrevistas presenciales o por videollamada conducidas por un entrevistador humano de la empresa.

**Flujo completo:**

1. **Reclutador agenda entrevista**: Selecciona candidato, fecha/hora, entrevistador
2. **Evento en calendario**: Si Google Calendar esta conectado, se crea un evento automaticamente con link de Google Meet
3. **Invitacion por email**: Se envia email al candidato y al entrevistador con los detalles
4. **Entrevista se realiza**: El entrevistador conduce la entrevista (fuera de la plataforma)
5. **Evaluacion registrada**: El entrevistador ingresa scores y notas en la plataforma

**Crear entrevista humana:**
- Seleccionar candidato
- Seleccionar vacante
- Fecha y hora
- Entrevistador asignado
- Notas adicionales

**Evaluacion humana — 5 criterios (escala 1-10):**

| Criterio | Que evalua |
|----------|-----------|
| Competencia Tecnica | Dominio de habilidades tecnicas requeridas |
| Habilidades Blandas | Comunicacion, trabajo en equipo, liderazgo |
| Fit Cultural | Alineacion con valores y dinamica del equipo |
| Potencial de Crecimiento | Capacidad de aprendizaje y desarrollo |
| Presentacion Personal | Profesionalismo, puntualidad, preparacion |

Ademas:
- Notas textuales del entrevistador
- Recomendacion: Contratar / No contratar / Considerar

### 7.4 Google Calendar + Meet

Si la organizacion conecta Google Calendar (desde Configuracion → Integraciones):
- Al crear entrevista humana, se genera automaticamente un evento en Google Calendar
- El evento incluye un link de Google Meet
- Se agregan como invitados: el candidato (por email) y el entrevistador
- Se configuran recordatorios automaticos (1 hora y 1 dia antes)
- Si se reagenda la entrevista, el evento se actualiza
- Si se cancela, el evento se elimina

---

## 8. MODULO DE EVALUACIONES TECNICAS

### 8.1 Pantalla principal

**URL:** `/evaluaciones`

Muestra evaluaciones tecnicas en diferentes estados. Acceso a sub-secciones:
- Evaluaciones Tecnicas (listado principal)
- Banco de Preguntas
- Plantillas

### 8.2 Banco de preguntas

**URL:** `/evaluaciones/banco-preguntas`

Repositorio central de preguntas tecnicas reutilizables.

**Crear pregunta:**
- Enunciado (texto de la pregunta)
- Categoria (ej: JavaScript, React, SQL, Logica, etc.)
- Dificultad: facil, media, dificil
- Tipo: opcion multiple, verdadero/falso, respuesta abierta, codigo
- Opciones de respuesta (para opcion multiple)
- Respuesta correcta
- Explicacion (opcional)
- Puntos asignados
- Tiempo estimado en segundos
- Tags
- Cargos aplicables

**Filtros del banco:**
- Por categoria
- Por dificultad
- Por tipo de pregunta
- Busqueda por texto del enunciado

### 8.3 Plantillas de evaluacion

**URL:** `/evaluaciones/plantillas`

Configuraciones reutilizables que definen la estructura de una evaluacion.

**Crear plantilla:**
- Nombre (ej: "Evaluacion React Senior")
- Descripcion
- Duracion en minutos
- Puntaje total y puntaje aprobatorio
- Estructura: lista de bloques con:
  - Categoria de preguntas
  - Cantidad de preguntas
  - Dificultad (facil, media, dificil, mixta)
  - Puntos por pregunta
- Mostrar resultados al candidato (si/no)

### 8.4 Crear evaluacion

**URL:** `/evaluaciones/nueva`

**Wizard de 3 pasos:**

**Paso 1 — Seleccion:**
- Seleccionar vacante (dropdown con todas las vacantes)
- Seleccionar candidato (dropdown filtrado por la vacante)
- Opcionalmente seleccionar plantilla (auto-llena el paso 2)

**Paso 2 — Configuracion:**
- Titulo de la evaluacion
- Duracion en minutos
- Puntaje aprobatorio (%)
- Estructura de preguntas:
  - Agregar bloques: categoria + cantidad + dificultad + puntos
  - Ejemplo: "3 preguntas de JavaScript, dificultad media, 10 puntos cada una"

**Paso 3 — Preview y envio:**
- Vista previa de las preguntas seleccionadas aleatoriamente del banco
- Boton "Crear y Enviar"

Al enviar:
1. Se seleccionan preguntas aleatorias del banco segun la estructura
2. Se genera un **token unico** de 64 caracteres
3. Se establece expiracion de **72 horas**
4. Se envia email al candidato con el link: `/evaluacion/[token]`
5. Estado cambia a "Enviada"

### 8.5 Portal de evaluacion (candidato)

**URL:** `/evaluacion/[token]` (sin autenticacion requerida)

**Pantalla de bienvenida:**
- Nombre de la empresa y vacante
- Informacion: numero de preguntas, duracion, puntos totales
- Boton "Comenzar Evaluacion"

**Pantalla de evaluacion:**
- Timer visible en la parte superior (se pone rojo cuando quedan <5 minutos)
- Puntos de navegacion (circulos) que muestran estado de cada pregunta:
  - Gris: no respondida
  - Teal: respondida
  - Actual: con borde
- Pregunta actual con su tipo:
  - **Opcion multiple**: Radio buttons con las opciones
  - **Verdadero/Falso**: Dos botones
  - **Respuesta abierta**: Textarea
  - **Codigo**: Area de texto con monospace
- Botones "Anterior" / "Siguiente"
- Boton "Finalizar Evaluacion"
- **Auto-submit**: Si el timer llega a 0, se envia automaticamente

**Pantalla de resultados (si configurado para mostrar):**
- Score obtenido y si aprobo o no
- Mensaje de agradecimiento

### 8.6 Scoring de evaluaciones

El scoring es automatico y diferenciado por tipo:
- **Opcion multiple y V/F**: Comparacion exacta con respuesta correcta → 100% o 0%
- **Respuesta abierta y codigo**: Claude AI evalua la respuesta (0-100) con feedback textual
- Si Claude no esta disponible: fallback a 50% para respuestas de >10 caracteres

Resultado guardado:
- Score total (0-100)
- Detalle por categoria (correctas/total, score%)
- Aprobado si/no (vs puntaje aprobatorio)
- Se actualiza `score_tecnico` en la aplicacion

### 8.7 Vista de resultados (reclutador)

**URL:** `/evaluaciones/[id]`

Muestra:
- Score final con indicador de aprobacion
- Breakdown por categoria
- Cada pregunta con la respuesta del candidato
- Tiempo empleado por pregunta
- Boton para re-enviar si la evaluacion expiro

---

## 9. PIPELINE DE CONTRATACION (State Machine)

### 9.1 Estados del pipeline

El corazon de Hirely es el pipeline de contratacion. Cada aplicacion (candidato + vacante) pasa por estas etapas:

```
nuevo → revisado → preseleccionado → entrevista_ia → entrevista_humana → evaluado → seleccionado → contratado
```

Cualquier estado puede pasar a **descartado**.

| Estado | Que significa | Que accion lo activa |
|--------|--------------|---------------------|
| **nuevo** | Candidato acaba de aplicar | Aplicacion desde portal o creacion manual |
| **revisado** | Reclutador reviso el perfil | Revision manual o automatica tras scoring |
| **preseleccionado** | Candidato pasa el corte ATS | Score ATS supera el umbral minimo |
| **entrevista_ia** | En proceso de entrevista IA | Se inicia entrevista con Dapta |
| **entrevista_humana** | Entrevista humana agendada/realizada | Se agenda o completa entrevista humana |
| **evaluado** | Todos los scores estan completos | Evaluacion tecnica y/o humana completada |
| **seleccionado** | Candidato elegido para el puesto | Reclutador lo marca como seleccionado |
| **contratado** | Candidato contratado oficialmente | Se completa el proceso de contratacion |
| **descartado** | Candidato eliminado del proceso | Rechazo en cualquier etapa |

### 9.2 Scoring Dual

El scoring final combina multiples fuentes:

| Score | Fuente | Rango |
|-------|--------|-------|
| Score ATS | Algoritmo deterministico (6 dimensiones) | 0-100 |
| Score IA | Analisis de entrevista IA por Claude | 0-100 |
| Score Humano | Evaluacion del entrevistador humano | 0-100 |
| Score Tecnico | Evaluacion tecnica del candidato | 0-100 |
| **Score Final** | Promedio ponderado configurable | 0-100 |

Los pesos entre IA y humano son configurables en Configuracion → Scoring.

---

## 10. MODULO DE SELECCION Y DOCUMENTOS

### 10.1 Seleccionar candidato

Cuando el reclutador decide seleccionar a un candidato:
1. Desde el pipeline, mueve al candidato a "Seleccionado"
2. Completa: salario ofrecido, fecha de inicio tentativa
3. Define documentos requeridos (o usa los default de la organizacion)

**Al confirmar:**
- Estado cambia a "seleccionado"
- Se genera un **token de portal** con validez de 30 dias
- Se envia **email de felicitacion** al candidato con:
  - Nombre de la posicion y empresa
  - Salario y fecha de inicio
  - Lista de documentos requeridos
  - Boton/link al portal de documentos

### 10.2 Rechazar candidatos

Se pueden rechazar candidatos individual o masivamente:
- Se envia email de rechazo profesional
- El email agradece la participacion y anima a aplicar en el futuro
- Estado cambia a "descartado"

### 10.3 Portal de documentos (candidato)

**URL:** `/portal/documentos/[token]` (sin autenticacion, acceso por token)

Lo que ve el candidato:
- Nombre de la empresa y vacante
- Checklist de documentos requeridos y opcionales
- Barra de progreso: "3 de 5 documentos subidos"
- Para cada documento:
  - Nombre y descripcion
  - Estado: pendiente, subido, verificado, rechazado
  - Si rechazado: nota del reclutador explicando por que
  - Boton de upload (drag & drop o click)
- Formatos aceptados: PDF, JPG, PNG, DOC, DOCX (max 10MB)

**Documentos tipicos requeridos:**
- Cedula de ciudadania
- Certificados laborales
- Certificados de estudio
- Antecedentes judiciales
- Examen medico
- Referencias personales

### 10.4 Verificacion de documentos (reclutador)

Desde el dashboard, el reclutador puede:
- Ver los documentos subidos por cada candidato
- **Verificar**: Marca el documento como correcto
- **Rechazar**: Marca como rechazado con una nota explicativa (el candidato ve la nota en el portal y puede re-subir)
- Cuando todos los documentos requeridos estan verificados, se marca `documentos_completos`
- Se envia **email al reclutador** notificando que los documentos estan completos

---

## 11. MODULO DE ONBOARDING

### 11.1 Que es y para que sirve

El onboarding es el proceso de bienvenida al nuevo empleado. En Hirely, se activa cuando un candidato pasa de "seleccionado" a "contratado". Su funcion principal es enviar el **email de bienvenida** con toda la informacion que el nuevo empleado necesita para su primer dia.

### 11.2 Como se activa

1. El reclutador mueve al candidato al estado "contratado"
2. Se configura: fecha de inicio, lider asignado, tipo de contrato
3. El sistema crea un registro de onboarding
4. El email se puede enviar:
   - **Inmediatamente**: Se envia al momento
   - **Programado**: Se envia automaticamente en la fecha de inicio

### 11.3 Pantalla de onboarding

**URL:** `/onboarding`

**3 tarjetas de resumen:**
- Contratados este mes (verde)
- Emails pendientes (azul)
- Inicios esta semana (naranja)

**Filtros:** Todos | Pendiente | Programado | Enviado | Error

**Tabla:**
| Columna | Contenido |
|---------|-----------|
| Candidato | Nombre y email |
| Cargo | Titulo de la vacante |
| Fecha inicio | Fecha + badge relativo (Hoy, Manana, En 3d, Hace 2d) |
| Email | Estado con icono y color |
| Acciones | Boton "Enviar" o "Re-enviar" |

**Boton "Procesar emails programados":** Ejecuta manualmente el procesamiento de todos los emails programados cuya fecha de inicio ya llego.

### 11.4 Email de bienvenida

El email que recibe el nuevo empleado contiene:
- Felicitacion personalizada
- Cargo y empresa
- Fecha de inicio
- Area/departamento
- Nombre y email del lider directo
- Tipo de contrato y salario
- Modalidad (remoto/hibrido/presencial) y ubicacion
- Lista de documentos HR adjuntos (recursos, guias, etc.)

El template es **personalizable por organizacion** desde Configuracion → Onboarding.

**Variables disponibles en el template:**
`{{nombre_empleado}}`, `{{cargo}}`, `{{empresa}}`, `{{fecha_inicio}}`, `{{area}}`, `{{nombre_lider}}`, `{{email_lider}}`, `{{tipo_contrato}}`, `{{salario}}`, `{{modalidad}}`, `{{ubicacion}}`

### 11.5 Cron de emails programados

Para los emails programados (que se deben enviar en la fecha de inicio):
- Existe un endpoint: `POST /api/onboarding/procesar-programados`
- Busca onboardings donde `fecha_inicio <= hoy` y email en estado "programado"
- Envia los emails pendientes
- Se puede configurar como Vercel Cron o llamar manualmente

---

## 12. MODULO DE CONTRATOS

### 12.1 Listado de contratos

**URL:** `/contratos`

**4 tarjetas de resumen:** Borradores, Generados, En firma, Firmados

**Filtros:** Estado (todos, borrador, generado, enviado, firmado, rechazado), Tipo de contrato, Busqueda

**Cada fila muestra:** Candidato, cargo, tipo de contrato, salario, estado, fecha

### 12.2 Crear contrato

**Flujo:**
1. Click "Nuevo Contrato"
2. Seleccionar candidato y vacante (o aplicacion)
3. **Auto-poblacion**: El sistema llena automaticamente:
   - Nombre completo, email, telefono del candidato
   - Cargo (titulo de la vacante)
   - Empresa
   - Salario (del rango de la vacante)
   - Modalidad, ubicacion
   - Fecha del contrato y de inicio
4. Seleccionar tipo de contrato:
   - Laboral (generico)
   - Prestacion de servicios
   - Por horas / demanda
   - Termino fijo
   - Termino indefinido
   - Obra o labor
5. El sistema genera el **HTML del contrato** usando el template correspondiente
6. Estado: "Generado"

### 12.3 Detalle de contrato

**URL:** `/contratos/[id]`

**Columna izquierda (2/3):**
- **Tab "Editor"**: Editor del contenido HTML del contrato. Editable cuando esta en borrador o generado.
- **Tab "Preview"**: Vista previa del contrato renderizado

**Columna derecha (1/3):**
- **Panel de firma**: Muestra estado actual del proceso de firma
  - Estado: borrador → generado → enviado → firmado/rechazado
  - URL de firma (si disponible)
  - Fecha de firma (si firmado)
  - Boton "Enviar para Firma"

### 12.4 Versionamiento

Cada vez que se edita un contrato, se crea una nueva version:
- Version 1 → 2 → 3...
- Se registra quien edito, cuando, y nota de cambio
- Se puede consultar el historial de versiones

### 12.5 Firma digital

**Providers disponibles:**

| Provider | Estado | Uso |
|----------|--------|-----|
| **Mock** | Default en desarrollo | Simula firma en ~30 segundos. No envia nada real. |
| **SignWell** | Produccion | Firma electronica real. Envia documento a firmantes por email. |
| **DocuSign** | Placeholder | No implementado aun. |

**Flujo de firma (SignWell):**
1. Reclutador click "Enviar para Firma"
2. El HTML del contrato se convierte a documento y se envia a SignWell
3. Se definen 2 firmantes en orden:
   - Firmante 1: Candidato (email del candidato)
   - Firmante 2: Admin de la organizacion
4. Cada firmante recibe email de SignWell con link para firmar
5. Al firmar todos, SignWell envia webhook a Hirely
6. El contrato se marca como "Firmado"
7. Se descarga el PDF firmado y se almacena localmente

**Flujo de firma (Mock — desarrollo):**
1. Reclutador click "Enviar para Firma"
2. El sistema simula el envio
3. Despues de ~30 segundos, el contrato se marca como "Firmado" automaticamente
4. Se genera un URL y PDF mock

### 12.6 Webhook de firma

Endpoint: `POST /api/webhooks/firma` (publico, sin auth)

Procesa eventos de:
- **Firma completada** (completed, signed, document.completed): Marca contrato como "firmado"
- **Firma rechazada** (declined, voided, document.declined): Marca contrato como "rechazado"

Compatible con formato de SignWell y DocuSign.

---

## 13. MODULO DE REPORTES Y ANALYTICS

### 13.1 Pantalla principal

**URL:** `/reportes`

### 13.2 Panel de filtros

- **Periodo**: Ultimos 7 dias, 30 dias, 90 dias (default), 180 dias, 1 ano, Personalizado
- **Vacante**: Todas las vacantes o una especifica
- **Fechas custom**: Si selecciona "Personalizado", aparecen campos de fecha desde/hasta
- **Boton Exportar**: Descarga CSV con todos los datos

### 13.3 KPIs (4 tarjetas)

| KPI | Que muestra |
|-----|------------|
| Vacantes Activas | Cantidad de vacantes en estado "publicada" |
| Total Candidatos | Cantidad total de candidatos en la org |
| Contratados (90d) | Candidatos contratados en los ultimos 90 dias |
| Tasa de Conversion | % de contratados vs aplicaciones (90d). Color: verde >10%, amarillo >5%, rojo <5% |

### 13.4 Funnel de conversion

Grafico de barras horizontales mostrando candidatos en cada etapa del pipeline:
- Nuevos, Revisados, Preseleccionados, Entrevista IA, Entrevista Humana, Evaluados, Seleccionados, Contratados
- Cada barra tiene color unico y muestra cantidad + porcentaje

### 13.5 Tiempos promedio por etapa

Tarjeta con metricas de velocidad del proceso:
- Aplicacion → Entrevista IA: X dias
- Entrevista IA → Humana: X dias
- Humana → Evaluacion: X dias
- **Tiempo total de contratacion**: X dias
- Si no hay datos suficientes, muestra "—"

### 13.6 Volumen de aplicaciones

Grafico combinado (barras + lineas) mostrando por semana:
- Barras grises: total de aplicaciones
- Linea verde: contratados
- Linea roja punteada: descartados
- Eje X: semanas (formato "Mar 10")

### 13.7 Top vacantes por conversion

Tabla con las vacantes mas activas:

| Columna | Contenido |
|---------|-----------|
| Vacante | Nombre (link al detalle) |
| Aplicaciones | Cantidad total |
| Contratados | Cantidad |
| Conversion | % con badge de color |
| Score Promedio | Promedio de score final con badge |
| Dias Abierta | Dias desde creacion |

### 13.8 Distribucion de scores

Histograma vertical mostrando cuantos candidatos hay en cada rango de score final:
- 0-20 (rojo): Muy bajo
- 21-40 (naranja): Bajo
- 41-60 (amarillo): Medio
- 61-80 (verde claro): Alto
- 81-100 (verde oscuro): Excelente

### 13.9 Exportar CSV

El boton "Exportar" genera un archivo CSV con:
- Seccion KPIs generales (todas las metricas)
- Seccion Funnel (etapa, cantidad, porcentaje)
- Seccion Top Vacantes (vacante, aplicaciones, contratados, conversion, score, dias)

Nombre del archivo: `hirely-reporte-[fecha].csv`

### 13.10 Estado vacio

Si la organizacion tiene menos de 5 aplicaciones, se muestra un estado vacio con:
- Icono de graficos
- Mensaje "Aun no hay datos para mostrar"
- Lista de lo que vera cuando tenga datos
- Link a vacantes activas

---

## 14. CONFIGURACION

### 14.1 Pantalla principal

**URL:** `/configuracion`

6 tabs de configuracion:

### 14.2 Tab: Organizacion

- Nombre de la empresa (editable)
- Slug de la organizacion (no editable)
- URL del logo
- Dias de vencimiento de oferta

### 14.3 Tab: Scoring

Configura el Scoring Dual:
- **Peso Entrevista IA** (%): Cuanto pesa el score de la entrevista IA en el score final
- **Peso Evaluacion Humana** (%): Cuanto pesa la evaluacion humana
- **Umbral de preseleccion ATS** (%): Score minimo ATS para avanzar automaticamente
- Barras de progreso visuales para cada peso

### 14.4 Tab: Documentos

Configura el checklist de documentos que se piden al candidato seleccionado:
- Lista de documentos requeridos y opcionales
- Cada documento: nombre, descripcion, requerido si/no
- Agregar / eliminar documentos

### 14.5 Tab: Onboarding

**Plantilla de email de bienvenida:**
- Editor del template HTML con variables disponibles
- Asunto del email personalizable
- Variables: `{{nombre_empleado}}`, `{{cargo}}`, `{{empresa}}`, `{{fecha_inicio}}`, `{{area}}`, `{{nombre_lider}}`, `{{email_lider}}`, `{{tipo_contrato}}`, `{{salario}}`, `{{modalidad}}`, `{{ubicacion}}`

**Documentos de onboarding:**
- Lista de recursos HR que se adjuntan al email de bienvenida
- Cada recurso: nombre, descripcion, link

### 14.6 Tab: Contratos

Editor de plantillas de contrato por tipo:
- Plantilla para cada tipo de contrato colombiano
- HTML editable con variables de auto-poblacion
- Vista previa

### 14.7 Tab: Integraciones

Panel de conexion con servicios externos:

| Integracion | Descripcion |
|-------------|------------|
| **LinkedIn** | Conectar cuenta de LinkedIn para publicar vacantes automaticamente. Boton de OAuth. |
| **Google Calendar** | Conectar Google Calendar para crear eventos y links de Meet automaticamente. |
| **Dapta** | Configuracion del agente de voz IA para entrevistas telefonicas. |
| **SignWell** | Firma digital de contratos. |
| **Resend** | Servicio de email transaccional. |

---

## 15. FLUJO COMPLETO DE INICIO A FIN

Este es el recorrido completo de un proceso de contratacion exitoso en Hirely:

### Fase 1: Preparacion
1. **Registrar organizacion** → Se crea el admin
2. **Configurar** en `/configuracion`:
   - Datos de la empresa
   - Pesos de scoring
   - Checklist de documentos
   - Template de onboarding
   - Plantillas de contratos
   - Conectar integraciones (LinkedIn, Google Calendar, etc.)
3. **Poblar banco de preguntas** en `/evaluaciones/banco-preguntas`
4. **Crear plantillas de evaluacion** en `/evaluaciones/plantillas`

### Fase 2: Publicar vacante
5. **Crear vacante** en `/vacantes/nueva` con todos los detalles
6. **Publicar** → Se genera URL publica
7. **Compartir** en LinkedIn (automatico o manual)

### Fase 3: Recibir candidatos
8. **Candidatos aplican** desde el portal publico `/empleo/[slug]`
9. **CV se parsea automaticamente** con Claude AI
10. **Score ATS se calcula** automaticamente
11. Candidatos aparecen en el pipeline como "Nuevo"

### Fase 4: Evaluar
12. **Revisar candidatos** en el pipeline, filtrar por score
13. **Crear evaluacion tecnica** para los preseleccionados
14. **Candidato responde** evaluacion en `/evaluacion/[token]`
15. **Score tecnico** se calcula automaticamente
16. **Iniciar entrevista IA** → Dapta llama al candidato
17. **Score IA** se calcula con Claude
18. **Agendar entrevista humana** → Google Calendar + Meet
19. **Registrar evaluacion humana** → 5 criterios + notas

### Fase 5: Seleccionar
20. **Comparar candidatos** usando scoring dual (todos los scores visibles)
21. **Seleccionar al mejor** → Email de felicitacion al candidato
22. **Rechazar a los demas** → Email de rechazo profesional
23. **Candidato sube documentos** en el portal `/portal/documentos/[token]`
24. **Reclutador verifica** documentos

### Fase 6: Contratar
25. **Mover a "Contratado"** → Se crea onboarding
26. **Enviar email de bienvenida** (inmediato o programado)
27. **Generar contrato** → Auto-poblado con datos del candidato
28. **Enviar para firma** → SignWell o mock
29. **Contrato firmado** → Proceso completo

### Fase 7: Analizar
30. **Revisar reportes** en `/reportes`:
    - Funnel de conversion
    - Tiempos de contratacion
    - Top vacantes
    - Distribucion de scores
31. **Exportar datos** a CSV para analisis externo

---

## 16. INTEGRACIONES EXTERNAS

### 16.1 Claude AI (Anthropic)

**Uso en Hirely:**
- Parseo inteligente de CVs (extrae datos estructurados de PDFs)
- Analisis de transcripciones de entrevistas IA (5 dimensiones)
- Scoring de respuestas abiertas y de codigo en evaluaciones tecnicas

**Configuracion:** `ANTHROPIC_API_KEY` en `.env.local`
**Modelo:** claude-sonnet-4
**Sin API key:** El sistema funciona con fallbacks (datos basicos del CV, scoring simplificado)

### 16.2 Dapta (Entrevistas de voz IA)

**Uso en Hirely:**
- Realiza llamadas telefonicas reales a candidatos
- Conduce entrevistas automatizadas con preguntas relevantes
- Envia transcripcion via webhook al completar

**Configuracion:** `DAPTA_API_KEY`, `DAPTA_FLOW_WEBHOOK_URL`, `DAPTA_FROM_NUMBER`
**Webhook:** `POST /api/webhooks/dapta` (publico)

### 16.3 Resend (Email)

**Uso en Hirely:**
- Invitaciones a entrevistas
- Envio de evaluaciones tecnicas
- Emails de seleccion/rechazo
- Email de bienvenida (onboarding)
- Notificacion de documentos completos

**Configuracion:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
**Sin API key:** Los emails no se envian (el sistema no se rompe, solo log de warning)

### 16.4 SignWell (Firma digital)

**Uso en Hirely:**
- Envia contratos para firma electronica
- 2 firmantes: candidato y admin de la org
- Descarga PDF firmado

**Configuracion:** `SIGNWELL_API_KEY`, `FIRMA_PROVIDER=signwell`
**Con FIRMA_PROVIDER=mock:** Simula firma en 30 segundos (para desarrollo)

### 16.5 Google Calendar

**Uso en Hirely:**
- Crea eventos de entrevista automaticamente
- Genera links de Google Meet
- Envia invitaciones a participantes
- Actualiza/cancela eventos si cambia la entrevista

**Configuracion:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, OAuth flow por usuario
**Sin config:** Entrevistas se crean sin evento ni link de Meet

### 16.6 LinkedIn (Unipile)

**Uso en Hirely:**
- Publica vacantes automaticamente en LinkedIn
- Sincroniza candidatos que aplican desde LinkedIn

**Configuracion:** `UNIPILE_API_KEY`, `UNIPILE_API_URL`, `UNIPILE_ACCOUNT_ID`
**Modos:** Unipile (auto) → API directa → Deeplink (manual)

### 16.7 Storage (archivos)

**Uso en Hirely:**
- CVs subidos por candidatos
- Documentos del portal de seleccion
- PDFs de contratos firmados

**Estado actual:** Almacenamiento local en `/public/uploads/`
**Produccion:** Requiere migracion a AWS S3

---

## 17. GLOSARIO

| Termino | Definicion |
|---------|-----------|
| **Vacante** | Posicion abierta que la empresa quiere llenar |
| **Candidato** | Persona que aplica o es considerada para una vacante |
| **Aplicacion** | La relacion entre un candidato y una vacante (un candidato puede tener multiples aplicaciones) |
| **Pipeline** | Vista visual del progreso de candidatos por etapas |
| **Score ATS** | Puntaje automatico basado en match CV vs requisitos (0-100) |
| **Score IA** | Puntaje del analisis de entrevista IA por Claude (0-100) |
| **Score Humano** | Puntaje de la evaluacion del entrevistador humano (0-100) |
| **Score Tecnico** | Puntaje de la evaluacion tecnica del candidato (0-100) |
| **Score Final** | Promedio ponderado de todos los scores |
| **Scoring Dual** | Sistema que combina evaluacion IA + humana con pesos configurables |
| **Portal publico** | Paginas accesibles sin login: vacantes, evaluaciones, documentos |
| **Token** | Codigo unico que da acceso temporal a portales publicos |
| **Webhook** | Notificacion automatica que un servicio externo envia a Hirely |
| **Onboarding** | Proceso de bienvenida e integracion del nuevo empleado |
| **Firma digital** | Proceso electronico de firma de contratos (SignWell) |
| **Slug** | URL amigable generada automaticamente (ej: desarrollador-frontend-acme-x7k2) |
| **Funnel** | Embudo de conversion que muestra cuantos candidatos pasan cada etapa |
| **Deeplink** | Modo de LinkedIn donde se copia contenido al clipboard para pegar manualmente |
