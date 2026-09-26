// scripts/verify-social-schema.mjs
// Comprobacion de humo del schema social recien agregado (Follow, VideoLike).
// No modifica datos: solo comprueba que las tablas, los indices unicos y las
// relaciones funcionan tal y como las espera la API.
//
// Uso:  node scripts/verify-social-schema.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const suffix = Date.now();
const email = (n) => `schema-check-${n}-${suffix}@xshop.test`;

let failed = false;
const ok = (label) => console.log(`  OK   ${label}`);
const bad = (label, detail) => {
  failed = true;
  console.error(`  FALLA ${label}: ${detail}`);
};

async function main() {
  console.log('\n1) Las tablas Follow y VideoLike existen y aceptan escritura');
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: email('a'), name: 'Schema A', password: 'x' } }),
    prisma.user.create({ data: { email: email('b'), name: 'Schema B', password: 'x' } }),
  ]);

  const video = await prisma.video.create({
    data: {
      url: `/api/videos/stream/verify-${suffix}.mp4`,
      caption: 'Video de verificacion',
      hashtags: [],
      authorId: bob.id,
    },
  });
  ok(`Video creado (${video.id.slice(0, 8)}…)`);

  const follow = await prisma.follow.create({ data: { followerId: alice.id, followedId: bob.id } });
  ok(`Follow creado (${follow.id.slice(0, 8)}…)`);

  const like = await prisma.videoLike.create({ data: { userId: alice.id, videoId: video.id } });
  ok(`VideoLike creado (${like.id.slice(0, 8)}…)`);

  console.log('\n2) Los indices unicos evitan duplicados');
  try {
    await prisma.follow.create({ data: { followerId: alice.id, followedId: bob.id } });
    bad('Follow duplicado', 'se permitio seguir dos veces al mismo vendedor');
  } catch {
    ok('Follow duplicado rechazado por @@unique([followerId, followedId])');
  }
  try {
    await prisma.videoLike.create({ data: { userId: alice.id, videoId: video.id } });
    bad('Like duplicado', 'se permitio dar like dos veces al mismo video');
  } catch {
    ok('Like duplicado rechazado por @@unique([userId, videoId])');
  }

  console.log('\n3) Las relaciones bidireccionales funcionan');
  const withRelations = await prisma.user.findUniqueOrThrow({
    where: { id: alice.id },
    include: { following: true, videoLikes: true },
  });
  if (withRelations.following.length === 1 && withRelations.videoLikes.length === 1) {
    ok('User -> following y videoLikes devolvieron 1 cada uno');
  } else {
    bad('Relaciones', `following=${withRelations.following.length} videoLikes=${withRelations.videoLikes.length}`);
  }

  const followers = await prisma.user.findUniqueOrThrow({
    where: { id: bob.id },
    include: { followers: true },
  });
  if (followers.followers.length === 1) {
    ok('User -> followers devolvio al seguidor (relacion Followed)');
  } else {
    bad('Followers', `esperaba 1, recibi ${followers.followers.length}`);
  }

  const likesOnVideo = await prisma.video.findUniqueOrThrow({
    where: { id: video.id },
    include: { videoLikes: true },
  });
  if (likesOnVideo.videoLikes.length === 1) {
    ok('Video -> videoLikes devolvio el like');
  } else {
    bad('Video.videoLikes', `esperaba 1, recibi ${likesOnVideo.videoLikes.length}`);
  }

  console.log('\n4) Borrado en cascada al eliminar el usuario');
  await prisma.user.delete({ where: { id: alice.id } });
  const remaining = await prisma.videoLike.count({ where: { userId: alice.id } });
  const remainingFollows = await prisma.follow.count({ where: { followerId: alice.id } });
  if (remaining === 0 && remainingFollows === 0) {
    ok('Los likes y follows se borraron en cascada');
  } else {
    bad('Cascada', `quedaron ${remaining} likes y ${remainingFollows} follows huerfanos`);
  }

  // Limpieza de los datos de prueba.
  await prisma.video.delete({ where: { id: video.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: bob.id } }).catch(() => {});
  console.log('\nDatos de prueba limpiados.');
}

main()
  .catch((err) => {
    failed = true;
    console.error('\nError inesperado:', err.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(failed ? '\nRESULTADO: FALLO\n' : '\nRESULTADO: OK\n');
    process.exit(failed ? 1 : 0);
  });
