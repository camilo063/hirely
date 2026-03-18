'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VacanteCard } from '@/components/vacantes/vacante-card';
import { EmptyState } from '@/components/shared/empty-state';
import { CardSkeleton } from '@/components/shared/loading-skeleton';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { VacanteWithStats } from '@/lib/types/vacante.types';
import { ESTADO_VACANTE_OPTIONS } from '@/lib/utils/constants';
import { useDebounce } from '@/hooks/use-debounce';

export default function VacantesPage() {
  const [vacantes, setVacantes] = useState<VacanteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<string>('');
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    fetchVacantes();
  }, [debouncedSearch, estado]);

  async function fetchVacantes() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (estado && estado !== 'all') params.set('estado', estado);

      const res = await fetch(`/api/vacantes?${params}`);
      const data = await res.json();
      if (data.success) {
        setVacantes(data.data.data || []);
      }
    } catch {
      console.error('Error fetching vacantes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Vacantes</h1>
          <p className="text-muted-foreground">Gestiona tus posiciones abiertas</p>
        </div>
        <Link href="/vacantes/nueva">
          <Button className="bg-teal hover:bg-teal/90 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nueva vacante
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vacantes..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ESTADO_VACANTE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : vacantes.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No hay vacantes"
          description="Crea tu primera vacante para comenzar a recibir candidatos."
          actionLabel="Crear vacante"
          onAction={() => window.location.href = '/vacantes/nueva'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vacantes.map((v) => (
            <VacanteCard key={v.id} vacante={v} onRefresh={fetchVacantes} />
          ))}
        </div>
      )}
    </div>
  );
}
