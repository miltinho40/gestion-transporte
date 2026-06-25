import bcrypt from 'bcryptjs';

export const DEFAULT_TEMPORARY_PASSWORD = 'Transporte123';

const PASSWORD_HASH_ROUNDS = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

export const hashDefaultTemporaryPassword = () => hashPassword(DEFAULT_TEMPORARY_PASSWORD);
