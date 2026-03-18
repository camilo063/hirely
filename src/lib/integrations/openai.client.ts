/**
 * OpenAI Client - placeholder implementation.
 * Used for CV parsing and AI-assisted text analysis.
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class OpenAIClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  async chat(messages: ChatMessage[], model: string = 'gpt-4'): Promise<ChatResponse> {
    // TODO: Implement OpenAI API call
    console.log('[OpenAI] Chat request with model:', model);
    return {
      content: 'Respuesta simulada de OpenAI',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };
  }

  async parseCv(cvText: string): Promise<Record<string, unknown>> {
    // TODO: Implement real CV parsing with OpenAI
    console.log('[OpenAI] Parsing CV, length:', cvText.length);
    return {
      nombre: 'Nombre Extraido',
      email: 'extraido@email.com',
      experiencia: [],
      educacion: [],
      habilidades: [],
    };
  }

  async generateJobDescription(params: {
    titulo: string;
    departamento: string;
    habilidades: string[];
  }): Promise<string> {
    console.log('[OpenAI] Generating job description for:', params.titulo);
    return `Descripcion generada para ${params.titulo} en ${params.departamento}.`;
  }
}
