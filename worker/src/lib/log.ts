// Structured logs
//
// IDs, timings, status, model, prompt version only. Never tokens, words or sentences

export interface LogFields {
  requestId: string;
  route: string;
  status: number;
  total_ms: number;
  lang?: string;
  model?: string;
  prompt?: string;
  model_ms?: number;
  db_ms?: number;
  ocr_ms?: number;
  cached?: boolean;
  attempts?: number;
  error?: string;
}

export function log(fields: LogFields): void {
  console.log(JSON.stringify(fields));
}
