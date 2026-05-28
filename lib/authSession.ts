/**
 * Serializes Supabase Auth storage operations on web.
 * Prevents "Lock broken by another request with the 'steal' option" when
 * getSession, getUser, token refresh, and onAuthStateChange overlap.
 */
let authQueue: Promise<unknown> = Promise.resolve();

export function runSerializedAuth<T>(operation: () => Promise<T>): Promise<T> {
  const result = authQueue.then(operation, operation);
  authQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
