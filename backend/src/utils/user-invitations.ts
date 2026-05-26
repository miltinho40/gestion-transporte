import { createHash, randomBytes } from 'node:crypto';
import { TipoInvitacionUsuario } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { sendMail } from './mailer.js';

const invitationTtlDays = 7;

export const hashInvitationToken = (token: string) => {
  return createHash('sha256').update(token).digest('hex');
};

const buildInvitationUrl = (token: string) => {
  const url = new URL('/aceptar-invitacion', env.FRONTEND_URL);
  url.searchParams.set('token', token);

  return url.toString();
};

export const createPasswordInvitation = async (input: {
  usuario_id: bigint;
  propietario_id?: bigint | null;
  email: string;
  nombre: string;
  propietario_nombre: string;
}) => {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashInvitationToken(token);
  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + invitationTtlDays);

  const invitacion = await prisma.invitacionUsuario.create({
    data: {
      usuario_id: input.usuario_id,
      propietario_id: input.propietario_id ?? null,
      email: input.email,
      token_hash: tokenHash,
      tipo: TipoInvitacionUsuario.CREAR_PASSWORD,
      fecha_expiracion: fechaExpiracion
    }
  });
  const enlace = buildInvitationUrl(token);
  const mail = await sendMail({
    to: input.email,
    subject: 'Crea tu clave de Gestion Transporte',
    text: [
      `Hola ${input.nombre},`,
      '',
      `Te invitaron como administrador de ${input.propietario_nombre}.`,
      'Crea tu clave usando este enlace:',
      enlace,
      '',
      `El enlace vence en ${invitationTtlDays} dias.`
    ].join('\n'),
    html: `
      <p>Hola ${input.nombre},</p>
      <p>Te invitaron como administrador de <strong>${input.propietario_nombre}</strong>.</p>
      <p><a href="${enlace}">Crear clave</a></p>
      <p>El enlace vence en ${invitationTtlDays} dias.</p>
    `
  }).catch((error: unknown) => {
    console.error('No se pudo enviar la invitacion por correo', error);
    return {
      sent: false,
      reason: 'Error enviando correo'
    };
  });

  return {
    invitacion: {
      id: invitacion.id,
      email: invitacion.email,
      fecha_expiracion: invitacion.fecha_expiracion,
      usado: invitacion.usado
    },
    enlace,
    email_enviado: mail.sent,
    email_motivo: mail.reason
  };
};
