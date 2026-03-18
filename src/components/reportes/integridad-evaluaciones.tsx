'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Download,
  Monitor, Clipboard, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface KPIs {
  total_evaluaciones_completadas: number;
  evaluaciones_limpias: number;
  riesgo_bajo: number;
  riesgo_medio: number;
  riesgo_alto: number;
  pct_con_incidentes: number;
  total_cambios_pestana: number;
  total_intentos_copia: number;
  promedio_cambios_pestana: number;
  promedio_intentos_copia: number;
  score_riesgo_promedio: number;
  score_promedio_riesgo_alto: number | null;
  score_promedio_sin_incidentes: number | null;
}

interface EvalIntegridad {
  evaluacion_id: string;
  candidato_nombre: string;
  candidato_email: string;
  vacante_titulo: string;
  cambios_pestana: number;
  intentos_copia: number;
  score_total: number | null;
  aprobada: boolean | null;
  nivel_riesgo: string;
  score_riesgo: number;
  completada_at: string;
}

interface Distribucion {
  rango_eventos: string;
  cantidad_evaluaciones: number;
}

interface Props {
  vacantes: { id: string; titulo: string }[];
}

const NIVEL_COLORS: Record<string, string> = {
  sin_incidentes: 'bg-green-100 text-green-700',
  bajo: 'bg-yellow-100 text-yellow-700',
  medio: 'bg-orange-100 text-orange-700',
  alto: 'bg-red-100 text-red-700',
};

const NIVEL_LABELS: Record<string, string> = {
  sin_incidentes: 'Sin incidentes',
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
};

const BAR_COLORS: Record<string, string> = {
  '0 eventos': '#10B981',
  '1-2 eventos': '#f59e0b',
  '3-5 eventos': '#FF6B35',
  '6+ eventos': '#ef4444',
};

const PIE_COLORS = ['#00BCD4', '#FF6B35'];

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
  return date.toLocaleDateString('es');
}

