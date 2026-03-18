'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, Plus, MoreHorizontal, Eye, Trash2, Briefcase, Loader2, FileText, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import type { CandidatoEnriquecido } from '@/lib/types/candidato.types';
import { getFuenteColor, getEstadoColor } from '@/lib/utils/design-tokens';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';

const ESTADO_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'revisado', label: 'Revisado' },
  { value: 'preseleccionado', label: 'Preseleccionado' },
  { value: 'entrevista_ia', label: 'Entrevista IA' },
  { value: 'entrevista_humana', label: 'Entrevista Humana' },
  { value: 'seleccionado', label: 'Seleccionado' },
  { value: 'contratado', label: 'Contratado' },
  { value: 'descartado', label: 'Descartado' },
];

const SCORE_OPTIONS = [
  { value: 'excelente', label: 'Excelente (≥85)' },
  { value: 'bueno', label: 'Bueno (70-84)' },
  { value: 'regular', label: 'Regular (50-69)' },
  { value: 'bajo', label: 'Bajo (<50)' },
  { value: 'sin_score', label: 'Sin score' },
];

export default function CandidatosPage() {
  const router = useRouter();
  const [candidatos, setCandidatos] = useState<CandidatoEnriquecido[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Filters
  const [filterVacanteId, setFilterVacanteId] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFuente, setFilterFuente] = useState('');
  const [filterScore, setFilterScore] = useState('');

  // Vacantes for filter dropdown
  const [vacantesOptions, setVacantesOptions] = useState<{ id: string; titulo: string }[]>([]);

  // Action state
  const [deleteTarget, setDeleteTarget] = useState<CandidatoEnriquecido | null>(null);
  const [assignTarget, setAssignTarget] = useState<CandidatoEnriquecido | null>(null);
  const [vacantesDisponibles, setVacantesDisponibles] = useState<{ id: string; titulo: string }[]>([]);
  const [selectedVacanteId, setSelectedVacanteId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Load vacantes for filter
  useEffect(() => {
    fetch('/api/vacantes?limit=100')
      .then(r => r.json())
      .then(data => {
        if (data.success) setVacantesOptions((data.data.data || []).map((v: any) => ({ id: v.id, titulo: v.titulo })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterVacanteId, filterEstado, filterFuente, filterScore]);

  useEffect(() => {
    fetchCandidatos();
  }, [debouncedSearch, page, filterVacanteId, filterEstado, filterFuente, filterScore]);

  async function fetchCandidatos() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterVacanteId) params.set('vacante_id', filterVacanteId);
      if (filterEstado) params.set('estado', filterEstado);
      if (filterFuente) params.set('fuente', filterFuente);
      if (filterScore) params.set('score_range', filterScore);

      const res = await fetch(`/api/candidatos?${params}`);
      const data = await res.json();
      if (data.success) {
        setCandidatos(data.data.data || []);
        setTotal(data.data.total || 0);
      }
    } catch {
      console.error('Error fetching candidatos');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/candidatos/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Candidato eliminado');
        fetchCandidatos();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  }

  async function openAssignDialog(c: CandidatoEnriquecido) {
    setAssignTarget(c);
    setSelectedVacanteId('');
    try {
      const res = await fetch('/api/vacantes?estado=publicada&limit=50');
      const data = await res.json();
      if (data.success) {
        setVacantesDisponibles((data.data.data || []).map((v: any) => ({ id: v.id, titulo: v.titulo })));
      }
    } catch {
      setVacantesDisponibles([]);
    }
  }

  async function handleAssign() {
    if (!assignTarget || !selectedVacanteId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/vacantes/${selectedVacanteId}/candidatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidato_id: assignTarget.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Candidato asignado a vacante`);
        setAssignTarget(null);
        fetchCandidatos();
      } else {
        toast.error(data.error || 'Error al asignar');
      }
    } catch {
      toast.error('Error al asignar');
    } finally {
      setAssignLoading(false);
    }
  }

  const hasFilters = filterVacanteId || filterEstado || filterFuente || filterScore;

  function clearFilters() {
    setFilterVacanteId('');
    setFilterEstado('');
    setFilterFuente('');
    setFilterScore('');
  }

  const columns = [
    {
      key: 'nombre',
      header: 'Candidato',
      render: (c: CandidatoEnriquecido) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-teal/20 to-teal/5 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-teal">
              {(c.nombre || '').charAt(0)}{(c.apellido || '').charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-sm text-navy">{c.nombre} {c.apellido}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vacantes',
      header: 'Vacantes',
      render: (c: CandidatoEnriquecido) => {
        const vacantes = c.vacantes || [];
        if (vacantes.length === 0) {
          return <span className="text-xs text-muted-foreground">Sin postulaciones</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {vacantes.slice(0, 2).map((v) => (
              <Link
                key={v.id}
                href={`/vacantes/${v.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] bg-teal/10 text-teal-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-teal/20 transition-colors truncate max-w-[110px]"
                title={v.titulo}
              >
                {v.titulo}
              </Link>
            ))}
            {vacantes.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{vacantes.length - 2}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'max_score',
      header: 'Score',
      render: (c: CandidatoEnriquecido) => (
        <div className="flex justify-center">
          <ScoreBadge score={c.max_score !== null ? Number(c.max_score) : null} size="sm" />
        </div>
      ),
    },
    {
      key: 'estado_mas_avanzado',
      header: 'Estado',
      render: (c: CandidatoEnriquecido) => {
        if (!c.estado_mas_avanzado) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const color = getEstadoColor(c.estado_mas_avanzado);
        return (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color.bg} ${color.text}`}>
            {color.label}
          </span>
        );
      },
    },
    {
      key: 'fuente',
      header: 'Fuente',
      render: (c: CandidatoEnriquecido) => {
        const color = getFuenteColor(c.fuente);
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color.bg} ${color.text}`}>
            {color.label}
          </span>
        );
      },
    },
    {
      key: 'habilidades',
      header: 'Habilidades',
      render: (c: CandidatoEnriquecido) => (
        <div className="flex flex-wrap gap-1">
          {(c.habilidades || []).slice(0, 3).map((h) => (
            <span key={h} className="text-[10px] bg-teal/10 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{h}</span>
          ))}
          {(c.habilidades || []).length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{c.habilidades.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'acciones',
      header: '',
      className: 'w-10',
      render: (c: CandidatoEnriquecido) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/candidatos/${c.id}`); }}>
              <Eye className="h-3.5 w-3.5 mr-2" /> Ver perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/candidatos/${c.id}`); }}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Ver CV parseado
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openAssignDialog(c); }}>
              <Briefcase className="h-3.5 w-3.5 mr-2" /> Asignar a vacante
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Banco de talento</h1>
          <p className="text-muted-foreground">
            {hasFilters
              ? `${candidatos.length} candidatos (filtrado de ${total})`
              : `${total} candidatos`
            }
          </p>
        </div>
        <Link href="/candidatos/nuevo">
          <Button className="bg-teal hover:bg-teal/90 text-white gap-2">
            <Plus className="h-4 w-4" />
            Agregar candidato
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, habilidades..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterVacanteId} onValueChange={setFilterVacanteId}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Vacante: Todas" />
          </SelectTrigger>
          <SelectContent>
            {vacantesOptions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">{v.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue placeholder="Estado: Todos" />
          </SelectTrigger>
          <SelectContent>
            {ESTADO_OPTIONS.map((e) => (
              <SelectItem key={e.value} value={e.value} className="text-xs">{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterFuente} onValueChange={setFilterFuente}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Fuente: Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="portal" className="text-xs">Portal</SelectItem>
            <SelectItem value="linkedin" className="text-xs">LinkedIn</SelectItem>
            <SelectItem value="referido" className="text-xs">Referido</SelectItem>
            <SelectItem value="manual" className="text-xs">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterScore} onValueChange={setFilterScore}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue placeholder="Score: Todos" />
          </SelectTrigger>
          <SelectContent>
            {SCORE_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground gap-1">
            <X className="h-3 w-3" /> Limpiar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : candidatos.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? 'Sin resultados' : 'No hay candidatos'}
          description={hasFilters ? 'Intenta ajustar los filtros.' : 'Agrega candidatos manualmente o recibelos a traves de tus vacantes.'}
          actionLabel={hasFilters ? undefined : 'Agregar candidato'}
          onAction={hasFilters ? undefined : () => router.push('/candidatos/nuevo')}
        />
      ) : (
        <DataTable
          data={candidatos as unknown as Record<string, unknown>[]}
          columns={columns as never}
          total={total}
          page={page}
          limit={20}
          onPageChange={setPage}
          onRowClick={(item) => router.push(`/candidatos/${(item as unknown as CandidatoEnriquecido).id}`)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Eliminar candidato"
        description={`Se eliminara permanentemente a ${deleteTarget?.nombre} ${deleteTarget?.apellido}. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        destructive
      />

      {/* Assign to vacancy dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar a vacante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Asignar a <span className="font-medium text-foreground">{assignTarget?.nombre} {assignTarget?.apellido}</span> a una vacante:
            </p>
            {vacantesDisponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay vacantes publicadas disponibles</p>
            ) : (
              <Select value={selectedVacanteId} onValueChange={setSelectedVacanteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vacante" />
                </SelectTrigger>
                <SelectContent>
                  {vacantesDisponibles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancelar</Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedVacanteId || assignLoading}
              className="bg-teal hover:bg-teal/90 text-white"
            >
              {assignLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
