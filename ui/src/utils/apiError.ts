// Turns an API error (axios) into a sentence the user can read.
// The server answers business-rule errors as { message }, model-validation
// errors as { title, errors }, and some older endpoints with plain text.
export function apiErrorMessage(error: any, fallback = 'Something went wrong'): string {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return String(data.message);
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat()[0];
    if (first) return String(first);
  }
  if (data?.title) return String(data.title);
  if (!error?.response) return 'Cannot reach the server — check your connection and try again.';
  return fallback;
}
