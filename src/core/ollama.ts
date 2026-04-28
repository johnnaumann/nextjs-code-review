export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatOptions = {
  num_ctx?: number;
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  seed?: number;
};

export type OllamaChatRequest = {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: "json";
  options?: OllamaChatOptions;
};

export type OllamaChatResponse = {
  model: string;
  created_at: string;
  message: { role: "assistant"; content: string };
  done: boolean;
};

export type OllamaTagsResponse = {
  models: Array<{ name: string }>;
};

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 5 * 60_000;

function getOllamaHost(): string {
  return (process.env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST).replace(/\/$/, "");
}

export async function ollamaHasModel(model: string): Promise<boolean> {
  const res = await fetch(`${getOllamaHost()}/api/tags`);
  if (!res.ok) return false;
  const tags = (await res.json()) as OllamaTagsResponse;
  return tags.models.some((m) => m.name === model);
}

export async function ollamaChatOnce(
  req: OllamaChatRequest,
  init?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<OllamaChatResponse> {
  // Caller can pass an AbortSignal directly; otherwise we install our own timeout.
  const internalCtrl = init?.signal ? null : new AbortController();
  const timer = internalCtrl
    ? setTimeout(() => internalCtrl.abort(), init?.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    : null;

  try {
    const signal = init?.signal ?? internalCtrl?.signal ?? null;
    const res = await fetch(`${getOllamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, stream: false }),
      signal
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama chat failed: ${res.status} ${res.statusText}\n${body}`);
    }

    return (await res.json()) as OllamaChatResponse;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
