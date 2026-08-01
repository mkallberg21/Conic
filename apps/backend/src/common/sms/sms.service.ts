import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Provider-gated SMS sender.
 *
 * When TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are set
 * (config `sms.provider === 'twilio'`) messages go out over Twilio's REST API.
 * Otherwise the message is logged and NOT sent — the phone-verification flow
 * still works end-to-end in development without leaking codes to the API caller.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly fromNumber?: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('sms.provider', 'log');
    this.accountSid = this.config.get<string>('sms.twilioAccountSid');
    this.authToken = this.config.get<string>('sms.twilioAuthToken');
    this.fromNumber = this.config.get<string>('sms.fromNumber');
  }

  /** True when a real SMS provider is configured. */
  get isLive(): boolean {
    return (
      this.provider === 'twilio' &&
      !!this.accountSid &&
      !!this.authToken &&
      !!this.fromNumber
    );
  }

  async send(to: string, body: string): Promise<void> {
    if (!this.isLive) {
      // Dev / unconfigured: log so the flow is testable, but never expose the
      // code to the HTTP response.
      this.logger.warn(`[SMS suppressed — no provider] to=${to} body="${body}"`);
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: this.fromNumber!, Body: body });

    try {
      await axios.post(url, form.toString(), {
        auth: { username: this.accountSid!, password: this.authToken! },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      });
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}`, (err as Error)?.message);
      throw err;
    }
  }
}
