/**
 * Cliente para Claude API (Anthropic).
 * Usado para:
 * 1. Parsear CVs en PDF -> datos estructurados
 * 2. Analisis inteligente de matching candidato-vacante
 *
 * Usa claude-sonnet-4-20250514 para balance costo/calidad.
 * anthropic-version: 2024-10-22 para soporte de type:"document" (PDFs nativos).
 */

interface AnthropicConfig {
  apiKey: string;
  model: string;
  apiVersion: string;
  betaFeatures: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'document';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicResponse {
  id: string;
  content: { type: string; text: string }[];
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicClient {
  private config: AnthropicConfig;

  constructor(config?: Partial<AnthropicConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY || '',
      model: config?.model || 'claude-sonnet-4-20250514',
      apiVersion: config?.apiVersion || '2023-06-01',
      betaFeatures: config?.betaFeatures || 'pdfs-2024-09-25',
    };
  }

  async complete(
    systemPrompt: string,
    messages: AnthropicMessage[],
    options?: { maxTokens?: number; temperature?: number; useBeta?: boolean }
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.config.apiVersion,
    };
    if (options?.useBeta && this.config.betaFeatures) {
      headers['anthropic-beta'] = this.config.betaFeatures;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data: AnthropicResponse = await response.json();
    return data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }

  /**
   * Envia un PDF como documento nativo a Claude.
   * Requiere anthropic-version >= 2024-10-22.
   */
  async parseDocument(
    pdfBase64: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    return this.complete(systemPrompt, [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ], { useBeta: true });
  }

  /**
   * Envia texto plano extraido de un PDF (fallback si document type falla).
   */
  async parseDocumentText(
    pdfText: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    return this.complete(systemPrompt, [
      {
        role: 'user',
        content: `${userPrompt}\n\nContenido del CV:\n\n${pdfText}`,
      },
    ]);
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }
}

export function createAnthropicClient(): AnthropicClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new AnthropicClient();
}
