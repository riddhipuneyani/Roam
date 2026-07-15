import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (service role — never exposed to the client)
 * used for PDF storage in a private bucket. Objects live at
 * {userId}/{tripId}/itinerary.pdf and are handed out via short-lived
 * signed URLs.
 */

const BUCKET = process.env.SUPABASE_PDF_BUCKET ?? 'trip-pdfs';
const SIGNED_URL_TTL_SECONDS = 10 * 60;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

let client: SupabaseClient | null = null;
let bucketReady = false;

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new StorageError('Supabase storage is not configured');
    }
    client = createClient(url.replace(/\/+$/, ''), key, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/** Create the private bucket on first use if it doesn't exist yet. */
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const supabase = getClient();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
    // A parallel request may have created it — only real failures matter.
    if (error && !/already exists/i.test(error.message)) {
      throw new StorageError(`Couldn't create bucket "${BUCKET}": ${error.message}`);
    }
    console.log(`[roam] created private storage bucket "${BUCKET}"`);
  }
  bucketReady = true;
}

const pdfPath = (userId: string, tripId: string): string => `${userId}/${tripId}/itinerary.pdf`;

/**
 * True when a stored PDF exists that is newer than the trip's last edit —
 * in that case regenerating with Puppeteer would produce the same document.
 */
export async function hasFreshPdf(
  userId: string,
  tripId: string,
  tripUpdatedAt: Date,
): Promise<boolean> {
  await ensureBucket();
  const { data, error } = await getClient()
    .storage.from(BUCKET)
    .list(`${userId}/${tripId}`);
  if (error || !data) return false;
  const existing = data.find((item) => item.name === 'itinerary.pdf');
  if (!existing?.updated_at) return false;
  return new Date(existing.updated_at).getTime() > tripUpdatedAt.getTime();
}

export async function uploadTripPdf(
  userId: string,
  tripId: string,
  pdf: Uint8Array,
): Promise<void> {
  await ensureBucket();
  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(pdfPath(userId, tripId), Buffer.from(pdf), {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) {
    throw new StorageError(`PDF upload failed: ${error.message}`);
  }
}

/** Short-lived signed URL; `filename` becomes the browser's download name. */
export async function signedPdfUrl(
  userId: string,
  tripId: string,
  filename: string,
): Promise<string> {
  await ensureBucket();
  const { data, error } = await getClient()
    .storage.from(BUCKET)
    .createSignedUrl(pdfPath(userId, tripId), SIGNED_URL_TTL_SECONDS, { download: filename });
  if (error || !data?.signedUrl) {
    throw new StorageError(`Couldn't sign the download URL: ${error?.message ?? 'no URL returned'}`);
  }
  return data.signedUrl;
}
