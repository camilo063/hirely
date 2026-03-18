'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Briefcase, Users, Brain, FileText,
  Settings, ClipboardCheck, UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'General',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Reclutamiento',
    items: [
      { name: 'Vacantes', href: '/vacantes', icon: Briefcase },
      { name: 'Candidatos', href: '/candidatos', icon: Users },
      { name: 'Entrevistas', href: '/entrevistas', icon: Brain },
      { name: 'Evaluaciones', href: '/evaluaciones', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { name: 'Contratos', href: '/contratos', icon: FileText },
      { name: 'Onboarding', href: '/onboarding', icon: UserCheck },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { name: 'Configuracion', href: '/configuracion', icon: Settings },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-navy text-white">
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center font-bold text-white text-sm">
            H
          </div>
          <span className="text-lg font-bold tracking-tight">Hirely</span>
        </Link>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </p>
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal rounded-r-full" />
                    )}
                    <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-teal' : '')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
