'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { VacanteForm } from '@/components/vacantes/vacante-form';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { toast } from 'sonner';

export default function EditarVacantePage() {
  const params = useParams();
  const [vacante, setVacante] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVacante() {
      try {
        const res = await fetch(`/api/vacantes/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setVacante(data.data);
        } else {
          toast.error('Vacante no encontrada');
        }
      } catch {
        toast.error('Error cargando vacante');
      } finally {
        setLoading(false);
      }
    }
    fetchVacante();
  }, [params.id]);

  if (loading) return <TableSkeleton />;
  if (!vacante) return <p className="text-center text-muted-foreground py-12">Vacante no encontrada</p>;

  return (
    <div className="animate-fade-in">
      <Breadcrumbs overrides={vacante ? { [params.id as string]: vacante.titulo as string } : undefined} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Editar vacante</h1>
        <p className="text-muted-foreground">Modifica los datos de la posicion</p>
      </div>
      <div className="max-w-4xl">
        <VacanteForm initialData={vacante} isEditing />
      </div>
    </div>
  );
}
