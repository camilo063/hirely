-- Add missing firma columns for SignWell integration
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS firma_pdf_url TEXT;
