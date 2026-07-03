'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: string;
  description?: ReactNode;
  /** Contenido opcional a la derecha del header (ej. un contador). */
  aside?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Card con header clickeable que colapsa/expande su contenido. Pensado para
 * pantallas de configuracion largas: permite cerrar los bloques que no se estan
 * editando. Sin dependencias externas (solo estado local + chevron animado).
 */
export function CollapsibleCard({
  title,
  description,
  aside,
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-6 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
        <ChevronDown
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
}
