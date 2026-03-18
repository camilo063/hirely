'use client';

import { useRouter } from 'next/navigation';
import { MapPin, Users, Clock, MoreHorizontal, Eye, Pencil, Copy, Globe, Pause, Play, XCircle, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { VacanteWithStats } from '@/lib/types/vacante.types';
import { EstadoVacante } from '@/lib/types/common.types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState } from 'react';

interface VacanteCardProps {
  vacante: VacanteWithStats;
  onRefresh?: () => void;
}

export function VacanteCard({ vacante, onRefresh }: VacanteCardProps) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/vacantes/${vacante.id}`);
      const data = await res.json();
      if (!data.success) { toast.error('Error al duplicar'); return; }
      const orig = data.data;
      const dupRes = await fetch('/api/vacantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Copia de ${orig.titulo}`,
          descripcion: orig.descripcion,
          departamento: orig.departamento,
          ubicacion: orig.ubicacion,
          tipo_contrato: orig.tipo_contrato,
          modalidad: orig.modalidad,
          rango_salarial_min: orig.rango_salarial_min,
          rango_salarial_max: orig.rango_salarial_max,
          moneda: orig.moneda,
          criterios_evaluacion: orig.criterios_evaluacion,
          habilidades_requeridas: orig.habilidades_requeridas,
          experiencia_minima: orig.experiencia_minima,
          score_minimo: orig.score_minimo,
        }),
      });
      const dupData = await dupRes.json();
      if (dupData.success) {
        toast.success('Vacante duplicada');
        onRefresh?.();
      } else {
        toast.error(dupData.error || 'Error al duplicar');
      }
    } catch {
      toast.error('Error al duplicar');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEstadoChange(nuevoEstado: string, label: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/vacantes/${vacante.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Vacante ${label}`);
        onRefresh?.();
      } else {
        toast.error(data.error || `Error al ${label.toLowerCase()}`);
      }
    } catch {
      toast.error(`Error al ${label.toLowerCase()}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePublish(e: React.MouseEvent) {
    e.stopPropagation();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/vacantes/${vacante.id}/publicar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Vacante publicada');
        onRefresh?.();
      } else {
        toast.error(data.error || 'Error al publicar');
      }
    } catch {
      toast.error('Error al publicar');
    } finally {
      setActionLoading(false);
    }
  }

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (vacante.slug) {
      const url = `${window.location.origin}/empleo/${vacante.slug}`;
      navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    }
  }

  const estado = vacante.estado;

  return (
    <>
      <Card
        className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer border-gray-200"
        onClick={() => router.push(`/vacantes/${vacante.id}`)}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 mr-2">
              <h3 className="font-semibold text-navy truncate">{vacante.titulo}</h3>
              <p className="text-sm text-muted-foreground">{vacante.departamento}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <EstadoBadge estado={vacante.estado} variant="vacante" size="sm" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/vacantes/${vacante.id}`); }}>
                    <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/vacantes/${vacante.id}/editar`); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={actionLoading}>
                    <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {estado === EstadoVacante.BORRADOR && (
                    <DropdownMenuItem onClick={handlePublish} disabled={actionLoading}>
                      <Globe className="h-3.5 w-3.5 mr-2" /> Publicar
                    </DropdownMenuItem>
                  )}

                  {estado === EstadoVacante.PUBLICADA && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEstadoChange('pausada', 'pausada'); }} disabled={actionLoading}>
                      <Pause className="h-3.5 w-3.5 mr-2" /> Pausar
                    </DropdownMenuItem>
                  )}

                  {estado === EstadoVacante.PAUSADA && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEstadoChange('publicada', 'reactivada'); }} disabled={actionLoading}>
                      <Play className="h-3.5 w-3.5 mr-2" /> Reactivar
                    </DropdownMenuItem>
                  )}

                  {estado === EstadoVacante.PUBLICADA && vacante.slug && (
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Link2 className="h-3.5 w-3.5 mr-2" /> Copiar link publico
                    </DropdownMenuItem>
                  )}

                  {estado !== EstadoVacante.CERRADA && estado !== EstadoVacante.ARCHIVADA && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setCloseOpen(true); }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-2" /> Cerrar vacante
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {vacante.ubicacion}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(vacante.created_at), { addSuffix: true, locale: es })}
            </span>
          </div>

          {vacante.rango_salarial_min && (
            <p className="text-sm font-medium text-navy mb-3">
              {vacante.moneda} {new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_min)}
              {vacante.rango_salarial_max && ` - ${new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_max)}`}
            </p>
          )}

          <div className="flex items-center gap-4 pt-3 border-t text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {vacante.total_aplicaciones} candidatos
            </span>
            <span className="text-purple-600 font-medium">{vacante.en_proceso} en proceso</span>
            <span className="text-green-600 font-medium">{vacante.seleccionados} seleccionados</span>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Cerrar vacante"
        description="Los candidatos activos no podran postularse. Esta accion se puede revertir."
        confirmLabel="Cerrar vacante"
        onConfirm={() => handleEstadoChange('cerrada', 'cerrada')}
        destructive
      />
    </>
  );
}
