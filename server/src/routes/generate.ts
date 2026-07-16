import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/async-handler.js';
import { GenerationError } from '../lib/openai.js';
import { validatePreferences, type TripPreferences } from '../lib/itinerary.js';
import { generateDestinations, generateItinerary } from '../lib/generate.js';
import { GenerationTrace } from '../lib/trace.js';

const router = Router();

router.use(requireAuth);

const FRIENDLY_FAILURE =
  'We couldn’t finish drafting this itinerary. Nothing was lost — please try again in a moment.';

function tripTitle(destination: string, preferences: TripPreferences): string {
  const city = destination.split(',')[0].trim();
  return `${preferences.duration} days in ${city}`;
}

/* ------------------------- async generation job ------------------------- */

/**
 * Generation runs as a detached in-process job: the HTTP request returns a
 * trip id immediately (the full pipeline can outlive proxy timeouts), and
 * the client polls GET /api/trips/:id/status. One run per trip at a time;
 * a job orphaned by a server restart is healed by the status endpoint's
 * staleness check.
 */
const runningJobs = new Set<string>();

function startGenerationJob(
  tripId: string,
  destination: string,
  preferences: TripPreferences,
): void {
  if (runningJobs.has(tripId)) return; // already drafting this trip
  runningJobs.add(tripId);

  const trace = new GenerationTrace();
  void (async () => {
    try {
      const itinerary = await generateItinerary(destination, preferences, trace);
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'complete',
          destination: itinerary.destination,
          title: tripTitle(itinerary.destination, preferences),
          itinerary: itinerary as unknown as Prisma.InputJsonValue,
          generationError: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof GenerationError && error.kind === 'provider'
          ? error.message
          : FRIENDLY_FAILURE;
      console.error(
        `[roam] background generation failed for trip ${tripId}:`,
        error instanceof Error ? error.message : error,
      );
      await prisma.trip
        .update({
          where: { id: tripId },
          data: { status: 'failed', generationError: message },
        })
        .catch((updateError) =>
          console.error('[roam] could not record generation failure:', updateError),
        );
    } finally {
      runningJobs.delete(tripId);
      trace.logSummary('itinerary generation (async job)', {
        destination,
        days: preferences.duration,
      });
    }
  })();
}

router.post(
  '/destinations',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = validatePreferences(req.body?.preferences);
    if (!parsed.ok) {
      res.status(400).json({ error: 'Invalid preferences', details: parsed.errors });
      return;
    }

    // Destinations already shown to the traveler in earlier rounds.
    const exclude: string[] = Array.isArray(req.body?.exclude)
      ? req.body.exclude
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter(Boolean)
          .slice(0, 40)
      : [];

    try {
      const options = await generateDestinations(parsed.value, exclude);
      res.json({ options });
    } catch (error) {
      if (error instanceof GenerationError) {
        console.error('[roam] destination generation failed:', error.message);
        res.status(502).json({
          error:
            error.kind === 'provider'
              ? error.message
              : 'We couldn’t gather destination ideas just now. Please try again in a moment.',
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
      // Retrying a draft/failed trip, or re-requesting one already drafting.
      const draft = await prisma.trip.findFirst({
        where: { id: req.body.tripId, userId },
      });
      if (!draft) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      if (draft.status === 'complete' || draft.status === 'active') {
        res.status(400).json({ error: 'This trip already has its itinerary' });
        return;
      }
      if (draft.status === 'generating' && runningJobs.has(draft.id)) {
        res.status(202).json({ tripId: draft.id, status: 'generating' });
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

      // Born directly in the "generating" state — one DB write, fast 202.
      const draft = await prisma.trip.create({
        data: {
          userId,
          title: tripTitle(destination, preferences),
          destination,
          status: 'generating',
          preferences: preferences as unknown as Prisma.InputJsonValue,
        },
      });
      tripId = draft.id;
      startGenerationJob(tripId, destination, preferences);
      res.status(202).json({ tripId, status: 'generating' });
      return;
    }

    // Retry path: flip back to drafting, kick off the detached job, answer
    // immediately — the pipeline can take minutes, longer than any proxy
    // timeout.
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'generating', generationError: null },
    });
    startGenerationJob(tripId, destination, preferences);
    res.status(202).json({ tripId, status: 'generating' });
  }),
);

export default router;
