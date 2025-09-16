export type Message = {
  id: string;
  type: "user" | "assistant";
  text: string;
  usage?: {
    cost?: number;
    latencyMs?: number;
    ttfcMs?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    promptChar?: number;
    audioUsage?: {
      cost?: number;
      char_count?: number;
      latency?: number;
    };
  };
  createdAt?: Date;
};
