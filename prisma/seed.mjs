import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const password = await bcrypt.hash('Demo1234!', 12);

const seller = await prisma.user.upsert({
  where: { email: 'vendedor@xshop.pe' },
  update: {},
  create: {
    id: 'seed-seller-xstore',
    email: 'vendedor@xshop.pe',
    name: 'TechReviews PE',
    password,
    role: 'SELLER',
    status: 'ACTIVE',
    authProvider: 'PASSWORD',
  },
});

await prisma.user.upsert({
  where: { email: 'demo@xshop.pe' },
  update: {},
  create: {
    id: 'seed-buyer-xstore',
    email: 'demo@xshop.pe',
    name: 'Juan Pérez',
    password,
    role: 'BUYER',
    status: 'ACTIVE',
    authProvider: 'PASSWORD',
  },
});

const products = [
  ['c01', 'Audífonos Pro ANC', 'Cancelación de ruido ANC', 149.9],
  ['c02', 'Hoodie Oversize Premium', 'Algodón premium', 79.9],
  ['c03', 'Smartwatch AMOLED 1.43"', 'Pantalla AMOLED', 189],
  ['c04', 'Lámpara LED ambiente', 'Luz ambiental regulable', 59.9],
  ['c05', 'Mochila antirrobo Urban', 'Compartimento reforzado', 99],
  ['c06', 'Perfumé Ambar Noir 100ml', 'Aroma ambarado', 119.9],
];

for (const [id, title, description, price] of products) {
  await prisma.product.upsert({
    where: { id },
    update: { title, description, price, sellerId: seller.id, isActive: true },
    create: { id, title, description, price, sellerId: seller.id, stock: 25, isActive: true },
  });
}

console.log('Production/demo catalog seed complete.');
await prisma.$disconnect();
