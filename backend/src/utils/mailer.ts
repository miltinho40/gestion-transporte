import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const createTransporter = () => {
  if (!env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        : undefined
  });
};

export const sendMail = async (input: SendMailInput) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.info(`[mail skipped] ${input.to} - ${input.subject}\n${input.text}`);
    return {
      sent: false,
      reason: 'SMTP no configurado'
    };
  }

  await transporter.sendMail({
    from: env.MAIL_FROM,
    ...input
  });

  return {
    sent: true,
    reason: null
  };
};
