import { useEffect } from 'react';

let depth = 0;

/**
 * Full-screen pages close with the phone's back gesture. Each open page adds a history
 * entry; going back closes only the page on top, so pages can be stacked.
 * Close a page from a button with `history.back()`.
 */
export function useBackClose(onClose: () => void) {
  useEffect(() => {
    const mine = ++depth;
    // (React's dev mode mounts twice; don't add a second entry for the same page.)
    if ((history.state as { page?: number } | null)?.page !== mine) history.pushState({ page: mine }, '');
    const onPop = (e: PopStateEvent) => {
      const now = (e.state as { page?: number } | null)?.page ?? 0;
      if (now < mine) onClose();
    };
    addEventListener('popstate', onPop);
    return () => {
      removeEventListener('popstate', onPop);
      depth = Math.min(depth, mine - 1);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
