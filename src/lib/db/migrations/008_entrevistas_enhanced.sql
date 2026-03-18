-- Migration 008: Enhanced entrevistas columns for Dapta + scheduling

-- Entrevistas IA: recording and questions tracking
ALTER TABLE entrevistas_ia ADD COLUMN recording_url TEXT;
ALTER TABLE entrevistas_ia ADD COLUMN preguntas_usadas JSONB DEFAULT '[]';

-- Entrevistas Humanas: email invitation and scheduling
ALTER TABLE entrevistas_humanas ADD COLUMN email_invitacion_enviado BOOLEAN DEFAULT false;
ALTER TABLE entrevistas_humanas ADD COLUMN agendamiento_url TEXT;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_entrevistas_ia_aplicacion ON entrevistas_ia(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_ia_estado ON entrevistas_ia(estado);
CREATE INDEX IF NOT EXISTS idx_entrevistas_humanas_aplicacion ON entrevistas_humanas(aplicacion_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_humanas_entrevistador ON entrevistas_humanas(entrevistador_id);
