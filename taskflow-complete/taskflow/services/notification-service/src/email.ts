import { createLogger } from "@taskflow/utils";

const logger = createLogger("notification-service:email");

/**
 * Email provider interface.
 * Implement this to plug in SendGrid, SES, Postmark, etc.
 */
export interface EmailProvider {
  send(options: EmailOptions): Promise<void>;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Console email provider — logs emails instead of sending them.
 * Used in development.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<void> {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        textPreview: options.text?.slice(0, 100),
      },
      "[DEV] Email would be sent"
    );
  }
}

/**
 * Email template renderer.
 * In production, swap with a proper template engine (handlebars, mjml, etc.)
 */
export function renderEmail(
  template: string,
  data: Record<string, string>
): { html: string; text: string } {
  let html = template;
  let text = template;

  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
    text = text.replaceAll(`{{${key}}}`, value);
  }

  return { html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Email Templates ────────────────────────────────────────

export const EMAIL_TEMPLATES = {
  INVITE: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to {{tenantName}}</h2>
      <p>{{inviterName}} has invited you to join their workspace as a {{role}}.</p>
      <p>Use the following invite code to join:</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; font-size: 18px; font-family: monospace;">
        {{inviteCode}}
      </div>
      <p style="margin-top: 24px;">
        <a href="{{joinUrl}}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Join Workspace
        </a>
      </p>
    </div>
  `,

  TASK_ASSIGNED: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Task assigned to you</h2>
      <p>{{assignerName}} assigned you to "{{taskTitle}}" in {{projectName}}.</p>
      <p>
        <a href="{{taskUrl}}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Task
        </a>
      </p>
    </div>
  `,

  COMMENT_ADDED: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New comment on "{{taskTitle}}"</h2>
      <p>{{commenterName}} commented:</p>
      <blockquote style="border-left: 4px solid #6366f1; padding-left: 16px; color: #4b5563;">
        {{commentPreview}}
      </blockquote>
      <p>
        <a href="{{taskUrl}}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Task
        </a>
      </p>
    </div>
  `,
} as const;

// ─── Singleton email provider ───────────────────────────────
let emailProvider: EmailProvider = new ConsoleEmailProvider();

export function setEmailProvider(provider: EmailProvider): void {
  emailProvider = provider;
}

export function getEmailProvider(): EmailProvider {
  return emailProvider;
}
