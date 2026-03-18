/**
 * SendGrid Client - placeholder implementation.
 * Handles transactional email sending.
 */

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

interface TemplateEmailParams {
  to: string;
  templateId: string;
  dynamicData: Record<string, string>;
}

export class SendGridClient {
  private apiKey: string;
  private defaultFrom: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@hirely.app';
  }

  async send(params: EmailParams): Promise<boolean> {
    // TODO: Implement SendGrid API
    console.log(`[SendGrid] Sending email to ${params.to}: ${params.subject}`);
    return true;
  }

  async sendTemplate(params: TemplateEmailParams): Promise<boolean> {
    console.log(`[SendGrid] Sending template ${params.templateId} to ${params.to}`);
    return true;
  }

  async sendBatch(emails: EmailParams[]): Promise<boolean> {
    console.log(`[SendGrid] Sending batch of ${emails.length} emails`);
    return true;
  }
}
