// backend/prisma/seed.js — Datos demo para X-SHOP (idempotente: usa upsert/count guards)
// Uso: npm run db:seed   |   Credenciales: demo@xshop.pe / Demo1234!
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';

async function main() {
  console.log('🌱 Seed X-SHOP…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  /* ---------- Usuarios ---------- */
  const buyer = await prisma.user.upsert({
    where: { email: 'demo@xshop.pe' },
    update: {},
    create: {
      email: 'demo@xshop.pe',
      phone: '+51999888777',
      name: 'Juan Pérez',
      passwordHash,
      role: 'BUYER',
      isVerified: true
    }
  });

  const sellerTech = await prisma.user.upsert({
    where: { email: 'vendedor@xshop.pe' },
    update: {},
    create: {
      email: 'vendedor@xshop.pe',
      phone: '+51988777666',
      name: 'TechReviews PE',
      passwordHash,
      role: 'SELLER',
      isVerified: true
    }
  });

  const sellerModa = await prisma.user.upsert({
    where: { email: 'moda@xshop.pe' },
    update: {},
    create: {
      email: 'moda@xshop.pe',
      name: 'Moda Lima',
      passwordHash,
      role: 'SELLER',
      isVerified: true
    }
  });

  /* ---------- Reputación + historial ---------- */
  const repTech = await prisma.reputation.upsert({
    where: { userId: sellerTech.id },
    update: {},
    create: {
      userId: sellerTech.id,
      score: 912,
      level: 'MERCADO_LIDER',
      totalSales: 342,
      rating: 4.9,
      responseTimeSec: 120,
      completionRate: 98.5
    }
  });

  await prisma.reputation.upsert({
    where: { userId: sellerModa.id },
    update: {},
    create: {
      userId: sellerModa.id,
      score: 768,
      level: 'GOLD',
      totalSales: 189,
      rating: 4.7,
      responseTimeSec: 300,
      completionRate: 96.2,
      disputesCount: 1
    }
  });

  if ((await prisma.reputationHistory.count({ where: { reputationId: repTech.id } })) === 0) {
    await prisma.reputationHistory.createMany({
      data: [
        { reputationId: repTech.id, type: 'sale', amount: 489900, buyerName: 'Juan Pérez', comment: 'iPhone 16 Pro impecable, envío 24h' },
        { reputationId: repTech.id, type: 'review', rating: 5, buyerName: 'Carlos Ruiz', comment: 'Excelente vendedor, todo original' },
        { reputationId: repTech.id, type: 'review', rating: 5, buyerName: 'Ana Torres', comment: 'Muy atento, respondió en minutos' },
        { reputationId: repTech.id, type: 'return', amount: 14900, buyerName: 'Diego Flores', comment: 'Cambio por taller — resuelto rápido', status: 'completed' },
        { reputationId: repTech.id, type: 'sale', amount: 29900, buyerName: 'Lucía Mendez', comment: 'Mouse gamer perfecto' }
      ]
    });
  }

  /* ---------- Tarjetas del comprador ---------- */
  if ((await prisma.card.count({ where: { userId: buyer.id } })) === 0) {
    await prisma.card.createMany({
      data: [
        { userId: buyer.id, brand: 'visa', last4: '4242', expiry: '12/28', holderName: 'JUAN PEREZ', isDefault: true, token: 'tok_demo_visa' },
        { userId: buyer.id, brand: 'mastercard', last4: '5555', expiry: '08/27', holderName: 'JUAN PEREZ', isDefault: false, token: 'tok_demo_mc' }
      ]
    });
  }

  /* ---------- Transacciones (montos en céntimos) ---------- */
  if ((await prisma.transaction.count({ where: { userId: buyer.id } })) === 0) {
    const cards = await prisma.card.findMany({ where: { userId: buyer.id } });
    await prisma.transaction.createMany({
      data: [
        { userId: buyer.id, cardId: cards[0]?.id ?? null, amount: 489900, description: 'Compra: iPhone 16 Pro 256GB', status: 'COMPLETED', provider: 'manual', providerRef: 'xshop_seed_1', metadata: JSON.stringify({ source: 'seed' }) },
        { userId: buyer.id, cardId: cards[0]?.id ?? null, amount: 14900, description: 'Compra: Mouse gamer RGB 26K DPI', status: 'COMPLETED', provider: 'manual', providerRef: 'xshop_seed_2', metadata: JSON.stringify({ source: 'seed' }) },
        { userId: buyer.id, cardId: cards[1]?.id ?? null, amount: 29900, description: 'Compra: Wok de acero al carbono 32cm', status: 'COMPLETED', provider: 'manual', providerRef: 'xshop_seed_3', metadata: JSON.stringify({ source: 'seed' }) },
        { userId: buyer.id, cardId: cards[1]?.id ?? null, amount: 8900, description: 'Compra: Lámpara LED minimalista', status: 'PENDING', provider: 'manual', providerRef: 'xshop_seed_4', metadata: JSON.stringify({ source: 'seed' }) }
      ]
    });
  }

  /* ---------- Posts para el feed ---------- */
  if ((await prisma.post.count()) === 0) {
    const VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';
    const img = seed => `https://picsum.photos/seed/${seed}/720/1280`;

    const posts = await Promise.all([
      prisma.post.create({
        data: {
          authorId: sellerTech.id,
          type: 'VIDEO',
          content: 'Review completo del iPhone 16 Pro: cámaras, batería y rendimiento en Perú 📱 ¿Vale la pena el upgrade?',
          mediaUrl: `${VIDEO}/ForBiggerBlazes.mp4`,
          mediaAspectRatio: 1.78
        }
      }),
      prisma.post.create({
        data: {
          authorId: sellerModa.id,
          type: 'IMAGE',
          content: 'Tendencias Otoño 2025: los 5 básicos que no pueden faltar en tu closet 🍂',
          mediaUrl: img('seed-moda'),
          mediaAspectRatio: 0.56
        }
      }),
      prisma.post.create({
        data: {
          authorId: sellerTech.id,
          type: 'VIDEO',
          content: 'Unboxing de los sneakers más buscados del año 👟 Talla real, envío 24h en Lima.',
          mediaUrl: `${VIDEO}/ForBiggerJoyrides.mp4`,
          mediaAspectRatio: 1.78
        }
      }),
      prisma.post.create({
        data: {
          authorId: sellerModa.id,
          type: 'LIVE',
          isLive: true,
          content: 'EN VIVO: Liquidación de abrigos ⏳ 2x1 en toda la colección otoñal 🍁',
          mediaUrl: img('seed-live'),
          mediaAspectRatio: 0.56
        }
      }),
      prisma.post.create({
        data: {
          authorId: sellerTech.id,
          type: 'IMAGE',
          content: 'Set completo de mancuernas ajustables 20kg — ahora con 20% off 💪',
          mediaUrl: img('seed-fit'),
          mediaAspectRatio: 0.56
        }
      })
    ]);

    // Interacciones iniciales
    await prisma.like.createMany({
      data: posts.slice(0, 3).map(p => ({ userId: buyer.id, postId: p.id }))
    });
    await prisma.comment.createMany({
      data: [
        { userId: buyer.id, postId: posts[0].id, content: '¡Lo compré y llegó en un día! Súper recomendado 😍' },
        { userId: buyer.id, postId: posts[1].id, content: '¿Envían a Arequipa?' }
      ]
    });
    await prisma.share.create({ data: { userId: buyer.id, postId: posts[0].id } });
  }

  console.log('✅ Seed completado.');
  console.log('   👤 Comprador:  demo@xshop.pe   /', DEMO_PASSWORD);
  console.log('   🛍️  Vendedor:  vendedor@xshop.pe /', DEMO_PASSWORD);
  console.log('   👗  Vendedor:  moda@xshop.pe     /', DEMO_PASSWORD);
}

main()
  .catch(e => {
    console.error('❌ Seed falló:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
