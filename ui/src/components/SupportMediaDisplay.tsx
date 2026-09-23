import { useState, useEffect } from 'react';
import api from '../services/api';
import type { MediaEvidence } from '../types';

/**
 * Displays support media with auth. Users see only their own media;
 * Managers see all. Fetches via secured API with Bearer token.
 */
export const SupportMediaDisplay = ({ media }: { media: MediaEvidence[] }) => {
  if (!media || media.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {media.map((m) =>
        m.mimeType.startsWith('image/') ? (
          <SecureMediaImage key={m.id} mediaId={m.id} fileName={m.fileName} mimeType={m.mimeType} />
        ) : (
          <SecureMediaLink key={m.id} mediaId={m.id} fileName={m.fileName} />
        )
      )}
    </div>
  );
};

const SecureMediaImage = ({
  mediaId,
  fileName,
  mimeType,
}: {
  mediaId: number;
  fileName: string;
  mimeType: string;
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/support/media/${mediaId}`, { responseType: 'blob' })
      .then((res) => {
        const blob = res.data as Blob;
        setSrc(URL.createObjectURL(blob));
      })
      .catch(() => setError(true));

    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [mediaId]);

  if (error) return <span className="text-xs text-slate-500">[Media unavailable]</span>;
  if (!src) return <div className="h-20 w-20 bg-slate-800 rounded-lg animate-pulse" />;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <img
        src={src}
        alt={fileName}
        className="h-20 w-20 object-cover rounded-lg border border-slate-700 hover:border-violet-500 transition cursor-pointer"
      />
    </a>
  );
};

const SecureMediaLink = ({ mediaId, fileName }: { mediaId: number; fileName: string }) => {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/support/media/${mediaId}`, { responseType: 'blob' });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
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
      className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 rounded-lg text-xs text-violet-400 hover:bg-slate-700 transition disabled:opacity-50"
    >
      🎬 {loading ? 'Opening...' : fileName}
    </button>
  );
};
