# Hirely — ATS (Applicant Tracking System)

Plataforma SaaS multi-tenant de reclutamiento y seleccion de personal, construida con Next.js 14, TypeScript y PostgreSQL. Cubre el flujo completo: desde la publicacion de vacantes hasta la firma de contratos.

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| UI | shadcn/ui (27 componentes base + 50 componentes de dominio) |
| Auth | NextAuth.js v5 (Credentials + JWT) |
| Base de datos | PostgreSQL 16 (Docker) |
| Validacion | Zod 4.3 |
| Estado | Zustand 5.0 |
| IA | Claude API (CV parsing, analisis de entrevistas) |
| Charts | Recharts 3.7 |
| Integraciones | LinkedIn OAuth, Dapta (voz IA), DocuSign, SendGrid, Unipile, Google Calendar |

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
│   ├── api/                 # 62 rutas API REST
│   ├── auth/                # Flujos OAuth LinkedIn
│   ├── evaluacion/[token]/  # Formulario publico de evaluacion tecnica
│   └── portal/              # Portal publico de documentos
├── components/              # 77 componentes React
│   ├── candidatos/          # Score badge, CV view, kanban, pipeline
│   ├── contratos/           # Editor, preview, firma, plantillas, versiones
│   ├── entrevistas/         # Trigger IA, evaluacion humana, scoring
│   ├── evaluaciones/        # Banco preguntas, plantillas, formularios
│   ├── layout/              # Sidebar, header, breadcrumbs, mobile-nav
│   ├── onboarding/          # Contratar, plantilla email, docs
│   ├── portal/              # Aplicacion publica, documentos
│   ├── seleccion/           # Seleccionar, rechazar, documentos
│   ├── shared/              # Data table, empty state, confirm dialog, loading
│   ├── ui/                  # 27 shadcn/ui components
│   └── vacantes/            # Card, form, status selector, LinkedIn publisher
├── hooks/                   # 5 custom hooks (useDebounce, useCandidatos, useVacantes, useLinkedin, useToast)
├── lib/
│   ├── auth/                # NextAuth config + API middleware helpers
│   ├── db/                  # Pool de conexion + 13 migraciones SQL
│   │   ├── migrations/      # 001-013 migraciones
│   │   └── seeds/           # Preguntas iniciales de evaluacion
│   ├── integrations/        # 10 clientes externos (Anthropic, Dapta, LinkedIn, DocuSign, SendGrid, etc.)
│   ├── services/            # 24 servicios de logica de negocio
│   ├── types/               # 11 archivos de tipos TypeScript
│   ├── utils/               # 11 utilidades (API response, errors, constants, design tokens, email templates, etc.)
│   ├── validations/         # 6 schemas Zod
│   └── tests/               # Tests de integracion
└── middleware.ts            # Edge middleware (proteccion de rutas)
```

**Totales:** 255 archivos TypeScript/TSX, 77 componentes, 62 endpoints API, 24 servicios, 13 migraciones

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
- State machine de vacante: `borrador → publicada → pausada → cerrada → archivada`
- Selector de estado inteligente con acciones LinkedIn automaticas por transicion
- Pagina publica `/empleo/[slug]` para que candidatos apliquen
- Pagina de agradecimiento post-aplicacion
- Criterios de evaluacion ponderados por vacante
- Portal publico con conteo de vistas y aplicaciones
- Webhooks: Unipile + LinkedIn para recibir datos de candidatos

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
- `POST /api/candidatos/[id]/parse-cv` — parsear CV con Claude
- `POST /api/candidatos/[id]/score` — calcular score ATS
- `POST/GET /api/candidatos/[id]/documentos` — subida de CVs/documentos

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
- Envio de invitaciones por email al candidato con datos de la entrevista
- Formulario de evaluacion: notas del entrevistador, score por competencia (1-10), recomendacion final
- Detalle con informacion del entrevistador y candidato
- Estados: `agendada → completada / no_show / cancelada`

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
  - Tipos de pregunta: opcion multiple, verdadero/falso, respuesta abierta
  - Plantillas de evaluacion reutilizables con duracion y puntaje aprobatorio
  - Envio de evaluacion al candidato via token unico con expiracion
  - Formulario publico `/evaluacion/[token]` para que el candidato responda
  - Scoring automatico + merge con score ATS y entrevistas
  - Importacion masiva de preguntas

**Servicios:** scoring-dual, scoring-pipeline, evaluacion-tecnica, evaluacion-scoring, banco-preguntas

**API Routes:**
- `POST /api/scoring` — calcular scoring ATS por pipeline
- `GET /api/scoring/dual` — obtener datos del dashboard dual
- `GET/POST /api/evaluaciones` — listar y crear evaluaciones
- `GET/PATCH /api/evaluaciones/[id]` — detalle y actualizar
- `POST /api/evaluaciones/[id]/enviar` — enviar al candidato
- `GET/POST/DELETE /api/evaluaciones/banco-preguntas` — banco de preguntas CRUD
- `GET/POST/DELETE /api/evaluaciones/banco-preguntas/[id]` — pregunta individual
- `GET /api/evaluaciones/banco-preguntas/categorias` — categorias disponibles
- `POST /api/evaluaciones/banco-preguntas/importar` — importacion masiva
- `GET/POST/DELETE /api/evaluaciones/plantillas` — plantillas CRUD
- `GET/POST/DELETE /api/evaluaciones/plantillas/[id]` — plantilla individual
- `GET/POST /api/evaluaciones/responder/[token]` — formulario publico

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

- Boton "Contratar" desde el pipeline: transiciona candidato de `seleccionado → contratado`
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

---

### Modulo 9: Generacion de Contratos

**Paginas:** `/contratos`, `/contratos/[id]`, `/configuracion` (tab Contratos)

- 3 tipos de contrato para legislacion colombiana:
  - **Prestacion de Servicios**: autonomia, honorarios, objeto del contrato
  - **Horas y Demanda**: tarifa por hora, modalidad, reportes
  - **Laboral**: jornada, prestaciones sociales, periodo de prueba
- Auto-poblado de datos desde candidato/vacante/organizacion con un click
- Plantillas HTML profesionales con variables `{{nombre_completo}}`, `{{cargo}}`, `{{salario}}`, etc.
- ~20 variables por tipo de contrato (auto-detectadas o manuales)
- Formulario de generacion:
  - Selector de tipo de contrato
  - Selector de plantilla (default o personalizada)
  - Campos dinamicos segun tipo seleccionado
  - Vista previa en vivo del documento renderizado
- Editor de contrato dual:
  - Tab Datos: formulario editable con todos los campos
  - Tab HTML: editor de codigo directo
- Versionamiento completo:
  - Cada cambio crea una nueva version automaticamente
  - Historial de versiones con autor, fecha y nota de cambio
  - Restaurar versiones anteriores
- State machine: `borrador → generado → enviado → firmado / rechazado`
- Acciones de documento:
  - Imprimir (abre dialogo de impresion del navegador)
  - Descargar como HTML
  - Marcar como generado
  - Enviar para firma electronica (DocuSign mock)
- Dashboard de contratos:
  - Cards de resumen: borradores, generados, en firma, firmados
  - Tabla filtrable por estado, tipo y busqueda
- Gestion de plantillas personalizadas desde Configuracion → Contratos:
  - CRUD completo de plantillas
  - Panel de variables disponibles por tipo
  - Vista previa con datos de ejemplo
- Integracion en pipeline: tab "Contrato" para candidatos contratados
- Firma electronica: integracion DocuSign (mock preparado para produccion)

**Servicios:** contratos, firma-electronica

**API Routes:**
- `GET/POST /api/contratos` — listar (con filtros) y crear
- `GET/PUT /api/contratos/[id]` — detalle y actualizar
- `GET /api/contratos/[id]/versiones` — historial de versiones
- `POST /api/contratos/[id]/regenerar` — regenerar HTML desde plantilla
- `POST /api/contratos/[id]/firmar` — enviar para firma electronica
- `GET /api/contratos/auto-poblar` — auto-poblar datos del candidato
- `GET/POST /api/plantillas-contrato` — listar y crear plantillas
- `GET/PUT/DELETE /api/plantillas-contrato/[id]` — CRUD plantilla

---

## Maquinas de Estado

```
VACANTE:     borrador → publicada → pausada → cerrada → archivada

