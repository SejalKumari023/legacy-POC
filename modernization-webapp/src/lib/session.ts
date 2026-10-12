import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = { installationId: number; repository?: string };

const secret = () => {
  const value = process.env.APP_SESSION_SECRET;
  if (!value) throw new Error("APP_SESSION_SECRET is not configured");
  return value;
};

export function sign(value: object) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verify<T>(value?: string): T | null {
  if (!value) return null;
  const [payload, supplied] = value.split(".");
  if (!payload || !supplied) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T; } catch { return null; }
}
