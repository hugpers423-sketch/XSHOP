// apps/web/app/api/chat/messages/route.ts
// Chat REST de demostración. Mantiene los mensajes en memoria durante el
// proceso del servidor y mantiene el mismo contrato que el cliente espera.

import { NextRequest, NextResponse } from 'next/server';

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: string;
  sharedProductId?: string;
  createdAt: string;
};

const globalForChat = globalThis as unknown as { xshopMessages?: Message[] };
const messages = globalForChat.xshopMessages ?? (globalForChat.xshopMessages = []);

function sanitize(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
    .slice(0, 1000);
}

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get('chatId');
  if (!chatId) return NextResponse.json({ error: 'chatId requerido' }, { status: 400 });
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
  const data = messages.filter((message) => message.chatId === chatId).slice(-limit);
  return NextResponse.json({ data, meta: { hasMore: false, nextCursor: null } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.chatId !== 'string' || typeof body.senderId !== 'string' || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'chatId, senderId y content son requeridos' }, { status: 400 });
  }
  const content = sanitize(body.content);
  if (!content) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });

  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chatId: body.chatId,
    senderId: body.senderId,
    content,
    type: typeof body.type === 'string' ? body.type : 'TEXT',
    sharedProductId: typeof body.sharedProductId === 'string' ? body.sharedProductId : undefined,
    createdAt: new Date().toISOString(),
  };
  messages.push(message);
  if (messages.length > 500) messages.splice(0, messages.length - 500);
  return NextResponse.json({ data: message }, { status: 201 });
}
