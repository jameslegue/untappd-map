import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "um_session";
const MAX_AGE = 60 * 60 * 24 * 30;

// Dev falls back to password "dev"; production refuses to unlock without config
function config() {
  const dev = process.env.NODE_ENV !== "production";
  const password = process.env.SITE_PASSWORD || (dev ? "dev" : "");
  const secret = process.env.SESSION_SECRET || (dev ? "dev-secret-dev-secret-dev-secret" : "");
  return { password, secret: new TextEncoder().encode(secret) };
}

export function checkPassword(input: string): boolean {
  const { password } = config();
  if (!password || input.length !== password.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i++) diff |= input.charCodeAt(i) ^ password.charCodeAt(i);
  return diff === 0;
}

export async function issueSession(): Promise<void> {
  const { secret } = config();
  const token = await new SignJWT({ u: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isUnlocked(): Promise<boolean> {
  const { secret } = config();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || secret.length === 0) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
