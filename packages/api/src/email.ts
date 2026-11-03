// Outbound email through Resend (https://resend.com/docs/api-reference/emails/send-email).
export type MailEnv = { RESEND_API_KEY?: string; RESEND_FROM?: string };

export async function sendMail(
  env: MailEnv,
  msg: { to: string; subject: string; text: string },
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM ?? '2yolks <login@mail.2yolks.com>', to: [msg.to], subject: msg.subject, text: msg.text }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}
