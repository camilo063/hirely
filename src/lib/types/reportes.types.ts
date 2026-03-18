export interface KPIsGenerales {
  vacantesActivas: number;
  vacantasCerradas30d: number;
  totalCandidatos: number;
  totalAplicaciones: number;
  totalContratados: number;
  aplicaciones90d: number;
  contratados90d: number;
  tasaConversionGlobal: number;
  scoreAtsPromedio: number | null;
  scoreIaPromedio: number | null;
  scoreHumanoPromedio: number | null;
  scoreTecnicoPromedio: number | null;
  scoreFinalPromedio: number | null;
  entrevistasIaCompletadas: number;
  entrevistasHumanasCompletadas: number;
  contratosFirmados: number;
}

export interface FunnelEtapa {
  etapa: string;
  key: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

export interface FunnelData {
  etapas: FunnelEtapa[];
  totalAplicaciones: number;
  porVacante?: {
    vacanteId: string;
    vacanteTitulo: string;
  };
}

export interface TiemposPorEtapa {
  diasAplicacionAEntrevistaIa: number | null;
  diasEntrevistaIaAHumana: number | null;
  diasHumanaAEvaluacion: number | null;
  diasTotalContratacion: number | null;
}

export interface VolumenSemana {
  semana: string;
  semanaLabel: string;
  totalAplicaciones: number;
  contratados: number;
  descartados: number;
}

export interface TopVacante {
  vacanteId: string;
  titulo: string;
  totalAplicaciones: number;
  contratados: number;
  tasaConversion: number;
  scorePromedio: number | null;
  diasAbierta: number;
}

export interface FiltrosReporte {
  desde?: string;
  hasta?: string;
  vacanteId?: string;
  periodo?: '7d' | '30d' | '90d' | '180d' | '365d' | 'custom';
}
