import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const PASSWORD_HASH_ROUNDS = 12;
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*-_';
const ALL_CHARACTERS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

export const hashPassword = (password: string) => bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

const randomCharacter = (characters: string) =>
  characters[randomInt(0, characters.length)]!;

export const generateTemporaryPassword = (length = 14) => {
  const safeLength = Math.max(length, 12);
  const characters = [
    randomCharacter(UPPERCASE),
    randomCharacter(LOWERCASE),
    randomCharacter(DIGITS),
    randomCharacter(SYMBOLS),
    ...Array.from(
      { length: safeLength - 4 },
      () => randomCharacter(ALL_CHARACTERS)
    )
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index + 1);
    [characters[index], characters[target]] = [
      characters[target]!,
      characters[index]!
    ];
  }

  return characters.join('');
};

export const generateHashedTemporaryPassword = async () => {
  const password = generateTemporaryPassword();
  return {
    password,
    hash: await hashPassword(password)
  };
};
