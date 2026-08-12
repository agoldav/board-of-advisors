/** Thin fetch client for the local/board API (proxied in Vite as /api). */

export type Session = {
  ownerId: string;
  profileId: string;
  conversationId: string;
  timezone: string;
  ownerName: string;
};

export type FigureRow = {
  id?: string;
  lineItem: string;
  value: number;
  statementSection: "assets" | "liabilities" | "equity" | "revenue" | "expense";
  confirmedByOwner: boolean;
  correctedByOwner: boolean;
};

export type ConfirmationView = {
  documentId: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  figures: FigureRow[];
  validation: {
    ok: boolean;
    identity: {
      balances: boolean;
      assets: number;
      liabilities: number;
      equity: number;
      difference: number;
    };
    subtotalMismatches: unknown[];
  };
  readyForAdvice: boolean;
  fileName?: string | null;
  source?: "upload" | "demo";
};

export type LlmStatus = {
  configured: string;
  active: "mock" | "anthropic" | string;
  anthropicKeyConfigured: boolean;
};

export type CommitmentItem = {
  id: string;
  recommendationId: string;
  text: string;
  dueDate: string;
  deferredTo: string | null;
  dismissedReason: string | null;
  closedEvidence: string | null;
  status: string;
  displayStatus: "pending" | "overdue" | "done" | "deferred" | "dismissed";
  origin: string;
  createdAt: string;
};

const SESSION_KEY = "boa.session";
const DOC_KEY = "boa.documentId";
const DOC_NAME_KEY = "boa.documentFileName";
const REC_KEY = "boa.recommendationId";

/** Deduplicate concurrent bootstraps (React Strict Mode mounts twice). */
let sessionInflight: Promise<Session> | null = null;

type StoredDoc = { id: string; ownerId: string };

async function api<T>(
  path: string,
  init: RequestInit & { ownerId?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (init.ownerId) headers.set("X-Owner-Id", init.ownerId);
  const res = await fetch(path, { ...init, headers });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-ndjson")) {
    throw new Error("Use streamFirstReading for NDJSON endpoints.");
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }
  return data;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function getDocumentId(ownerId?: string): string | null {
  const raw = localStorage.getItem(DOC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDoc | string;
    if (typeof parsed === "object" && parsed && "id" in parsed) {
      if (ownerId && parsed.ownerId !== ownerId) return null;
      return parsed.id;
    }
  } catch {
    /* legacy: plain uuid string */
  }
  if (ownerId) {
    const session = loadSession();
    if (session && session.ownerId !== ownerId) return null;
  }
  return raw;
}

export function setDocumentId(id: string | null, ownerId?: string): void {
  if (!id) {
    localStorage.removeItem(DOC_KEY);
    localStorage.removeItem(DOC_NAME_KEY);
    return;
  }
  if (ownerId) {
    const payload: StoredDoc = { id, ownerId };
    localStorage.setItem(DOC_KEY, JSON.stringify(payload));
    return;
  }
  localStorage.setItem(DOC_KEY, id);
}

export function getDocumentFileName(): string | null {
  return localStorage.getItem(DOC_NAME_KEY);
}

export function setDocumentFileName(name: string | null): void {
  if (name) localStorage.setItem(DOC_NAME_KEY, name);
  else localStorage.removeItem(DOC_NAME_KEY);
}

export function getRecommendationId(): string | null {
  return localStorage.getItem(REC_KEY);
}

export function setRecommendationId(id: string | null): void {
  if (id) localStorage.setItem(REC_KEY, id);
  else localStorage.removeItem(REC_KEY);
}

export function ensureClientSession(): Promise<Session> {
  if (sessionInflight) return sessionInflight;

  sessionInflight = (async () => {
    const existing = loadSession();
    const data = await api<Session & { ok: boolean }>("/api/session", {
      method: "POST",
      body: JSON.stringify(existing ? { ownerId: existing.ownerId } : {}),
    });
    const session: Session = {
      ownerId: data.ownerId,
      profileId: data.profileId,
      conversationId: data.conversationId,
      timezone: data.timezone,
      ownerName: data.ownerName,
    };
    if (existing && existing.ownerId !== session.ownerId) {
      setDocumentId(null);
      setRecommendationId(null);
    }
    saveSession(session);
    return session;
  })().finally(() => {
    sessionInflight = null;
  });

  return sessionInflight;
}

export async function fetchLlmStatus(): Promise<LlmStatus> {
  const data = await api<LlmStatus & { ok: boolean }>("/api/llm/status", {
    method: "GET",
  });
  return {
    configured: data.configured,
    active: data.active,
    anthropicKeyConfigured: data.anthropicKeyConfigured,
  };
}

export async function seedDemoDocument(
  ownerId: string,
): Promise<ConfirmationView> {
  const data = await api<ConfirmationView & { ok: boolean }>(
    "/api/documents/demo",
    {
      method: "POST",
      ownerId,
      body: JSON.stringify({ ownerId }),
    },
  );
  setDocumentId(data.documentId, ownerId);
  setDocumentFileName(data.fileName ?? "estados_2026_jun.pdf");
  return { ...data, fileName: data.fileName ?? "estados_2026_jun.pdf", source: "demo" };
}

/** Upload a financial-statement PDF (raw body). Uses Claude when key is set. */
export async function uploadFinancialPdf(
  ownerId: string,
  file: File,
): Promise<ConfirmationView> {
  const headers = new Headers({
    "content-type": "application/pdf",
    "X-Owner-Id": ownerId,
    "X-Filename": encodeURIComponent(file.name),
  });
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers,
    body: file,
  });
  const data = (await res.json()) as ConfirmationView & {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  const fileName = data.fileName ?? file.name;
  setDocumentId(data.documentId, ownerId);
  setDocumentFileName(fileName);
  return { ...data, fileName, source: "upload" };
}

