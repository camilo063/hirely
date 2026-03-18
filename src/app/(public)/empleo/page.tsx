import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Briefcase, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { listVacantesPublicas } from '@/lib/services/portal-vacantes.service';

export const metadata: Metadata = {
  title: 'Vacantes disponibles | Hirely',
  description: 'Explora nuestras vacantes disponibles y postulate directamente.',
};

export default async function EmpleoListPage() {
  const vacantes = await listVacantesPublicas();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-navy">Vacantes disponibles</h1>
        <p className="text-muted-foreground mt-2">Encuentra tu proxima oportunidad</p>
      </div>

      {vacantes.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No hay vacantes disponibles en este momento.</p>
      ) : (
        <div className="grid gap-4">
          {vacantes.map((v) => (
            <Link key={v.id} href={`/empleo/${v.slug}`}>
              <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-navy text-lg">{v.titulo}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{v.empresa_nombre}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {v.modalidad && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Home className="h-3 w-3" />
                      {v.modalidad === 'remoto' ? 'Remoto' : v.modalidad === 'hibrido' ? 'Hibrido' : 'Presencial'}
                    </Badge>
                  )}
                  {v.ubicacion && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <MapPin className="h-3 w-3" />
                      {v.ubicacion}
                    </Badge>
                  )}
                  {v.tipo_contrato && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Briefcase className="h-3 w-3" />
                      {v.tipo_contrato}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
