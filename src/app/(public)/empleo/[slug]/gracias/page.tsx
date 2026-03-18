import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function GraciasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nombre?: string; empresa?: string; cargo?: string }>;
}) {
  const { slug } = await params;
  const { nombre, empresa, cargo } = await searchParams;

  return (
    <div className="max-w-lg mx-auto text-center py-12 space-y-6">
      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mx-auto">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-navy">
          {nombre ? `Gracias, ${nombre}!` : 'Gracias!'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {cargo && empresa
            ? `Tu postulacion para ${cargo} en ${empresa} ha sido recibida.`
            : 'Tu postulacion ha sido recibida exitosamente.'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Revisaremos tu perfil y te contactaremos pronto.
        </p>
      </div>
      <Link
        href={`/empleo/${slug}`}
        className="inline-block text-teal hover:underline text-sm"
      >
        Volver a la vacante
      </Link>
    </div>
  );
}
