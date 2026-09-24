/**
 * Email channel. Providers implement `send({ to, subject, text })`:
 *  - smtp    Nodemailer (SMTP)
 *  - resend  HTTPS API (use on hosts that restrict outbound SMTP on free plans)
 *  - console log only (development)
 * Disabled unless EMAIL_ENABLED=true. Sending never throws into callers.
 */
import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

function smtpProvider() {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return {
    name: 'smtp',
    send: ({ to, subject, text }) =>
      transport.sendMail({ from: env.EMAIL_FROM, to, subject, text }),
  };
}

function resendProvider() {
  return {
    name: 'resend',
    async send({ to, subject, text }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
    },
  };
}

const consoleProvider = () => ({
  name: 'console',
  send: async ({ to, subject }) => logger.info(`[email:console] to=${to} subject="${subject}"`),
});

let provider;
function getProvider() {
  provider ??= { smtp: smtpProvider, resend: resendProvider, console: consoleProvider }[
    env.EMAIL_PROVIDER
  ]();
  return provider;
}

let enabledOverride = null;

/** Test hook: replace the provider (e.g. a recorder) and force email on/off. Pass null to reset. */
export function setEmailProvider(custom, { enabled = true } = {}) {
  provider = custom ?? undefined;
  enabledOverride = custom ? enabled : null;
}

export const emailEnabled = () => enabledOverride ?? env.EMAIL_ENABLED;

/** Send one email; failures are logged, never thrown. */
export async function sendEmail(message) {
  if (!emailEnabled()) return false;
  try {
    await getProvider().send(message);
    return true;
  } catch (err) {
    logger.error(`Email to ${message.to} failed: ${err.message}`);
    return false;
  }
}
