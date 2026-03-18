'use client';

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AplicacionConCandidato } from '@/lib/types/candidato.types';
import { EstadoAplicacion } from '@/lib/types/common.types';
import { PIPELINE_STAGES } from '@/lib/utils/constants';
import { ScoreBadge } from './score-badge';
import { Badge } from '@/components/ui/badge';
import { Linkedin, FileCheck, FileText, UserCheck, Calendar } from 'lucide-react';

interface PipelineKanbanProps {
  aplicaciones: AplicacionConCandidato[];
  onMoveAplicacion: (aplicacionId: string, nuevoEstado: EstadoAplicacion) => void;
  onClickAplicacion?: (aplicacion: AplicacionConCandidato) => void;
}

function KanbanCard({ aplicacion, onClick }: { aplicacion: AplicacionConCandidato; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: aplicacion.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-navy truncate">
            {aplicacion.candidato.nombre} {aplicacion.candidato.apellido}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{aplicacion.candidato.email}</p>
        </div>
        {aplicacion.score_ats !== null && (
          <ScoreBadge score={Number(aplicacion.score_ats)} size="sm" />
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {aplicacion.candidato.fuente === 'linkedin' && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-[#0A66C2] bg-[#0A66C2]/5 px-1.5 py-0.5 rounded">
            <Linkedin className="h-2.5 w-2.5" /> LinkedIn
          </span>
        )}
        {aplicacion.score_final !== null && (
          <ScoreBadge score={Number(aplicacion.score_final)} label="Final" size="sm" />
        )}
      </div>
      {aplicacion.estado === EstadoAplicacion.SELECCIONADO && (
        <div className="mt-2">
          <Badge className={`text-[10px] gap-1 ${
            (aplicacion as any).documentos_completos
              ? 'bg-success/15 text-success'
              : 'bg-blue-50 text-blue-600'
          }`}>
            {(aplicacion as any).documentos_completos
              ? <><FileCheck className="h-2.5 w-2.5" /> Docs completos</>
              : <><FileText className="h-2.5 w-2.5" /> Docs pendientes</>
            }
          </Badge>
        </div>
      )}
      {aplicacion.estado === EstadoAplicacion.CONTRATADO && (
        <div className="mt-2 flex items-center gap-1">
          <Badge className="text-[10px] gap-1 bg-success/15 text-success">
            <UserCheck className="h-2.5 w-2.5" /> Contratado
          </Badge>
          {(aplicacion as any).fecha_inicio_tentativa && (
            <Badge variant="outline" className="text-[10px] gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {new Date((aplicacion as any).fecha_inicio_tentativa + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </Badge>
          )}
        </div>
      )}
      {aplicacion.candidato.habilidades && (aplicacion.candidato.habilidades as string[]).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(aplicacion.candidato.habilidades as string[]).slice(0, 3).map((h) => (
            <span key={h} className="text-[10px] bg-soft-gray px-1.5 py-0.5 rounded">
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PipelineKanban({ aplicaciones, onMoveAplicacion, onClickAplicacion }: PipelineKanbanProps) {
  const columns = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    aplicaciones: aplicaciones.filter((a) => a.estado === stage.id),
  }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine target column from over.id
    const targetColumn = columns.find((col) =>
      col.aplicaciones.some((a) => a.id === over.id)
    );
    if (targetColumn) {
      onMoveAplicacion(String(active.id), targetColumn.id);
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2" style={{ minHeight: '400px' }}>
        {columns.map((column) => (
          <div key={column.id} className="min-w-[270px] max-w-[310px] w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
              <h3 className="text-sm font-semibold text-navy">{column.label}</h3>
              <span className="text-xs bg-soft-gray px-2 py-0.5 rounded-full text-muted-foreground">
                {column.aplicaciones.length}
              </span>
            </div>
            <div className="bg-soft-gray/50 rounded-xl p-2 min-h-[350px] space-y-2">
              <SortableContext
                items={column.aplicaciones.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.aplicaciones.map((app) => (
                  <KanbanCard
                    key={app.id}
                    aplicacion={app}
                    onClick={() => onClickAplicacion?.(app)}
                  />
                ))}
              </SortableContext>
              {column.aplicaciones.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Sin candidatos</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
