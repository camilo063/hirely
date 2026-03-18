/**
 * Cliente para Dapta AI Voice Agent.
 *
 * Dapta API format (verified working):
 *   POST https://api.dapta.ai/api/{org_id}/hacer_llamada?x-api-key={key}
 *   Body: { "telefono": "+573112223344", "nombre": "nicolas" }
 *   Response: { "response": "https://cloudfront.net/...response.json", "message": "..." }
 *
 * Key differences from generic webhook:
 * - API key goes as QUERY PARAM (?x-api-key=), NOT as header
 * - Body uses "telefono" and "nombre", NOT "to_number"/"candidato_nombre"
 * - Response returns a CloudFront URL with call results, NOT execution_id
 *
 * Flow:
 * 1. Hirely POSTs to Dapta API with telefono + nombre
 * 2. Dapta's flow initiates the AI call to the candidate
 * 3. When done, Dapta POSTs back to our webhook /api/webhooks/dapta
 *
 * Env vars:
 * - DAPTA_FLOW_WEBHOOK_URL: Dapta API endpoint (e.g. https://api.dapta.ai/api/{org}/hacer_llamada)
 * - DAPTA_API_KEY: API key (sent as ?x-api-key= query param)
 * - DAPTA_WEBHOOK_SECRET: Secret to verify incoming webhooks from Dapta
 * - DAPTA_FROM_NUMBER: Registered phone number in Dapta (optional)
 */

interface DaptaConfig {
  flowWebhookUrl: string;
  apiKey: string;
  webhookSecret: string;
  fromNumber: string;
}

interface TriggerCallResponse {
  success: boolean;
  execution_id?: string;
  response_url?: string;
  error?: string;
}

export class DaptaClient {
  private config: DaptaConfig;

  constructor(config?: Partial<DaptaConfig>) {
    this.config = {
      flowWebhookUrl: config?.flowWebhookUrl || process.env.DAPTA_FLOW_WEBHOOK_URL || process.env.DAPTA_API_URL || '',
      apiKey: config?.apiKey || process.env.DAPTA_API_KEY || '',
      webhookSecret: config?.webhookSecret || process.env.DAPTA_WEBHOOK_SECRET || '',
      fromNumber: config?.fromNumber || process.env.DAPTA_FROM_NUMBER || '',
    };
  }

  /**
   * Build the full URL with API key as query parameter.
   * Dapta expects: ?x-api-key=<key>
   */
  private buildUrl(): string {
    const base = this.config.flowWebhookUrl;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}x-api-key=${this.config.apiKey}`;
  }

  /**
   * Trigger an AI interview call via Dapta.
   *
   * The Dapta "hacer_llamada" API expects { telefono, nombre } in the body.
   * Additional params (vacante, preguntas, etc.) are passed through for flows
   * that support them — the Dapta flow decides which params to use.
   */
  async triggerInterviewCall(params: {
    candidatoTelefono: string;
    candidatoNombre: string;
    vacanteTitulo?: string;
    empresaNombre?: string;
    preguntas?: string[];
    idioma?: string;
    maxDuracionMinutos?: number;
    contextoAdicional?: string;
    aplicacionId?: string;
    entrevistaId?: string;
    callbackUrl?: string;
  }): Promise<TriggerCallResponse> {
    try {
      const url = this.buildUrl();

      // Core params that Dapta's hacer_llamada expects
      const body: Record<string, unknown> = {
        telefono: params.candidatoTelefono,
        nombre: params.candidatoNombre,
      };

      // Additional params — Dapta flow may or may not use these
      if (params.vacanteTitulo) body.vacante = params.vacanteTitulo;
      if (params.empresaNombre) body.empresa = params.empresaNombre;
      if (params.preguntas?.length) body.preguntas = params.preguntas.join('\n');
      if (params.idioma) body.idioma = params.idioma;
      if (params.maxDuracionMinutos) body.max_duracion = params.maxDuracionMinutos;
      if (params.contextoAdicional) body.contexto = params.contextoAdicional;
      if (params.entrevistaId) body.entrevista_id = params.entrevistaId;
      if (params.aplicacionId) body.aplicacion_id = params.aplicacionId;
      if (params.callbackUrl) body.callback_url = params.callbackUrl;

      console.log(`[Dapta] POST ${this.config.flowWebhookUrl}`);
      console.log(`[Dapta] Body:`, JSON.stringify(body));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log(`[Dapta] Response: HTTP ${response.status} — ${responseText.substring(0, 300)}`);

      if (!response.ok) {
        return { success: false, error: `Dapta API error: ${response.status} - ${responseText}` };
      }

      let data: any = {};
      try { data = JSON.parse(responseText); } catch { /* text response */ }

      // Dapta returns { response: "cloudfront_url", message: "..." }
      // Extract call ID from the CloudFront response URL if available
      const responseUrl = data.response || '';
      const callId = this.extractCallId(responseUrl) || data.execution_id || data.id || `dapta-${Date.now()}`;

      return {
        success: true,
        execution_id: callId,
        response_url: responseUrl || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error conectando con Dapta: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Extract call ID from Dapta CloudFront response URL.
   * URL format: https://xxx.cloudfront.net/{org}/{date}/{api}/{call_id}:response.json
   */
  private extractCallId(url: string): string | null {
    if (!url) return null;
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1]; // e.g. "e6295aa0-...:response.json"
      if (last.includes(':')) {
        return last.split(':')[0]; // UUID before ":response.json"
      }
      return last;
    } catch {
      return null;
    }
  }

  verifyWebhook(headers: Headers): boolean {
    if (!this.config.webhookSecret) return true;
    const secret = headers.get('x-webhook-secret') || headers.get('x-dapta-secret') || '';
    return secret === this.config.webhookSecret;
  }

  isConfigured(): boolean {
    return !!(this.config.flowWebhookUrl && this.config.apiKey);
  }
}

export function createDaptaClient(): DaptaClient | null {
  if (!process.env.DAPTA_FLOW_WEBHOOK_URL && !process.env.DAPTA_API_URL) return null;
  return new DaptaClient();
}
