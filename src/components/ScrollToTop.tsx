import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// ── Scroll reset on navigation ────────────────────────────────────────────
// React Router keeps the DOM scroll offset across route changes, and the
// browser restores its own offset on reload. Between them, a participant who
// scrolled to the bottom of the workload scale landed halfway down the IPC
// scale and never saw the instructions or the first items.
//
// The reset runs in a layout effect so it happens before the browser paints —
// the new page is never shown mid-scroll. A POP (back/forward) is left alone
// so returning to a long list keeps the reader's place, which is what a back
// button is expected to do.

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    // Stop the browser from re-applying its remembered offset on reload.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, navigationType]);

  return null;
}
