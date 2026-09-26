// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/SupportFileUpload.tsx
//  Drag & drop attachment box for the Support form — light/dark upgrade
//
//  Same rules: max 5 files, 5 MB each, images / PDF / Word only.
//  Fixes:
//  • ✕ (remove) button is type="button" — it no longer submits the Support form
//  • Image thumbnails reuse one object URL per file and release it (no leak)
//  • The 5-file limit also counts files dropped in the same batch
//  • File chooser pre-filters to the allowed types
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, FileText, FileImage, File as FileIcon, X, AlertCircle } from 'lucide-react';

interface UploadProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  uploadProgress: number;
}

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPT = 'image/*,.pdf,.doc,.docx';

export const SupportFileUpload = ({
  files,
  setFiles,
  uploadProgress,
}: UploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  // One object URL per image file; revoked when the list changes / unmounts
  const thumbUrls = useMemo(
    () => files.map(f => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => thumbUrls.forEach(u => u && URL.revokeObjectURL(u)), [thumbUrls]);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const accepted: File[] = [];
    let lastError = '';

    for (const file of Array.from(newFiles)) {
      if (files.length + accepted.length >= MAX_FILES) {
        lastError = `Maximum ${MAX_FILES} files allowed.`;
        break;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        lastError = `"${file.name}" is over ${MAX_SIZE_MB}MB.`;
        continue;
      }
      if (!ALLOWED_TYPES.some((type) => file.type.startsWith(type))) {
        lastError = `"${file.name}" is not a supported file type.`;
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    setError(lastError);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

  const FileTypeIcon = ({ file }: { file: File }) => {
    if (file.type.startsWith('image/')) return <FileImage className="w-5 h-5 text-violet-500" />;
    if (file.type.includes('pdf'))      return <FileText className="w-5 h-5 text-rose-500" />;
    if (file.type.includes('word'))     return <FileText className="w-5 h-5 text-blue-500" />;
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  const full = files.length >= MAX_FILES;

  return (
    <div className="col-span-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !full && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !full) { e.preventDefault(); inputRef.current?.click(); } }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
          full
            ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 cursor-not-allowed opacity-70'
            : dragging
              ? 'border-violet-500 bg-violet-500/10 cursor-copy'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-violet-400 hover:bg-violet-500/5 cursor-pointer'
        }`}
      >
        <div className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center mb-2 ${
          dragging ? 'bg-violet-500 text-white' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
        }`}>
          <UploadCloud className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {full ? 'File limit reached' : <>Drag & drop files or <span className="font-semibold text-violet-600 dark:text-violet-400">browse</span></>}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Images, PDF or Word · max {MAX_FILES} files · {MAX_SIZE_MB}MB each · {files.length}/{MAX_FILES} added
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              {thumbUrls[index] ? (
                <button type="button" onClick={() => setPreview(thumbUrls[index])} className="shrink-0" title="Preview">
                  <img
                    src={thumbUrls[index]!}
                    alt={file.name}
                    className="w-11 h-11 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                  />
                </button>
              ) : (
                <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0">
                  <FileTypeIcon file={file} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>

                {/* Upload progress */}
                {uploadProgress > 0 && (
                  <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeFile(index)}
                title="Remove file"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={preview} alt="Preview" className="max-h-[80vh] max-w-[90vw] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};
