# Hirely — ATS (Applicant Tracking System)

Plataforma SaaS multi-tenant de reclutamiento y seleccion de personal, construida con Next.js 14, TypeScript y PostgreSQL. Cubre el flujo completo: desde la publicacion de vacantes hasta la firma de contratos.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| UI | shadcn/ui (27 componentes base + 74 componentes de dominio) |
| Auth | NextAuth.js v5 (Credentials + JWT) |
| Base de datos | PostgreSQL 16 (Docker) |
| Validacion | Zod 4.3 |
| Estado | Zustand 5.0 |
| IA | Claude API (CV parsing, analisis de entrevistas, generacion de preguntas, scoring de respuestas abiertas) |
| Charts | Recharts 3.7 |
| Email | Resend (emails transaccionales) |
| Firma electronica | SignWell (produccion) / mock (desarrollo) |
| Integraciones | LinkedIn OAuth, Dapta (voz IA), Google Calendar + Meet |

## Inicio Rapido

### Prerequisitos

- Node.js 18+
- Docker Desktop (para PostgreSQL)

### Instalacion

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd Hirely
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar base de datos
docker-compose up -d

# 4. Ejecutar migraciones
for f in src/lib/db/migrations/*.sql; do
  docker cp "$f" hirely-db:/tmp/migration.sql
  docker exec hirely-db psql -U hirely_user -d hirely -f /tmp/migration.sql
done

# 5. Iniciar servidor de desarrollo
npm run dev
```

La app corre en **http://localhost:3500**

### Usuarios de prueba

| Email | Rol | Password |
|-------|-----|----------|
| admin@hirely.app | Admin | cualquiera (dev mode) |
| recruiter@hirely.app | Reclutador | cualquiera (dev mode) |

---

## Arquitectura del Proyecto

```
src/
├── app/
│   ├── (auth)/              # Login, Register
│   ├── (dashboard)/         # Paginas protegidas del dashboard
│   │   ├── candidatos/      # Banco de talento
│   │   ├── configuracion/   # Ajustes de organizacion
│   │   ├── contratos/       # Gestion de contratos
│   │   ├── entrevistas/     # Entrevistas IA y humanas
│   │   ├── evaluaciones/    # Evaluaciones tecnicas + scoring dual
│   │   ├── onboarding/      # Gestion de onboarding
│   │   └── vacantes/        # Vacantes y pipeline
│   ├── (public)/            # Portal publico de empleo
│   │   └── empleo/[slug]/   # Pagina publica de vacante + aplicacion
│   ├── api/                 # 83 rutas API REST
│   ├── auth/                # Flujos OAuth LinkedIn
│   ├── evaluacion/[token]/  # Formulario publico de evaluacion tecnica
│   └── portal/              # Portal publico de documentos
├── components/              # 99 componentes React
│   ├── candidatos/          # Score badge, CV view, kanban, pipeline
│   ├── contratos/           # Editor, preview, firma, plantillas, versiones
│   ├── entrevistas/         # Trigger IA, evaluacion humana, scoring
│   ├── evaluaciones/        # Banco preguntas, plantillas, formularios, anti-cheating, proctoring
│   ├── layout/              # Sidebar, header, breadcrumbs, mobile-nav
│   ├── onboarding/          # Contratar, plantilla email, docs
│   ├── portal/              # Aplicacion publica, documentos
│   ├── seleccion/           # Seleccionar, rechazar, documentos
│   ├── shared/              # Data table, empty state, confirm dialog, loading
│   ├── ui/                  # 27 shadcn/ui components
│   └── vacantes/            # Card, form, status selector, LinkedIn publisher
├── hooks/                   # 8 custom hooks (useDebounce, useCandidatos, useVacantes, useLinkedin, useToast, useReportes, useReveal, useTiposContrato)
├── lib/
│   ├── auth/                # NextAuth config + API middleware helpers
│   ├── db/                  # Pool de conexion + 24 migraciones SQL
│   │   ├── migrations/      # 001-024 migraciones
│   │   └── seeds/           # Preguntas iniciales de evaluacion
│   ├── integrations/        # Clientes externos (Anthropic, Dapta, LinkedIn, Resend, SignWell, Google Calendar)
│   ├── services/            # 27 servicios de logica de negocio
│   ├── types/               # 12 archivos de tipos TypeScript
│   ├── utils/               # 12 utilidades (API response, errors, constants, design tokens, email templates, etc.)
│   ├── validations/         # 6 schemas Zod
│   └── tests/               # Tests de integracion
└── middleware.ts            # Edge middleware (proteccion de rutas)
```

**Totales:** 320+ archivos TypeScript/TSX, 101 componentes, 87 endpoints API, 27 servicios, 24 migraciones

---

## Modulos del Sistema

### Modulo 1: Infraestructura Base + Autenticacion

**Paginas:** `/login`, `/register`, `/dashboard`

- Autenticacion con NextAuth v5 (Credentials provider, JWT strategy)
- Base de datos PostgreSQL 16 via Docker (puerto 5434)
- Middleware Edge Runtime que protege todas las rutas del dashboard
- Layout principal: sidebar con navegacion, header con menu de usuario, breadcrumbs
- Dashboard con metricas: vacantes activas, total candidatos, en proceso, contratados
- Feed de actividad reciente
- Multi-tenant: aislamiento de datos por `organization_id`

**Servicios:** auth config, auth middleware, db pool

---

### Modulo 2: Gestion de Vacantes + LinkedIn

**Paginas:** `/vacantes`, `/vacantes/nueva`, `/vacantes/[id]`, `/vacantes/[id]/editar`, `/vacantes/[id]/candidatos`, `/empleo/[slug]` (publica)

- CRUD completo de vacantes con formulario detallado (titulo, descripcion, requisitos, salario, modalidad, habilidades)
- Vista en tarjetas con estadisticas (candidatos, entrevistas, contratos)
- Pipeline visual dual: vista tabla + kanban con drag & drop (dnd-kit)
- Integracion LinkedIn OAuth: publicar vacantes, sincronizar aplicantes automaticamente
- 3 modos de publicacion LinkedIn: deeplink, API directa, Unipile
- State machine de vacante: `borrador -> publicada -> pausada -> cerrada -> archivada`
- Selector de estado inteligente con acciones LinkedIn automaticas por transicion
- Pagina publica `/empleo/[slug]` para que candidatos apliquen
- Pagina de agradecimiento post-aplicacion
- Criterios de evaluacion ponderados por vacante
- Portal publico con conteo de vistas y aplicaciones

**Servicios:** vacantes, linkedin, linkedin-publish, linkedin-sync, public-apply, portal-vacantes, vacancy-state-machine

**API Routes:**
- `GET/POST /api/vacantes` — listar y crear
- `GET /api/vacantes/[id]` — detalle
- `GET/POST /api/vacantes/[id]/candidatos` — aplicaciones
- `PATCH /api/vacantes/[id]/estado` — transiciones de estado
- `POST /api/vacantes/[id]/publicar` — publicar en portales
- `GET/POST/PATCH /api/vacantes/[id]/linkedin` — integracion LinkedIn
- `POST /api/vacantes/[id]/linkedin/sync` — sincronizar aplicantes

---

### Modulo 3: Banco de Talento + CV Parsing + Scoring ATS

**Paginas:** `/candidatos`, `/candidatos/nuevo`, `/candidatos/[id]`

- CRUD de candidatos con busqueda por nombre/email y paginacion
- CV Parsing con Claude AI: extrae experiencia, educacion, idiomas, habilidades, certificaciones
- Carga y gestion de documentos/CVs por candidato
- Scoring ATS deterministico (0-100) con 6 dimensiones:
  - Experiencia relevante (30%)
  - Habilidades tecnicas (25%)
  - Educacion y formacion (15%)
  - Idiomas (15%)
  - Certificaciones (10%)
  - Keywords de la vacante (5%)
- ScoreBadge visual con colores por rango (verde >= 80, amarillo >= 60, naranja >= 40, rojo < 40)
- Score breakdown detallado por dimension con barras de progreso
- Filtro "pasa el corte" basado en umbral configurable
- Vista de CV parseado con datos estructurados
- Detalle con pestanas: perfil, aplicaciones, CV

**Servicios:** candidatos, cv-parser, scoring-ats

**API Routes:**
- `GET/POST /api/candidatos` — listar y crear
- `GET/DELETE /api/candidatos/[id]` — detalle y eliminar
- `GET /api/candidatos/[id]/aplicaciones` — aplicaciones de un candidato
- `POST /api/candidatos/[id]/parse-cv` — parsear CV con Claude
- `POST /api/candidatos/[id]/score` — calcular score ATS
- `POST/GET /api/candidatos/[id]/documentos` — subida de CVs/documentos
- `PATCH /api/aplicaciones/[id]/estado` — cambio de estado con state machine

---

### Modulo 4: Entrevistas IA (Dapta)

**Paginas:** `/entrevistas` (tab IA), `/entrevistas/[id]`

- Integracion con Dapta AI: entrevistas telefonicas automatizadas con agente de voz
- Trigger desde el pipeline: boton para iniciar entrevista IA por candidato
- Webhook `/api/webhooks/dapta` procesa resultados de llamada
- Grabacion de audio + transcripcion automatica
- Analisis con Claude API: evalua 5 competencias (tecnica, comunicacion, resolucion de problemas, cultura, motivacion)
- Score IA calculado automaticamente (0-100) con ponderacion por competencia
- Vista de transcripcion completa con timestamps
- Reporte detallado de entrevista IA con desglose por competencia

**Servicios:** entrevista-ia, entrevista-analisis

**API Routes:**
- `GET/POST /api/entrevistas` — listar y crear entrevistas IA
- `GET /api/entrevistas/[id]` — detalle
- `POST /api/webhooks/dapta` — webhook de resultados

---

### Modulo 5: Entrevistas Humanas + Agendamiento

**Paginas:** `/entrevistas` (tab Humanas), `/entrevistas/[id]`

- CRUD de entrevistas humanas con agendamiento (fecha, hora, duracion)
- Panel de agendamiento: ubicacion, enlace virtual (Zoom/Meet/Teams)
- Integracion Google Calendar: crea evento automaticamente con enlace Meet
- Envio de invitaciones por email al candidato con datos de la entrevista
- Formulario de evaluacion: notas del entrevistador, score por competencia (1-10), recomendacion final
- Detalle con informacion del entrevistador y candidato
- Estados: `agendada -> completada / no_show / cancelada`

**Servicios:** entrevista-humana, calendario, email

**API Routes:**
- `GET/POST /api/entrevistas` — listar y crear entrevistas humanas
- `PATCH /api/entrevistas/[id]` — actualizar
- `POST /api/entrevistas/[id]/evaluacion` — guardar evaluacion
- `POST /api/entrevistas/[id]/invitacion` — enviar invitacion

---

### Modulo 6: Scoring Dual + Evaluaciones Tecnicas

**Paginas:** `/evaluaciones`, `/evaluaciones/nueva`, `/evaluaciones/[id]`, `/evaluaciones/banco-preguntas`, `/evaluaciones/plantillas`, `/evaluacion/[token]` (publica)

- **Scoring Dual**: comparacion visual IA vs Humano
  - Formula configurable: `Score Final = (Score IA x peso%) + (Score Humano x peso%)`
  - Pesos por defecto: 50% IA / 50% Humano (configurable desde `/configuracion`)
  - Alertas de discrepancia cuando `|Score IA - Score Humano| > 30` puntos
  - Tabla comparativa con scores ATS, IA, Humano, Tecnico y Final
- **Evaluaciones Tecnicas**:
  - Banco de preguntas con categorias, subcategorias, puntos y tiempo estimado
  - Tipos de pregunta: opcion multiple, verdadero/falso, respuesta abierta, codigo
  - Plantillas de evaluacion reutilizables con duracion y puntaje aprobatorio
  - Envio de evaluacion al candidato via token unico con expiracion (72h)
  - Envio masivo de evaluaciones a multiples candidatos
  - Formulario publico `/evaluacion/[token]` para que el candidato responda
  - Scoring automatico (opcion multiple/V-F exacto, respuesta abierta/codigo via Claude AI)
  - Importacion masiva de preguntas
- **Generacion de Preguntas con IA**:
  - Boton "Generar con IA" en el banco de preguntas
  - Modal de configuracion: categoria, subcategoria, tipo(s), dificultad, cantidad (1-10), cargo objetivo, idioma, instrucciones adicionales
  - Llamada a Claude API con prompt estructurado para generar preguntas de alta calidad
  - Vista previa de preguntas generadas con opcion de incluir/excluir y edicion inline
  - Guardado selectivo al banco de preguntas
  - Regeneracion con mismos parametros
- **Seguridad Anti-Trampa** (portal del candidato):
  - Bloqueo de copy/paste (Ctrl+C/X/A) con toast informativo
  - Bloqueo de clic derecho (menu contextual)
  - Bloqueo de seleccion de texto (`select-none`)
  - Deteccion de cambio de pestana/foco con contador
  - Advertencia progresiva: toast informativo (1ra salida) -> modal de advertencia (3+ salidas)
  - Badge "Evaluacion protegida - Actividad monitoreada" con tooltip
  - Registro silencioso de eventos en BD (`eventos_seguridad` JSONB)
  - Medidas disuasivas, no bloqueantes — solo registra y advierte
- **Reporte de Integridad** (vista admin):
  - Seccion "Reporte de Integridad" en detalle de evaluacion completada
  - Conteo de cambios de pestana e intentos de copia
  - Badge de estado: sin incidentes / actividad moderada / actividad sospechosa

**Servicios:** scoring-dual, scoring-pipeline, evaluacion-tecnica, evaluacion-scoring, banco-preguntas, generar-preguntas-ia

**API Routes:**
- `POST /api/scoring` — calcular scoring ATS por pipeline
- `GET /api/scoring/dual` — obtener datos del dashboard dual
- `GET/POST /api/evaluaciones` — listar y crear evaluaciones
- `GET/PATCH /api/evaluaciones/[id]` — detalle y actualizar
- `POST /api/evaluaciones/[id]/enviar` — enviar al candidato
- `POST /api/evaluaciones/envio-masivo` — envio masivo de evaluaciones a multiples candidatos
- `GET/POST/DELETE /api/evaluaciones/banco-preguntas` — banco de preguntas CRUD
- `GET/POST/DELETE /api/evaluaciones/banco-preguntas/[id]` — pregunta individual
- `GET /api/evaluaciones/banco-preguntas/categorias` — categorias disponibles
- `POST /api/evaluaciones/banco-preguntas/importar` — importacion masiva
- `POST /api/evaluaciones/banco-preguntas/generar-ia` — generacion de preguntas con Claude AI
- `GET/POST/DELETE /api/evaluaciones/plantillas` — plantillas CRUD
- `GET/POST/DELETE /api/evaluaciones/plantillas/[id]` — plantilla individual
- `GET/POST /api/evaluaciones/responder/[token]` — formulario publico
- `POST /api/evaluacion/[token]/seguridad` — registro de eventos de seguridad (publico, solo token)

---

### Modulo 7: Seleccion + Comunicacion + Portal de Documentos

**Paginas:** `/vacantes/[id]/candidatos` (pestana Docs), `/portal/documentos/[token]` (publica)

- Boton "Seleccionar candidato" con confirmacion, notas y fecha tentativa de inicio
- Rechazo masivo de candidatos no seleccionados con email personalizado
- Checklist de documentos requeridos (configurable por organizacion desde `/configuracion`)
- Portal publico `/portal/documentos/[token]` basado en token unico:
  - El candidato ve los documentos requeridos
  - Sube archivos (PDF, imagenes) directamente
  - Tracking de progreso de completitud
- Pestana "Docs" en el panel lateral del candidato seleccionado
- Indicadores en kanban: badge "Docs completos" / "Docs pendientes"

**Servicios:** seleccion, email

**API Routes:**
- `POST /api/seleccion` — marcar como seleccionado/rechazado
- `GET /api/configuracion/checklist` — checklist de documentos
- `GET /api/portal/documentos/[token]` — portal publico
- `POST /api/portal/documentos/[token]/upload` — subir documentos
- `GET/DELETE /api/documentos/[id]` — operaciones de archivos

---

### Modulo 8: Onboarding + Bienvenida

**Paginas:** `/onboarding`, `/configuracion` (tab Onboarding)

- Boton "Contratar" desde el pipeline: transiciona candidato de `documentos_completados -> contratado`
- **Flujo automatico al marcar contratado:**
  1. Email de felicitaciones al candidato (siempre, independiente del contrato)
  2. Creacion automatica de contrato borrador (con datos de empresa + candidato + vacante)
  3. Toast con feedback: contrato creado o advertencia si fallo
- **Flujo de onboarding post-firma:**
  - Al confirmar firma bilateral del contrato, se dispara automaticamente el email de onboarding
  - Se crea registro en tabla `onboarding` con estado del email
- Email de bienvenida con plantilla HTML personalizable y 11 variables dinamicas:
  - `{{nombre_empleado}}`, `{{cargo}}`, `{{fecha_inicio}}`, `{{empresa}}`, `{{lider_nombre}}`, etc.
- Envio inmediato o programado para la fecha de inicio laboral
- Cron job (Vercel, diario a las 8 AM) procesa emails programados automaticamente
- Dashboard de onboarding:
  - Cards de resumen: contratados del mes, emails pendientes, inicios esta semana
  - Tabla filtrable por estado de email
  - Boton "Procesar programados" manual
- Configuracion:
  - Editor de plantilla HTML con panel de variables y vista previa
  - Plantillas de email editables para seleccion, rechazo y onboarding
  - Documentos adjuntos de onboarding (archivos o links)
- Panel de estado en el detalle del candidato contratado
- Selector de lider directo al contratar

**Servicios:** onboarding, email

**API Routes:**
- `GET/POST /api/onboarding` — listar e iniciar onboarding
- `GET/PATCH /api/onboarding/[id]` — detalle y actualizar
- `POST /api/onboarding/[id]/enviar-email` — enviar/reenviar email
- `POST /api/onboarding/procesar-programados` — cron batch
- `GET/PUT /api/configuracion/onboarding` — configuracion de plantilla
- `GET/POST /api/configuracion/onboarding/documentos` — docs adjuntos
- `DELETE /api/configuracion/onboarding/documentos/[id]` — eliminar doc
- `GET/PATCH /api/configuracion/emails` — plantillas de email editables (seleccion, rechazo, onboarding)

---

### Modulo 9: Generacion de Contratos + Firma Digital

**Paginas:** `/contratos`, `/contratos/[id]`, `/configuracion` (tabs Contratos + Empresa)

- **Tipos de contrato** para legislacion colombiana (configurables desde admin):
  - Prestacion de Servicios, Termino Indefinido, Termino Fijo, Obra o Labor, Aprendizaje
- **Creacion automatica** al marcar candidato como contratado:
  - Detecta tipo de contrato desde la vacante
  - Busca plantilla en tabla de mapeo `tipo_plantilla_mapeo`, luego por tipo directo
  - Auto-pobla datos: candidato + vacante + config_empresa (NIT, representante legal, direccion)
  - Crea contrato como borrador listo para revision
- **Configuracion global de empresa** (Configuracion > Empresa):
  - NIT, Representante Legal, Cargo del Representante, Direccion, Ciudad, Departamento, Pais, Telefono, Email
  - Se persiste en `organizations.config_empresa` (JSONB)
  - Se usa automaticamente en todos los contratos generados
- **Mapeo tipo -> plantilla** (Configuracion > Contratos):
  - Admin define que plantilla usar para cada tipo de contrato via selects
  - Tabla `tipo_plantilla_mapeo` con UNIQUE por org + tipo
  - Elimina logica de matching en codigo — todo administrable
- Plantillas HTML profesionales con variables `{{nombre_completo}}`, `{{cargo}}`, `{{salario}}`, `{{empresa_nit}}`, etc.
- ~20 variables por tipo de contrato (auto-detectadas o manuales)
- Editor de contrato dual:
  - Tab Datos: formulario editable con todos los campos
  - Tab HTML: editor de codigo directo
- Versionamiento completo:
  - Cada cambio crea una nueva version automaticamente
  - Historial de versiones con autor, fecha y nota de cambio
  - Regenerar HTML toma datos actualizados de config_empresa
- State machine: `borrador -> generado -> enviado -> firmado / rechazado`
- **Firma electronica bilateral** (SignWell en produccion, mock en desarrollo):
  - Enviar para firma: inyecta campos de firma (`text_tags`) en el HTML del contrato
  - Dos signatarios: candidato (orden 1) + empresa/admin (orden 2)
  - `SIGNWELL_TEST_MODE=false` en `.env.local` para envio real de emails
  - Confirmar firma bilateral: dialog con fecha y notas, dispara email de onboarding automatico
  - Al confirmar firma: contrato -> firmado, crea registro onboarding, envia email al candidato
- Dashboard de contratos:
  - Cards de resumen: borradores, generados, en firma, firmados
  - Tabla filtrable por estado, tipo y busqueda
- Acciones de documento: Imprimir, Descargar HTML, Marcar como generado, Enviar para firma, Confirmar firma bilateral

**Servicios:** contratos, firma-electronica, tipos-contrato

**API Routes:**
- `GET/POST /api/contratos` — listar (con filtros) y crear
- `GET/PUT /api/contratos/[id]` — detalle y actualizar
- `GET /api/contratos/[id]/versiones` — historial de versiones
- `POST /api/contratos/[id]/regenerar` — regenerar HTML desde plantilla (refresca datos empresa)
- `POST /api/contratos/[id]/firmar` — enviar para firma electronica (SignWell)
- `PATCH /api/contratos/[id]/firmar` — confirmar firma bilateral + trigger onboarding
- `GET /api/contratos/[id]/firma` — consultar estado de firma + descargar PDF
- `GET /api/contratos/auto-poblar` — auto-poblar datos del candidato
- `GET/PATCH /api/configuracion/empresa` — config global de empresa (nombre, logo, NIT, representante, etc.)
- `GET/POST/DELETE /api/configuracion/tipo-plantilla-mapeo` — mapeo tipo contrato -> plantilla
- `GET/POST /api/plantillas-contrato` — listar y crear plantillas
- `GET/PUT/DELETE /api/plantillas-contrato/[id]` — CRUD plantilla
- `GET/POST /api/tipos-contrato` — listar y crear tipos de contrato
- `GET/PUT/DELETE /api/tipos-contrato/[id]` — CRUD tipo de contrato

---

### Modulo 10: Reportes y Analytics

**Paginas:** `/reportes`

- **Tab Pipeline** — metricas generales del proceso de contratacion:
  - KPIs: vacantes activas, total candidatos, contratados (90d), tasa de conversion
  - Funnel de conversion por etapas (filtrable por vacante)
  - Dias promedio por etapa del pipeline
  - Volumen de aplicaciones semanal (grafico de barras)
  - Top vacantes por tasa de conversion
  - Distribucion de scores (histograma)
  - Filtros: periodo (7d/30d/90d/180d/365d/custom), vacante
- **Tab Integridad** — analytics de seguridad de evaluaciones tecnicas:
  - 5 KPI cards: evaluaciones completadas, sin incidentes (%), riesgo medio, riesgo alto, indice de riesgo promedio
  - Insight de correlacion riesgo-score (condicional, aparece si diferencia >= 5 puntos)
  - Grafico de barras: distribucion de incidentes (0, 1-2, 3-5, 6+ eventos)
  - Grafico de pie: tipo de evento (cambios de pestana vs intentos de copia)
  - Filtros: vacante, nivel de riesgo, rango de fechas
  - Tabla de evaluaciones con riesgo: candidato, vacante, cambios pestana, intentos copia, score, nivel riesgo, fecha
  - Export CSV con todos los datos
  - 3 vistas SQL: `v_integridad_evaluaciones`, `v_kpis_integridad`, `v_distribucion_incidentes`

**Servicios:** reportes

**API Routes:**
- `GET /api/reportes/kpis` — KPIs generales
- `GET /api/reportes/funnel` — funnel de conversion
- `GET /api/reportes/tiempos` — tiempos por etapa
- `GET /api/reportes/volumen` — volumen semanal
- `GET /api/reportes/top-vacantes` — top vacantes
- `GET /api/reportes/scores` — distribucion de scores
- `GET /api/reportes/exportar` — exportar datos
- `GET /api/reportes/integridad` — analytics de integridad de evaluaciones (KPIs, tabla, distribucion)

---

## Maquinas de Estado

```
VACANTE:     borrador -> publicada -> pausada -> cerrada -> archivada

APLICACION:  nuevo -> revisado -> preseleccionado -> entrevista_ia ->
             entrevista_humana -> evaluado -> seleccionado ->
             documentos_pendientes -> documentos_completos -> contratado ->
             contrato_terminado
             (cualquier estado -> descartado)

ENTREVISTA IA:     pendiente -> en_progreso -> completada / cancelada
ENTREVISTA HUMANA: agendada -> completada / no_show / cancelada

CONTRATO:    borrador -> generado -> enviado -> firmado / rechazado

ONBOARDING EMAIL:  pendiente -> programado -> enviado / error

EVALUACION TECNICA: pendiente -> enviada -> en_progreso -> completada / expirada / cancelada
```

## Flujo Completo de Contratacion

```
 1. Crear vacante -> Publicar en LinkedIn / Portal publico
 2. Recibir candidatos -> Parsear CV (Claude AI) -> Score ATS
 3. Evaluacion tecnica (token publico) -> Score Tecnico
 4. Entrevista IA (Dapta) -> Transcripcion -> Analisis -> Score IA
 5. Agendar entrevista humana (Google Calendar + Meet) -> Evaluacion -> Score Humano
 6. Scoring Dual (ATS + Tecnico + IA + Humano) -> Ranking final
 7. Seleccionar candidato -> Auto-avance a documentos_pendientes
 8. Solicitar documentos (portal publico con token) -> Verificar completitud
 9. Marcar contratado ->
    a. Email de felicitaciones al candidato (automatico, desacoplado del contrato)
    b. Creacion automatica de contrato borrador (plantilla segun tipo de vacante + datos empresa)
10. Admin revisa/edita contrato en /contratos/[id]
11. Enviar para firma electronica (SignWell bilateral: candidato + empresa)
12. Confirmar firma bilateral -> Email de onboarding al candidato (automatico)
```

---

## Base de Datos

### Migraciones (24)

| # | Archivo | Descripcion |
|---|---------|-------------|
| 001 | `initial_schema.sql` | organizations, users, vacantes, candidatos, aplicaciones |
| 002 | `scoring_tables.sql` | Campos de scoring en aplicaciones |
| 003 | `contratos_tables.sql` | contratos, plantillas_contrato, activity_log, org_settings |
| 004 | `add_missing_columns.sql` | organization_id en tablas dependientes |
| 005 | `linkedin_integration.sql` | linkedin_tokens, linkedin_job_syncs |
| 006 | `linkedin_sync.sql` | Tracking de sync de aplicantes LinkedIn |
| 007 | `scoring_ats_breakdown.sql` | Desglose de score por dimension |
| 008 | `entrevistas_enhanced.sql` | recording_url, agendamiento_url |
| 009 | `seleccion_documentos.sql` | Checklist de documentos requeridos |
| 010 | `onboarding.sql` | Tabla onboarding + documentos_onboarding |
| 011 | `contratos_enhanced.sql` | contrato_versiones + campos de firma |
| 012 | `portal_publico_vacantes.sql` | Portal publico: slug, is_published, views/applications count |
| 013 | `evaluaciones_tecnicas.sql` | preguntas_banco, evaluacion_plantillas, evaluaciones |
| 014 | `google_calendar.sql` | google_tokens, calendar_events |
| 015 | `firma_campos.sql` | Campos de firma digital en contratos |
| 016 | `reportes_analytics.sql` | Vistas SQL: v_kpis_generales, v_tiempos_por_etapa, v_volumen_semanal, fn_top_vacantes_conversion |
| 017 | `tipos_contrato.sql` | Tabla tipos_contrato con 3 tipos colombianos |
| 018 | `evaluaciones_seguridad.sql` | Columna eventos_seguridad JSONB en evaluaciones + indice GIN |
| 019 | `analytics_integridad.sql` | Vistas SQL: v_integridad_evaluaciones, v_kpis_integridad, v_distribucion_incidentes |
| 020 | `email_firma_admin.sql` | Email admin configurable para firma + plantillas email editables en org_settings |
| 021 | `estados_completados.sql` | Array de estados completados en aplicaciones |
| 022 | `terminacion_contrato.sql` | Tabla terminaciones_contrato con motivos y fecha |
| 023 | `configuracion_empresa.sql` | Columna config_empresa JSONB en organizations (NIT, representante, direccion) |
| 024 | `tipo_plantilla_mapeo.sql` | Tabla tipo_plantilla_mapeo: mapeo admin tipo contrato -> plantilla |

### Tablas Principales

- **organizations** — multi-tenant (id, name, slug, plan, logo_url, config_empresa JSONB)
- **users** — roles: admin, reclutador, hiring_manager, viewer
- **vacantes** — publicaciones de empleo con portal publico (slug, is_published)
- **candidatos** — banco de talento con CV parseado (JSONB)
- **aplicaciones** — pipeline candidato-vacante con 5 scores (ATS, IA, humano, tecnico, final)
- **entrevistas_ia** — entrevistas con Dapta (transcripcion, analisis JSONB)
- **entrevistas_humanas** — entrevistas presenciales/virtuales con evaluacion
- **contratos** — contratos generados con versionamiento
- **contrato_versiones** — historial de cambios con autor
- **plantillas_contrato** — plantillas HTML por tipo de contrato
- **onboarding** — registros de onboarding con tracking de email
- **documentos_onboarding** — documentos requeridos por organizacion
- **org_settings** — configuracion por organizacion (email, scoring, portal, onboarding, plantillas email)
- **linkedin_tokens** — tokens OAuth LinkedIn
- **linkedin_job_syncs** — tracking de sincronizacion
- **preguntas_banco** — banco de preguntas tecnicas (categoria, tipo, puntos)
- **evaluacion_plantillas** — plantillas de evaluacion reutilizables
- **evaluaciones** — evaluaciones asignadas a candidatos (token, respuestas, score, eventos_seguridad)
- **google_tokens** — tokens OAuth de Google (Calendar, Meet)
- **calendar_events** — vinculacion entrevista-evento de Google Calendar
- **tipos_contrato** — tipos de contrato configurables (15 registros seed)
- **tipo_plantilla_mapeo** — mapeo admin: tipo de contrato -> plantilla a usar (UNIQUE org + tipo)
- **terminaciones_contrato** — registro de terminaciones con motivo, detalle y fecha
- **activity_log** — auditoria de acciones

---

## Integraciones Externas

| Servicio | Uso | Estado |
|----------|-----|--------|
| **Claude AI (Anthropic)** | CV parsing, analisis de entrevistas, generacion de preguntas, scoring de respuestas abiertas | Funcional |
| **Dapta** | Entrevistas telefonicas con agente de voz IA + webhook | Funcional |
| **Resend** | Emails transaccionales (invitaciones, seleccion, rechazo, onboarding) | Funcional |
| **SignWell** | Firma electronica de contratos + webhook | Funcional |
| **Google Calendar** | Agendamiento de entrevistas + Meet links | Funcional |
| **LinkedIn** | OAuth, publicar vacantes, sync aplicantes | Requiere API key |
| **AWS S3** | Almacenamiento de archivos | Placeholder (usa local en dev) |

---

## Variables de Entorno

Ver `.env.example` para la lista completa. Las variables minimas para desarrollo:

```env
DATABASE_URL=postgresql://hirely_user:hirely_dev_2026@localhost:5434/hirely
NEXTAUTH_URL=http://localhost:3500
NEXTAUTH_SECRET=your-secret-here
```

Variables opcionales por integracion:

- **LinkedIn:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `LINKEDIN_INTEGRATION_MODE`
- **IA:** `ANTHROPIC_API_KEY`
- **Dapta:** `DAPTA_FLOW_WEBHOOK_URL`, `DAPTA_API_KEY`, `DAPTA_WEBHOOK_SECRET`, `DAPTA_FROM_NUMBER`
- **Email:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **Firma electronica:** `FIRMA_PROVIDER` (signwell|mock), `SIGNWELL_API_KEY`, `SIGNWELL_API_URL`, `SIGNWELL_TEST_MODE` (true|false, default true)
- **Google:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Storage:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`
- **App:** `APP_URL` (para webhooks de firma)

## Docker

```bash
# Iniciar base de datos
docker-compose up -d

# Ver logs
docker logs -f hirely-db

# Conectar a psql
docker exec -it hirely-db psql -U hirely_user -d hirely

# Ejecutar migracion individual
docker cp src/lib/db/migrations/001_initial_schema.sql hirely-db:/tmp/m.sql
docker exec hirely-db psql -U hirely_user -d hirely -f /tmp/m.sql
```

## Scripts

```bash
npm run dev       # Servidor de desarrollo (puerto 3500)
npm run build     # Build de produccion
npm run start     # Iniciar build de produccion
npm run lint      # Ejecutar ESLint
npm run db:migrate  # Ejecutar migraciones
npm run db:seed     # Seed de datos
```

## Changelog

### 2026-03-24 — Flujo completo de contratacion

- **Email de contratado**: Al marcar candidato como contratado, se envia email de felicitaciones automaticamente (desacoplado del contrato)
- **Configuracion global de empresa**: Nueva pestana "Empresa" en Configuracion con NIT, representante legal, direccion, etc. Persiste en `organizations.config_empresa` JSONB
- **Creacion automatica de contrato**: Detecta tipo de contrato de la vacante, busca plantilla via mapeo admin, auto-pobla datos de empresa + candidato
- **Mapeo tipo -> plantilla**: Nueva seccion en Configuracion > Contratos para definir que plantilla usar por tipo de contrato (dos selects, sin logica hardcodeada)
- **Firma bilateral**: Boton "Confirmar: ambas partes han firmado" con dialog (fecha, notas), dispara email de onboarding automaticamente
- **Onboarding post-firma**: Al confirmar firma bilateral, se crea registro onboarding y se envia email de bienvenida al candidato
- **SignWell text tags**: Inyeccion automatica de campos de firma en el HTML del contrato para firma digital real
- **`SIGNWELL_TEST_MODE`**: Variable de entorno para controlar test mode de SignWell (default true)
- **Regenerar contrato**: Ahora refresca datos de empresa desde config_empresa actual
- **Mejoras UI**: Toast mejorado al contratar, error handling en envio de firma, tab Organizacion funcional
- **Migraciones**: 021 (estados_completados), 022 (terminacion_contrato), 023 (config_empresa), 024 (tipo_plantilla_mapeo)

### 2026-03-19 — Fixes S1-S7

- **S1:** Correccion de validaciones Zod en esquema de vacantes y rutas API asociadas
- **S2:** Mejoras de layout y UX en editor de plantillas de contrato
- **S3:** Tipos de contrato configurables (CRUD admin) + migracion 017
- **S4:** Seguridad anti-trampa en evaluaciones tecnicas: bloqueo copy/paste, deteccion cambio de pestana, registro de eventos en BD, advertencias progresivas, indicador de proctoring
- **S5:** Generacion de preguntas con IA (Claude API) desde el banco de preguntas con preview, edicion inline y guardado selectivo
- **S6:** Reporte de integridad de evaluaciones: analytics con KPIs, distribucion de incidentes, correlacion riesgo-score, export CSV, vistas SQL
- **S7:** Email admin configurable para firma digital + plantillas de email editables (seleccion, rechazo, onboarding) en configuracion de organizacion. Migracion 020

---

## Deploy

Configurado para **Vercel** con:
- Cron job diario: `/api/onboarding/procesar-programados` (8:00 AM UTC)
- Edge middleware para autenticacion
- Variables de entorno en Vercel Dashboard
- Output standalone para Docker deployment alternativo

## Estado del MVP

### Implementado
- Autenticacion multi-tenant con JWT
- Dashboard con metricas y actividad reciente
- CRUD completo de vacantes con state machine
- Banco de talento con CV parsing (Claude AI)
- Scoring ATS deterministico (6 dimensiones ponderadas)
- Pipeline kanban con drag & drop
- State machine de aplicaciones con estados de documentos (documentos_pendientes, documentos_completos)
- Entrevistas IA (Dapta) con analisis automatico
- Entrevistas humanas con agendamiento y evaluacion + Google Calendar + Meet
- Scoring dual (IA + Humano) configurable
- Evaluaciones tecnicas con banco de preguntas y token publico
- Envio masivo de evaluaciones tecnicas
- Generacion de preguntas con IA (Claude API) desde el banco de preguntas
- Seguridad anti-trampa en evaluaciones (copy/paste, cambio de pestana, registro de eventos)
- Reporte de integridad de evaluaciones en detalle y analytics con export CSV
- Seleccion de candidatos con portal de documentos
- Onboarding con emails de bienvenida (Resend, inmediatos/programados)
- Plantillas de email editables (seleccion, rechazo, onboarding) desde configuracion
- Generacion de contratos (5 tipos colombianos) con versionamiento y creacion automatica
- Tipos de contrato configurables (CRUD admin) + mapeo tipo -> plantilla administrable
- Configuracion global de empresa (NIT, representante, direccion) para contratos
- Firma electronica bilateral con SignWell (text tags, candidato + empresa) + mock (desarrollo)
- Confirmacion de firma bilateral con trigger automatico de onboarding
- Email de contratado desacoplado (siempre se envia, independiente del contrato)
- Email admin configurable para firma digital
- Integracion LinkedIn (OAuth, publicacion, sync)
- Portal publico de empleo
- Reportes y Analytics: pipeline (funnel, tiempos, volumen, scores) + integridad de evaluaciones
- 27 componentes shadcn/ui + 74 de dominio
- 87 endpoints API REST
- 27 servicios de logica de negocio
- 24 migraciones SQL

### Parcialmente implementado
- AWS S3 storage (usa `/public/uploads/` en dev)

### Pendiente
- Colaboracion en equipo (comentarios, menciones)
- Notificaciones en tiempo real (WebSocket/SSE)
- App movil (solo responsive web)
