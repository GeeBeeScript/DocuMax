import { readFileSync } from "node:fs";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";

/** Recorded model output from tests/fixtures/ai. */
export const recordedOutput = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests/fixtures/ai", name), "utf8");

type Reply = { text: string; finish?: "stop" | "content-filter" } | { throws: Error };

/** A mock model replying with each reply in turn (the last one repeats); records every call. */
export function replayModel(replies: Reply[]) {
  let call = 0;
  return new MockLanguageModelV4({
    provider: "test",
    modelId: "replay",
    doGenerate: async () => {
      const reply = replies[Math.min(call++, replies.length - 1)];
      if ("throws" in reply) throw reply.throws;
      return {
        content: [{ type: "text", text: reply.text }],
        finishReason: {
          unified: reply.finish ?? "stop",
          raw: reply.finish === "content-filter" ? "refusal" : "end_turn",
        },
        usage: {
          inputTokens: { total: 1200, noCache: 1200, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 300, text: 300, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}
