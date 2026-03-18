'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Users, Mail, Calendar, Clock, CheckCircle, AlertCircle,
  Send, Loader2, RefreshCw, UserCheck,
} from 'lucide-react';
import type { OnboardingCandidato } from '@/lib/types/onboarding.types';

export default function OnboardingPage() {
  const [onboardings, setOnboardings] = useState<OnboardingCandidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [procesando, setProcesando] = useState(false);

  const fetchOnboardings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroEstado !== 'todos') params.set('estado', filtroEstado);
      const res = await fetch(`/api/onboarding?${params}`);
      if (res.ok) {
        const { data } = await res.json();
        setOnboardings(data || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { fetchOnboardings(); }, [fetchOnboardings]);

  const handleProcesarProgramados = async () => {
    setProcesando(true);
    try {
      const res = await fetch('/api/onboarding/procesar-programados', { method: 'POST' });
      if (res.ok) {
        const { data } = await res.json();
        toast.success(data.message);
        fetchOnboardings();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Error al procesar emails programados');
    } finally {
      setProcesando(false);
    }
  };

  const handleEnviarEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/onboarding/${id}/enviar-email`, { method: 'POST' });
      if (res.ok) {
        toast.success('Email enviado');
        fetchOnboardings();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Error al enviar email');
    }
  };

  const formatFecha = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const daysUntil = (iso: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fecha = new Date(iso + 'T12:00:00');
    fecha.setHours(0, 0, 0, 0);
    const diff = Math.round((fecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff > 0) return `En ${diff}d`;
    return `Hace ${Math.abs(diff)}d`;
  };

  const emailEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'enviado':
        return <Badge className="bg-success/15 text-success gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Enviado</Badge>;
      case 'programado':
        return <Badge className="bg-blue-100 text-blue-700 gap-1 text-xs"><Clock className="h-3 w-3" /> Programado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 gap-1 text-xs"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Pendiente</Badge>;
    }
  };

  // Summary stats
  const now = new Date();
  const thisMonth = onboardings.filter(o => {
    const d = new Date(o.fecha_inicio + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const pendientes = onboardings.filter(o =>
    o.email_bienvenida_estado === 'programado' || o.email_bienvenida_estado === 'pendiente'
  );
  const proximaSemana = onboardings.filter(o => {
    const d = new Date(o.fecha_inicio + 'T12:00:00');
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Onboarding</h1>
          <p className="text-muted-foreground text-sm">{onboardings.length} onboardings activos</p>
        </div>
        <Button
          variant="outline"
          onClick={handleProcesarProgramados}
          disabled={procesando}
          className="gap-1.5"
        >
          {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Procesar emails programados
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thisMonth.length}</p>
              <p className="text-xs text-muted-foreground">Contratados este mes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientes.length}</p>
              <p className="text-xs text-muted-foreground">Emails pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{proximaSemana.length}</p>
              <p className="text-xs text-muted-foreground">Inicios esta semana</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado del email" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="programado">Programado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={fetchOnboardings} className="gap-1">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : onboardings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No hay onboardings registrados</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Fecha inicio</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onboardings.map(ob => (
                <TableRow key={ob.id}>
                  <TableCell>
                    <p className="font-medium text-sm">
                      {ob.candidato_nombre} {ob.candidato_apellido || ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{ob.candidato_email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{ob.vacante_titulo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatFecha(ob.fecha_inicio)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {daysUntil(ob.fecha_inicio)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{emailEstadoBadge(ob.email_bienvenida_estado)}</TableCell>
                  <TableCell className="text-right">
                    {ob.email_bienvenida_estado !== 'enviado' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEnviarEmail(ob.id)}
                        className="gap-1 text-xs"
                      >
                        <Send className="h-3 w-3" /> Enviar
                      </Button>
                    )}
                    {ob.email_bienvenida_estado === 'enviado' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEnviarEmail(ob.id)}
                        className="gap-1 text-xs text-muted-foreground"
                      >
                        <RefreshCw className="h-3 w-3" /> Re-enviar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
