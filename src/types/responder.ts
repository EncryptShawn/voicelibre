export type Responder = {
  id: number;
  name: string;
  model: string;
  voice_model: string | null;
  voice: string | null;
  max_tokens: number | null;
  prompt: string;
  short_mem?: number;
  long_mem?: number;
  mem_expire?: number;
  owner: string;
};
