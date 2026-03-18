-- Hirely: Scoring & Entrevistas Tables

-- Entrevistas IA (Dapta)
CREATE TABLE IF NOT EXISTS entrevistas_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id),
  dapta_call_id VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'pendiente',
  transcripcion TEXT,
  analisis JSONB DEFAULT '{}',
  score_total NUMERIC(5,2),
  duracion_segundos INTEGER,
  fecha_llamada TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entrevistas Humanas
CREATE TABLE IF NOT EXISTS entrevistas_humanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id),
  entrevistador_id UUID REFERENCES users(id),
  fecha_programada TIMESTAMPTZ,
  fecha_realizada TIMESTAMPTZ,
  estado VARCHAR(50) DEFAULT 'pendiente',
  evaluacion JSONB DEFAULT '{}',
  score_total NUMERIC(5,2),
  observaciones TEXT,
  calendar_event_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos del candidato
CREATE TABLE IF NOT EXISTS documentos_candidato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacion_id UUID REFERENCES aplicaciones(id),
  tipo VARCHAR(100) NOT NULL,
  nombre_archivo VARCHAR(255),
  url TEXT NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