export async function fetchConfirmation(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  const data = await api<ConfirmationView & { ok: boolean }>(
    `/api/documents/${documentId}/confirmation`,
    { method: "GET", ownerId },
  );
  const fileName = data.fileName ?? getDocumentFileName();
  if (fileName) setDocumentFileName(fileName);
  return { ...data, fileName };
}

export async function patchFigures(
  ownerId: string,
  documentId: string,
  corrections: Array<{ figureId: string; value: number; lineItem?: string }>,
): Promise<ConfirmationView> {
  return api<ConfirmationView & { ok: boolean }>(
    `/api/documents/${documentId}/figures`,
    {
      method: "PATCH",
      ownerId,
      body: JSON.stringify({ ownerId, corrections }),
    },
  );
}

export async function confirmDoc(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  return api<ConfirmationView & { ok: boolean }>(
    `/api/documents/${documentId}/confirm`,
    {
      method: "POST",
      ownerId,
      body: JSON.stringify({ ownerId }),
    },
  );
}

export async function rejectDoc(
  ownerId: string,
  documentId: string,
): Promise<ConfirmationView> {
  return api<ConfirmationView & { ok: boolean }>(
    `/api/documents/${documentId}/reject`,
    {
      method: "POST",
      ownerId,
      body: JSON.stringify({ ownerId }),
    },
  );
}

export type FirstReadingDone = {
  type: "done";
  reading: string;
  model: string;
  recommendationId: string;
  suggestedCommitment: { text: string; dueDate: string };
};

export async function streamFirstReading(args: {
  ownerId: string;
  profileId: string;
  conversationId: string;
  documentId: string;
  onDelta: (chunk: string) => void;
}): Promise<FirstReadingDone> {
  const res = await fetch("/api/readings/first", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Owner-Id": args.ownerId,
    },
    body: JSON.stringify({
      ownerId: args.ownerId,
      profileId: args.profileId,
      conversationId: args.conversationId,
      documentId: args.documentId,
    }),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: FirstReadingDone | null = null;

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as
        | { type: "delta"; text: string }
        | { type: "error"; error: string }
        | FirstReadingDone;
      if (msg.type === "delta") args.onDelta(msg.text);
      else if (msg.type === "error") throw new Error(msg.error);
      else if (msg.type === "done") done = msg;
    }
  }
  if (buffer.trim()) {
    const msg = JSON.parse(buffer) as
      | { type: "delta"; text: string }
      | { type: "error"; error: string }
      | FirstReadingDone;
    if (msg.type === "delta") args.onDelta(msg.text);
    else if (msg.type === "error") throw new Error(msg.error);
    else if (msg.type === "done") done = msg;
  }
  if (!done) throw new Error("First reading ended without a done event.");
  setRecommendationId(done.recommendationId);
  return done;
}