APLICACION:  nuevo → revisado → preseleccionado → entrevista_ia →
             entrevista_humana → evaluado → seleccionado → contratado
             (cualquier estado → descartado)

ENTREVISTA IA:     pendiente → en_progreso → completada / cancelada
ENTREVISTA HUMANA: agendada → completada / no_show / cancelada

CONTRATO:    borrador → generado → enviado → firmado / rechazado

ONBOARDING EMAIL:  pendiente → programado → enviado / error

EVALUACION TECNICA: pendiente → enviada → iniciada → completada
```

## Flujo Completo de Contratacion

```
1. Crear vacante → Publicar en LinkedIn / Portal publico
2. Recibir candidatos → Parsear CV (Claude AI) → Score ATS
3. Evaluacion tecnica (token publico) → Score Tecnico
4. Entrevista IA (Dapta) → Transcripcion → Analisis → Score IA
5. Agendar entrevista humana → Evaluacion → Score Humano
6. Scoring Dual (ATS + Tecnico + IA + Humano) → Ranking final
7. Seleccionar candidato → Solicitar documentos (portal)
8. Contratar → Enviar email de bienvenida → Onboarding
9. Generar contrato → Firma electronica
```

---

## Base de Datos

### Migraciones (13)

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

### Tablas Principales

- **organizations** — multi-tenant (id, name, slug, plan, logo_url)
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
- **org_settings** — configuracion por organizacion (email, scoring, portal, onboarding)
- **linkedin_tokens** — tokens OAuth LinkedIn
- **linkedin_job_syncs** — tracking de sincronizacion
- **preguntas_banco** — banco de preguntas tecnicas (categoria, tipo, puntos)
- **evaluacion_plantillas** — plantillas de evaluacion reutilizables
- **evaluaciones** — evaluaciones asignadas a candidatos (token, respuestas, score)
- **activity_log** — auditoria de acciones

---

## Integraciones Externas

| Servicio | Uso | Estado |
|----------|-----|--------|
| **Claude API (Anthropic)** | CV parsing, analisis de entrevistas | Funcional |
| **LinkedIn OAuth** | Login candidato, publicar vacantes, sync aplicantes | Funcional |
| **Dapta** | Entrevistas telefonicas con agente de voz IA | Funcional (requiere API key) |
| **Unipile** | Automatizacion LinkedIn, job posting, applicant sync | Funcional (requiere cuenta) |
| **DocuSign** | Firma electronica de contratos | Mock (preparado para produccion) |
| **Signable** | Firma electronica alternativa | Placeholder |
| **SendGrid** | Emails transaccionales | Configurado (requiere API key) |
| **Google Calendar** | Agendamiento de entrevistas | Placeholder |
| **OpenAI** | Fallback para analisis IA | Placeholder |
| **AWS S3** | Almacenamiento de archivos | Placeholder (usa storage local en dev) |

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
- **IA:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **Dapta:** `DAPTA_FLOW_WEBHOOK_URL`, `DAPTA_API_KEY`, `DAPTA_WEBHOOK_SECRET`
- **Email:** `SENDGRID_API_KEY`, `EMAIL_FROM`
- **E-Signature:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, `SIGNABLE_API_KEY`
- **Unipile:** `UNIPILE_API_URL`, `UNIPILE_API_KEY`, `UNIPILE_ACCOUNT_ID`
- **Storage:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

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

## Deploy

Configurado para **Vercel** con:
- Cron job diario: `/api/onboarding/procesar-programados` (8:00 AM UTC)
- Edge middleware para autenticacion
- Variables de entorno en Vercel Dashboard
- Output standalone para Docker deployment alternativo

## Estado del MVP

### Implementado ✅
- Autenticacion multi-tenant con JWT
- Dashboard con metricas y actividad reciente
- CRUD completo de vacantes con state machine
- Banco de talento con CV parsing (Claude AI)
- Scoring ATS deterministico (6 dimensiones ponderadas)
- Pipeline kanban con drag & drop
- Entrevistas IA (Dapta) con analisis automatico
- Entrevistas humanas con agendamiento y evaluacion
- Scoring dual (IA + Humano) configurable
- Evaluaciones tecnicas con banco de preguntas y token publico
- Seleccion de candidatos con portal de documentos
- Onboarding con emails de bienvenida (inmediatos/programados)
- Generacion de contratos (3 tipos colombianos) con versionamiento
- Integracion LinkedIn (OAuth, publicacion, sync)
- Portal publico de empleo
- 27 componentes shadcn/ui + 50 de dominio
- 62 endpoints API REST

### Parcialmente implementado ⚠️
- DocuSign e-signature (mock listo para produccion)
- Google Calendar (placeholder)
- AWS S3 storage (usa `/public/uploads/` en dev)

### Pendiente 🚧
- Reportes/analytics avanzados
- Colaboracion en equipo (comentarios, menciones)
- Notificaciones en tiempo real (WebSocket/SSE)
- App movil (solo responsive web)
