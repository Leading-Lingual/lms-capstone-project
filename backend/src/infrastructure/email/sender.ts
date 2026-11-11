import { z } from 'zod';

export function parseEmailSender(value: string): { email: string; name?: string } | undefined {
  if (/[\r\n]/.test(value)) return undefined;
  const sender = value.trim();
  if (z.email().safeParse(sender).success) return { email: sender };
  const match = /^([^<>]+?)\s*<([^<>]+)>$/.exec(sender);
  if (!match || !z.email().safeParse(match[2]!.trim()).success) return undefined;
  const name = match[1]!.trim();
  return name ? { name, email: match[2]!.trim() } : undefined;
}
