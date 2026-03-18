'use client';

import dynamic from 'next/dynamic';

const AplicacionForm = dynamic(
  () => import('./aplicacion-form').then(m => ({ default: m.AplicacionForm })),
  { ssr: false, loading: () => <div className="animate-pulse h-96 bg-gray-100 rounded-lg" /> }
);

interface Props {
  slug: string;
  vacanteTitulo: string;
  empresaNombre: string;
  habilidadesSugeridas: string[];
}

export function AplicacionFormWrapper(props: Props) {
  return <AplicacionForm {...props} />;
}
