'use client';

import {
  forwardRef, useImperativeHandle, useRef, useEffect, useState,
} from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Heading2, Pilcrow,
  AlignLeft, AlignCenter, AlignRight, Code, Eye, Baseline,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RichTextEditorHandle {
  /** Inserta texto (p.ej. una variable {{...}}) en la posición del cursor. */
  insertAtCursor: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  minHeight?: number;
  placeholder?: string;
  /**
   * Aísla la edición dentro de un iframe e inyecta los bloques <style> del
   * contenido en su <head>. Úsalo para documentos con CSS global (p.ej.
   * plantillas de contrato con `<style>body{...}` y clases), de modo que el
   * documento se vea con su estilo real SIN filtrar ese CSS al resto de la app.
   */
  isolated?: boolean;
}

// Separa los bloques <style> del resto del HTML (para inyectarlos en el <head>
// del iframe y reensamblarlos al guardar).
function splitStyle(html: string): { style: string; body: string } {
  const styles: string[] = [];
  const body = html.replace(/<style[\s\S]*?<\/style>/gi, (m) => {
    styles.push(m);
    return '';
  });
  return { style: styles.join('\n'), body };
}

// Editor de texto enriquecido basado en contentEditable nativo. A diferencia de
// editores con esquema propio (Quill/Tiptap), preserva el HTML original tal cual,
// por lo que es seguro para plantillas de email/contrato con marca. Incluye modo
// "HTML" para edición avanzada y modo `isolated` (iframe) para documentos con CSS
// global.
export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  function RichTextEditor(
    { value, onChange, className, minHeight = 320, placeholder, isolated = false },
    ref,
  ) {
    const [mode, setMode] = useState<'visual' | 'html'>('visual');
    const divRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastValue = useRef<string>(value);
    const savedRange = useRef<Range | null>(null);
    const styleRef = useRef<string>('');

    // Refs a handlers "vivos" para poder engancharlos a los listeners del iframe
    // (que se recrean con cada re-seed) sin closures obsoletas.
    const emitRef = useRef<() => void>(() => {});
    const saveSelRef = useRef<() => void>(() => {});

    const getEditable = (): HTMLElement | null =>
      isolated ? (iframeRef.current?.contentDocument?.body ?? null) : divRef.current;
    const getDoc = (): Document | null =>
      isolated ? (iframeRef.current?.contentDocument ?? null) : (typeof document !== 'undefined' ? document : null);
    const getWin = (): Window | null =>
      isolated ? (iframeRef.current?.contentWindow ?? null) : (typeof window !== 'undefined' ? window : null);

    // Handlers vivos (se reasignan en cada render para capturar el último onChange).
    emitRef.current = () => {
      const el = getEditable();
      if (!el) return;
      const body = el.innerHTML;
      const full = isolated && styleRef.current ? `${styleRef.current}\n${body}` : body;
      lastValue.current = full;
      onChange(full);
    };
    saveSelRef.current = () => {
      const sel = getWin()?.getSelection?.();
      const el = getEditable();
      if (sel && sel.rangeCount > 0 && el && el.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0);
      }
    };

    const restoreSelection = () => {
      const sel = getWin()?.getSelection?.();
      if (savedRange.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
    };

    // Escribe el contenido en la superficie de edición.
    const seed = (html: string) => {
      if (isolated) {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        const { style, body } = splitStyle(html);
        styleRef.current = style;
        doc.open();
        doc.write(
          `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">${style}` +
          `<style>html,body{margin:0}body{padding:16px;outline:none}</style>` +
          `</head><body>${body}</body></html>`,
        );
        doc.close();
        doc.body.contentEditable = 'true';
        doc.body.addEventListener('input', () => emitRef.current());
        doc.body.addEventListener('keyup', () => saveSelRef.current());
        doc.body.addEventListener('mouseup', () => saveSelRef.current());
        doc.body.addEventListener('blur', () => { emitRef.current(); saveSelRef.current(); });
      } else if (divRef.current) {
        divRef.current.innerHTML = html;
      }
      lastValue.current = html;
    };

    // Siembra al montar y al volver a modo visual.
    useEffect(() => {
      if (mode === 'visual') seed(value);
      // Solo cuando cambia el modo (no en cada cambio de value).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // Aplica cambios externos de value (p.ej. "Restaurar default") sin pisar la
    // edición en curso.
    useEffect(() => {
      if (mode === 'visual' && value !== lastValue.current) seed(value);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, mode]);

    const exec = (command: string, arg?: string) => {
      getWin()?.focus();
      getEditable()?.focus();
      restoreSelection();
      getDoc()?.execCommand(command, false, arg);
      emitRef.current();
      saveSelRef.current();
    };

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        if (mode === 'html') {
          onChange(value + text);
          return;
        }
        getWin()?.focus();
        getEditable()?.focus();
        restoreSelection();
        getDoc()?.execCommand('insertText', false, text);
        emitRef.current();
        saveSelRef.current();
      },
    }));

    const ToolbarButton = ({
      onClick, title, children, active,
    }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
      <button
        type="button"
        title={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors',
          active && 'bg-muted',
        )}
      >
        {children}
      </button>
    );

    const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" />;

    return (
      <div className={cn('rounded-md border bg-background', className)}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
          {mode === 'visual' ? (
            <>
              <ToolbarButton title="Negrita" onClick={() => exec('bold')}><Bold className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Cursiva" onClick={() => exec('italic')}><Italic className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Subrayado" onClick={() => exec('underline')}><Underline className="h-4 w-4" /></ToolbarButton>
              <Divider />
              <ToolbarButton title="Título" onClick={() => exec('formatBlock', 'H2')}><Heading2 className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Párrafo" onClick={() => exec('formatBlock', 'P')}><Pilcrow className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Lista con viñetas" onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolbarButton>
              <Divider />
              <ToolbarButton title="Alinear a la izquierda" onClick={() => exec('justifyLeft')}><AlignLeft className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Centrar" onClick={() => exec('justifyCenter')}><AlignCenter className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton title="Alinear a la derecha" onClick={() => exec('justifyRight')}><AlignRight className="h-4 w-4" /></ToolbarButton>
              <Divider />
              <ToolbarButton
                title="Insertar enlace"
                onClick={() => {
                  const url = window.prompt('URL del enlace (incluye https://):');
                  if (url) exec('createLink', url);
                }}
              >
                <Link2 className="h-4 w-4" />
              </ToolbarButton>
              <label
                title="Color de texto"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded hover:bg-muted transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Baseline className="h-4 w-4" />
                <input
                  type="color"
                  className="sr-only"
                  onChange={(e) => exec('foreColor', e.target.value)}
                />
              </label>
            </>
          ) : (
            <span className="px-1.5 text-xs text-muted-foreground">Editando HTML sin formato</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarButton
              title={mode === 'visual' ? 'Editar HTML' : 'Editor visual'}
              active={mode === 'html'}
              onClick={() => setMode(mode === 'visual' ? 'html' : 'visual')}
            >
              {mode === 'visual' ? <Code className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </ToolbarButton>
          </div>
        </div>

        {/* Área de edición */}
        {mode === 'html' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="w-full resize-y bg-background p-4 font-mono text-xs focus:outline-none"
            style={{ minHeight }}
          />
        ) : isolated ? (
          <iframe
            ref={iframeRef}
            title="Editor de plantilla"
            className="w-full bg-white"
            style={{ height: minHeight, border: 0 }}
          />
        ) : (
          <div
            ref={divRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            data-placeholder={placeholder}
            onInput={() => emitRef.current()}
            onBlur={() => { emitRef.current(); saveSelRef.current(); }}
            onKeyUp={() => saveSelRef.current()}
            onMouseUp={() => saveSelRef.current()}
            className="overflow-y-auto p-4 text-sm leading-relaxed focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            style={{ minHeight }}
          />
        )}
      </div>
    );
  },
);
