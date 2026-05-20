import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import { env } from './env.js';

export interface JwtPayload {
  usuario_id: string;
  propietario_id?: string;
  rol?: string;
  es_super_admin?: boolean;
}

export const signToken = (payload: JwtPayload) => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  };

  return jwt.sign(payload, env.JWT_SECRET as Secret, options);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET as Secret) as JwtPayload;
};