export function IntegridadEvaluaciones({ vacantes }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvalIntegridad[]>([]);
  const [distribucion, setDistribucion] = useState<Distribucion[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVacante, setFilterVacante] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterVacante) params.set('vacante_id', filterVacante);
      if (filterRiesgo) params.set('nivel_riesgo', filterRiesgo);
      if (filterDesde) params.set('desde', filterDesde);
      if (filterHasta) params.set('hasta', filterHasta);

      const res = await fetch(`/api/reportes/integridad?${params}`);
      const data = await res.json();
      if (data.success) {
        setKpis(data.data.kpis);
        setEvaluaciones(data.data.evaluaciones);
        setDistribucion(data.data.distribucion);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filterVacante, filterRiesgo, filterDesde, filterHasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportCSV() {
    const headers = ['Candidato', 'Email', 'Vacante', 'Cambios Pestana', 'Intentos Copia', 'Score', 'Aprobada', 'Nivel Riesgo', 'Score Riesgo', 'Fecha'];
    const rows = evaluaciones.map(e => [
      e.candidato_nombre,
      e.candidato_email,
      e.vacante_titulo,
      e.cambios_pestana,
      e.intentos_copia,
      e.score_total ?? '',
      e.aprobada === null ? '' : e.aprobada ? 'Si' : 'No',
      e.nivel_riesgo,
      e.score_riesgo,
      e.completada_at ? new Date(e.completada_at).toLocaleDateString('es') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `integridad-evaluaciones-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  if (!kpis || kpis.total_evaluaciones_completadas === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <ShieldCheck className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-navy mb-2">No hay evaluaciones completadas aun</h3>
        <p className="text-muted-foreground max-w-md">
          Cuando los candidatos completen evaluaciones tecnicas, aqui veras el reporte de integridad con patrones de comportamiento.
        </p>
      </div>
    );
  }

  const pctLimpias = kpis.total_evaluaciones_completadas > 0
    ? Math.round((kpis.evaluaciones_limpias / kpis.total_evaluaciones_completadas) * 100)
    : 0;

  // Correlation insight
  const showCorrelation = kpis.score_promedio_riesgo_alto !== null
    && kpis.score_promedio_sin_incidentes !== null
    && Math.abs(kpis.score_promedio_riesgo_alto - kpis.score_promedio_sin_incidentes) >= 5;

  // Distribution chart data (ensure all ranges present)
  const rangosOrden = ['0 eventos', '1-2 eventos', '3-5 eventos', '6+ eventos'];
  const distMap = new Map(distribucion.map(d => [d.rango_eventos, d.cantidad_evaluaciones]));
  const distData = rangosOrden.map(rango => ({
    rango,
    cantidad: distMap.get(rango) || 0,
    fill: BAR_COLORS[rango],
  }));

  // Pie chart data
  const pieData = [
    { name: 'Cambios de pestana', value: kpis.total_cambios_pestana },
    { name: 'Intentos de copia', value: kpis.total_intentos_copia },
  ].filter(d => d.value > 0);

  const limpiarFiltros = () => { setFilterVacante(''); setFilterRiesgo(''); setFilterDesde(''); setFilterHasta(''); };
  const hayFiltros = filterVacante || filterRiesgo || filterDesde || filterHasta;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-navy">{kpis.total_evaluaciones_completadas}</p>
            <p className="text-xs text-muted-foreground mt-1">Evaluaciones completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{kpis.evaluaciones_limpias}</p>
            <p className="text-xs text-muted-foreground mt-1">Sin incidentes ({pctLimpias}%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-yellow-600">{kpis.riesgo_medio}</p>
            <p className="text-xs text-muted-foreground mt-1">Riesgo medio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{kpis.riesgo_alto}</p>
            <p className="text-xs text-muted-foreground mt-1">Riesgo alto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-navy">{kpis.score_riesgo_promedio}</p>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${kpis.score_riesgo_promedio >= 30 ? 'bg-red-500' : kpis.score_riesgo_promedio >= 10 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${kpis.score_riesgo_promedio}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Indice de riesgo promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Correlation insight */}
      {showCorrelation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Correlacion Riesgo - Score</p>
            <p>
              Candidatos con riesgo alto obtuvieron un score promedio de{' '}
              <strong>{kpis.score_promedio_riesgo_alto}</strong> vs{' '}
              <strong>{kpis.score_promedio_sin_incidentes}</strong> en evaluaciones sin incidentes.
              {kpis.score_promedio_riesgo_alto! > kpis.score_promedio_sin_incidentes! && (
                <span className="text-amber-900 font-medium"> Los candidatos con comportamiento sospechoso obtienen mejor score.</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-navy mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Distribucion de Incidentes
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value) => [
                  `${value} evaluaciones (${kpis.total_evaluaciones_completadas > 0 ? Math.round((Number(value) / kpis.total_evaluaciones_completadas) * 100) : 0}%)`,
                  'Cantidad',
                ]}
              />
              <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                {distData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Event type pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-navy mb-4 flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Tipo de Evento
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} eventos`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
              Sin eventos registrados
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterVacante}
          onChange={(e) => setFilterVacante(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todas las vacantes</option>
          {vacantes.map(v => <option key={v.id} value={v.id}>{v.titulo}</option>)}
        </select>
        <select
          value={filterRiesgo}
          onChange={(e) => setFilterRiesgo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos los niveles</option>
          <option value="alto">Alto</option>
          <option value="medio">Medio</option>
          <option value="bajo">Bajo</option>
          <option value="sin_incidentes">Sin incidentes</option>
        </select>
        <input
          type="date"
          value={filterDesde}
          onChange={(e) => setFilterDesde(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          placeholder="Desde"
        />
        <input
          type="date"
          value={filterHasta}
          onChange={(e) => setFilterHasta(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          placeholder="Hasta"
        />
        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar</Button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Table */}
      {evaluaciones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No hay evaluaciones con los filtros seleccionados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-soft-gray/50">
                  <th className="text-left px-4 py-3 font-medium">Candidato</th>
                  <th className="text-left px-4 py-3 font-medium">Vacante</th>
                  <th className="text-center px-4 py-3 font-medium">Cambios pestana</th>
                  <th className="text-center px-4 py-3 font-medium">Intentos copia</th>
                  <th className="text-center px-4 py-3 font-medium">Score</th>
                  <th className="text-center px-4 py-3 font-medium">Aprobada</th>
                  <th className="text-center px-4 py-3 font-medium">Nivel riesgo</th>
                  <th className="text-center px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((ev) => (
                  <tr key={ev.evaluacion_id} className="border-b hover:bg-soft-gray/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{ev.candidato_nombre}</div>
                      <div className="text-xs text-muted-foreground">{ev.candidato_email}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ev.vacante_titulo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${ev.cambios_pestana >= 3 ? 'text-red-600 font-medium' : ''}`}>
                        <Monitor className="h-3 w-3" /> {ev.cambios_pestana}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${ev.intentos_copia >= 1 ? 'text-red-600 font-medium' : ''}`}>
                        <Clipboard className="h-3 w-3" /> {ev.intentos_copia}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ev.score_total !== null ? (
                        <span className={`font-bold ${ev.aprobada ? 'text-green-600' : 'text-red-500'}`}>
                          {ev.score_total}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">—</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ev.aprobada === null ? '—' : ev.aprobada ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-red-500 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`${NIVEL_COLORS[ev.nivel_riesgo] || ''} text-xs`}>
                        {NIVEL_LABELS[ev.nivel_riesgo] || ev.nivel_riesgo}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground" title={ev.completada_at ? new Date(ev.completada_at).toLocaleString('es') : ''}>
                      {ev.completada_at ? formatRelativeDate(ev.completada_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
