'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, X, Check, Shield } from 'lucide-react';
import { useTiposContrato, TipoContratoOption } from '@/hooks/useTiposContrato';

export function TiposContratoConfig() {
  const { tipos, loading, refetch } = useTiposContrato();
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  const handleCreate = async () => {
    if (!newNombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tipos-contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newNombre.trim(), descripcion: newDescripcion.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Tipo de contrato creado');
      setNewNombre('');
      setNewDescripcion('');
      setShowAdd(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editNombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tipos-contrato/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre.trim(), descripcion: editDescripcion.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Tipo actualizado');
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tipo: TipoContratoOption) => {
    if (tipo.is_system) {
      toast.error('No se pueden eliminar tipos del sistema');
      return;
    }
    if (!confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/tipos-contrato/${tipo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Tipo eliminado');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const startEdit = (tipo: TipoContratoOption) => {
    setEditingId(tipo.id);
    setEditNombre(tipo.nombre);
    setEditDescripcion(tipo.descripcion || '');
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando tipos...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define los tipos de contrato disponibles. Se usan al crear plantillas y vacantes.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar tipo
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-dashed border-teal rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input
                value={newNombre}
                onChange={e => setNewNombre(e.target.value)}
                placeholder="Ej: Termino Fijo"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <Label className="text-xs">Descripcion (opcional)</Label>
              <Input
                value={newDescripcion}
                onChange={e => setNewDescripcion(e.target.value)}
                placeholder="Descripcion breve"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-teal hover:bg-teal/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Crear
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {tipos.map(tipo => (
          <div key={tipo.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
            {editingId === tipo.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleUpdate(tipo.id)}
                />
                <Input
                  value={editDescripcion}
                  onChange={e => setEditDescripcion(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Descripcion"
                />
                <Button variant="ghost" size="sm" onClick={() => handleUpdate(tipo.id)} disabled={saving}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tipo.nombre}</span>
                  {tipo.is_system && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Shield className="h-3 w-3" /> Sistema
                    </Badge>
                  )}
                  {tipo.descripcion && (
                    <span className="text-xs text-muted-foreground hidden md:inline">— {tipo.descripcion}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(tipo)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!tipo.is_system && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tipo)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {tipos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No hay tipos de contrato configurados.
        </p>
      )}
    </div>
  );
}
