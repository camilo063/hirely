'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const EVENTOS_CONFIG = [
  { tipo: 'vacante_publicada', titulo: 'Vacante publicada', descripcion: 'Cuando una vacante pasa a estado publicada', fase: 'Vacante', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'vacante_pausada', titulo: 'Vacante pausada o cerrada', descripcion: 'Cuando una vacante se pausa o cierra', fase: 'Vacante', prioridad_default: 'baja', inapp_default: true, browser_default: false },
  { tipo: 'vacante_limite_aplicantes', titulo: 'Limite de aplicantes alcanzado', descripcion: 'Cuando la vacante alcanza el maximo configurado', fase: 'Vacante', prioridad_default: 'media', inapp_default: true, browser_default: true },
  { tipo: 'nueva_aplicacion', titulo: 'Nueva aplicacion recibida', descripcion: 'Cuando un candidato aplica desde el portal publico', fase: 'Aplicacion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'aplicacion_descartada', titulo: 'Aplicacion descartada', descripcion: 'Cuando un candidato es descartado del proceso', fase: 'Aplicacion', prioridad_default: 'baja', inapp_default: true, browser_default: false },
  { tipo: 'score_ats_calculado', titulo: 'Score ATS calculado', descripcion: 'Cuando el sistema calcula el score automatico de un CV', fase: 'Aplicacion', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'pipeline_estado_cambiado', titulo: 'Estado de pipeline cambiado', descripcion: 'Cualquier transicion de estado en el pipeline', fase: 'Aplicacion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'entrevista_dapta_completada', titulo: 'Entrevista IA completada', descripcion: 'Cuando Dapta finaliza la entrevista y el score esta disponible', fase: 'Entrevistas', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'entrevista_humana_agendada', titulo: 'Entrevista humana agendada', descripcion: 'Cuando se programa una entrevista con el candidato', fase: 'Entrevistas', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'entrevista_humana_realizada', titulo: 'Entrevista humana realizada', descripcion: 'Cuando se registra como completada la entrevista', fase: 'Entrevistas', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'evaluacion_tecnica_completada', titulo: 'Evaluacion tecnica completada', descripcion: 'Cuando el candidato termina y entrega la evaluacion tecnica', fase: 'Entrevistas', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'candidato_seleccionado', titulo: 'Candidato seleccionado', descripcion: 'Cuando un candidato avanza al estado seleccionado', fase: 'Seleccion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'documento_subido', titulo: 'Documento subido por candidato', descripcion: 'Cuando el candidato sube un documento al portal', fase: 'Seleccion', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'documentos_completos', titulo: 'Documentos completos', descripcion: 'Cuando todos los documentos requeridos estan aprobados', fase: 'Seleccion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'documento_rechazado', titulo: 'Documento rechazado', descripcion: 'Cuando el admin rechaza un documento del candidato', fase: 'Seleccion', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'documento_aprobado', titulo: 'Documento aprobado', descripcion: 'Cuando el admin aprueba un documento individual', fase: 'Seleccion', prioridad_default: 'baja', inapp_default: true, browser_default: false },
  { tipo: 'portal_documentos_expirado', titulo: 'Portal de documentos expirado', descripcion: 'Cuando han pasado 72 horas sin que el candidato cargue documentos', fase: 'Seleccion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'contrato_generado', titulo: 'Contrato generado', descripcion: 'Cuando se genera el borrador del contrato', fase: 'Contrato', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'contrato_enviado_firma', titulo: 'Contrato enviado a firma', descripcion: 'Cuando el contrato se envia al candidato por SignWell', fase: 'Contrato', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'contrato_firmado_candidato', titulo: 'Firmado por el candidato', descripcion: 'Cuando el candidato firma el contrato (webhook SignWell)', fase: 'Contrato', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'contrato_firmado_bilateral', titulo: 'Contrato firmado bilateralmente', descripcion: 'Cuando todas las partes han firmado', fase: 'Contrato', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'candidato_contratado', titulo: 'Candidato contratado', descripcion: 'Cuando el candidato pasa al estado contratado', fase: 'Contratacion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'onboarding_email_enviado', titulo: 'Email de onboarding enviado', descripcion: 'Cuando se envia el email de bienvenida al nuevo empleado', fase: 'Contratacion', prioridad_default: 'media', inapp_default: true, browser_default: false },
  { tipo: 'candidato_duplicado_alerta', titulo: 'Alerta candidato duplicado', descripcion: 'Cuando se detecta que el mismo candidato ya fue contratado', fase: 'Contratacion', prioridad_default: 'alta', inapp_default: true, browser_default: true },
  { tipo: 'contrato_terminado', titulo: 'Contrato terminado', descripcion: 'Cuando se registra la terminacion de un contrato', fase: 'Contratacion', prioridad_default: 'media', inapp_default: true, browser_default: false },
];

const FASE_COLORES: Record<string, string> = {
  Vacante:      '#378ADD',
  Aplicacion:   '#7F77DD',
  Entrevistas:  '#1D9E75',
  Seleccion:    '#BA7517',
  Contrato:     '#D4537E',
  Contratacion: '#D85A30',
};

interface ConfigItem {
  tipo: string;
  inapp_activo: boolean;
  browser_activo: boolean;
  prioridad: 'alta' | 'media' | 'baja';
}

function agruparPorFase(eventos: typeof EVENTOS_CONFIG) {
  const grupos: Record<string, typeof EVENTOS_CONFIG> = {};
  eventos.forEach(e => {
    if (!grupos[e.fase]) grupos[e.fase] = [];
    grupos[e.fase].push(e);
  });
  return grupos;
}

export function TabNotificaciones() {
  const [config, setConfig] = useState<Record<string, ConfigItem>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch('/api/notificaciones/config');
        const data = await res.json();

        const mapa: Record<string, ConfigItem> = {};
        EVENTOS_CONFIG.forEach(e => {
          mapa[e.tipo] = {
            tipo: e.tipo,
            inapp_activo: e.inapp_default,
            browser_activo: e.browser_default,
            prioridad: e.prioridad_default as 'alta' | 'media' | 'baja',
          };
        });

        (data.config ?? []).forEach((c: ConfigItem) => {
          if (mapa[c.tipo]) {
            mapa[c.tipo] = { ...mapa[c.tipo], ...c };
          }
        });

        setConfig(mapa);
      } catch {
        toast.error('Error cargando configuracion de notificaciones');
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  function toggleInapp(tipo: string) {
    setConfig(prev => ({
      ...prev,
      [tipo]: { ...prev[tipo], inapp_activo: !prev[tipo].inapp_activo }
    }));
  }

  function toggleBrowser(tipo: string) {
    setConfig(prev => ({
      ...prev,
      [tipo]: { ...prev[tipo], browser_activo: !prev[tipo].browser_activo }
    }));
  }

  function setAll(inapp: boolean, browser?: boolean) {
    setConfig(prev => {
      const nuevo = { ...prev };
      Object.keys(nuevo).forEach(tipo => {
        nuevo[tipo] = {
          ...nuevo[tipo],
          inapp_activo: inapp,
          ...(browser !== undefined ? { browser_activo: browser } : {}),
        };
      });
      return nuevo;
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch('/api/notificaciones/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: Object.values(config) }),
      });
      if (!res.ok) throw new Error();
      toast.success('Configuracion de notificaciones guardada');
    } catch {
      toast.error('Error guardando configuracion');
    } finally {
      setGuardando(false);
    }
  }

  function restaurarDefaults() {
    const mapa: Record<string, ConfigItem> = {};
    EVENTOS_CONFIG.forEach(e => {
      mapa[e.tipo] = {
        tipo: e.tipo,
        inapp_activo: e.inapp_default,
        browser_activo: e.browser_default,
        prioridad: e.prioridad_default as 'alta' | 'media' | 'baja',
      };
    });
    setConfig(mapa);
  }

  const activos = Object.values(config).filter(c => c.inapp_activo).length;
  const conBrowser = Object.values(config).filter(c => c.browser_activo).length;
  const grupos = agruparPorFase(EVENTOS_CONFIG);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Cargando configuracion...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 px-4 py-3">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Centro de control de notificaciones</p>
        <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
          Activa o desactiva cada tipo de evento individualmente. In-app aparece en la campana. Navegador requiere permiso del browser.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-xl font-semibold">{EVENTOS_CONFIG.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Eventos totales</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-xl font-semibold">{activos}</p>
          <p className="text-xs text-muted-foreground mt-1">Activos in-app</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-xl font-semibold">{conBrowser}</p>
          <p className="text-xs text-muted-foreground mt-1">Con notif. navegador</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setAll(true)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted">Activar todas in-app</button>
        <button onClick={() => setAll(false)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted">Desactivar todas in-app</button>
        <button onClick={() => setAll(true, true)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted">Activar todas navegador</button>
        <button onClick={() => setAll(true, false)} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted">Desactivar todas navegador</button>
      </div>

      <div className="flex items-center px-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        <div className="flex-1">Evento</div>
        <div className="w-16 text-center">In-app</div>
        <div className="w-16 text-center">Naveg.</div>
        <div className="w-20 text-center">Prioridad</div>
      </div>

      {Object.entries(grupos).map(([fase, eventos]) => (
        <div key={fase} className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: FASE_COLORES[fase] ?? '#888' }}
            />
            <span className="text-xs font-medium">{fase}</span>
          </div>

          {eventos.map((evento, i) => {
            const cfg = config[evento.tipo];
            if (!cfg) return null;

            const pBadge = {
              alta: 'bg-red-50 text-red-700 border-red-200',
              media: 'bg-amber-50 text-amber-700 border-amber-200',
              baja: 'bg-gray-100 text-gray-500 border-gray-200',
            }[cfg.prioridad];

            return (
              <div
                key={evento.tipo}
                className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t' : ''} hover:bg-muted/30 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{evento.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{evento.descripcion}</p>
                </div>

                <div className="w-16 flex justify-center">
                  <button
                    role="switch"
                    aria-checked={cfg.inapp_activo}
                    onClick={() => toggleInapp(evento.tipo)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      cfg.inapp_activo ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      cfg.inapp_activo ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="w-16 flex justify-center">
                  <button
                    role="switch"
                    aria-checked={cfg.browser_activo}
                    onClick={() => toggleBrowser(evento.tipo)}
                    disabled={!cfg.inapp_activo}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      cfg.browser_activo && cfg.inapp_activo ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      cfg.browser_activo && cfg.inapp_activo ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="w-20 flex justify-center">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${pBadge}`}>
                    {cfg.prioridad}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={restaurarDefaults}
          className="text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
        >
          Restaurar por defecto
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="text-sm px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors font-medium"
        >
          {guardando ? 'Guardando...' : 'Guardar configuracion'}
        </button>
      </div>
    </div>
  );
}
