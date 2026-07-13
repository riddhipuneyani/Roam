import puppeteer, { type Browser } from 'puppeteer-core';

/**
 * PDF export via headless Chrome. One browser instance is launched lazily
 * and reused across requests (Puppeteer launches are expensive); each export
 * gets its own page, always closed in finally. The browser is relaunched if
 * it ever disconnects, and closed on process shutdown.
 *
 * Uses the system Chrome via puppeteer-core (channel: "chrome") — override
 * with PUPPETEER_EXECUTABLE_PATH if Chrome lives somewhere unusual.
 */

const NAV_TIMEOUT_MS = 60_000; // Unsplash imagery can be slow
const READY_TIMEOUT_MS = 30_000;

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfError';
  }
}

let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });
  browser.on('disconnected', () => {
    browserPromise = null;
  });
  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (pending) {
    try {
      await (await pending).close();
    } catch {
      /* already gone */
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void closeBrowser().finally(() => process.exit(0));
  });
}

export async function exportTripPdf(
  tripId: string,
  authCookie: { name: string; value: string },
): Promise<Uint8Array> {
  const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // The print route sits behind the normal auth guard — hand the caller's
    // own session cookie to the headless page.
    await page.setCookie({
      name: authCookie.name,
      value: authCookie.value,
      url: clientUrl,
      httpOnly: true,
      sameSite: 'Lax',
    });

    await page.setViewport({ width: 1080, height: 1400, deviceScaleFactor: 2 });
    await page.goto(`${clientUrl}/print/${tripId}`, {
      waitUntil: 'networkidle0',
      timeout: NAV_TIMEOUT_MS,
    });

    // The page flips this flag once trip data, fonts and images are settled.
    await page.waitForSelector('[data-print-ready="true"]', { timeout: READY_TIMEOUT_MS });

    const failed = await page.$('[data-print-failed="true"]');
    if (failed) {
      throw new PdfError('The print view could not load this trip');
    }

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%; font-family: Georgia, serif; font-size:8px; color:#7A6B5C;
                    padding:0 14mm; display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-style:italic;">Roam</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      margin: { top: '10mm', bottom: '16mm', left: '0mm', right: '0mm' },
      timeout: NAV_TIMEOUT_MS,
    });
  } finally {
    await page.close().catch(() => {
      /* page may already be gone if the browser crashed */
    });
  }
}
