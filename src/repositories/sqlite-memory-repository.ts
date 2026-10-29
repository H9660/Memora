import { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { EvidenceItem, EvidenceType } from '@/domain/evidence';
import { MemoryEvent } from '@/domain/memory-event';

import { MemoryRepository } from './memory-repository';

export const DATABASE_NAME = 'memora.db';

const SCHEMA_VERSION = 1;

type MemoryRow = {
  id: string;
  captured_at: string;
  event_time: string | null;
  note: string;
  latitude: number | null;
  longitude: number | null;
  place_name: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  id: string;
  memory_id: string;
  type: EvidenceType;
  captured_at: string;
  source_description: string;
  payload_ref: string | null;
};

// Runs once before the app renders (SQLiteProvider onInit). Bump SCHEMA_VERSION
// and add a new block for each future schema change.
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) {
    return;
  }

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY NOT NULL,
        captured_at TEXT NOT NULL,
        event_time TEXT,
        note TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        place_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_memories_captured_at ON memories (captured_at DESC);

      CREATE TABLE evidence (
        id TEXT PRIMARY KEY NOT NULL,
        memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        source_description TEXT NOT NULL,
        payload_ref TEXT
      );
      CREATE INDEX idx_evidence_memory_id ON evidence (memory_id);
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

export class SqliteMemoryRepository implements MemoryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(event: MemoryEvent): Promise<void> {
    await this.transaction(async (txn) => {
      await txn.runAsync(
        `INSERT INTO memories
           (id, captured_at, event_time, note, latitude, longitude, place_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        memoryParams(event),
      );
      for (const item of event.evidence) {
        await insertEvidence(txn, event.id, item);
      }
    });
  }

  async getById(id: string): Promise<MemoryEvent | null> {
    const row = await this.db.getFirstAsync<MemoryRow>('SELECT * FROM memories WHERE id = ?', id);
    if (!row) {
      return null;
    }
    const [event] = await this.attachEvidence([row]);
    return event;
  }

  async listRecent(limit = 50): Promise<MemoryEvent[]> {
    const rows = await this.db.getAllAsync<MemoryRow>(
      'SELECT * FROM memories ORDER BY captured_at DESC LIMIT ?',
      limit,
    );
    return this.attachEvidence(rows);
  }

  // Simple keyword match on the note and place name. Will move behind
  // MemoryRetriever with full-text search in the search step.
  async search(query: string): Promise<MemoryEvent[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return this.listRecent();
    }
    const pattern = `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.db.getAllAsync<MemoryRow>(
      `SELECT * FROM memories
       WHERE note LIKE ? ESCAPE '\\' OR place_name LIKE ? ESCAPE '\\'
       ORDER BY captured_at DESC`,
      pattern,
      pattern,
    );
    return this.attachEvidence(rows);
  }

  async update(event: MemoryEvent): Promise<void> {
    await this.transaction(async (txn) => {
      const [id, ...rest] = memoryParams(event);
      await txn.runAsync(
        `UPDATE memories SET
           captured_at = ?, event_time = ?, note = ?, latitude = ?, longitude = ?,
           place_name = ?, created_at = ?, updated_at = ?
         WHERE id = ?`,
        [...rest, id],
      );
      await txn.runAsync('DELETE FROM evidence WHERE memory_id = ?', event.id);
      for (const item of event.evidence) {
        await insertEvidence(txn, event.id, item);
      }
    });
  }

  async delete(id: string): Promise<void> {
    // Evidence rows are removed by ON DELETE CASCADE.
    await this.db.runAsync('DELETE FROM memories WHERE id = ?', id);
  }

  // Exclusive transactions keep unrelated queries out, but aren't supported on web.
  private async transaction(task: (txn: SQLiteDatabase) => Promise<void>): Promise<void> {
    if (Platform.OS === 'web') {
      await this.db.withTransactionAsync(() => task(this.db));
    } else {
      await this.db.withExclusiveTransactionAsync(task);
    }
  }

  private async attachEvidence(rows: MemoryRow[]): Promise<MemoryEvent[]> {
    if (rows.length === 0) {
      return [];
    }
    const placeholders = rows.map(() => '?').join(', ');
    const evidenceRows = await this.db.getAllAsync<EvidenceRow>(
      `SELECT * FROM evidence WHERE memory_id IN (${placeholders}) ORDER BY captured_at`,
      rows.map((row) => row.id),
    );

    const byMemory = new Map<string, EvidenceItem[]>();
    for (const row of evidenceRows) {
      const items = byMemory.get(row.memory_id) ?? [];
      items.push(toEvidenceItem(row));
      byMemory.set(row.memory_id, items);
    }
    return rows.map((row) => toMemoryEvent(row, byMemory.get(row.id) ?? []));
  }
}

function memoryParams(event: MemoryEvent) {
  return [
    event.id,
    event.capturedAt,
    event.eventTime ?? null,
    event.note,
    event.location?.latitude ?? null,
    event.location?.longitude ?? null,
    event.location?.placeName ?? null,
    event.createdAt,
    event.updatedAt,
  ];
}

async function insertEvidence(db: SQLiteDatabase, memoryId: string, item: EvidenceItem) {
  await db.runAsync(
    `INSERT INTO evidence (id, memory_id, type, captured_at, source_description, payload_ref)
     VALUES (?, ?, ?, ?, ?, ?)`,
    item.id,
    memoryId,
    item.type,
    item.capturedAt,
    item.sourceDescription,
    item.payloadRef ?? null,
  );
}

function toMemoryEvent(row: MemoryRow, evidence: EvidenceItem[]): MemoryEvent {
  return {
    id: row.id,
    capturedAt: row.captured_at,
    eventTime: row.event_time ?? undefined,
    note: row.note,
    location:
      row.latitude !== null && row.longitude !== null
        ? { latitude: row.latitude, longitude: row.longitude, placeName: row.place_name }
        : undefined,
    evidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvidenceItem(row: EvidenceRow): EvidenceItem {
  return {
    id: row.id,
    type: row.type,
    capturedAt: row.captured_at,
    sourceDescription: row.source_description,
    payloadRef: row.payload_ref ?? undefined,
  };
}
