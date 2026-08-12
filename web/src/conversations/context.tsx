import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createConversationApi,
  deleteConversationApi,
  ensureClientSession,
  exportConversationApi,
  fetchConversations,
  importConversationApi,
  loadSession,
  renameConversationApi,
  saveSession,
  type ConversationSummary,
  type Session,
} from "../api/client";

type ConversationsContextValue = {
  session: Session | null;
  items: ConversationSummary[];
  busy: boolean;
  error: string | null;
  refresh: () => Promise<ConversationSummary[]>;
  createThread: (title?: string) => Promise<ConversationSummary>;
  renameThread: (id: string, title: string) => Promise<void>;
  deleteThread: (id: string) => Promise<string | null>;
  exportThread: (id: string) => Promise<void>;
  importThread: (payload: unknown) => Promise<ConversationSummary>;
};

const ConversationsContext = createContext<ConversationsContextValue | null>(
  null,
);

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "hilo";
}

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession());
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await ensureClientSession();
    setSession(s);
    const next = await fetchConversations(s.ownerId);
    setItems(next);
    const still = next.some((c) => c.id === s.conversationId);
    if (!still && next[0]) {
      const updated = { ...s, conversationId: next[0].id };
      saveSession(updated);
      setSession(updated);
    }
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los hilos.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const createThread = useCallback(
    async (title?: string) => {
      const s = session ?? (await ensureClientSession());
      const item = await createConversationApi(s.ownerId, title);
      await refresh();
      return item;
    },
    [refresh, session],
  );

  const renameThread = useCallback(
    async (id: string, title: string) => {
      const s = session ?? (await ensureClientSession());
      await renameConversationApi({
        ownerId: s.ownerId,
        conversationId: id,
        title,
      });
      await refresh();
    },
    [refresh, session],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      const s = session ?? (await ensureClientSession());
      await deleteConversationApi(s.ownerId, id);
      const next = await refresh();
      return next[0]?.id ?? null;
    },
    [refresh, session],
  );

  const exportThread = useCallback(
    async (id: string) => {
      const s = session ?? (await ensureClientSession());
      const payload = await exportConversationApi(s.ownerId, id);
      const title =
        items.find((c) => c.id === id)?.title ?? "hilo";
      downloadJson(`hilo-${slugTitle(title)}.json`, payload);
    },
    [items, session],
  );

  const importThread = useCallback(
    async (payload: unknown) => {
      const s = session ?? (await ensureClientSession());
      const item = await importConversationApi(s.ownerId, payload);
      await refresh();
      return item;
    },
    [refresh, session],
  );

  const value = useMemo(
    () => ({
      session,
      items,
      busy,
      error,
      refresh,
      createThread,
      renameThread,
      deleteThread,
      exportThread,
      importThread,
    }),
    [
      session,
      items,
      busy,
      error,
      refresh,
      createThread,
      renameThread,
      deleteThread,
      exportThread,
      importThread,
    ],
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error("useConversations must be used inside ConversationsProvider");
  }
  return ctx;
}
