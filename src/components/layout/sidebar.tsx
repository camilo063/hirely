'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, Briefcase, Users, Brain, FileText,
  Settings, ChevronLeft, ChevronRight, ClipboardCheck, UserCheck,
  Building2, BarChart2, Bell,
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
      { name: 'Reportes', href: '/reportes', icon: BarChart2 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { name: 'Notificaciones', href: '/notificaciones', icon: Bell },
      { name: 'Configuracion', href: '/configuracion', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-navy text-white transition-all duration-300 relative',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0">
            H
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight">Hirely</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative group',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {/* Teal active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal rounded-r-full" />
                    )}
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-teal' : 'text-white/50 group-hover:text-white/80')} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile at bottom */}
      {!collapsed && session?.user && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/5">
            <div className="h-8 w-8 rounded-full bg-teal/20 flex items-center justify-center text-xs font-bold text-teal shrink-0">
              {(session.user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name || 'Usuario'}</p>
              <p className="text-[10px] text-white/40 truncate">{session.user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-11 flex items-center justify-center border-t border-white/10 text-white/40 hover:text-white/70 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
