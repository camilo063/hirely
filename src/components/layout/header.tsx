'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Search, Menu, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MobileNav } from './mobile-nav';
import { NotificacionesCampana } from '@/components/notificaciones/NotificacionesCampana';

export function Header() {
  const { data: session } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6">
      {/* Mobile menu + Search */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <MobileNav />
          </SheetContent>
        </Sheet>

        <div className="hidden sm:flex items-center">
          {searchOpen ? (
            <Input
              placeholder="Buscar vacantes, candidatos..."
              className="w-64"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications — real-time via SSE */}
        <NotificacionesCampana />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-full bg-teal/10 flex items-center justify-center">
                <User className="h-4 w-4 text-teal" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{session?.user?.name || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email || ''}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
