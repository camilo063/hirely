'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const routeNames: Record<string, string> = {
  dashboard: 'Dashboard',
  vacantes: 'Vacantes',
  candidatos: 'Candidatos',
  entrevistas: 'Entrevistas',
  evaluaciones: 'Evaluaciones',
  contratos: 'Contratos',
  onboarding: 'Onboarding',
  configuracion: 'Configuracion',
  nueva: 'Nueva',
  nuevo: 'Nuevo',
  editar: 'Editar',
};

export interface BreadcrumbOverride {
  [segment: string]: string;
}

interface BreadcrumbsProps {
  overrides?: BreadcrumbOverride;
}

export function Breadcrumbs({ overrides }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    let name = overrides?.[segment] || routeNames[segment] || segment;

    // Truncate long names
    if (name.length > 40) {
      name = name.substring(0, 40) + '...';
    }

    const isLast = index === segments.length - 1;
    // Hide UUID segments that have no override (they'll look like raw IDs)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment);
    const showAsLink = !isLast;

    return { href, name, isLast, isUUID, segment, showAsLink };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      {crumbs.map((crumb, index) => {
        // If it's a UUID with no override, skip rendering it separately
        // (the next segment like "editar" or "candidatos" will show)
        if (crumb.isUUID && !overrides?.[crumb.segment]) {
          return (
            <Fragment key={crumb.href}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <Link href={crumb.href} className="hover:text-foreground transition-colors truncate max-w-[200px]">
                {crumb.name}
              </Link>
            </Fragment>
          );
        }

        return (
          <Fragment key={crumb.href}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {crumb.isLast ? (
              <span className="font-medium text-foreground truncate max-w-[250px]">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors truncate max-w-[200px]">
                {crumb.name}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
