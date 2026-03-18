'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  transcripcion: string;
  duracionSegundos?: number | null;
  defaultExpanded?: boolean;
}

export function TranscripcionView({ transcripcion, duracionSegundos, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  if (!transcripcion) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Sin transcripcion disponible.</p>
      </div>
    );
  }

  const wordCount = transcripcion.split(/\s+/).length;
  const lines = transcripcion.split('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcripcion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-soft-gray/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Transcripcion</span>
          <span className="text-xs text-muted-foreground">
            ({wordCount} palabras
            {duracionSegundos ? ` · ${Math.floor(duracionSegundos / 60)}:${String(duracionSegundos % 60).padStart(2, '0')} min` : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 max-h-[500px] overflow-y-auto">
          <div className="space-y-2 text-sm">
            {lines.map((line, i) => {
              const isAgent = line.toLowerCase().startsWith('agente:') || line.toLowerCase().startsWith('agent:');
              const isCandidate = line.toLowerCase().startsWith('candidato:') || line.toLowerCase().startsWith('candidate:');

              return (
                <p
                  key={i}
                  className={
                    isAgent
                      ? 'text-muted-foreground pl-0'
                      : isCandidate
                      ? 'text-navy font-medium pl-0'
                      : 'pl-0'
                  }
                >
                  {line || '\u00A0'}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