export async function acceptCommitment(args: {
  ownerId: string;
  recommendationId: string;
  text: string;
  dueDate: string;
}): Promise<CommitmentItem> {
  const data = await api<{ ok: boolean; item: CommitmentItem }>(
    "/api/commitments",
    {
      method: "POST",
      ownerId: args.ownerId,
      body: JSON.stringify(args),
    },
  );
  return data.item;
}

export async function fetchCommitments(
  ownerId: string,
): Promise<CommitmentItem[]> {
  const data = await api<{ ok: boolean; items: CommitmentItem[] }>(
    "/api/commitments",
    { method: "GET", ownerId },
  );
  return data.items;
}

export async function transitionCommitmentApi(args: {
  ownerId: string;
  commitmentId: string;
  to: "done" | "deferred" | "dismissed";
  dismissedReason?: string;
  deferredTo?: string;
  closedEvidence?: string;
}): Promise<CommitmentItem> {
  const data = await api<{ ok: boolean; item: CommitmentItem }>(
    `/api/commitments/${args.commitmentId}/transition`,
    {
      method: "POST",
      ownerId: args.ownerId,
      body: JSON.stringify(args),
    },
  );
  return data.item;
}

export type ParagraphAnchor = {
  kind: "paragraph";
  sectionKey: string;
  sectionTitle: string;
  excerpt: string;
  parentConversationId?: string;
  source?: "first_reading" | "chat";
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  anchor: ParagraphAnchor | null;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  advisorId: string | null;
  modelUsed: string | null;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
  attachment?: AttachmentMeta | null;
};

export type AttachmentMeta = {
  documentId: string;
  fileName: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
};

export async function fetchConversations(
  ownerId: string,
): Promise<ConversationSummary[]> {
  const data = await api<{ ok: boolean; items: ConversationSummary[] }>(
    "/api/conversations",
    { method: "GET", ownerId },
  );
  return data.items;
}

export async function fetchConversation(
  ownerId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const data = await api<{ ok: boolean; item: ConversationDetail }>(
    `/api/conversations/${conversationId}`,
    { method: "GET", ownerId },
  );
  return data.item;
}

export async function createConversationApi(
  ownerId: string,
  title?: string,
): Promise<ConversationSummary> {
  const data = await api<{ ok: boolean; item: ConversationSummary }>(
    "/api/conversations",
    {
      method: "POST",
      ownerId,
      body: JSON.stringify({ ownerId, title }),
    },
  );
  return data.item;
}

export async function renameConversationApi(args: {
  ownerId: string;
  conversationId: string;
  title: string;
}): Promise<ConversationSummary> {
  const data = await api<{ ok: boolean; item: ConversationSummary }>(
    `/api/conversations/${args.conversationId}`,
    {
      method: "PATCH",
      ownerId: args.ownerId,
      body: JSON.stringify({ ownerId: args.ownerId, title: args.title }),
    },
  );
  return data.item;
}

export async function deleteConversationApi(
  ownerId: string,
  conversationId: string,
): Promise<void> {
  await api<{ ok: boolean }>(`/api/conversations/${conversationId}`, {
    method: "DELETE",
    ownerId,
  });
}

export async function exportConversationApi(
  ownerId: string,
  conversationId: string,
): Promise<unknown> {
  const data = await api<{ ok: boolean; payload: unknown }>(
    `/api/conversations/${conversationId}/export`,
    { method: "GET", ownerId },
  );
  return data.payload;
}

export async function importConversationApi(
  ownerId: string,
  payload: unknown,
): Promise<ConversationDetail> {
  const data = await api<{ ok: boolean; item: ConversationDetail }>(
    "/api/conversations/import",
    {
      method: "POST",
      ownerId,
      body: JSON.stringify({ ownerId, payload }),
    },
  );
  return data.item;
}

export type RailKind = "advisor" | "section" | "thread";

export type RailNode = {
  id: string;
  title: string;
  kind: RailKind;
  parentId: string | null;
  sortOrder: number;
  archived: boolean;
  advisorId: string | null;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  anchor: ParagraphAnchor | null;
};

