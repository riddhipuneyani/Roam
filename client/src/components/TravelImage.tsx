import { useState, type ImgHTMLAttributes } from 'react';
import { FALLBACK_POOL, fallbackFor } from '../lib/images';

interface TravelImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Seed for choosing a stable fallback if the photo fails to load. */
  fallbackSeed?: string;
}

/**
 * An <img> that never leaves a broken-image hole: if the curated photo is
 * unavailable it steps through the known-good fallback pool.
 */
export function TravelImage({ src, alt, fallbackSeed = 'roam', ...props }: TravelImageProps) {
  const [attempt, setAttempt] = useState(0);

  const currentSrc =
    attempt === 0
      ? src
      : FALLBACK_POOL[(FALLBACK_POOL.indexOf(fallbackFor(fallbackSeed)) + attempt) % FALLBACK_POOL.length];

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onError={() => setAttempt((a) => (a < FALLBACK_POOL.length ? a + 1 : a))}
      {...props}
    />
  );
}
