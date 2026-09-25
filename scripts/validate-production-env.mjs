#!/usr/bin/env node
import process from 'node:process';

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'SESSION_SECRET',
  'AUTH_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SOCKET_URL',
  'WHATSAPP_SUPPORT_PHONE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'NEXT_PUBLIC_LIVEKIT_URL',
];

const missing = required.filter((key) => !process.env[key]?.trim());
const invalidHttps = ['AUTH_API_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SOCKET_URL', 'LIVEKIT_URL', 'NEXT_PUBLIC_LIVEKIT_URL']
  .filter((key) => process.env[key] && !/^wss?:\/\//i.test(process.env[key]) && !/^https:\/\//i.test(process.env[key]));
const badPhone = process.env.WHATSAPP_SUPPORT_PHONE && !/^\d{8,15}$/.test(process.env.WHATSAPP_SUPPORT_PHONE.replace(/\D/g, ''));

if (missing.length || invalidHttps.length || badPhone) {
  if (missing.length) console.error(`Faltan variables: ${missing.join(', ')}`);
  if (invalidHttps.length) console.error(`URLs inválidas: ${invalidHttps.join(', ')}`);
  if (badPhone) console.error('WHATSAPP_SUPPORT_PHONE debe contener solo dígitos con código de país.');
  process.exit(1);
}

console.log('Production environment validado correctamente.');
