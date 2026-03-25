'use client';
import { useState, useEffect, useCallback } from 'react';

interface UseS3UrlOptions {
  expiresIn?: number;
  autoLoad?: boolean;
}

interface UseS3UrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to obtain presigned URLs from S3 for rendering in components.
 *
 * Usage:
 *   const { url, loading } = useS3Url('s3://bucket/uuid/documentos/uuid/cedula.jpeg');
 *   return loading ? <Spinner /> : <img src={url!} />;
 */
export function useS3Url(
  keyOrRef: string | null | undefined,
  options: UseS3UrlOptions = {}
): UseS3UrlResult {
  const { expiresIn = 3600, autoLoad = true } = options;
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = useCallback(async () => {
    if (!keyOrRef) return;

    // If it's already an accessible URL (not s3://), use directly
    if (!keyOrRef.startsWith('s3://')) {
      setUrl(keyOrRef);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/s3/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyOrRef, action: 'download', expiresIn }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setUrl(data.url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error desconocido';
      setError(message);
      console.error('[useS3Url] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [keyOrRef, expiresIn]);

  useEffect(() => {
    if (autoLoad && keyOrRef) {
      fetchUrl();
    }
  }, [keyOrRef, autoLoad, fetchUrl]);

  return { url, loading, error, refresh: fetchUrl };
}
