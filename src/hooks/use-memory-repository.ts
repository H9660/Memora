import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { MemoryRepository } from '@/repositories/memory-repository';
import { SqliteMemoryRepository } from '@/repositories/sqlite-memory-repository';

export function useMemoryRepository(): MemoryRepository {
  const db = useSQLiteContext();
  return useMemo(() => new SqliteMemoryRepository(db), [db]);
}