export async function fetchRail(ownerId: string): Promise<RailNode[]> {
  const data = await api<{ ok: boolean; items: RailNode[] }>("/api/rail", {
    method: "GET",
    ownerId,
  });
  return data.items;
}

export async function createRailNodeApi(args: {
  ownerId: string;
  kind: RailKind;
  title?: string;
  parentId?: string | null;
  advisorId?: string;
}): Promise<RailNode> {
  const data = await api<{ ok: boolean; item: RailNode }>("/api/rail/nodes", {
    method: "POST",
    ownerId: args.ownerId,
    body: JSON.stringify(args),
  });
  return data.item;
}

export async function patchRailNodeApi(args: {
  ownerId: string;
  nodeId: string;
  title?: string;
  archived?: boolean;
  parentId?: string | null;
  index?: number;
}): Promise<{ item?: RailNode; items?: RailNode[] }> {
  const body: Record<string, unknown> = { ownerId: args.ownerId };
  if (typeof args.title === "string") body.title = args.title;
  if (typeof args.archived === "boolean") body.archived = args.archived;
  if ("parentId" in args) body.parentId = args.parentId ?? null;
  if (typeof args.index === "number") body.index = args.index;
  const data = await api<{ ok: boolean; item?: RailNode; items?: RailNode[] }>(
    `/api/rail/nodes/${args.nodeId}`,
    {
      method: "PATCH",
      ownerId: args.ownerId,
      body: JSON.stringify(body),
    },
  );
  return data;
}

export async function deleteRailNodeApi(
  ownerId: string,
  nodeId: string,
): Promise<RailNode[]> {
  const data = await api<{ ok: boolean; items: RailNode[] }>(
    `/api/rail/nodes/${nodeId}`,
    { method: "DELETE", ownerId },
  );
  return data.items;
}

export async function ensureParagraphThread(args: {
  ownerId: string;
  sectionKey: string;
  sectionTitle: string;
  excerpt: string;
  parentConversationId?: string;
  source?: "first_reading" | "chat";
}): Promise<ConversationDetail> {
  const data = await api<{ ok: boolean; item: ConversationDetail }>(
    "/api/conversations/paragraph",
    {
      method: "POST",
      ownerId: args.ownerId,
      body: JSON.stringify(args),
    },
  );
  return data.item;
}

export async function attachConversationFile(args: {
  ownerId: string;
  conversationId: string;
  file: File;
}): Promise<AttachmentMeta> {
  const headers = new Headers({
    "content-type": args.file.type || "application/octet-stream",
    "X-Owner-Id": args.ownerId,
    "X-Filename": encodeURIComponent(args.file.name),
  });
  const res = await fetch(`/api/conversations/${args.conversationId}/attachments`, {
    method: "POST",
    headers,
    body: args.file,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    attachment?: AttachmentMeta;
    error?: string;
  };
  if (!res.ok || !data.attachment) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data.attachment;
}

/** Authenticated-ish file URL for the document pane (owner via header is not possible in iframe). */
export function documentFileUrl(documentId: string, ownerId: string): string {
  const q = new URLSearchParams({ ownerId });
  return `/api/documents/${documentId}/file?${q.toString()}`;
}

export async function sendConversationMessage(args: {
  ownerId: string;
  profileId: string;
  conversationId: string;
  question: string;
  documentId?: string | null;
}): Promise<ConversationDetail> {
  const data = await api<{ ok: boolean; item: ConversationDetail }>(
    `/api/conversations/${args.conversationId}/messages`,
    {
      method: "POST",
      ownerId: args.ownerId,
      body: JSON.stringify({
        ownerId: args.ownerId,
        profileId: args.profileId,
        question: args.question,
        documentId: args.documentId ?? undefined,
        advisorId: "finance",
      }),
    },
  );
  return data.item;
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function sectionLabel(
  s: FigureRow["statementSection"],
): string {
  switch (s) {
    case "assets":
      return "Activos";
    case "liabilities":
      return "Pasivos";
    case "equity":
      return "Patrimonio";
    case "revenue":
      return "Ingresos";
    case "expense":
      return "Gastos";
  }
}
