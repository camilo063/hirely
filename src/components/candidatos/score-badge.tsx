import { cn } from '@/lib/utils';
import { getScoreColor, getScoreLabel } from '@/lib/utils/constants';

interface ScoreBadgeProps {
  score: number | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, label, size = 'md' }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-muted-foreground bg-soft-gray px-2 py-1 rounded-full">
        Sin score
      </span>
    );
  }

  const color = getScoreColor(score);
  const scoreLabel = label || getScoreLabel(score);

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full font-medium', {
      'px-2 py-0.5 text-xs': size === 'sm',
      'px-2.5 py-1 text-sm': size === 'md',
      'px-3 py-1.5 text-base': size === 'lg',
    })} style={{ backgroundColor: `${color}15`, color }}>
      <span className="font-bold">{score}</span>
      <span className="opacity-80">/ 100</span>
      {scoreLabel && <span className="ml-1 opacity-70">({scoreLabel})</span>}
    </div>
  );
}
