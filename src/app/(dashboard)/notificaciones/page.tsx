'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificaciones } from '@/hooks/useNotificaciones';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPOS_FILTRO = [
  { value: '', label: 'Todas' },
  { value: 'nueva_aplicacion', label: 'Nuevas aplicaciones' },
  { value: 'pipeline_estado_cambiado', label: 'Pipeline' },
  { value: 'entrevista_dapta_completada,entrevista_humana_agendada,entrevista_humana_realizada', label: 'Entrevistas' },
  { value: 'evaluacion_tecnica_completada', label: 'Evaluaciones' },
  { value: 'documento_subido,documentos_completos,documento_rechazado,documento_aprobado,portal_documentos_expirado', label: 'Documentos' },
  { value: 'contrato_generado,contrato_enviado_firma,contrato_firmado_candidato,contrato_firmado_bilateral', label: 'Contratos' },
  { value: 'candidato_contratado,onboarding_email_enviado,contrato_terminado', label: 'Contratacion' },
];

interface NotificacionPaginada {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  meta: Record<string, string>;
  created_at: string;
}

interface PaginaData {
  notificaciones: NotificacionPaginada[];
  total: number;
  no_leidas: number;
  total_paginas: number;
  pagina: number;
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  nueva_aplicacion:              { label: 'aplicacion',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  pipeline_estado_cambiado:      { label: 'pipeline',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  candidato_seleccionado:        { label: 'seleccion',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  entrevista_dapta_completada:   { label: 'entrevista IA', color: 'bg-green-50 text-green-700 border-green-200' },
  entrevista_humana_agendada:    { label: 'entrevista',    color: 'bg-green-50 text-green-700 border-green-200' },
  entrevista_humana_realizada:   { label: 'entrevista',    color: 'bg-green-50 text-green-700 border-green-200' },
  evaluacion_tecnica_completada: { label: 'evaluacion',    color: 'bg-green-50 text-green-700 border-green-200' },
  documento_subido:              { label: 'documento',     color: 'bg-gray-50 text-gray-600 border-gray-200' },
  documentos_completos:          { label: 'documentos',    color: 'bg-green-50 text-green-700 border-green-200' },
  documento_rechazado:           { label: 'documento',     color: 'bg-red-50 text-red-700 border-red-200' },
  portal_documentos_expirado:    { label: 'portal',        color: 'bg-red-50 text-red-700 border-red-200' },
  contrato_generado:             { label: 'contrato',      color: 'bg-amber-50 text-amber-700 border-amber-200' },
  contrato_enviado_firma:        { label: 'contrato',      color: 'bg-amber-50 text-amber-700 border-amber-200' },
  contrato_firmado_candidato:    { label: 'contrato',      color: 'bg-amber-50 text-amber-700 border-amber-200' },
  contrato_firmado_bilateral:    { label: 'contrato',      color: 'bg-green-50 text-green-700 border-green-200' },
  candidato_contratado:          { label: 'contratacion',  color: 'bg-green-50 text-green-700 border-green-200' },
  onboarding_email_enviado:      { label: 'onboarding',    color: 'bg-green-50 text-green-700 border-green-200' },
  candidato_duplicado_alerta:    { label: 'alerta',        color: 'bg-red-50 text-red-700 border-red-200' },
  vacante_publicada:             { label: 'vacante',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  contrato_terminado:            { label: 'terminacion',   color: 'bg-red-50 text-red-700 border-red-200' },
};

function labelTipo(tipo: string) {
  return TIPO_LABELS[tipo] ?? { label: tipo, color: 'bg-gray-50 text-gray-600 border-gray-200' };
}

function agruparPorFecha(notifs: NotificacionPaginada[]): Record<string, NotificacionPaginada[]> {
  const grupos: Record<string, NotificacionPaginada[]> = {};
  notifs.forEach(n => {
    const fecha = new Date(n.created_at);
    let key: string;
    if (isToday(fecha)) key = 'Hoy';
    else if (isYesterday(fecha)) key = 'Ayer';
    else key = format(fecha, "d 'de' MMMM", { locale: es });
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(n);
  });
  return grupos;
}

export default function NotificacionesPage() {
  const router = useRouter();
  const { marcarTodasLeidas, marcarLeida } = useNotificaciones();

  const [data, setData] = useState<PaginaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const fetchNotificaciones = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (soloNoLeidas) params.set('no_leidas', 'true');
      if (busqueda) params.set('q', busqueda);
      params.set('pagina', String(pagina));
      params.set('por_pagina', '20');

      const res = await fetch(`/api/notificaciones?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('[NotificacionesPage] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, soloNoLeidas, busqueda, pagina]);

  useEffect(() => { fetchNotificaciones(); }, [fetchNotificaciones]);
  useEffect(() => { setPagina(1); }, [filtroTipo, soloNoLeidas, busqueda]);

  function handleClickNotif(notif: NotificacionPaginada) {
    if (!notif.leida) {
      marcarLeida(notif.id);
      setData(prev => prev ? {
        ...prev,
        notificaciones: prev.notificaciones.map(n => n.id === notif.id ? { ...n, leida: true } : n),
        no_leidas: Math.max(0, prev.no_leidas - 1),
      } : null);
    }
    if (notif.meta?.url) router.push(notif.meta.url);
  }

  async function handleMarcarTodas() {
    await marcarTodasLeidas();
    setData(prev => prev ? {
      ...prev,
      notificaciones: prev.notificaciones.map(n => ({ ...n, leida: true })),
      no_leidas: 0,
    } : null);
  }

  const grupos = data ? agruparPorFecha(data.notificaciones) : {};

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Notificaciones</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.no_leidas > 0 ? `${data.no_leidas} sin leer \u00B7 ` : ''}{data.total} en total
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {data && data.no_leidas > 0 && (
            <button
              onClick={handleMarcarTodas}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              Marcar todas leidas
            </button>
          )}
          <button
            onClick={() => router.push('/configuracion?tab=notificaciones')}
            className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
          >
            Configurar
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIPOS_FILTRO.map(t => (
            <button
              key={t.value}
              onClick={() => setFiltroTipo(t.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtroTipo === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-border'
              }`}
            >
              {t.label}
              {t.value === '' && data?.no_leidas ? (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {data.no_leidas}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="search"
            placeholder="Buscar notificaciones..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={soloNoLeidas}
              onChange={e => setSoloNoLeidas(e.target.checked)}
              className="rounded"
            />
            Solo sin leer
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : data && data.notificaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-4xl">{'\uD83D\uDD14'}</span>
          <p className="font-medium">Sin notificaciones</p>
          <p className="text-sm text-muted-foreground">Ajusta los filtros o espera nuevos eventos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grupos).map(([fecha, notifs]) => (
            <div key={fecha}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{fecha}</span>
                <div className="flex-1 border-t" />
              </div>

              <div className="rounded-xl border overflow-hidden">
                {notifs.map((notif, i) => {
                  const tl = labelTipo(notif.tipo);
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleClickNotif(notif)}
                      className={`flex w-full gap-3 items-start px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        i > 0 ? 'border-t' : ''
                      } ${!notif.leida ? 'bg-blue-50/60 dark:bg-blue-950/10' : ''}`}
                    >
                      <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{
                        background: notif.leida ? 'transparent' : '#3b82f6'
                      }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tl.color}`}>
                            {tl.label}
                          </span>
                        </div>
                        <p className={`text-sm font-medium ${notif.leida ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notif.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.mensaje}</p>
                        {notif.meta?.url && (
                          <span className="text-xs text-primary mt-1 block">Ver detalle &rarr;</span>
                        )}
                      </div>

                      <span className="text-[10px] text-muted-foreground/70 flex-shrink-0 mt-1">
                        {format(new Date(notif.created_at), 'h:mm a')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.total_paginas > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-muted-foreground">
            Mostrando {(pagina - 1) * 20 + 1}&ndash;{Math.min(pagina * 20, data.total)} de {data.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              &larr; Anterior
            </button>
            <button
              disabled={pagina >= data.total_paginas}
              onClick={() => setPagina(p => p + 1)}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
