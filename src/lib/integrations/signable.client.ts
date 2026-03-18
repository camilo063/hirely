/**
 * Signable Client - placeholder implementation.
 * Alternative electronic signature provider.
 */

interface SignableDocumentParams {
  signerEmail: string;
  signerName: string;
  documentHtml: string;
  title: string;
}

interface SignableResult {
  documentId: string;
  status: string;
  signingUrl: string;
}

export class SignableClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SIGNABLE_API_KEY || '';
  }

  async sendDocument(params: SignableDocumentParams): Promise<SignableResult> {
    console.log('[Signable] Sending document to:', params.signerEmail);
    return {
      documentId: `sig_${Date.now()}`,
      status: 'pending',
      signingUrl: `https://app.signable.co.uk/sign/mock-${Date.now()}`,
    };
  }

  async getStatus(documentId: string): Promise<{ status: string; signedAt?: string }> {
    console.log('[Signable] Checking status:', documentId);
    return { status: 'pending' };
  }

  async cancelDocument(documentId: string): Promise<boolean> {
    console.log('[Signable] Cancelling document:', documentId);
    return true;
  }
}
