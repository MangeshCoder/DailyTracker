// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/hooks/useConfirm.ts
//
//  Replaces native confirm() / alert() with SweetAlert2 dialogs that follow
//  the app theme (light or dark) at the moment they open.
//
//  Usage (replaces confirm):
//    const { confirm } = useConfirm();
//    const ok = await confirm('Delete this task?');
//    if (!ok) return;
//
//  Usage (replaces alert):
//    const { alert } = useConfirm();
//    await alert('Something went wrong', 'error');
// ─────────────────────────────────────────────────────────────────────────────

import Swal, { type SweetAlertIcon } from 'sweetalert2';

// ThemeContext toggles the `dark` class on <html>, so read it at call time.
const isDarkMode = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

const themeBase = () =>
  isDarkMode()
    ? { background: 'rgb(11, 23, 57)', color: '#ECEFFA' }   // slate-900 / slate-100
    : { background: '#ffffff',         color: '#0B1739' };  // white / slate-900

const POPUP_CLASS = 'font-sans !rounded-2xl';

const ICON_COLORS: Record<SweetAlertIcon, string> = {
  success:  '#10b981',
  error:    '#f43f5e',
  warning:  '#EAB308',
  info:     '#D0800C',
  question: '#D0800C',
};

export function useConfirm() {

  // ── confirm() — replaces window.confirm() ───────────────────────────────
  //  await confirm('Delete this task?')              → red destructive
  //  await confirm('Remove member?', { icon: 'warning', confirmText: 'Remove' })
  const confirm = async (
    message: string,
    options?: {
      title?:       string;
      icon?:        SweetAlertIcon;
      confirmText?: string;
      cancelText?:  string;
      danger?:      boolean;   // true → red confirm button
    }
  ): Promise<boolean> => {
    const isDanger = options?.danger ?? true;  // destructive by default
    const result = await Swal.fire({
      ...themeBase(),
      customClass:        { popup: POPUP_CLASS },
      title:              options?.title ?? 'Are you sure?',
      text:               message,
      icon:               options?.icon ?? 'question',
      iconColor:          isDanger ? ICON_COLORS.error : ICON_COLORS.info,
      showCancelButton:   true,
      reverseButtons:     true,
      focusCancel:        isDanger,
      confirmButtonColor: isDanger ? '#e11d48' : '#B35F00',
      cancelButtonColor:  isDarkMode() ? '#4E5A80' : '#96A3D0',
      confirmButtonText:  options?.confirmText ?? 'Yes, continue',
      cancelButtonText:   options?.cancelText  ?? 'Cancel',
    });
    return result.isConfirmed;
  };

  // ── confirmTyped() — for actions that can't easily be undone ────────────
  //  await confirmTyped('Replace all data?', 'RESTORE') → true only if the
  //  person typed the word exactly
  const confirmTyped = async (
    message: string,
    word: string,
    options?: { title?: string; confirmText?: string }
  ): Promise<boolean> => {
    const result = await Swal.fire({
      ...themeBase(),
      customClass:        { popup: POPUP_CLASS, input: '!rounded-xl !text-base' },
      title:              options?.title ?? 'Are you sure?',
      text:               message,
      icon:               'warning',
      iconColor:          ICON_COLORS.warning,
      input:              'text',
      inputPlaceholder:   `Type ${word} to confirm`,
      inputAttributes:    { autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' },
      showCancelButton:   true,
      reverseButtons:     true,
      focusCancel:        false,
      confirmButtonColor: '#e11d48',
      cancelButtonColor:  isDarkMode() ? '#4E5A80' : '#96A3D0',
      confirmButtonText:  options?.confirmText ?? 'Yes, continue',
      cancelButtonText:   'Cancel',
      preConfirm: (value: string) => {
        if ((value ?? '').trim() !== word) {
          Swal.showValidationMessage(`Type ${word} (capital letters) to confirm`);
          return false;
        }
        return true;
      },
    });
    return result.isConfirmed;
  };

  // ── alert() — replaces window.alert() ───────────────────────────────────
  const alert = async (
    message: string,
    icon:    SweetAlertIcon = 'info',
    title?:  string
  ): Promise<void> => {
    await Swal.fire({
      ...themeBase(),
      customClass:        { popup: POPUP_CLASS },
      title:              title ?? (icon === 'error' ? 'Error' : icon === 'success' ? 'Done' : 'Notice'),
      text:               message,
      icon,
      iconColor:          ICON_COLORS[icon],
      confirmButtonColor: '#B35F00',
      confirmButtonText:  'OK',
    });
  };

  // ── toast() — non-blocking banner, fire and forget ──────────────────────
  const toast = (
    message: string,
    icon:    SweetAlertIcon = 'success'
  ): void => {
    Swal.fire({
      ...themeBase(),
      toast:             true,
      position:          'bottom-end',
      showConfirmButton: false,
      timer:             2500,
      timerProgressBar:  true,
      icon,
      iconColor:         ICON_COLORS[icon],
      title:             message,
      customClass:       { popup: `${POPUP_CLASS} text-sm` },
    });
  };

  return { confirm, confirmTyped, alert, toast };
}
