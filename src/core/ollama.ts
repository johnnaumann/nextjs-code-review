export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatRequest = {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: "json";
  options?: Record<string, unknown>;
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

function getOllamaHost(): string {
  return (process.env.OLLAMA_HOST?.trim() || "http://localhost:11434").replace(/\/$/, "");
}

export async function ollamaHasModel(model: string): Promise<boolean> {
  const res = await fetch(`${getOllamaHost()}/api/tags`);
  if (!res.ok) return false;
  const tags = (await res.json()) as OllamaTagsResponse;
  return tags.models.some((m) => m.name === model);
}

export async function ollamaChatOnce(req: OllamaChatRequest): Promise<OllamaChatResponse> {
  const res = await fetch(`${getOllamaHost()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: false })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama chat failed: ${res.status} ${res.statusText}\n${body}`);
  }

  return (await res.json()) as OllamaChatResponse;
}

