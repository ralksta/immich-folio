import { useState, useCallback } from 'react';

export interface ExifData {
  make?: string | null;
  model?: string | null;
  lensModel?: string | null;
  focalLength?: number | null;
  fNumber?: number | null;
  exposureTime?: string | null;
  iso?: number | null;
  city?: string | null;
  country?: string | null;
}

export function useExif() {
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [exifLoading, setExifLoading] = useState(false);

  const fetchExif = useCallback((url: string) => {
    setExifLoading(true);
    setExifData(null);
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setExifData(data))
      .catch(() => setExifData(null))
      .finally(() => setExifLoading(false));
  }, []);

  const clearExif = useCallback(() => {
    setExifData(null);
  }, []);

  return { exifData, exifLoading, fetchExif, clearExif };
}
