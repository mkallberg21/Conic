import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Thin email abstraction that talks to SendGrid's Web API v3.
 * Swap the provider by changing SENDGRID_API_KEY for SES or Postmark.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('email.sendgridApiKey');
    this.from = this.config.get<string>('email.fromAddress', 'noreply@conic.io');
  }

  async send(options: SendEmailOptions): Promise<void> {
    const payload = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: options.from ?? this.from, name: 'Conic Platform' },
      subject: options.subject,
      content: [
        ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
        { type: 'text/html', value: options.html },
      ],
    };

    try {
      await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}`, err?.message);
      throw err;
    }
  }

  // ── Transactional helpers ─────────────────────────────────────────────────

  async sendEmailVerification(to: string, token: string, firstName: string): Promise<void> {
    const verifyUrl = `${this.config.get('app.frontendUrl')}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Verify your Conic account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#6366f1">Welcome to Conic, ${firstName}!</h2>
          <p>Click the button below to verify your email address. The link expires in 24 hours.</p>
          <a href="${verifyUrl}"
             style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;
                    border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Verify Email
          </a>
          <p style="color:#64748b;font-size:12px">
            If you didn't create a Conic account, you can safely ignore this email.
          </p>
        </div>`,
    });
  }

  async sendPasswordReset(to: string, token: string, firstName: string): Promise<void> {
    const resetUrl = `${this.config.get('app.frontendUrl')}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Reset your Conic password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#6366f1">Password reset</h2>
          <p>Hi ${firstName}, click below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;
                    border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#64748b;font-size:12px">
            If you didn't request this, please ignore the email.
          </p>
        </div>`,
    });
  }

  async sendContractReady(to: string, params: { firstName: string; contractTitle: string; contractId: string }): Promise<void> {
    const contractUrl = `${this.config.get('app.frontendUrl')}/contracts/${params.contractId}`;
    await this.send({
      to,
      subject: `Contract ready to sign: ${params.contractTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#6366f1">Contract ready for your signature</h2>
          <p>Hi ${params.firstName},</p>
          <p><strong>${params.contractTitle}</strong> is ready for your review and signature.</p>
          <a href="${contractUrl}"
             style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;
                    border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Review &amp; Sign
          </a>
        </div>`,
    });
  }

  async sendDeliverableApproved(to: string, params: { firstName: string; deliverableTitle: string; amount: number }): Promise<void> {
    await this.send({
      to,
      subject: `Deliverable approved — payment incoming`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#10b981">Deliverable approved! 🎉</h2>
          <p>Hi ${params.firstName},</p>
          <p>Your deliverable <strong>${params.deliverableTitle}</strong> has been approved.</p>
          <p>Payment of <strong>$${(params.amount / 100).toLocaleString()}</strong> will be
             sent to your account within 5 business days via ACH.</p>
        </div>`,
    });
  }

  async sendPaymentReceived(to: string, params: { firstName: string; amount: number; contractTitle: string }): Promise<void> {
    await this.send({
      to,
      subject: `Payment received: $${(params.amount / 100).toLocaleString()}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#10b981">Payment received</h2>
          <p>Hi ${params.firstName},</p>
          <p>You've received a payment of <strong>$${(params.amount / 100).toLocaleString()}</strong>
             for <strong>${params.contractTitle}</strong>.</p>
          <p>The funds will appear in your account within 1–3 business days.</p>
        </div>`,
    });
  }
}
