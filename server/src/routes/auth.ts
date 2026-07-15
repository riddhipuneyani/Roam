import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import {
  AUTH_COOKIE_NAME,
  getCookieOptions,
  signToken,
} from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { toPublicUser } from '../lib/user.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function validatePassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

function validateName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length >= 1;
}

router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body ?? {};

  if (!validateEmail(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }

  if (!validatePassword(password)) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  if (!validateName(name)) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: trimmedName,
    },
  });

  const token = signToken({ userId: user.id });
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
  res.status(201).json({ user: toPublicUser(user) });
}));

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!validateEmail(email) || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ userId: user.id });
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
  res.json({ user: toPublicUser(user) });
}));

router.post('/logout', (_req: Request, res: Response) => {
  // Must match the set-cookie options exactly (minus maxAge), or browsers
  // ignore the clear in the cross-domain production setup.
  const { maxAge: _maxAge, ...clearOptions } = getCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
