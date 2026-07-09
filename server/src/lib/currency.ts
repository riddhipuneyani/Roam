/**
 * Currency conversion backed by the Frankfurter API (no key required),
 * cached server-side so rates are fetched at most once an hour.
 * All cross-currency math goes through EUR (Frankfurter's base).
 */

const FRANKFURTER = 'https://api.frankfurter.dev/v1';
const RATES_TTL_MS = 60 * 60 * 1000; // hourly, per the spec
const CURRENCIES_TTL_MS = 24 * 60 * 60 * 1000;

export class CurrencyError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'CurrencyError';
    this.status = status;
  }
}

interface RatesCache {
  fetchedAt: number;
  /** Rates relative to EUR, including EUR: 1 itself. */
  rates: Record<string, number>;
  /** The reference date Frankfurter published these rates for. */
  date: string;
}

let ratesCache: RatesCache | null = null;
let currenciesCache: { fetchedAt: number; currencies: Record<string, string> } | null = null;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new CurrencyError(`Frankfurter responded ${response.status}`);
  }
  return response.json();
}

export async function getRates(): Promise<RatesCache> {
  const fresh = ratesCache && Date.now() - ratesCache.fetchedAt < RATES_TTL_MS;
  if (fresh) {
    return ratesCache!;
  }

  try {
    const data = (await fetchJson(`${FRANKFURTER}/latest`)) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };
    ratesCache = {
      fetchedAt: Date.now(),
      rates: { ...data.rates, EUR: 1 },
      date: data.date,
    };
    return ratesCache;
  } catch (error) {
    // Serve a stale cache rather than failing, if we have one at all.
    if (ratesCache) {
      console.warn('[roam] Frankfurter unreachable — serving stale rates from', ratesCache.date);
      return ratesCache;
    }
    if (error instanceof CurrencyError) throw error;
    throw new CurrencyError('Exchange rates are unavailable right now');
  }
}

export async function getCurrencies(): Promise<Record<string, string>> {
  const fresh = currenciesCache && Date.now() - currenciesCache.fetchedAt < CURRENCIES_TTL_MS;
  if (fresh) {
    return currenciesCache!.currencies;
  }
  try {
    const currencies = (await fetchJson(`${FRANKFURTER}/currencies`)) as Record<string, string>;
    currenciesCache = { fetchedAt: Date.now(), currencies };
    return currencies;
  } catch (error) {
    if (currenciesCache) return currenciesCache.currencies;
    if (error instanceof CurrencyError) throw error;
    throw new CurrencyError('The currency list is unavailable right now');
  }
}

export function isSupported(code: string, rates: Record<string, number>): boolean {
  return Object.prototype.hasOwnProperty.call(rates, code.toUpperCase());
}

/** Convert between any two supported currencies via the EUR cross rate. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  if (fromCode === toCode) return amount;
  const fromRate = rates[fromCode];
  const toRate = rates[toCode];
  if (!fromRate) throw new CurrencyError(`Unsupported currency: ${fromCode}`, 400);
  if (!toRate) throw new CurrencyError(`Unsupported currency: ${toCode}`, 400);
  return (amount / fromRate) * toRate;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
