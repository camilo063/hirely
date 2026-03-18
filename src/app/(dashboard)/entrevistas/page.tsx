'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ScoreBadge } from '@/components/candidatos/score-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { EntrevistaIAConDetalles, EntrevistaHumanaConDetalles } from '@/lib/types/entrevista.types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EntrevistasPage() {
  const [entrevistasIA, setEntrevistasIA] = useState<EntrevistaIAConDetalles[]>([]);
  const [entrevistasHumanas, setEntrevistasHumanas] = useState<EntrevistaHumanaConDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntrevistas();
  }, []);

  async function fetchEntrevistas() {
    try {
      const res = await fetch('/api/entrevistas');
      const data = await res.json();
      if (data.success) {
        setEntrevistasIA(data.data.entrevistas_ia || []);
        setEntrevistasHumanas(data.data.entrevistas_humanas || []);
      }
    } catch {
      console.error('Error fetching entrevistas');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Entrevistas</h1>
        <p className="text-muted-foreground">Gestiona entrevistas IA y presenciales</p>
      </div>

      <Tabs defaultValue="ia" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ia">
            <Brain className="h-4 w-4 mr-1" />
            Entrevistas IA ({entrevistasIA.length})
          </TabsTrigger>
          <TabsTrigger value="humana">
            <Calendar className="h-4 w-4 mr-1" />
            Entrevistas Humanas ({entrevistasHumanas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ia">
          {entrevistasIA.length === 0 ? (
            <EmptyState icon={Brain} title="No hay entrevistas IA" description="Las entrevistas IA se crean automaticamente cuando un candidato avanza en el pipeline." />
          ) : (
            <div className="space-y-3">
              {entrevistasIA.map((e) => (
                <Link key={e.id} href={`/entrevistas/${e.id}?tipo=ia`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center">
                          <Brain className="h-5 w-5 text-teal" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{e.candidato_nombre} {e.candidato_apellido}</p>
                          <p className="text-xs text-muted-foreground">{e.vacante_titulo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.score_total !== null && <ScoreBadge score={Number(e.score_total)} size="sm" />}
                        <Badge variant="outline" className="capitalize text-xs">
                          {e.estado.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="humana">
          {entrevistasHumanas.length === 0 ? (
            <EmptyState icon={Calendar} title="No hay entrevistas humanas" description="Agenda entrevistas con candidatos preseleccionados." />
          ) : (
            <div className="space-y-3">
              {entrevistasHumanas.map((e) => (
                <Link key={e.id} href={`/entrevistas/${e.id}?tipo=humana`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-orange" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{e.candidato_nombre} {e.candidato_apellido}</p>
                          <p className="text-xs text-muted-foreground">{e.vacante_titulo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {e.fecha_programada && format(new Date(e.fecha_programada), 'PPp', { locale: es })}
                        </span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {e.estado.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
