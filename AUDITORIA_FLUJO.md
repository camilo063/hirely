# AUDITORIA DE FLUJO COMPLETO — HIRELY

**Fecha:** 2026-03-19
**Alcance:** Vacante publicada → Postulacion → Evaluacion IA → Llamada Dapta → Evaluacion Tecnica → Entrevista Humana → Seleccion → Documentos → Contrato → Firma → Onboarding

---

## FLUJO ACTUAL (como esta hoy)

```
1. POSTULACION (portal publico /empleo/[slug])
   → Candidato sube CV + datos personales
   → Se crea registro en aplicaciones con estado='nuevo'
   → Se dispara scoring pipeline automatico (Claude AI parsea CV + calcula Score ATS)
   → Estado cambia a 'en_revision' (si pasa corte) o 'descartado' (si no)

2. REVISION MANUAL (dashboard /vacantes/[id]/candidatos)
   → Reclutador ve pipeline kanban con candidatos
   → ⚠️ Drag-and-drop de estados NO FUNCIONA (schema rechaza campo 'estado')
   → Solo cambios automaticos de estado via servicios internos

3. ENTREVISTA IA — DAPTA (/entrevistas)
   → Reclutador hace clic "Iniciar entrevista IA"
   → Sistema llama a Dapta API con datos del candidato + preguntas
   → Dapta hace llamada telefonica real al candidato
   → Webhook /api/webhooks/dapta recibe transcript al terminar
   → Claude AI analiza transcript → genera score_ia
   → Estado aplicacion: 'entrevista_ia' → 'entrevista_humana'
   → ❌ NO hay notificacion al admin cuando la llamada termina

4. EVALUACION TECNICA (/evaluaciones)
   → Reclutador crea evaluacion, selecciona plantilla y candidato (wizard 3 pasos)
   → Se envia email con link /evaluacion/[token] (72h expiracion, via Resend)
   → Candidato responde en portal publico con timer
   → Al completar: scoring automatico, se guarda score_tecnico en aplicacion
   → ❌ NO se actualiza el estado del pipeline
   → ❌ NO hay notificacion al admin

5. ENTREVISTA HUMANA (/entrevistas)
   → Reclutador agenda entrevista humana
   → Si Google Calendar conectado: crea evento + Meet link automatico (no-bloqueante)
   → Invitacion enviada a candidato + entrevistador via Calendar
   → Post-entrevista: formulario con 5 criterios (1-10) + recomendacion
   → Se calcula score_humano (promedio × 10) y score_final (dual)

6. SELECCION (/vacantes/[id]/candidatos)
   → Reclutador marca candidato como "seleccionado" o "descartado"
   → Si seleccionado:
     - Se genera token portal documentos (30 dias)
     - Se crea checklist de documentos requeridos
     - Email con link al portal (si activado)
   → Si descartado:
     - Se envia email de rechazo (si activado)
     - Estado → 'descartado'

7. DOCUMENTOS (/portal/documentos/[token])
   → Candidato sube documentos en portal publico
   → Admin puede verificar o rechazar cada documento
   → Si rechazado: candidato ve motivo y puede re-subir
   → Cuando todos completos: email de notificacion al admin

8. CONTRATO (/contratos)
   → Reclutador genera contrato desde plantilla (auto-poblado de datos)
   → Envia para firma electronica (SignWell)
   → SignWell envia email a candidato + admin automaticamente
   → Webhook /api/webhooks/firma recibe confirmacion de firma
   → Estado contrato: 'enviado' → 'firmado'
   → ❌ NO se envia notificacion interna al completar firma

9. ONBOARDING (/onboarding)
   → ❌ NO es automatico — requiere accion manual del admin
   → Admin inicia onboarding: estado → 'contratado'
   → Email de bienvenida: inmediato o programado (cron diario)
   → Plantilla editable desde /configuracion con 11 variables dinamicas
```

---

## BRECHAS IDENTIFICADAS

