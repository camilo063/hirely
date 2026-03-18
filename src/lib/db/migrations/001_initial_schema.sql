-- Hirely: Initial Schema
-- Multi-tenant SaaS recruitment platform

-- Organizaciones (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'starter',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'recruiter',
  password_hash TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacantes
CREATE TABLE IF NOT EXISTS vacantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES users(id),
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  habilidades_requeridas JSONB DEFAULT '[]',
  experiencia_minima INTEGER DEFAULT 0,
  nivel_estudios VARCHAR(100),
  rango_salarial_min NUMERIC(12,2),
  rango_salarial_max NUMERIC(12,2),
  moneda VARCHAR(3) DEFAULT 'COP',
  modalidad VARCHAR(50) DEFAULT 'remoto',
  tipo_contrato VARCHAR(50),
  ubicacion VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'borrador',
  linkedin_job_id VARCHAR(255),
  criterios_evaluacion JSONB DEFAULT '{}',
  score_minimo INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidatos (banco de talento)
CREATE TABLE IF NOT EXISTS candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  linkedin_url TEXT,
  cv_url TEXT,
  cv_parsed JSONB DEFAULT '{}',
  habilidades JSONB DEFAULT '[]',
  experiencia_anos INTEGER,
  nivel_educativo VARCHAR(100),
  idiomas JSONB DEFAULT '[]',
  certificaciones JSONB DEFAULT '[]',
  ubicacion VARCHAR(255),
  tags JSONB DEFAULT '[]',
  fuente VARCHAR(100) DEFAULT 'linkedin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Relacion Vacante-Candidato (pipeline)
CREATE TABLE IF NOT EXISTS aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vacante_id UUID REFERENCES vacantes(id),
  candidato_id UUID REFERENCES candidatos(id),
  estado VARCHAR(50) DEFAULT 'nuevo',
  score_ats NUMERIC(5,2),
  score_ia NUMERIC(5,2),
  score_humano NUMERIC(5,2),
  score_final NUMERIC(5,2),
  peso_ia NUMERIC(3,2) DEFAULT 0.50,
  peso_humano NUMERIC(3,2) DEFAULT 0.50,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vacante_id, candidato_id)
);
