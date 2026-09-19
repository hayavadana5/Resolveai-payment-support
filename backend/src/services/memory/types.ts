import type { MemoryMode } from '../../models/types';

export interface RetrievedKnowledge {
  title: string;
  content: string;
  source: string;
  relevance: number;
}

export interface MemoryResult {
  mode: MemoryMode;
  knowledge: RetrievedKnowledge[];
  /** Populated when Cognee was attempted and failed. Never hidden from the UI. */
  fallbackReason?: string;
}
