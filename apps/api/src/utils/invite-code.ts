import { customAlphabet } from 'nanoid';

// unambiguous alphabet: no 0, 1, I, O
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const generate = customAlphabet(ALPHABET, CODE_LENGTH);

export function generateInviteCode(): string {
  return generate();
}
