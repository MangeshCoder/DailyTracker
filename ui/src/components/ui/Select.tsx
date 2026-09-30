// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/ui/Select.tsx
//  Styled drop-down that replaces the browser's plain <select>.
//
//  Drop-in: same props as <select> (value, onChange, disabled, className …) and
//  the same <option value="…">Label</option> children, and onChange still gets
//  an event-like object, so `onChange={e => set(e.target.value)}` keeps working.
//  The list opens in a themed popup (light/dark), drawn on top of the page so
//  no card or modal can clip it, and works with the keyboard:
//  ↑ ↓ Home End to move · Enter/Space to pick · Esc to close · type to jump.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { placePopup } from '../popupPosition';

type OptionItem = { value: string; label: ReactNode; text: string; disabled: boolean };

export interface SelectProps {
  value?: string | number | readonly string[];
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  title?: string;
  'aria-label'?: string;
}

const textOf = (node: ReactNode): string =>
  typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(textOf).join('')
  : isValidElement(node) ? textOf((node.props as { children?: ReactNode }).children)
  : '';

/** Collect the <option> children (also inside fragments and .map() arrays) */
function readOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === 'option') {
      const text = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? text), label: el.props.children, text, disabled: !!el.props.disabled });
    } else if (el.props.children) out.push(...readOptions(el.props.children));
  });
  return out;
}

// Classes from the old <select> that only made sense for the browser's own box
const DROP = /\b(appearance-none|cursor-pointer|bg-no-repeat|bg-right)\b/g;

export function Select({ value, onChange, children, className = '', disabled, id, name, title, ...rest }: SelectProps) {
  const options = readOptions(children);
  const current = String(value ?? '');
  const selected = options.find(o => o.value === current) ?? options[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [style, setStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  const place = useCallback(() => {
    const b = buttonRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const h = listRef.current?.offsetHeight ?? Math.min(options.length * 36 + 8, 264);
    setStyle(placePopup(r, h, Math.max(r.width, 176)));
  }, [options.length]);

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex(o => o.value === current)));
    setOpen(true);
  };

  const choose = (o: OptionItem | undefined) => {
    if (!o || o.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (o.value === current) return;
    // event-like object: existing handlers read e.target.value
    const target = { value: o.value, name: name ?? '', id: id ?? '' } as unknown as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
  };

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  // keep the highlighted row in view
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const reposition = (e: Event) => { if (!listRef.current?.contains(e.target as Node)) place(); };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const move = (from: number, step: number) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step)
      if (!options[i].disabled) return i;
    return from;
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => move(i, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => move(i, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(move(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(move(options.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      // type the first letters of an option to jump to it
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const hit = options.findIndex(o => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        name={name}
        title={title}
        aria-label={rest['aria-label']}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={`${className.replace(DROP, '')} inline-flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-500' : ''}`} />
      </button>

      {open && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={style}
          className="max-h-64 overflow-y-auto p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/10 dark:shadow-black/50 text-sm"
        >
          {options.map((o, i) => {
            const isSel = o.value === current;
            return (
              <li
                key={`${o.value}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${
                  o.disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : i === active ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 cursor-pointer'
                  : 'text-slate-700 dark:text-slate-200 cursor-pointer'} ${isSel ? 'font-semibold' : ''}`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <Check className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
