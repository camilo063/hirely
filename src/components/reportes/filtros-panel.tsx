'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { FiltrosReporte } from '@/lib/types/reportes.types';

interface FiltrosPanelProps {
  filtros: FiltrosReporte;
  onChange: (filtros: FiltrosReporte) => void;
  vacantes: { id: string; titulo: string }[];
}

const PERIODOS = [
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: '180d', label: 'Ultimos 180 dias' },
  { value: '365d', label: 'Ultimo ano' },
  { value: 'custom', label: 'Personalizado' },
];

export function FiltrosPanel({ filtros, onChange, vacantes }: FiltrosPanelProps) {
  const [exportando, setExportando] = useState(false);

  const handlePeriodoChange = (periodo: string) => {
    onChange({
      ...filtros,
      periodo: periodo as FiltrosReporte['periodo'],
      ...(periodo !== 'custom' ? { desde: undefined, hasta: undefined } : {}),
    });
  };

  const handleVacanteChange = (value: string) => {
    onChange({
      ...filtros,
      vacanteId: value === 'all' ? undefined : value,
    });
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      if (filtros.periodo) params.set('periodo', filtros.periodo);
      if (filtros.vacanteId) params.set('vacanteId', filtros.vacanteId);
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);

      const res = await fetch(`/api/reportes/exportar?${params}`);
      if (!res.ok) throw new Error('Error al exportar');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hirely-reporte-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Reporte exportado exitosamente');
    } catch {
      toast.error('Error al exportar el reporte');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <Select value={filtros.periodo || '90d'} onValueChange={handlePeriodoChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          {PERIODOS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtros.vacanteId || 'all'} onValueChange={handleVacanteChange}>
        <SelectTrigger className="w-full sm:w-[250px]">
          <SelectValue placeholder="Vacante" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las vacantes</SelectItem>
          {vacantes.map((v) => (
            <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtros.periodo === 'custom' && (
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={filtros.desde || ''}
            onChange={(e) => onChange({ ...filtros, desde: e.target.value })}
            className="w-[150px]"
          />
          <span className="text-muted-foreground text-sm">a</span>
          <Input
            type="date"
            value={filtros.hasta || ''}
            onChange={(e) => onChange({ ...filtros, hasta: e.target.value })}
            className="w-[150px]"
          />
        </div>
      )}

      <Button variant="outline" size="sm" onClick={handleExportar} disabled={exportando} className="ml-auto shrink-0">
        {exportando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
        Exportar
      </Button>
    </div>
  );
}
