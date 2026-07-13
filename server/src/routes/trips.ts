import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { GenerationError } from '../lib/openai.js';
import {
  type ActivitySlot,
  type Itinerary,
  validatePreferences,
} from '../lib/itinerary.js';
import { regenerateActivity, regenerateRestaurant } from '../lib/generate.js';
import { AUTH_COOKIE_NAME } from '../lib/jwt.js';
import { exportTripPdf } from '../lib/pdf.js';

const router = Router();

router.use(requireAuth);

async function findOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId } });
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const trips = await prisma.trip.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        destination: true,
        status: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ trips });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    res.json({ trip });
  }),
);

router.post(
  '/:id/duplicate',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    const copy = await prisma.trip.create({
      data: {
        userId: trip.userId,
        title: `${trip.title} (copy)`,
        destination: trip.destination,
        // A copy of a trip you're currently on isn't itself underway.
        status: trip.status === 'active' ? 'complete' : trip.status,
        preferences: trip.preferences as Prisma.InputJsonValue,
        itinerary: (trip.itinerary ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    res.status(201).json({ trip: copy });
  }),
);

function shareUrlFor(token: string): string {
  const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${clientUrl}/shared/${token}`;
}

router.post(
  '/:id/share',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    let token = trip.shareToken;
    if (!token) {
      token = randomBytes(24).toString('base64url');
      await prisma.trip.update({ where: { id: trip.id }, data: { shareToken: token } });
    }
    res.json({ shareToken: token, shareUrl: shareUrlFor(token) });
  }),
);

router.delete(
  '/:id/share',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    if (trip.shareToken) {
      await prisma.trip.update({ where: { id: trip.id }, data: { shareToken: null } });
    }
    res.json({ message: 'Sharing disabled — the old link no longer works' });
  }),
);

router.post(
  '/:id/activate',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    if (trip.status === 'active') {
      res.json({ trip }); // already underway — idempotent
      return;
    }
    if (trip.status !== 'complete' || !trip.itinerary) {
      res.status(400).json({ error: 'Only a finished itinerary can be marked as underway' });
      return;
    }
    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: { status: 'active' },
    });
    res.json({ trip: updated });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    await prisma.trip.delete({ where: { id: trip.id } });
    res.json({ message: 'Trip deleted' });
  }),
);

router.get(
  '/:id/export-pdf',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip || !trip.itinerary) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    try {
      const pdf = await exportTripPdf(trip.id, {
        name: AUTH_COOKIE_NAME,
        value: req.cookies[AUTH_COOKIE_NAME],
      });

      const prefs = trip.preferences as { duration?: unknown };
      const city =
        trip.destination
          .split(',')[0]
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'trip';
      const days = typeof prefs.duration === 'number' ? `${prefs.duration}days` : 'itinerary';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="roam-${city}-${days}.pdf"`);
      res.send(Buffer.from(pdf));
    } catch (error) {
      console.error(
        '[roam] pdf export failed:',
        error instanceof Error ? error.message : error,
      );
      res.status(502).json({
        error: 'The PDF didn’t come together — please try again in a moment.',
      });
    }
  }),
);

const ACTIVITY_SLOTS: readonly string[] = ['morning', 'afternoon', 'evening'];

router.post(
  '/:id/regenerate',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await findOwnedTrip(req.params.id, req.user!.id);
    if (!trip || !trip.itinerary) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    const itinerary = trip.itinerary as unknown as Itinerary;
    const parsedPrefs = validatePreferences(trip.preferences);
    if (!parsedPrefs.ok) {
      res.status(400).json({ error: 'This trip is missing its preferences' });
      return;
    }

    const { dayNumber, slot, restaurantIndex } = req.body ?? {};
    const day =
      typeof dayNumber === 'number' && Number.isInteger(dayNumber)
        ? itinerary.days[dayNumber - 1]
        : undefined;
    if (!day) {
      res.status(400).json({ error: 'Unknown day' });
      return;
    }

    const isRestaurant = slot === 'restaurant';
    if (!isRestaurant && !ACTIVITY_SLOTS.includes(slot)) {
      res.status(400).json({ error: 'slot must be morning, afternoon, evening or restaurant' });
      return;
    }
    if (
      isRestaurant &&
      (typeof restaurantIndex !== 'number' ||
        !Number.isInteger(restaurantIndex) ||
        restaurantIndex < 0 ||
        restaurantIndex >= day.restaurants.length)
    ) {
      res.status(400).json({ error: 'Unknown restaurant' });
      return;
    }

    try {
      if (isRestaurant) {
        day.restaurants[restaurantIndex] = await regenerateRestaurant(
          itinerary,
          parsedPrefs.value,
          dayNumber,
          restaurantIndex,
        );
      } else {
        day[slot as ActivitySlot] = await regenerateActivity(
          itinerary,
          parsedPrefs.value,
          dayNumber,
          slot as ActivitySlot,
        );
      }

      const updated = await prisma.trip.update({
        where: { id: trip.id },
        data: { itinerary: itinerary as unknown as Prisma.InputJsonValue },
      });
      res.json({ trip: updated });
    } catch (error) {
      if (error instanceof GenerationError) {
        console.error('[roam] regeneration failed:', error.message);
        res.status(502).json({
          error:
            error.kind === 'provider'
              ? error.message
              : 'We couldn’t find a fresh alternative just now. The current pick is untouched — try again in a moment.',
        });
        return;
      }
      throw error;
    }
  }),
);

export default router;
