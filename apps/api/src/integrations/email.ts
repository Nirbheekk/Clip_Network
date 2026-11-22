export type EmailTemplateKind =
  | 'VERIFY_EMAIL'
  | 'PASSWORD_RESET'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CANCELLED';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function isLiveEmailConfigured(): boolean {
  return Boolean(process.env['RESEND_API_KEY']?.trim());
}

export function renderBrandedEmail(
  kind: EmailTemplateKind,
  params: {
    recipientName?: string;
    actionUrl?: string;
    planName?: string;
    workspaceName?: string;
  },
): RenderedEmail {
  const name = params.recipientName ?? 'there';
  const wrapHtml = (headline: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string) => `
    <!doctype html>
    <html>
      <body style="margin:0;padding:32px;background:#09090B;color:#FAFAFA;font-family:Inter,Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;border:1px solid #27272A;border-radius:8px;background:#111114;padding:28px;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#D4FF00;margin-bottom:12px;">
            CLIP NETWORK
          </div>
          <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#FAFAFA;">${headline}</h1>
          <div style="font-size:14px;line-height:1.6;color:#A1A1AA;">${bodyHtml}</div>
          ${
            ctaLabel && ctaUrl
              ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;padding:10px 18px;background:#D4FF00;color:#09090B;text-decoration:none;font-weight:600;font-size:13px;border-radius:6px;">${ctaLabel}</a></div>`
              : ''
          }
          <div style="margin-top:28px;padding-top:16px;border-top:1px solid #27272A;font-size:11px;color:#71717A;">
            Clip Network — Creator-Content Distribution Operating System
          </div>
        </div>
      </body>
    </html>
  `;

  switch (kind) {
    case 'VERIFY_EMAIL':
      return {
        subject: 'Verify your Clip Network email address',
        html: wrapHtml(
          'Verify your email',
          `<p>Hi ${name},</p><p>Confirm your email address to activate production alerts and workspace governance for Clip Network.</p>`,
          'Verify Email',
          params.actionUrl,
        ),
        text: `Hi ${name},\n\nVerify your Clip Network email address: ${params.actionUrl ?? ''}\n`,
      };
    case 'PASSWORD_RESET':
      return {
        subject: 'Reset your Clip Network password',
        html: wrapHtml(
          'Password reset requested',
          `<p>Hi ${name},</p><p>We received a request to reset your password. This link expires in 60 minutes. If you did not request this, you can safely ignore this message.</p>`,
          'Reset Password',
          params.actionUrl,
        ),
        text: `Hi ${name},\n\nReset your Clip Network password (expires in 60 minutes): ${params.actionUrl ?? ''}\n`,
      };
    case 'SUBSCRIPTION_ACTIVATED':
      return {
        subject: `Clip Network ${params.planName ?? ''} plan activated`,
        html: wrapHtml(
          `${params.planName ?? 'Paid'} plan active`,
          `<p>Workspace <strong>${params.workspaceName ?? ''}</strong> has been upgraded to the <strong>${params.planName ?? ''}</strong> plan. Your updated monthly clip and creator quotas are active immediately.</p>`,
          'Open Billing',
          params.actionUrl,
        ),
        text: `Workspace ${params.workspaceName ?? ''} is now active on the ${params.planName ?? ''} plan.\n`,
      };
    case 'PAYMENT_FAILED':
      return {
        subject: 'Action required: Clip Network payment failed',
        html: wrapHtml(
          'Payment could not be processed',
          `<p>A recent invoice for <strong>${params.workspaceName ?? ''}</strong> failed. Update your payment method in Billing to avoid service interruption.</p>`,
          'Update Payment Method',
          params.actionUrl,
        ),
        text: `Payment failed for workspace ${params.workspaceName ?? ''}. Update your payment method: ${params.actionUrl ?? ''}\n`,
      };
    case 'SUBSCRIPTION_CANCELLED':
      return {
        subject: 'Clip Network subscription cancelled',
        html: wrapHtml(
          'Subscription cancelled',
          `<p>Your subscription for <strong>${params.workspaceName ?? ''}</strong> has been cancelled and reverted to the Free tier quota.</p>`,
        ),
        text: `Your subscription for ${params.workspaceName ?? ''} has been cancelled and reverted to Free.\n`,
      };
  }
}

/**
 * Dispatches transactional email via Resend REST API when RESEND_API_KEY is configured.
 * Never logs raw verification/reset tokens!
 */
export async function sendTransactionalEmail(params: {
  to: string;
  kind: EmailTemplateKind;
  recipientName?: string;
  actionUrl?: string;
  planName?: string;
  workspaceName?: string;
}): Promise<{ delivered: boolean; mode: 'RESEND_LIVE' | 'SANDBOX_LOG'; providerId?: string }> {
  const rendered = renderBrandedEmail(params.kind, params);
  const apiKey = process.env['RESEND_API_KEY']?.trim();
  const from = process.env['EMAIL_FROM']?.trim() || 'Clip Network <noreply@clipnetwork.io>';

  if (!apiKey) {
    return { delivered: true, mode: 'SANDBOX_LOG' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    if (!res.ok) {
      return { delivered: false, mode: 'RESEND_LIVE' };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, mode: 'RESEND_LIVE', ...(body.id ? { providerId: body.id } : {}) };
  } catch {
    return { delivered: false, mode: 'RESEND_LIVE' };
  }
}
