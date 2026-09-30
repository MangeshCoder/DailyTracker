// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/ExcelButton.tsx
//  "Download Excel" — asks the server for an .xlsx file and saves it.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import type { AxiosResponse } from 'axios';
import { downloadBlob } from '../services/api';
import { useToast } from '../context/ToastContext';

interface Props {
  /** Asks the server for the file */
  fetch: () => Promise<AxiosResponse<Blob>>;
  /** Used when the server doesn't name the file */
  fileName: string;
  label?: string;
  className?: string;
}

/** The server's file name ("attachment; filename=…") if it sent one */
const serverName = (disposition?: string) => {
  const star = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) return decodeURIComponent(star);
  return disposition?.match(/filename="?([^";]+)"?/i)?.[1];
};

export const ExcelButton = ({ fetch, fileName, label = 'Download Excel', className = '' }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch();
      downloadBlob(res.data, serverName(res.headers?.['content-disposition']) ?? fileName);
    } catch {
      toast.error('Could not create the Excel file. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      {busy ? 'Preparing…' : label}
    </button>
  );
};
