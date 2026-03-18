'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, Mail, Phone, Linkedin, Briefcase, MapPin, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Candidato } from '@/lib/types/candidato.types';
import { getFuenteColor } from '@/lib/utils/design-tokens';
import { toast } from 'sonner';

export default function CandidatoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    fetchCandidato();
  }, [params.id]);

  async function fetchCandidato() {
    try {
      const res = await fetch(`/api/candidatos/${params.id}`);
      const data = await res.json();
      if (data.success) setCandidato(data.data);
    } catch {
      toast.error('Error cargando candidato');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/candidatos/${params.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Candidato eliminado');
        router.push('/candidatos');
      }
    } catch {
      toast.error('Error eliminando candidato');
    }
  }

  if (loading) return <TableSkeleton />;
  if (!candidato) return <p className="text-center text-muted-foreground py-12">Candidato no encontrado</p>;

  const fuenteColor = getFuenteColor(candidato.fuente);

  return (
    <div className="animate-fade-in">
      <Breadcrumbs overrides={candidato ? { [params.id as string]: `${candidato.nombre} ${candidato.apellido}` } : undefined} />

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-teal/20 to-teal/5 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-teal">
              {(candidato.nombre || '').charAt(0)}{(candidato.apellido || '').charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">{candidato.nombre} {candidato.apellido}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{candidato.email}</span>
              {candidato.telefono && (
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{candidato.telefono}</span>
              )}
              <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{candidato.experiencia_anos} anos</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fuenteColor.bg} ${fuenteColor.text}`}>
                {fuenteColor.label}
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="cv">CV Parseado</TabsTrigger>
          <TabsTrigger value="aplicaciones">Aplicaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Informacion de contacto</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{candidato.email}</span>
                </div>
                {candidato.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{candidato.telefono}</span>
                  </div>
                )}
                {candidato.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a href={candidato.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                      Ver perfil LinkedIn
                    </a>
                  </div>
                )}
                {candidato.cv_url && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a href={candidato.cv_url} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                      Descargar CV / Hoja de vida
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Habilidades</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(candidato.habilidades || []).map((h) => (
                    <span key={h} className="bg-teal/10 text-teal-700 px-2.5 py-1 rounded-full text-xs font-medium">{h}</span>
                  ))}
                  {(!candidato.habilidades || candidato.habilidades.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sin habilidades registradas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {candidato.salario_esperado && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Salario esperado</p>
                <p className="text-lg font-semibold text-navy">
                  COP {new Intl.NumberFormat('es-CO').format(candidato.salario_esperado)}
                </p>
              </CardContent>
            </Card>
          )}

          {candidato.notas && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notas</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{candidato.notas}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cv">
          <Card>
            <CardContent className="pt-6">
              {candidato.cv_parsed ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Resumen</h3>
                    <p className="text-sm">{(candidato.cv_parsed as any).resumen || (candidato.cv_parsed as any).resumen_profesional || 'Sin resumen'}</p>
                  </div>
                  {candidato.cv_parsed.experiencia?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Experiencia laboral</h3>
                      {candidato.cv_parsed.experiencia.map((exp, i) => (
                        <div key={i} className="mb-3 pl-3 border-l-2 border-teal">
                          <p className="font-medium text-sm">{exp.cargo}</p>
                          <p className="text-xs text-muted-foreground">{exp.empresa} | {exp.fecha_inicio} - {exp.fecha_fin || 'Actual'}</p>
                          <p className="text-sm mt-1">{exp.descripcion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {candidato.cv_parsed.educacion?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Educacion</h3>
                      {candidato.cv_parsed.educacion.map((edu, i) => (
                        <div key={i} className="mb-2">
                          <p className="font-medium text-sm">{edu.titulo}</p>
                          <p className="text-xs text-muted-foreground">{edu.institucion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">CV no parseado aun</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aplicaciones">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                Historial de aplicaciones del candidato
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar candidato"
        description="Esta accion no se puede deshacer. Se eliminara toda la informacion del candidato."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}
