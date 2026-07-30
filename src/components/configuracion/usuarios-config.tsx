'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { toast } from 'sonner';
import { Plus, Search, Users, KeyRound, Copy, Check } from 'lucide-react';
import { UsuarioForm, UsuarioRow } from '@/components/configuracion/usuario-form';
import type { Rol } from '@/lib/auth/authorization';

const ROLE_LABELS: Record<Rol, string> = {
  admin: 'Administrador',
  recruiter: 'Reclutador',
  viewer: 'Solo lectura',
};

export function UsuariosConfig() {
  const { data: session, status } = useSession();
  const rolActual = (session?.user as Record<string, unknown> | undefined)?.role as Rol | undefined;

  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editando, setEditando] = useState<UsuarioRow | null>(null);
  const [resetPassword, setResetPassword] = useState<{ password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/usuarios');
      const data = await res.json();
      if (data.success) {
        setUsuarios(data.data || []);
      } else {
        toast.error(data.error || 'Error cargando usuarios');
      }
    } catch {
      toast.error('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchUsuarios();
  }, [status, fetchUsuarios]);

  // Mientras la sesion resuelve no se sabe el rol aun: se muestra un esqueleto
  // en vez del contenido real, para no dejar ver la tabla ni por un instante a
  // alguien que termine siendo no-admin (la API igual la bloquea con
  // requireAdmin(), esto es solo para que la UI no lo insinue).
  if (status === 'loading') {
    return <TableSkeleton />;
  }

  if (rolActual !== 'admin') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Esta seccion es solo para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  function handleNew() {
    setEditando(null);
    setSheetOpen(true);
  }

  function handleEdit(usuario: UsuarioRow) {
    setEditando(usuario);
    setSheetOpen(true);
  }

  function handleSaved() {
    setSheetOpen(false);
    setEditando(null);
    fetchUsuarios();
  }

  async function handleToggleActivo(usuario: UsuarioRow) {
    const activar = !usuario.is_active;
    if (!activar && !confirm(`¿Desactivar a ${usuario.name}? No podra volver a iniciar sesion.`)) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: activar }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al actualizar el usuario');
      toast.success(activar ? 'Usuario activado' : 'Usuario desactivado');
      fetchUsuarios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el usuario');
    }
  }

  async function handleResetPassword(usuario: UsuarioRow) {
    if (!confirm(`¿Restablecer la contrasena de ${usuario.name}? La contrasena actual dejara de funcionar.`)) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al restablecer la contrasena');
      setResetPassword({ password: data.data.password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al restablecer la contrasena');
    }
  }

  async function copiarPassword(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      toast.success('Contrasena copiada');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto manualmente.');
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crea usuarios, asigna sus roles y gestiona el acceso a la plataforma.
        </p>
        <Button className="bg-teal hover:bg-teal/90 gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : usuariosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No hay usuarios que coincidan</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-soft-gray/50">
                  <th className="text-left px-4 py-3 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-center px-4 py-3 font-medium">Rol</th>
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="text-center px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-soft-gray/30 transition-colors">
                    <td className="px-4 py-3 cursor-pointer" onClick={() => handleEdit(u)}>{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => handleEdit(u)}>{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline">{ROLE_LABELS[u.role] || u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${u.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleResetPassword(u)} title="Restablecer contrasena">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActivo(u)}
                          className={u.is_active ? 'text-destructive hover:text-destructive' : 'text-success hover:text-success'}
                        >
                          {u.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editando ? 'Editar usuario' : 'Nuevo usuario'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <UsuarioForm usuario={editando} onSaved={handleSaved} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={resetPassword !== null} onOpenChange={(open) => { if (!open) setResetPassword(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contrasena restablecida</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Comparte esta contrasena por un canal seguro. No volvera a mostrarse.
          </p>
          {resetPassword && (
            <div className="space-y-1">
              <Label className="text-xs">Nueva contrasena</Label>
              <div className="flex items-center gap-2">
                <Input value={resetPassword.password} readOnly className="font-mono" />
                <Button type="button" variant="outline" size="sm" onClick={() => copiarPassword(resetPassword.password)}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button className="bg-teal hover:bg-teal/90" onClick={() => setResetPassword(null)}>Listo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
