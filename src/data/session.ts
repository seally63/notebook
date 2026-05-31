// Current user id, tracked in-memory and mirrored from the Supabase auth session.
// Local-first: this is null until sign-in. Data writes stamp rows with it (null while
// signed out); on sign-in we back-fill null-user rows (see auth/backfill.ts).

let _userId: string | null = null;

export const getCurrentUserId = (): string | null => _userId;
export const setCurrentUserId = (id: string | null): void => {
  _userId = id;
};
