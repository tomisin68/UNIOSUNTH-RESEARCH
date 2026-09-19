import { useSyncExternalStore } from 'react';
import { isUnlocked, subscribeToUnlock } from '../utils/coordinator';

/**
 * Live view of coordinator unlock state. Every component that shows or hides
 * something behind the PIN reads it from here, so unlocking on one screen
 * updates the header badge and the other gates in the same render.
 */
export function useUnlocked(): boolean {
  return useSyncExternalStore(subscribeToUnlock, isUnlocked, () => false);
}
