import { getEstadoColor, getVacanteEstadoColor } from '@/lib/utils/design-tokens';
import { cn } from '@/lib/utils';

interface EstadoBadgeProps {
  estado: string;
  size?: 'sm' | 'md';
  variant?: 'aplicacion' | 'vacante';
  className?: string;
}

export function EstadoBadge({ estado, size = 'md', variant = 'aplicacion', className }: EstadoBadgeProps) {
  if (variant === 'vacante') {
    const color = getVacanteEstadoColor(estado);
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        color.bg, color.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
        className
      )}>
        <span className={cn('h-1.5 w-1.5 rounded-full', color.dot)} />
        {color.label}
      </span>
    );
  }

  const color = getEstadoColor(estado);
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium capitalize',
      color.bg, color.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs',
      className
    )}>
      {color.label}
    </span>
  );
}
