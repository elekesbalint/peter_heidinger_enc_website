/** Egyetlen fix admin email — nyilvanos regisztracio nem engedelyezett erre a cimre. */
export const RESERVED_ADMIN_EMAIL = "encrendszer@gmail.com";

export function isReservedAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === RESERVED_ADMIN_EMAIL;
}
