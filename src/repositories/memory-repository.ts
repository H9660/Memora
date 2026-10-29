import { MemoryEvent } from '@/domain/memory-event';

export interface MemoryRepository {
  create(event: MemoryEvent): Promise<void>;
  getById(id: string): Promise<MemoryEvent | null>;
  listRecent(limit?: number): Promise<MemoryEvent[]>;
  search(query: string): Promise<MemoryEvent[]>;
  update(event: MemoryEvent): Promise<void>;
  delete(id: string): Promise<void>;
}
