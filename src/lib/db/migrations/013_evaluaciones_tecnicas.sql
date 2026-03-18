-- =====================================================
-- BANCO DE PREGUNTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS preguntas_banco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Clasificación
  categoria VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100),
  tipo VARCHAR(50) NOT NULL DEFAULT 'opcion_multiple',
  dificultad VARCHAR(20) NOT NULL DEFAULT 'intermedio',

  -- Contenido de la pregunta
  enunciado TEXT NOT NULL,
  opciones JSONB,
  respuesta_correcta TEXT,
  explicacion TEXT,
  puntos INTEGER NOT NULL DEFAULT 10,
  tiempo_estimado_segundos INTEGER DEFAULT 120,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  es_estandar BOOLEAN NOT NULL DEFAULT false,
  cargos_aplicables TEXT[] DEFAULT '{}',
  idioma VARCHAR(10) DEFAULT 'es',

  -- Estado y auditoría
  estado VARCHAR(20) NOT NULL DEFAULT 'activa',
  creado_por UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_org ON preguntas_banco(organization_id);
CREATE INDEX IF NOT EXISTS idx_preguntas_categoria ON preguntas_banco(categoria);
CREATE INDEX IF NOT EXISTS idx_preguntas_dificultad ON preguntas_banco(dificultad);
CREATE INDEX IF NOT EXISTS idx_preguntas_tipo ON preguntas_banco(tipo);
CREATE INDEX IF NOT EXISTS idx_preguntas_tags ON preguntas_banco USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_preguntas_cargos ON preguntas_banco USING GIN(cargos_aplicables);

-- =====================================================
-- PLANTILLAS DE EVALUACIÓN
-- =====================================================
CREATE TABLE IF NOT EXISTS evaluacion_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,

  duracion_minutos INTEGER NOT NULL DEFAULT 60,
  puntaje_total INTEGER NOT NULL DEFAULT 100,
  puntaje_aprobatorio INTEGER NOT NULL DEFAULT 70,
  aleatorizar_preguntas BOOLEAN DEFAULT true,
  mostrar_resultados_al_candidato BOOLEAN DEFAULT false,

  estructura JSONB NOT NULL DEFAULT '[]',

  cargos_sugeridos TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  estado VARCHAR(20) NOT NULL DEFAULT 'activa',

  creado_por UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EVALUACIONES ASIGNADAS A CANDIDATOS
-- =====================================================
CREATE TABLE IF NOT EXISTS evaluaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  aplicacion_id UUID NOT NULL REFERENCES aplicaciones(id),
  candidato_id UUID NOT NULL REFERENCES candidatos(id),
  vacante_id UUID NOT NULL REFERENCES vacantes(id),
  plantilla_id UUID REFERENCES evaluacion_plantillas(id),

  titulo VARCHAR(200) NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 60,
  puntaje_total INTEGER NOT NULL DEFAULT 100,
  puntaje_aprobatorio INTEGER NOT NULL DEFAULT 70,

  preguntas JSONB NOT NULL DEFAULT '[]',

  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',

  respuestas JSONB DEFAULT '[]',

  score_total NUMERIC(5,2),
  score_detalle JSONB,
  aprobada BOOLEAN,

  token_acceso VARCHAR(64) UNIQUE NOT NULL,
  token_expira_at TIMESTAMP WITH TIME ZONE,

  enviada_at TIMESTAMP WITH TIME ZONE,
  iniciada_at TIMESTAMP WITH TIME ZONE,
  completada_at TIMESTAMP WITH TIME ZONE,

  asignado_por UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_aplicacion ON evaluaciones(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_candidato ON evaluaciones(candidato_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_vacante ON evaluaciones(vacante_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_estado ON evaluaciones(estado);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_token ON evaluaciones(token_acceso);

-- =====================================================
-- AGREGAR score_tecnico A APLICACIONES
-- =====================================================
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS score_tecnico NUMERIC(5,2);
ALTER TABLE aplicaciones ADD COLUMN IF NOT EXISTS evaluacion_tecnica_id UUID REFERENCES evaluaciones(id);
