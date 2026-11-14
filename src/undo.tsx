import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './i18n';

type Show = (message: string, undo: () => void | Promise<void>) => void;
const Ctx = createContext<Show>(() => {});

/** A short message with an Undo button, shown after logging or deleting a set. */
export function UndoProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toast, setToast] = useState<{ id: number; message: string; undo: () => void | Promise<void> } | null>(null);

  const show = useCallback<Show>((message, undo) => setToast({ id: Date.now(), message, undo }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.id} className="toast" role="status">
          <span>{toast.message}</span>
          <button onClick={() => { void toast.undo(); setToast(null); }}>{t.undo}</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUndo = () => useContext(Ctx);
