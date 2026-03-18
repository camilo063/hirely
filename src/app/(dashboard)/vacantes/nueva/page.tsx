'use client';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { VacanteForm } from '@/components/vacantes/vacante-form';

export default function NuevaVacantePage() {
  return (
    <div className="animate-fade-in">
      <Breadcrumbs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Crear nueva vacante</h1>
        <p className="text-muted-foreground">Completa los datos para publicar una nueva posicion</p>
      </div>
      <div className="max-w-4xl">
        <VacanteForm />
      </div>
    </div>
  );
}
