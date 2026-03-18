'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, Send, XCircle, Search, Filter, FileSignature } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ContratoConDetalles,
  ESTADO_CONTRATO_LABELS,
  EstadoContrato,
} from '@/lib/types/contrato.types';
import { useTiposContrato } from '@/hooks/useTiposContrato';
import { cn } from '@/lib/utils';

export default function ContratosPage() {
  const [contratos, setContratos] = useState<ContratoConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const { tipos: tiposContrato, getTipoLabel } = useTiposContrato();

  const fetchContratos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterEstado) params.set('estado', filterEstado);
      if (filterTipo) params.set('tipo', filterTipo);
      const res = await fetch(`/api/contratos?${params}`);
      const data = await res.json();
      if (data.success) setContratos(data.data || []);
    } catch {
      console.error('Error fetching contratos');
    } finally {
      setLoading(false);
    }
  }, [search, filterEstado, filterTipo]);

  useEffect(() => {
    const timer = setTimeout(fetchContratos, 300);
    return () => clearTimeout(timer);
  }, [fetchContratos]);

  // Summary counts
  const borradores = contratos.filter(c => c.estado === 'borrador').length;
  const generados = contratos.filter(c => c.estado === 'generado').length;
  const enviados = contratos.filter(c => c.estado === 'enviado').length;
  const firmados = contratos.filter(c => c.estado === 'firmado').length;

  if (loading) return <TableSkeleton />;

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Contratos</h1>
        <p className="text-muted-foreground">Gestiona contratos laborales y firma electrónica</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{borradores}</p>
              <p className="text-xs text-muted-foreground">Borradores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{generados}</p>
              <p className="text-xs text-muted-foreground">Generados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Send className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{enviados}</p>
              <p className="text-xs text-muted-foreground">En firma</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{firmados}</p>
              <p className="text-xs text-muted-foreground">Firmados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar candidato o vacante..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(ESTADO_CONTRATO_LABELS) as [EstadoContrato, { label: string }][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {tiposContrato.map(t => (
              <SelectItem key={t.slug} value={t.slug}>{t.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {contratos.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No hay contratos"
          description="Los contratos se generan desde el pipeline de candidatos cuando un candidato es contratado."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Vacante</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Salario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratos.map((contrato) => {
                const estadoInfo = ESTADO_CONTRATO_LABELS[contrato.estado as EstadoContrato];
                const tipoLabel = getTipoLabel(contrato.tipo);
                return (
                  <TableRow key={contrato.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/contratos/${contrato.id}`} className="block">
                        <p className="font-medium text-sm">
                          {contrato.candidato_nombre} {contrato.candidato_apellido}
                        </p>
                        <p className="text-xs text-muted-foreground">{contrato.candidato_email}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{contrato.vacante_titulo}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{tipoLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {contrato.datos_contrato?.salario
                          ? `$${new Intl.NumberFormat('es-CO').format(Number(contrato.datos_contrato.salario))}`
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {estadoInfo ? (
                        <Badge className={cn('text-xs', estadoInfo.color)}>{estadoInfo.label}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">{contrato.estado}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">v{contrato.version || 1}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(contrato.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
