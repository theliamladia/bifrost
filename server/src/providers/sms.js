import { config } from '../config.js';

function body(code, minutes) {
  return `${code} is your Digital Footprint Self-Check code. It expires in ${minutes} minutes. Do not share it.`;
}

async function sendConsole(to, code, minutes) {
  console.log(`\n[otp:console:sms] to=${to}\n${body(code, minutes)}\n`);
  return { provider: 'console' };
}

async function sendTwilio(to, code, minutes) {
  const { accountSid, authToken, from } = config.twilio;
  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)');
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body(code, minutes) }),
  });
  if (!res.ok) throw new Error(`Twilio responded ${res.status}: ${await res.text()}`);
  return { provider: 'twilio' };
}

export async function sendSmsCode(to, code, ttlMs) {
  const minutes = Math.round(ttlMs / 60000);
  switch (config.otp.smsProvider) {
    case 'twilio':
      return sendTwilio(to, code, minutes);
    case 'console':
      return sendConsole(to, code, minutes);
    default:
      throw new Error(`Unknown OTP_SMS_PROVIDER: ${config.otp.smsProvider}`);
  }
}

export async function deliverCode(contact, code, ttlMs) {
  const { sendEmailCode } = await import('./email.js');
  return contact.channel === 'email'
    ? sendEmailCode(contact.value, code, ttlMs)
    : sendSmsCode(contact.value, code, ttlMs);
}
