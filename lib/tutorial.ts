export const TUTORIAL_COMPLETED_KEY = 'mawqifi_tutorial_completed';

export function hasCompletedTutorial(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function completeTutorial(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
  } catch {
    /* Local persistence is optional; the tour can still be dismissed for this session. */
  }
}
