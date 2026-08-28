import crypto from 'node:crypto';
import { config } from '../config.js';

function body(code, minutes) {
  return {
    subject: 'Your Digital Footprint Self-Check code',
    text:
      `Your verification code is ${code}.\n\n` +
      `It expires in ${minutes} minutes. This code lets someone run a footprint ` +
      `scan for the name they entered. If you did not request it, ignore this email — ` +
      `no scan runs without the code.\n`,
  };
}

async function sendConsole(to, code, minutes) {
  const { text } = body(code, minutes);
  console.log(`\n[otp:console:email] to=${to}\n${text}`);
  return { provider: 'console' };
}

async function sendPostmark(to, code, minutes) {
  const { token, from } = config.postmark;
  if (!token || !from) throw new Error('Postmark is not configured (POSTMARK_SERVER_TOKEN, POSTMARK_FROM)');
  const { subject, text } = body(code, minutes);
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, MessageStream: 'outbound' }),
  });
  if (!res.ok) throw new Error(`Postmark responded ${res.status}: ${await res.text()}`);
  return { provider: 'postmark' };
}

/** SES v2 SendEmail, signed with SigV4 from the standard environment credentials. */
async function sendSes(to, code, minutes) {
  const { region, from } = config.ses;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!from || !accessKeyId || !secretAccessKey) {
    throw new Error('SES is not configured (SES_FROM, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
  }
  const { subject, text } = body(code, minutes);
  const host = `email.${region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const payload = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [to] },
    Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
  });

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
  const hmac = (key, v) => crypto.createHmac('sha256', key).update(v).digest();

  const canonical = [
    'POST',
    path,
    '',
    `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`,
    'content-type;host;x-amz-date',
    sha256(payload),
  ].join('\n');
  const scope = `${dateStamp}/${region}/ses/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 'ses'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
      `SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`,
  };
  if (process.env.AWS_SESSION_TOKEN) headers['X-Amz-Security-Token'] = process.env.AWS_SESSION_TOKEN;

  const res = await fetch(`https://${host}${path}`, { method: 'POST', headers, body: payload });
  if (!res.ok) throw new Error(`SES responded ${res.status}: ${await res.text()}`);
  return { provider: 'ses' };
}

export async function sendEmailCode(to, code, ttlMs) {
  const minutes = Math.round(ttlMs / 60000);
  switch (config.otp.emailProvider) {
    case 'postmark':
      return sendPostmark(to, code, minutes);
    case 'ses':
      return sendSes(to, code, minutes);
    case 'console':
      return sendConsole(to, code, minutes);
    default:
      throw new Error(`Unknown OTP_EMAIL_PROVIDER: ${config.otp.emailProvider}`);
  }
}
