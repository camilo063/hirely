'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Upload, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface AplicacionFormProps {
  slug: string;
  vacanteTitulo: string;
  empresaNombre: string;
  habilidadesSugeridas: string[];
}

const EXPERIENCIA_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: '0', label: 'Sin experiencia' },
  { value: '1', label: '1 ano' },
  { value: '2', label: '1-3 anos' },
  { value: '4', label: '3-5 anos' },
  { value: '7', label: '5-10 anos' },
  { value: '11', label: '10+ anos' },
];

const NIVEL_EDUCATIVO_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'Bachiller', label: 'Bachiller' },
  { value: 'Tecnico', label: 'Tecnico' },
  { value: 'Tecnologo', label: 'Tecnologo' },
  { value: 'Profesional', label: 'Profesional' },
  { value: 'Especializacion', label: 'Especializacion' },
  { value: 'Maestria', label: 'Maestria' },
  { value: 'Doctorado', label: 'Doctorado' },
];

const COMO_SE_ENTERO_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'referido', label: 'Referido' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'portal_empleo', label: 'Portal de empleo' },
  { value: 'otro', label: 'Otro' },
];

export function AplicacionForm({
  slug,
  vacanteTitulo,
  empresaNombre,
  habilidadesSugeridas,
}: AplicacionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [habilidadInput, setHabilidadInput] = useState('');
  const [carta, setCarta] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`aplicacion_${slug}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const form = document.querySelector('form') as HTMLFormElement;
        if (form) {
          ['nombre', 'email', 'telefono', 'ubicacion', 'linkedin_url'].forEach(field => {
            const input = form.elements.namedItem(field) as HTMLInputElement;
            if (input && data[field]) input.value = data[field];
          });
          if (data.nombre) setNombre(data.nombre);
          if (data.habilidades) setHabilidades(data.habilidades);
          if (data.carta_presentacion) setCarta(data.carta_presentacion);
        }
      } catch { /* ignore */ }
    }
  }, [slug]);

  function saveToLocal(form: HTMLFormElement) {
    const data: Record<string, unknown> = {};
    ['nombre', 'email', 'telefono', 'ubicacion', 'linkedin_url'].forEach(field => {
      const input = form.elements.namedItem(field) as HTMLInputElement;
      if (input) data[field] = input.value;
    });
    data.habilidades = habilidades;
    data.carta_presentacion = carta;
    localStorage.setItem(`aplicacion_${slug}`, JSON.stringify(data));
  }

  function addHabilidad(h: string) {
    const trimmed = h.trim();
    if (trimmed && !habilidades.includes(trimmed)) {
      setHabilidades([...habilidades, trimmed]);
    }
    setHabilidadInput('');
  }

  function removeHabilidad(h: string) {
    setHabilidades(habilidades.filter(x => x !== h));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Add arrays as JSON
    formData.set('habilidades', JSON.stringify(habilidades));

    // Add CV file
    if (cvFile) {
      formData.set('cv', cvFile);
    }

    try {
      const res = await fetch(`/api/portal/aplicar/${slug}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        localStorage.removeItem(`aplicacion_${slug}`);
      } else {
        setError(data.error || 'Error al enviar la postulacion');
      }
    } catch {
      setError('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mx-auto">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-navy">
            {nombre ? `Gracias, ${nombre}!` : 'Gracias!'}
          </h3>
          <p className="text-muted-foreground mt-1">
            Tu postulacion para <strong>{vacanteTitulo}</strong> en <strong>{empresaNombre}</strong> ha sido recibida.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Revisaremos tu perfil y te contactaremos pronto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onChange={(e) => saveToLocal(e.currentTarget)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Section 1: Personal data */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Datos personales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              name="nombre"
              required
              placeholder="Tu nombre completo"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Telefono *</Label>
            <Input id="telefono" name="telefono" type="tel" required placeholder="+57 300 123 4567" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ubicacion">Ciudad / Ubicacion</Label>
            <Input id="ubicacion" name="ubicacion" placeholder="Ej: Bogota, Colombia" />
          </div>
        </div>
      </div>

      {/* Section 2: Professional profile */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Perfil profesional</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="experiencia_anos">Anos de experiencia</Label>
            <select
              id="experiencia_anos"
              name="experiencia_anos"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {EXPERIENCIA_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nivel_educativo">Nivel de estudios</Label>
            <select
              id="nivel_educativo"
              name="nivel_educativo"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {NIVEL_EDUCATIVO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-1.5">
          <Label>Habilidades principales</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {habilidades.map(h => (
              <Badge key={h} variant="secondary" className="bg-teal/10 text-teal gap-1 pr-1">
                {h}
                <button type="button" onClick={() => removeHabilidad(h)} className="ml-1 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={habilidadInput}
              onChange={(e) => setHabilidadInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addHabilidad(habilidadInput); }
              }}
              placeholder="Escribe una habilidad y presiona Enter"
              className="flex-1"
            />
          </div>
          {habilidadesSugeridas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs text-muted-foreground">Sugeridas:</span>
              {habilidadesSugeridas.filter(h => !habilidades.includes(h)).slice(0, 8).map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => addHabilidad(h)}
                  className="text-xs px-2 py-0.5 rounded-full border border-dashed border-teal/40 text-teal hover:bg-teal/10 transition-colors"
                >
                  + {h}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="linkedin_url">LinkedIn</Label>
          <Input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/tu-perfil" />
        </div>
      </div>

      {/* Section 3: CV Upload */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Documentos</h3>
        <div className="space-y-1.5">
          <Label>Hoja de vida / CV *</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 10 * 1024 * 1024) {
                  setError('El archivo no puede superar 10MB');
                  return;
                }
                setCvFile(file);
                setError(null);
              }
            }}
          />
          {cvFile ? (
            <div className="flex items-center gap-3 p-3 bg-teal/5 border border-teal/20 rounded-lg">
              <Upload className="h-5 w-5 text-teal" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cvFile.name}</p>
                <p className="text-xs text-muted-foreground">{(cvFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => { setCvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-muted-foreground hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-teal hover:bg-teal/5 transition-colors text-sm text-muted-foreground"
            >
              <Upload className="h-5 w-5" />
              Seleccionar archivo (PDF o DOC, max 10MB)
            </button>
          )}
        </div>
      </div>

      {/* Section 4: Message */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Mensaje</h3>
        <div className="space-y-1.5">
          <Label htmlFor="carta_presentacion">Por que te interesa esta posicion?</Label>
          <textarea
            id="carta_presentacion"
            name="carta_presentacion"
            maxLength={500}
            rows={3}
            value={carta}
            onChange={(e) => setCarta(e.target.value)}
            placeholder="Cuentanos que te motiva de esta oportunidad..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground text-right">{carta.length}/500</p>
        </div>
      </div>

      {/* Section 5: Source */}
      <div className="space-y-1.5">
        <Label htmlFor="como_se_entero">Como te enteraste de esta vacante?</Label>
        <select
          id="como_se_entero"
          name="como_se_entero"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {COMO_SE_ENTERO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting || !cvFile}
        className="w-full bg-teal hover:bg-teal/90 text-white font-semibold py-3 h-auto text-base"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          'Enviar mi postulacion'
        )}
      </Button>

      {!cvFile && (
        <p className="text-xs text-center text-muted-foreground">
          Debes adjuntar tu hoja de vida para poder enviar la postulacion.
        </p>
      )}
    </form>
  );
}
