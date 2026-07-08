import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { GenerationError } from '../lib/openai.js';
import { validatePreferences, type TripPreferences } from '../lib/itinerary.js';
import { generateDestinations, generateItinerary } from '../lib/generate.js';

const router = Router();

router.use(requireAuth);

const FRIENDLY_FAILURE =
  'We couldn’t finish drafting this itinerary. Nothing was lost — please try again in a moment.';

function tripTitle(destination: string, preferences: TripPreferences): string {
  const city = destination.split(',')[0].trim();
  return `${preferences.duration} days in ${city}`;
}

router.post(
  '/destinations',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = validatePreferences(req.body?.preferences);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid preferences', details: parsed.errors });
      return;
    }

    try {
      const options = await generateDestinations(parsed.value);
      res.json({ options });
    } catch (error) {
      if (error instanceof GenerationError) {
        console.error('[roam] destination generation failed:', error.message);
        res.status(502).json({
          error: 'We couldn’t gather destination ideas just now. Please try again in a moment.',
        });
        return;
      }
      throw error;
    }
  }),
);

router.post(
  '/itinerary',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    let tripId: string | null = null;
    let preferences: TripPreferences;
    let destination: string;

    if (typeof req.body?.tripId === 'string') {
      // Retrying a draft that failed generation earlier.
      const draft = await prisma.trip.findFirst({
        where: { id: req.body.tripId, userId },
      });
      if (!draft) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      const parsed = validatePreferences(draft.preferences);
      if (!parsed.ok) {
        res.status(400).json({ error: 'This draft is missing its preferences', details: parsed.errors });
        return;
      }
      tripId = draft.id;
      preferences = parsed.value;
      destination = draft.destination;
    } else {
      const parsed = validatePreferences(req.body?.preferences);
      if (!parsed.ok) {
        res.status(400).json({ error: 'Invalid preferences', details: parsed.errors });
        return;
      }
      preferences = parsed.value;
      // For "surprise me" flows the client sends the destination chosen on
      // the discovery screen via preferences.destination.
      if (!preferences.destination) {
        res.status(400).json({ error: 'A destination is required to draft the itinerary' });
        return;
      }
      destination = preferences.destination;

      const draft = await prisma.trip.create({
        data: {
          userId,
          title: tripTitle(destination, preferences),
          destination,
          status: 'draft',
          preferences: preferences as unknown as Prisma.InputJsonValue,
        },
      });
      tripId = draft.id;
    }

    try {
      const itinerary = await generateItinerary(destination, preferences);
      const trip = await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'complete',
          destination: itinerary.destination,
          title: tripTitle(itinerary.destination, preferences),
          itinerary: itinerary as unknown as Prisma.InputJsonValue,
        },
      });
      res.json({ trip });
    } catch (error) {
      if (error instanceof GenerationError) {
        console.error('[roam] itinerary generation failed:', error.message);
        // Keep the draft so the traveler can retry from the dashboard.
        res.status(502).json({ error: FRIENDLY_FAILURE, tripId });
        return;
      }
      throw error;
    }
  }),
);

export default router;
