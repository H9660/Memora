import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { MemoryRepository } from '@/repositories/memory-repository';
import { SqliteMemoryRepository } from '@/repositories/sqlite-memory-repository';
import { KeywordMemoryRetriever, MemoryRetriever } from '@/retrieval/memory-retriever';

export function useMemoryRepository(): MemoryRepository {
  const db = useSQLiteContext();
  return useMemo(() => new SqliteMemoryRepository(db), [db]);
}

export function useMemoryRetriever(): MemoryRetriever {
  const repository = useMemoryRepository();
  return useMemo(() => new KeywordMemoryRetriever(repository), [repository]);
}
