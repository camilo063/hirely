'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lightbulb, X, Users, Brain, FileText, BarChart2, FolderOpen, FileCheck, AlertCircle } from 'lucide-react';

interface PipelineInsight {
  tipo: string;
  titulo: string;
  descripcion: string;
  cantidad: number;
  cta_texto: string;
  cta_href: string;
  prioridad: 'alta' | 'media' | 'baja';
}

const TIPO_ICONOS: Record<string, React.ElementType> = {
  sin_candidatos: Users,
  pendientes_score: Brain,
  listos_entrevista_ia: Brain,
  listos_evaluacion: FileText,
  listos_decision: BarChart2,
  listos_documentos: FolderOpen,
  listos_contrato: FileCheck,
};

const PRIORIDAD_ESTILOS: Record<string, string> = {
  alta: 'border-l-4 border-[#FF6B35] bg-[#FF6B35]/5',
  media: 'border-l-4 border-[#00BCD4] bg-[#00BCD4]/5',
  baja: 'border-l-4 border-gray-300 bg-gray-50',
};

export function SiguientePasoSugerido({ vacanteId }: { vacanteId: string }) {
  const [insight, setInsight] = useState<PipelineInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/vacantes/${vacanteId}/pipeline-insight`);
        const data = await res.json();
        setInsight(data);
      } catch {
        // Fail silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vacanteId]);

  if (loading) {
    return (
      <div className="rounded-xl border p-4 mb-4 animate-pulse">
        <div className="h-3 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-64 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-80" />
      </div>
    );
  }

  if (!insight || !visible) return null;

  const Icon = TIPO_ICONOS[insight.tipo] || AlertCircle;
  const estilo = PRIORIDAD_ESTILOS[insight.prioridad] || PRIORIDAD_ESTILOS.baja;

  return (
    <div className={`rounded-xl p-4 border ${estilo} mb-4 flex items-start justify-between gap-4`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Lightbulb className="h-4 w-4 text-[#FF6B35]" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Siguiente paso sugerido
          </p>
          <p className="font-semibold text-[#0A1F3F] text-sm mb-1">
            {insight.titulo}
          </p>
          <p className="text-gray-500 text-sm mb-3">
            {insight.descripcion}
          </p>
          <Link
            href={insight.cta_href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#00BCD4] hover:text-[#00BCD4]/80 transition-colors"
          >
            {insight.cta_texto} &rarr;
          </Link>
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
