// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/chat/ChatAttachments.tsx
//  Chat attachments & polls — used by the chat page and the chat panel
//
//  ✅ AttachMenu      — 📎 menu: Photos & videos · Document · Camera · Poll
//  ✅ validateChatFile — same rules as the API (25 MB, allowed types)
//  ✅ ImageAttachment  — authenticated thumbnail + full-screen viewer
//  ✅ FileAttachment   — file card with type icon, size, download,
//                        inline player for audio / video
//  ✅ PollCard         — live results, one/multiple choice, close poll
//  ✅ PollComposer     — create a poll (2–10 options)
//
//  Attachments are private: files are fetched through the API with the
//  user's session (member-only endpoint) and shown from a local blob URL.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { chatApi } from '../../services/api';
import type { ChatMessage, ChatPoll } from '../../types';
import {
  Paperclip, ImageIcon, Camera, FileText, FileSpreadsheet, FileArchive, FileVideo,
  FileAudio, Presentation, File as FileIcon, Download, Play, X, Loader2, ChartNoAxesColumn,
  Plus, Trash2, Lock, Check, ImageOff,
} from 'lucide-react';

// ── Rules (mirror the API) ──────────────────────────────────────────────────
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const FILE_EXT = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'rtf', 'txt', 'csv', 'md', 'json', 'log',
  'zip', 'rar', '7z', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a',
];
export const IMAGE_ACCEPT = IMAGE_EXT.map(e => '.' + e).join(',') + ',.mp4,.webm,.mov';
export const FILE_ACCEPT = [...IMAGE_EXT, ...FILE_EXT].map(e => '.' + e).join(',');

const extOf = (name?: string) => (name?.split('.').pop() ?? '').toLowerCase();
export const isImageFile = (f: File) => IMAGE_EXT.includes(extOf(f.name));

/** Returns an error message, or null when the file can be sent */
export const validateChatFile = (f: File): string | null => {
  const ext = extOf(f.name);
  if (!IMAGE_EXT.includes(ext) && !FILE_EXT.includes(ext))
    return `${f.name}: ${ext ? `.${ext}` : 'this'} files can't be shared in chat`;
  if (f.size === 0) return `${f.name} is empty`;
  if (f.size > MAX_ATTACHMENT_BYTES) return `${f.name} is larger than 25 MB`;
  return null;
};

export const formatBytes = (n?: number) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const Portal = ({ children }: { children: ReactNode }) => createPortal(children, document.body);

// ── Authenticated blob URLs (cached per message for the session) ─────────────
const blobCache = new Map<number, Promise<string>>();

const loadBlobUrl = (message: ChatMessage) => {
  let p = blobCache.get(message.id);
  if (!p) {
    p = chatApi.getAttachment(message.attachmentUrl!).then(b => URL.createObjectURL(b));
    p.catch(() => blobCache.delete(message.id));   // allow retry after a failure
    blobCache.set(message.id, p);
  }
  return p;
};

