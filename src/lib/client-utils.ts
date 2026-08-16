export type StreamEvent = {
  type: string;
  data: unknown;
};

export async function readNdjson(
  res: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as StreamEvent);
      } catch {
        /* skip malformed line */
      }
    }
  }
}
