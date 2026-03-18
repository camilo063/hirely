import Link from 'next/link';
import { User, MapPin, Briefcase, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Candidato } from '@/lib/types/candidato.types';

interface CandidatoCardProps {
  candidato: Candidato;
}

export function CandidatoCard({ candidato }: CandidatoCardProps) {
  return (
    <Link href={`/candidatos/${candidato.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-navy truncate">
                {candidato.nombre} {candidato.apellido}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3" />
                <span className="truncate">{candidato.email}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {candidato.experiencia_anos} anos
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {candidato.fuente}
                </span>
              </div>
              {candidato.habilidades && candidato.habilidades.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {candidato.habilidades.slice(0, 4).map((h) => (
                    <span key={h} className="text-[10px] bg-teal/10 text-teal px-1.5 py-0.5 rounded">
                      {h}
                    </span>
                  ))}
                  {candidato.habilidades.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{candidato.habilidades.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