const useBlobUrl = (message: ChatMessage, enabled = true) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !message.attachmentUrl) return;
    let alive = true;
    setFailed(false);
    loadBlobUrl(message).then(u => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [message.id, message.attachmentUrl, enabled, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  return { url, failed, retry: () => setAttempt(a => a + 1) };
};

export const downloadAttachment = async (message: ChatMessage) => {
  const blob = await chatApi.getAttachment(message.attachmentUrl!, true);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = message.attachmentName ?? 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
};

// ─────────────────────────────────────────────────────────────────────────────
//  📎 Attach menu
// ─────────────────────────────────────────────────────────────────────────────
export const AttachMenu = ({
  onFiles, onPoll, disabled,
}: {
  onFiles: (files: File[]) => void;
  onPoll: () => void;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';           // allow picking the same file again
    if (files.length) onFiles(files);
    setOpen(false);
  };

  const items = [
    { label: 'Photos & videos', icon: ImageIcon, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', onClick: () => mediaRef.current?.click() },
    { label: 'Document', icon: FileText, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', onClick: () => docRef.current?.click() },
    { label: 'Camera', icon: Camera, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', onClick: () => cameraRef.current?.click() },
    { label: 'Poll', icon: ChartNoAxesColumn, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', onClick: () => { setOpen(false); onPoll(); } },
  ];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title="Attach"
        aria-label="Attach"
        aria-expanded={open}
        className={`w-11 h-11 rounded-2xl flex items-center justify-center transition disabled:opacity-40 ${
          open
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        {open ? <Plus className="w-5 h-5 rotate-45 transition-transform" /> : <Paperclip className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 z-20 w-56 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          {items.map(it => (
            <button
              key={it.label}
              type="button"
              onClick={it.onClick}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${it.cls}`}>
                <it.icon className="w-4 h-4" />
              </span>
              {it.label}
            </button>
          ))}
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] text-slate-400 dark:text-slate-500">Up to 25 MB per file · drag & drop or paste works too</p>
        </div>
      )}

      <input ref={mediaRef} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={pick} />
      <input ref={docRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={pick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Queued files (shown above the input before sending)
// ─────────────────────────────────────────────────────────────────────────────
export const QueuedFiles = ({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) => {
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map(f => (isImageFile(f) ? URL.createObjectURL(f) : ''));
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [files]);

  if (!files.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="relative flex-shrink-0 group/q">
          {previews[i] ? (
            <img src={previews[i]} alt={f.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
          ) : (
            <div className="w-40 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 px-2.5">
              <FileTypeIcon name={f.name} className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                <p className="text-[10px] text-slate-500">{formatBytes(f.size)}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${f.name}`}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900/80 dark:bg-slate-700 text-white flex items-center justify-center hover:bg-rose-600 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  File-type icon
// ─────────────────────────────────────────────────────────────────────────────
const FileTypeIcon = ({ name, className = '' }: { name?: string; className?: string }) => {
  const ext = extOf(name);
  const map: [string[], typeof FileIcon, string][] = [
    [['pdf'], FileText, 'text-rose-500 bg-rose-500/10'],
    [['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'log', 'json'], FileText, 'text-blue-500 bg-blue-500/10'],
    [['xls', 'xlsx', 'ods', 'csv'], FileSpreadsheet, 'text-emerald-500 bg-emerald-500/10'],
    [['ppt', 'pptx'], Presentation, 'text-orange-500 bg-orange-500/10'],
    [['zip', 'rar', '7z'], FileArchive, 'text-amber-500 bg-amber-500/10'],
    [['mp4', 'webm', 'mov'], FileVideo, 'text-violet-500 bg-violet-500/10'],
    [['mp3', 'wav', 'm4a'], FileAudio, 'text-fuchsia-500 bg-fuchsia-500/10'],
  ];
  const [, Icon, cls] = map.find(([exts]) => exts.includes(ext)) ?? [[], FileIcon, 'text-slate-500 bg-slate-500/10'];
  return (
    <span className={`rounded-xl flex items-center justify-center ${cls} ${className}`}>
      <Icon className="w-1/2 h-1/2" />
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Image attachment + viewer
// ─────────────────────────────────────────────────────────────────────────────
export const ImageAttachment = ({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) => {
  const { url, failed, retry } = useBlobUrl(message);
  const [viewing, setViewing] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => url && setViewing(true)}
        className={`block overflow-hidden rounded-2xl ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'} border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-zoom-in`}
        aria-label={`View ${message.attachmentName ?? 'image'}`}
      >
        {url ? (
          <img src={url} alt={message.attachmentName ?? 'image'} className="block max-h-72 w-auto max-w-full object-contain" />
        ) : failed ? (
          <span onClick={e => { e.stopPropagation(); retry(); }} className="w-56 h-40 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-500">
            <ImageOff className="w-6 h-6" /> Couldn't load · tap to retry
          </span>
        ) : (
          <span className="w-56 h-40 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </span>
        )}
      </button>
      {viewing && url && <ImageViewer message={message} url={url} onClose={() => setViewing(false)} />}
    </>
  );
};

const ImageViewer = ({ message, url, onClose }: { message: ChatMessage; url: string; onClose: () => void }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-150"
        onClick={onClose}
        role="dialog"
        aria-label="Image viewer"
      >
        <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={e => e.stopPropagation()}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{message.attachmentName}</p>
            <p className="text-xs text-white/60">{message.senderName} · {formatBytes(message.attachmentSize)}</p>
          </div>
          <button
            type="button"
            onClick={() => downloadAttachment(message)}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <img src={url} alt={message.attachmentName ?? ''} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
        {message.content && (
          <p className="text-center text-sm text-white/90 px-6 pb-6 whitespace-pre-wrap" onClick={e => e.stopPropagation()}>{message.content}</p>
        )}
      </div>
    </Portal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  File attachment card (+ inline audio / video)
// ─────────────────────────────────────────────────────────────────────────────
export const FileAttachment = ({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) => {
  const type = message.attachmentContentType ?? '';
  const playable = type.startsWith('video/') || type.startsWith('audio/');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const { url } = useBlobUrl(message, playing);

  const download = async () => {
    setBusy(true);
    try { await downloadAttachment(message); } finally { setBusy(false); }
  };

  return (
    <div className={`w-64 max-w-full rounded-2xl ${isOwn ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'} p-2.5 shadow-sm`}>
      {playing && url && (
        type.startsWith('video/')
          ? <video src={url} controls autoPlay className="w-full rounded-xl mb-2 bg-black max-h-60" />
          : <audio src={url} controls autoPlay className="w-full mb-2" />
      )}
      <div className="flex items-center gap-2.5">
        <FileTypeIcon name={message.attachmentName} className={`w-10 h-10 flex-shrink-0 ${isOwn ? '!bg-white/15 !text-white' : ''}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isOwn ? '' : 'text-slate-800 dark:text-slate-100'}`} title={message.attachmentName}>
            {message.attachmentName}
          </p>
          <p className={`text-[11px] ${isOwn ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
            {extOf(message.attachmentName).toUpperCase()} · {formatBytes(message.attachmentSize)}
          </p>
        </div>
        {playable && !playing && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            title="Play"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isOwn ? 'hover:bg-white/15' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={busy}
          title="Download"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isOwn ? 'hover:bg-white/15' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Poll card
// ─────────────────────────────────────────────────────────────────────────────
export const PollCard = ({
  poll, currentUserId, memberNames, onVote, onClosePoll, canClose,
}: {
  poll: ChatPoll;
  currentUserId: number;
  memberNames: Record<number, string>;
  onVote: (optionIds: number[]) => void;
  onClosePoll: () => void;
  canClose: boolean;
}) => {
  const mine = poll.options.filter(o => o.voterIds.includes(currentUserId)).map(o => o.id);
  const maxVotes = Math.max(0, ...poll.options.map(o => o.voterIds.length));

  const toggle = (id: number) => {
    if (poll.isClosed) return;
    if (poll.allowMultiple) onVote(mine.includes(id) ? mine.filter(x => x !== id) : [...mine, id]);
    else onVote(mine.includes(id) ? [] : [id]);
  };

  return (
    <div className="w-72 max-w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <ChartNoAxesColumn className="w-3.5 h-3.5" /> Poll
          {poll.isClosed && (
            <span className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-slate-500 dark:text-slate-400">
              <Lock className="w-3 h-3" /> Closed
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 whitespace-pre-wrap break-words">{poll.question}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {poll.isClosed ? 'Final results' : poll.allowMultiple ? 'Select one or more' : 'Select one'}
        </p>
      </div>

      <div className="px-2.5 pb-2 space-y-1.5">
        {poll.options.map(o => {
          const count = o.voterIds.length;
          const pct = poll.totalVoters ? Math.round((count / poll.totalVoters) * 100) : 0;
          const picked = mine.includes(o.id);
          const leading = poll.isClosed && count > 0 && count === maxVotes;
          const names = o.voterIds.map(id => (id === currentUserId ? 'You' : memberNames[id] ?? 'Someone')).join(', ');
          return (
            <button
              key={o.id}
              type="button"
              disabled={poll.isClosed}
              onClick={() => toggle(o.id)}
              title={names || 'No votes yet'}
              aria-pressed={picked}
              className={`relative w-full overflow-hidden rounded-xl border text-left transition ${
                picked ? 'border-blue-500/60' : 'border-slate-200 dark:border-slate-700'
              } ${poll.isClosed ? 'cursor-default' : 'hover:border-blue-400/60'}`}
            >
              <span
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${picked ? 'bg-blue-500/15' : leading ? 'bg-emerald-500/15' : 'bg-slate-100 dark:bg-slate-700/50'}`}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center gap-2.5 px-3 py-2">
                <span className={`w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center border-2 transition ${
                  poll.allowMultiple ? 'rounded-md' : 'rounded-full'
                } ${picked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-500'}`}>
                  {picked && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{o.text}</span>
                <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{count > 0 ? `${pct}%` : ''}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-700/70 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{poll.totalVoters} {poll.totalVoters === 1 ? 'vote' : 'votes'}</span>
        {canClose && !poll.isClosed && (
          <button type="button" onClick={onClosePoll} className="font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition">
            Close poll
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Poll composer
// ─────────────────────────────────────────────────────────────────────────────
export const PollComposer = ({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { question: string; options: string[]; allowMultiple: boolean }) => Promise<unknown>;
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = options.map(o => o.trim()).filter(Boolean);
  const dupes = new Set(filled.map(o => o.toLowerCase())).size !== filled.length;
  const valid = question.trim().length > 0 && filled.length >= 2 && !dupes;

  const setOption = (i: number, v: string) => setOptions(prev => prev.map((o, j) => (j === i ? v : o)));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ question: question.trim(), options: filled, allowMultiple });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not create the poll.');
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 ' +
    'text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div role="dialog" aria-label="Create poll" className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white">
            <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <ChartNoAxesColumn className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Create Poll</h3>
                <p className="text-xs text-white/80">Ask the chat and see answers live</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Question</label>
              <input
                autoFocus
                value={question}
                onChange={e => setQuestion(e.target.value)}
                maxLength={300}
                placeholder="e.g. Where should we go for the team lunch?"
                className={`${input} mt-1.5`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Options</label>
              <div className="space-y-2 mt-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={o}
                      onChange={e => setOption(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (i === options.length - 1 && options.length < 10) setOptions(p => [...p, '']);
                        }
                      }}
                      maxLength={100}
                      placeholder={`Option ${i + 1}`}
                      className={input}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptions(p => p.filter((_, j) => j !== i))}
                        aria-label={`Remove option ${i + 1}`}
                        className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={() => setOptions(p => [...p, ''])}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500"
                >
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              )}
              {dupes && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5">Options must be different from each other.</p>}
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Allow multiple answers</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">People can pick more than one option</span>
              </span>
              <input type="checkbox" checked={allowMultiple} onChange={e => setAllowMultiple(e.target.checked)} className="sr-only peer" />
              <span className="relative w-10 h-6 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-blue-600 transition after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
            </label>

            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          </div>

          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={submit}
              disabled={!valid || saving}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChartNoAxesColumn className="w-4 h-4" />}
              Send Poll
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
