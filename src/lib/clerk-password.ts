export const CLERK_PASSWORD_MIN_LENGTH = 15;
export const CLERK_PASSWORD_MAX_LENGTH = 1024;

export function hasValidClerkPasswordLength(password: string) {
  return password.length >= CLERK_PASSWORD_MIN_LENGTH && password.length <= CLERK_PASSWORD_MAX_LENGTH;
}
