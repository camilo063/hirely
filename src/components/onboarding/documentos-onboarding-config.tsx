'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Link2, Plus, Trash2, Upload, Loader2, ExternalLink } from 'lucide-react';

interface DocOnboarding {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  descripcion?: string;
}

export function DocumentosOnboardingConfig() {
  const [docs, setDocs] = useState<DocOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'file' | 'link'>('file');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/onboarding/documentos');
      if (res.ok) {
        const { data } = await res.json();
        setDocs(data || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleAdd = async () => {
    if (!nombre) {
      toast.error('El nombre es requerido');
      return;
    }

    setUploading(true);
    try {
      if (formMode === 'file' && file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nombre', nombre);
        formData.append('descripcion', descripcion);
        formData.append('tipo', file.name.endsWith('.pdf') ? 'pdf' : 'doc');

        const res = await fetch('/api/configuracion/onboarding/documentos', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error();
      } else if (formMode === 'link' && url) {
        const res = await fetch('/api/configuracion/onboarding/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, url, tipo: 'link', descripcion }),
        });
        if (!res.ok) throw new Error();
      } else {
        toast.error(formMode === 'file' ? 'Selecciona un archivo' : 'Ingresa una URL');
        setUploading(false);
        return;
      }

      toast.success('Documento agregado');
      resetForm();
      fetchDocs();
    } catch {
      toast.error('Error al agregar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/configuracion/onboarding/documentos/${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success('Documento eliminado');
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch {
      toast.error('Error al eliminar documento');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setNombre('');
    setDescripcion('');
    setUrl('');
    setFile(null);
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === 'link') return <Link2 className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Documentos de onboarding</h3>
          <p className="text-sm text-muted-foreground">
            Estos documentos se incluyen en el email de bienvenida.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={formMode === 'file' ? 'default' : 'outline'}
                onClick={() => setFormMode('file')}
                className="gap-1"
              >
                <Upload className="h-3 w-3" /> Archivo
              </Button>
              <Button
                size="sm"
                variant={formMode === 'link' ? 'default' : 'outline'}
                onClick={() => setFormMode('link')}
                className="gap-1"
              >
                <Link2 className="h-3 w-3" /> Enlace
              </Button>
            </div>

            <div>
              <Label htmlFor="doc_nombre">Nombre *</Label>
              <Input
                id="doc_nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Manual del empleado"
              />
            </div>

            <div>
              <Label htmlFor="doc_desc">Descripción</Label>
              <Input
                id="doc_desc"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción breve (opcional)"
              />
            </div>

            {formMode === 'file' ? (
              <div>
                <Label htmlFor="doc_file">Archivo (PDF, DOC)</Label>
                <Input
                  id="doc_file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="doc_url">URL</Label>
                <Input
                  id="doc_url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No hay documentos de onboarding configurados
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                {tipoIcon(doc.tipo)}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{doc.nombre}</p>
                  {doc.descripcion && (
                    <p className="text-xs text-muted-foreground truncate">{doc.descripcion}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
