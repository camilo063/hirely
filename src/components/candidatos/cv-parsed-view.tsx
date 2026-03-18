'use client';

import { Briefcase, GraduationCap, Code2, Globe, Award, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CVParsedData } from '@/lib/types/scoring.types';

interface CvParsedViewProps {
  cvParsed: CVParsedData | null;
  compact?: boolean;
}

const IDIOMA_NIVEL_COLORS: Record<string, string> = {
  nativo: 'bg-success/10 text-success border-success/30',
  avanzado: 'bg-teal/10 text-teal border-teal/30',
  intermedio: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  basico: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function CvParsedView({ cvParsed, compact = false }: CvParsedViewProps) {
  if (!cvParsed || !cvParsed.parsed_at) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">CV no parseado.</p>
        <p className="text-xs mt-1">Suba un CV en PDF o ejecute el scoring para extraer datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumen profesional */}
      {cvParsed.resumen_profesional && (
        <div>
          <p className="text-sm text-muted-foreground italic">{cvParsed.resumen_profesional}</p>
        </div>
      )}

      {/* Experiencia */}
      {cvParsed.experiencia?.length > 0 && (
        <Section icon={<Briefcase className="h-4 w-4" />} title="Experiencia">
          <div className="space-y-3">
            {cvParsed.experiencia.slice(0, compact ? 3 : undefined).map((exp, i) => (
              <div key={i} className="border-l-2 border-teal/30 pl-3">
                <p className="text-sm font-medium">{exp.cargo}</p>
                <p className="text-xs text-muted-foreground">{exp.empresa}{exp.ubicacion ? ` - ${exp.ubicacion}` : ''}</p>
                <p className="text-xs text-muted-foreground">
                  {exp.fecha_inicio} — {exp.fecha_fin || 'Actualmente'}
                  {exp.duracion_meses > 0 && ` (${formatDuration(exp.duracion_meses)})`}
                </p>
                {!compact && exp.descripcion && (
                  <p className="text-xs mt-1 text-gray-600">{exp.descripcion}</p>
                )}
                {exp.tecnologias?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {exp.tecnologias.map((t) => (
                      <span key={t} className="text-[10px] bg-teal/5 text-teal px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {compact && cvParsed.experiencia.length > 3 && (
              <p className="text-xs text-muted-foreground">+{cvParsed.experiencia.length - 3} posiciones mas</p>
            )}
          </div>
        </Section>
      )}

      {/* Educacion */}
      {cvParsed.educacion?.length > 0 && (
        <Section icon={<GraduationCap className="h-4 w-4" />} title="Educacion">
          <div className="space-y-2">
            {cvParsed.educacion.map((edu, i) => (
              <div key={i}>
                <p className="text-sm font-medium">{edu.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {edu.institucion} — {edu.nivel}
                  {edu.en_curso && ' (en curso)'}
                </p>
                {edu.campo_estudio && (
                  <p className="text-xs text-muted-foreground">{edu.campo_estudio}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Habilidades tecnicas */}
      {cvParsed.habilidades_tecnicas?.length > 0 && (
        <Section icon={<Code2 className="h-4 w-4" />} title="Habilidades Tecnicas">
          <div className="flex flex-wrap gap-1.5">
            {cvParsed.habilidades_tecnicas.map((h) => (
              <Badge key={h} variant="outline" className="text-xs">
                {h}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Idiomas */}
      {cvParsed.idiomas?.length > 0 && (
        <Section icon={<Globe className="h-4 w-4" />} title="Idiomas">
          <div className="flex flex-wrap gap-1.5">
            {cvParsed.idiomas.map((idioma) => (
              <Badge
                key={idioma.idioma}
                variant="outline"
                className={`text-xs ${IDIOMA_NIVEL_COLORS[idioma.nivel] || ''}`}
              >
                {idioma.idioma} ({idioma.nivel})
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Certificaciones */}
      {cvParsed.certificaciones?.length > 0 && (
        <Section icon={<Award className="h-4 w-4" />} title="Certificaciones">
          <div className="space-y-1">
            {cvParsed.certificaciones.map((cert, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{cert.nombre}</span>
                {cert.emisor && <span className="text-muted-foreground"> — {cert.emisor}</span>}
                {cert.vigente === false && <span className="text-xs text-orange ml-1">(expirada)</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Metadata */}
      <div className="text-[10px] text-muted-foreground pt-2 border-t flex items-center gap-3">
        <span>Parseado: {new Date(cvParsed.parsed_at).toLocaleDateString()}</span>
        <span>Fuente: {cvParsed.fuente}</span>
        <span>Confianza: {Math.round(cvParsed.confianza * 100)}%</span>
        <span>v{cvParsed.parser_version}</span>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-teal">{icon}</span>
        <h4 className="text-sm font-semibold text-navy">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining}m`;
  if (remaining === 0) return `${years}a`;
  return `${years}a ${remaining}m`;
}
