import { MemoryEvent } from '@/domain/memory-event';
import { MemoryRepository } from '@/repositories/memory-repository';

export type MatchedField = 'note' | 'place';

export type SearchFilters = {
  since?: Date;
};

export type SearchResult = {
  memory: MemoryEvent;
  matchedFields: MatchedField[];
};

export interface MemoryRetriever {
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
}

// Local keyword search. Can later be combined with semantic retrieval, as long
// as every result still points back to a saved MemoryEvent.
export class KeywordMemoryRetriever implements MemoryRetriever {
  constructor(private readonly repository: MemoryRepository) {}

  async search(query: string, filters: SearchFilters = {}): Promise<SearchResult[]> {
    const needle = query.trim().toLowerCase();
    const memories = await this.repository.search(query);

    return memories
      .filter((memory) => !filters.since || new Date(memory.capturedAt) >= filters.since)
      .map((memory) => ({
        memory,
        matchedFields: needle ? matchedFields(memory, needle) : [],
      }));
  }
}

function matchedFields(memory: MemoryEvent, needle: string): MatchedField[] {
  const fields: MatchedField[] = [];
  if (memory.note.toLowerCase().includes(needle)) {
    fields.push('note');
  }
  if (memory.location?.placeName?.toLowerCase().includes(needle)) {
    fields.push('place');
  }
  return fields;
}
