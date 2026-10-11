/** Local view clearing must not depend on draft cleanup or server reachability. */
export async function clearLocalIdentity(clearDraft: () => Promise<void>, clearCredentials: () => Promise<void>, clearView: () => void) {
  try {
    const [draft, credentials] = await Promise.allSettled([clearDraft(), clearCredentials()]);
    return { draftCleared: draft.status === 'fulfilled', credentialsCleared: credentials.status === 'fulfilled' };
  } finally { clearView(); }
}
