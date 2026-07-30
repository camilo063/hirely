'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, RefreshCw, Check } from 'lucide-react';
import type { Rol } from '@/lib/auth/authorization';

export interface UsuarioRow {
  id: string;
  name: string;
  email: string;
  role: Rol;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<Rol, string> = {
  admin: 'Administrador',
  recruiter: 'Reclutador',
  viewer: 'Solo lectura',
};

function generarPasswordVisible(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

interface Props {
  usuario: UsuarioRow | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function UsuarioForm({ usuario, onSaved, onCancel }: Props) {
  const esEdicion = usuario !== null;
  const [name, setName] = useState(usuario?.name || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [role, setRole] = useState<Rol>(usuario?.role || 'recruiter');
  const [isActive, setIsActive] = useState(usuario?.is_active ?? true);
  const [password, setPassword] = useState(() => (esEdicion ? '' : generarPasswordVisible()));
  const [saving, setSaving] = useState(false);
  const [creado, setCreado] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (esEdicion) {
        const res = await fetch(`/api/admin/usuarios/${usuario.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), role, is_active: isActive }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al actualizar usuario');
        toast.success('Usuario actualizado');
        onSaved();
      } else {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al crear usuario');
        setCreado({ email: data.data.user.email, password: data.data.password });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setSaving(false);
    }
  }

  // Tras crear: mostramos la contrasena una sola vez antes de cerrar el panel.
  if (creado) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 space-y-3">
          <p className="text-sm font-medium">Usuario creado correctamente.</p>
          <p className="text-sm text-muted-foreground">
            Comparte estas credenciales con <strong>{creado.email}</strong>. La contrasena no volvera a mostrarse
            &mdash; si se pierde, usa &quot;Restablecer contrasena&quot; desde la lista.
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Contrasena</Label>
            <div className="flex items-center gap-2">
              <Input value={creado.password} readOnly className="font-mono" />
              <Button type="button" variant="outline" size="sm" onClick={() => copiarPassword(creado.password)}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" className="bg-teal hover:bg-teal/90" onClick={onSaved}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
      </div>

      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={esEdicion}
          className="mt-1"
        />
      </div>

      <div>
        <Label>Rol</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Rol)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
        >
          {(Object.keys(ROLE_LABELS) as Rol[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {esEdicion && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-teal"
            id="usuario-activo"
          />
          <Label htmlFor="usuario-activo" className="cursor-pointer">Usuario activo</Label>
        </div>
      )}

      {!esEdicion && (
        <div>
          <Label>Contrasena inicial</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="font-mono"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setPassword(generarPasswordVisible())}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copiarPassword(password)}>
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Se muestra una sola vez despues de crear el usuario. Compartela por un canal seguro.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="bg-teal hover:bg-teal/90" disabled={saving}>
          {saving ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}
