import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { postSchema, postQuerySchema, likeSchema, commentSchema, paginationSchema } from '../utils/schemas.js';

export const postsRouter = Router();

postsRouter.get('/', validateQuery(postQuerySchema), asyncHandler(async (req, res) => {
  const { cursor, limit = 20, type, authorId, isLive } = req.query;
  const where = {};

  if (type) where.type = type;
  if (authorId) where.authorId = authorId;
  if (isLive !== undefined) where.isLive = isLive;
  if (cursor) where.createdAt = { lt: new Date(cursor) };

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      _count: { select: { likes: true, comments: true, shares: true } },
      likes: { where: { userId: req.user?.id }, select: { id: true } }
    }
  });

  let nextCursor = null;
  if (posts.length > limit) {
    const next = posts.pop();
    nextCursor = next.createdAt.toISOString();
  }

  res.json({
    data: posts.map(p => ({
      ...p,
      liked: p.likes.length > 0,
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      sharesCount: p._count.shares,
      likes: undefined,
      _count: undefined
    })),
    nextCursor
  });
}));

postsRouter.post('/', validate(postSchema), asyncHandler(async (req, res) => {
  if (req.user.role === 'BUYER') {
    throw new AppError('Solo vendedores pueden crear posts', 403, 'FORBIDDEN');
  }

  const post = await prisma.post.create({
    data: {
      authorId: req.user.id,
      ...req.body
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, role: true } },
      _count: { select: { likes: true, comments: true, shares: true } }
    }
  });

  res.status(201).json({ ...post, liked: false, likesCount: 0, commentsCount: 0, sharesCount: 0 });
}));

postsRouter.post('/:id/like', validateParams(z.object({ id: z.string().cuid() })), asyncHandler(async (req, res) => {
  const postId = req.params.id;

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: req.user.id, postId } }
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return res.json({ liked: false });
  }

  await prisma.like.create({ data: { userId: req.user.id, postId } });
  res.json({ liked: true });
}));

postsRouter.post('/:id/comment', validateParams(z.object({ id: z.string().cuid() })), validate(commentSchema), asyncHandler(async (req, res) => {
  const { content, parentId } = req.body;

  const comment = await prisma.comment.create({
    data: {
      userId: req.user.id,
      postId: req.params.id,
      content,
      parentId
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } }
    }
  });

  res.status(201).json(comment);
}));

postsRouter.get('/:id/comments', validateParams(z.object({ id: z.string().cuid() })), validateQuery(paginationSchema), asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { postId: req.params.id, parentId: null },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    }),
    prisma.comment.count({ where: { postId: req.params.id, parentId: null } })
  ]);

  res.json({ data: comments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

postsRouter.post('/:id/share', validateParams(z.object({ id: z.string().cuid() })), asyncHandler(async (req, res) => {
  const existing = await prisma.share.findUnique({
    where: { userId_postId: { userId: req.user.id, postId: req.params.id } }
  });

  if (existing) throw new AppError('Ya compartiste este post', 409, 'ALREADY_SHARED');

  await prisma.share.create({ data: { userId: req.user.id, postId: req.params.id } });
  res.json({ shared: true });
}));

postsRouter.delete('/:id', validateParams(z.object({ id: z.string().cuid() })), asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: req.params.id, authorId: req.user.id } });
  if (!post) throw new AppError('Post no encontrado o sin permisos', 404, 'NOT_FOUND');

  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));