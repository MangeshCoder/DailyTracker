// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/SupportMediaDisplay.tsx
//  Secure support media thumbnails / links — light/dark upgrade
//
//  Logic unchanged: media fetched via the authenticated API as a blob
//  (users see their own media, managers see all).
//  Fix: object URLs are now released on unmount (the old cleanup read a
//  stale `null` and never revoked anything).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import api from '../services/api';
import type { MediaEvidence } from '../types';
import { Film, FileText, ImageOff, Loader2 } from 'lucide-react';

export const SupportMediaDisplay = ({ media }: { media: MediaEvidence[] }) => {
  if (!media || media.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {media.map((m) =>
        m.mimeType.startsWith('image/') ? (
          <SecureMediaImage key={m.id} mediaId={m.id} fileName={m.fileName} />
        ) : (
          <SecureMediaLink key={m.id} mediaId={m.id} fileName={m.fileName} mimeType={m.mimeType} />
        )
      )}
    </div>
  );
};

const SecureMediaImage = ({ mediaId, fileName }: { mediaId: number; fileName: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    api
      .get(`/support/media/${mediaId}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data as Blob);
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 h-20 w-20 justify-center flex-col rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500">
        <ImageOff className="w-4 h-4" /> Unavailable
      </span>
    );
  }
  if (!src) return <div className="h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />;

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block group" title={fileName}>
      <img
        src={src}
        alt={fileName}
        className="h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-violet-500 group-hover:ring-2 group-hover:ring-violet-500/20 transition cursor-pointer"
      />
    </a>
  );
};

const SecureMediaLink = ({ mediaId, fileName, mimeType }: { mediaId: number; fileName: string; mimeType: string }) => {
  const [loading, setLoading] = useState(false);
  const Icon = mimeType.startsWith('video/') ? Film : FileText;

  const handleOpen = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/support/media/${mediaId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Give the new tab time to load before releasing the URL
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // Ignore - user may not have access
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      title={fileName}
      className="inline-flex items-center gap-1.5 max-w-[200px] px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 hover:bg-violet-500/20 transition disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate">{loading ? 'Opening…' : fileName}</span>
    </button>
  );
};