| # | Bloque | Descripcion | Severidad | Archivo(s) afectado(s) |
|---|--------|-------------|-----------|------------------------|
| 1 | Pipeline | **Kanban drag-and-drop NO funciona** — candidatoUpdateSchema no incluye campo 'estado', el PUT silenciosamente ignora el cambio | CRITICA | `src/lib/validations/candidato.schema.ts` (linea 18-31), `src/app/api/candidatos/[id]/route.ts` |
| 2 | Pipeline | **Tab "Aplicaciones" en detalle candidato esta vacio** — solo tiene texto placeholder, sin fetch de datos | ALTA | `src/app/(dashboard)/candidatos/[id]/page.tsx` (linea 205-213) |
| 3 | Dapta | **Sin notificacion al admin cuando Dapta completa llamada** — admin debe revisar manualmente | ALTA | `src/lib/services/entrevista-ia.service.ts` (linea 231-251) |
| 4 | Evaluaciones | **Sin notificacion al admin cuando candidato completa evaluacion tecnica** | ALTA | `src/lib/services/evaluacion-tecnica.service.ts` (linea 297-304) |
| 5 | Evaluaciones | **Estado del pipeline NO se actualiza al completar evaluacion** — solo se guarda score_tecnico | ALTA | `src/lib/services/evaluacion-tecnica.service.ts` (linea 287-294) |
| 6 | Evaluaciones | **Sin envio masivo de evaluaciones** — solo individual, una por una | MEDIA | `src/app/(dashboard)/evaluaciones/nueva/page.tsx` |
| 7 | Scoring | **score_final no se recalcula automaticamente** al recibir nuevos scores parciales | MEDIA | `src/lib/services/scoring-dual.service.ts` |
| 8 | Firma | **Sin notificacion interna al admin/candidato cuando contrato se firma** — webhook actualiza BD pero no avisa | MEDIA | `src/app/api/webhooks/firma/route.ts` (lineas 56-68) |
| 9 | Firma | **Email del admin para firma NO es configurable** — siempre usa el primer admin activo de la org | BAJA | `src/lib/services/firma-electronica.service.ts` (lineas 60-71) |
| 10 | Onboarding | **Onboarding NO es automatico** — requiere accion manual del admin despues de firma | MEDIA | `src/lib/services/onboarding.service.ts` |
| 11 | Configuracion | **Templates de email de seleccion/rechazo NO editables desde UI** — columnas existen en org_settings pero sin editor | MEDIA | `src/app/(dashboard)/configuracion/page.tsx`, `src/lib/utils/email-templates.ts` |
| 12 | Documentos | **Sin notificacion al candidato cuando documento es rechazado** — solo ve el cambio si vuelve al portal | BAJA | `src/lib/services/seleccion.service.ts` (lineas 282-325) |

---

## PLAN DE CORRECCION PRIORIZADO

### PRIORIDAD 1 — CRITICA

#### B1. Kanban drag-and-drop de estados
**Problema:** `candidatoUpdateSchema` no permite campo `estado`. El PUT a `/api/candidatos/[id]` silenciosamente ignora el cambio.
**Solucion:** Crear un endpoint dedicado para cambiar estado de aplicacion.

```
Archivo: src/app/api/aplicaciones/[id]/estado/route.ts (NUEVO)
- POST con { estado: string, notas?: string }
- Validar transiciones permitidas (state machine)
- Actualizar aplicaciones.estado + aplicaciones.updated_at

Archivo: src/components/candidatos/pipeline-completo.tsx
- Cambiar el PUT a /api/candidatos/[id] por POST a /api/aplicaciones/[id]/estado
```

### PRIORIDAD 2 — ALTA

#### B2. Tab Aplicaciones en detalle candidato
**Solucion:** Agregar fetch a `/api/candidatos/[id]/aplicaciones` y renderizar tabla con vacante, estado, scores, fechas.

#### B3. Notificacion admin cuando Dapta completa
**Solucion:** En `procesarResultadoLlamada()` despues del analisis (linea 251), agregar:
```typescript
await enviarEmail({
  to: adminEmail,
  subject: `Entrevista IA completada — ${candidatoNombre}`,
  html: `... score: ${scoreTotal}, recomendacion: ${recomendacion} ...`
});
```

