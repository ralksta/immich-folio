'use client';

import { useEffect } from 'react';

/**
 * Asks the browser to confirm before leaving while `dirty` is true.
 *
 * The page builder and the settings editor each carried their own copy of this
 * effect, byte for byte. The journal studio tracked `dirty` and had none, so
 * closing the tab mid-entry lost the work without a word while the same action
 * in the other two editors asked first (#538). A third copy would have been the
 * third chance to forget it.
 *
 * `returnValue` is set as well as `preventDefault()`: the property is what older
 * browsers read, and Safari still needs it. No custom string is passed because
 * no browser has shown one for years — the text is the browser's own.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);
}
