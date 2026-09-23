// ─────────────────────────────────────────────────────────────────────────────
//  FILE 2: frontend/src/hooks/useConfirm.ts
//  ACTION: CREATE new file
//
//  Replaces native confirm() and alert() with dark-themed SweetAlert2 dialogs.
//
//  Usage (replaces confirm):
//    const { confirm } = useConfirm();
//    const ok = await confirm('Delete this task?');
//    if (!ok) return;
//
//  Usage (replaces alert):
//    const { alert } = useConfirm();
//    await alert('Something went wrong', 'error');
//
//  The dark theme matches the existing Swal config in Dashboardpage.tsx.
//  background: slate-950  |  text: white  |  accent: blue-500
// ─────────────────────────────────────────────────────────────────────────────

import Swal, { SweetAlertIcon } from 'sweetalert2';

// Shared dark theme config — matches the existing Swal usage in the app
const DARK_BASE = {
  background:  'rgb(15, 23, 42)',   // slate-950
  color:       '#ffffff',
  customClass: { popup: 'font-sans rounded-xl' },
};

export function useConfirm() {

  // ── confirm() — replaces window.confirm() ───────────────────────────────
  //
  //  await confirm('Delete this task?')              → simple red destructive
  //  await confirm('Remove member?', { icon: 'warning', confirmText: 'Remove' })
  //
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
      ...DARK_BASE,
      title:              options?.title ?? 'Are you sure?',
      text:               message,
      icon:               options?.icon ?? 'question',
      iconColor:          isDanger ? '#ef4444' : '#3b82f6',
      showCancelButton:   true,
      confirmButtonColor: isDanger ? '#ef4444' : '#3b82f6',
      cancelButtonColor:  '#475569',
      confirmButtonText:  options?.confirmText ?? 'Yes, continue',
      cancelButtonText:   options?.cancelText  ?? 'Cancel',
    });
    return result.isConfirmed;
  };

  // ── alert() — replaces window.alert() ───────────────────────────────────
  //
  //  await alert('Saved successfully', 'success')
  //  await alert('Something went wrong', 'error')
  //
  const alert = async (
    message: string,
    icon:    SweetAlertIcon = 'info',
    title?:  string
  ): Promise<void> => {
    const iconColors: Record<SweetAlertIcon, string> = {
      success:  '#22c55e',
      error:    '#ef4444',
      warning:  '#f59e0b',
      info:     '#3b82f6',
      question: '#3b82f6',
    };
    await Swal.fire({
      ...DARK_BASE,
      title:             title ?? (icon === 'error' ? 'Error' : icon === 'success' ? 'Done' : 'Notice'),
      text:              message,
      icon,
      iconColor:         iconColors[icon],
      confirmButtonColor: '#3b82f6',
      confirmButtonText: 'OK',
    });
  };

  // ── toast() — non-blocking success/error banner ──────────────────────────
  //
  //  toast('Deleted successfully', 'success')
  //  No need to await — fire and forget
  //
  const toast = (
    message: string,
    icon:    SweetAlertIcon = 'success'
  ): void => {
    const iconColors: Record<SweetAlertIcon, string> = {
      success:  '#22c55e',
      error:    '#ef4444',
      warning:  '#f59e0b',
      info:     '#3b82f6',
      question: '#3b82f6',
    };
    Swal.fire({
      ...DARK_BASE,
      toast:             true,
      position:          'bottom-end',
      showConfirmButton: false,
      timer:             2500,
      timerProgressBar:  true,
      icon,
      iconColor:         iconColors[icon],
      title:             message,
      customClass:       { popup: 'font-sans rounded-xl text-sm' },
    });
  };

  return { confirm, alert, toast };
}