#### B4. Notificacion admin cuando evaluacion tecnica completada
**Solucion:** En `guardarRespuestas()` despues de guardar score (linea 304), enviar email al admin con score y resultado.

#### B5. Actualizar estado pipeline al completar evaluacion
**Solucion:** En `guardarRespuestas()` agregar:
```typescript
await pool.query(
  `UPDATE aplicaciones SET estado = 'evaluado', updated_at = NOW() WHERE id = $1 AND estado IN ('en_revision', 'preseleccionado', 'entrevista_ia', 'entrevista_humana')`,
  [ev.aplicacion_id]
);
```

### PRIORIDAD 3 — MEDIA

#### B6. Envio masivo de evaluaciones
Crear endpoint `POST /api/evaluaciones/envio-masivo` que reciba vacante_id + plantilla_id y cree + envie evaluacion a todos los candidatos en estado 'preseleccionado' o superior.

#### B7. Recalculo automatico de score_final
Despues de cada actualizacion de score parcial (ATS, IA, humano, tecnico), invocar `calculateScoreDual()` para recalcular score_final.

#### B8. Notificacion al completar firma
En webhook `/api/webhooks/firma` al recibir estado 'completed', enviar email a admin y candidato confirmando firma exitosa.

#### B10. Onboarding automatico post-firma
Opcion A: En webhook de firma, disparar `iniciarOnboarding()` automaticamente.
Opcion B: Enviar notificacion al admin con boton "Iniciar onboarding" (menos invasivo).

#### B11. Editor de plantillas email en configuracion
Agregar tab "Emails" en /configuracion con editores HTML para plantillas de seleccion y rechazo, leyendo/escribiendo a org_settings.

### PRIORIDAD 4 — BAJA

#### B9. Email admin configurable para firma
Agregar campo `email_firma_admin` a org_settings, usar ese email en lugar del primer admin.

#### B12. Notificacion al candidato por documento rechazado
Enviar email automatico al candidato cuando admin rechaza un documento, con motivo de rechazo y link al portal.

---

## ESTADO DE INTEGRACIONES

| Integracion | Estado | Detalle |
|-------------|--------|---------|
| **Dapta (voz IA)** | ⚠️ Parcial | Llamadas y webhook funcionan. Falta notificacion al admin. |
| **Google Calendar** | ✅ OK | Eventos + Meet links. No-bloqueante si no configurado. |
| **SignWell (firma)** | ⚠️ Parcial | Firma funciona end-to-end. Falta notificacion post-firma y email admin configurable. |
| **Resend (emails)** | ✅ OK | Emails de evaluacion, seleccion, rechazo, onboarding funcionan. FROM corregido a nivelics.com. |
| **Claude AI** | ✅ OK | CV parsing, scoring ATS, analisis entrevistas, scoring respuestas abiertas, generacion preguntas. |
| **Notificaciones in-app** | ❌ Ausente | No existe sistema de notificaciones push/SSE/badges. Solo activity_log pasivo. |

---

## RESUMEN EJECUTIVO

**Lo que funciona bien:**
- Flujo de postulacion con CV parsing automatico
- Entrevistas IA con Dapta (trigger + webhook + analisis)
- Evaluaciones tecnicas con portal publico y anti-trampa
- Entrevistas humanas con Google Calendar + Meet
- Scoring dual consolidado (4 fuentes)
- Seleccion con portal de documentos tokenizado
- Contratos con firma electronica SignWell
- Onboarding con emails programados

**Lo que esta roto:**
- Kanban drag-and-drop (cambio de estado no se guarda)

**Lo que falta:**
- Notificaciones al admin en puntos clave del flujo (Dapta, evaluaciones, firma)
- Recalculo automatico de score_final
- Tab de aplicaciones en detalle de candidato
- Envio masivo de evaluaciones
- Editor de plantillas de email en configuracion
- Sistema de notificaciones in-app (badges, SSE)
