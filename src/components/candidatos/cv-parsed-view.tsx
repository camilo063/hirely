'use client';

import { Briefcase, GraduationCap, Code2, Globe, Award, FileText, Download, ExternalLink, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useS3Url } from '@/hooks/use-s3-url';
import type { CVParsedData } from '@/lib/types/scoring.types';

interface CvParsedViewProps {
  cvParsed: CVParsedData | null;
  cvUrl?: string | null;
  compact?: boolean;
  onAnalizarConIA?: () => void;
  analizando?: boolean;
}

const IDIOMA_NIVEL_COLORS: Record<string, string> = {
  nativo: 'bg-success/10 text-success border-success/30',
  avanzado: 'bg-teal/10 text-teal border-teal/30',
  intermedio: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  basico: 'bg-gray-100 text-gray-600 border-gray-200',
};

function isFallbackOrEmpty(cvParsed: CVParsedData | null): boolean {
  if (!cvParsed || !cvParsed.parsed_at) return true;
  if (cvParsed.parser_version === '1.0-fallback') return true;
  if (cvParsed.parser_version === '1.0-minimal') return true;
  if (typeof cvParsed.confianza === 'number' && cvParsed.confianza < 0.5) return true;
  return false;
}

export function CvParsedView({
  cvParsed,
  cvUrl,
  compact = false,
  onAnalizarConIA,
  analizando,
}: CvParsedViewProps) {
  const fallback = isFallbackOrEmpty(cvParsed);

  return (
    <div className="space-y-4">
      {/* Bloque de descarga del CV original (si existe) */}
      {cvUrl && <CvDownloadBlock cvUrl={cvUrl} />}

      {/* Empty state inteligente: PDF guardado pero no analizado */}
      {fallback && cvUrl && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">CV no analizado</p>
              <p className="text-xs text-amber-800 mt-1">
                El CV de este candidato esta guardado pero no ha sido analizado por la IA.
                Esto puede ocurrir por timeout al momento de la aplicacion.
              </p>
              {onAnalizarConIA && (
                <Button
                  size="sm"
                  onClick={onAnalizarConIA}
                  disabled={analizando}
                  className="mt-3 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white"
                >
                  {analizando ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 mr-1" />
                  )}
                  Analizar con IA
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state: ni siquiera hay PDF */}
      {fallback && !cvUrl && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">CV no parseado.</p>
          <p className="text-xs mt-1">Suba un CV en PDF o ejecute el scoring para extraer datos.</p>
        </div>
      )}

      {/* Datos parseados (solo si NO es fallback) */}
      {!fallback && cvParsed && (
        <div className="space-y-5">
          {cvParsed.resumen_profesional && (
            <p className="text-sm text-muted-foreground italic">{cvParsed.resumen_profesional}</p>
          )}

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

          <div className="text-[10px] text-muted-foreground pt-2 border-t flex items-center gap-3">
            <span>Parseado: {new Date(cvParsed.parsed_at).toLocaleDateString()}</span>
            <span>Fuente: {cvParsed.fuente}</span>
            <span>Confianza: {Math.round(cvParsed.confianza * 100)}%</span>
            <span>v{cvParsed.parser_version}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bloque de descarga del CV original. Resuelve la URL via presigned si es
 * una clave s3:// o usa la URL directa si ya es publica.
 */
function CvDownloadBlock({ cvUrl }: { cvUrl: string }) {
  const { url, loading, error } = useS3Url(cvUrl);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md border bg-soft-gray px-3 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando enlace al CV...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive rounded-md border border-destructive/30 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5" /> No se pudo cargar el CV ({error || 'sin url'})
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-soft-gray px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-navy">
        <FileText className="h-3.5 w-3.5 text-teal" />
        <span className="font-medium">CV original</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild className="h-7 px-2">
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir en nueva pestana">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2">
          <a href={url} download title="Descargar CV">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
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
