import * as Crypto from 'expo-crypto';

import { EvidenceItem } from './evidence';

export type MemoryLocation = {
  latitude: number;
  longitude: number;
  placeName?: string | null;
};

export type MemoryEvent = {
  id: string;
  capturedAt: string;
  eventTime?: string; // Optional time the user says the event occurred
  note: string;
  location?: MemoryLocation;
  evidence: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
};

export type NewMemoryInput = {
  note: string;
  capturedAt: Date;
  location?: MemoryLocation & { capturedAt: string };
};

export class MemoryValidationError extends Error {}

export function createMemoryEvent(input: NewMemoryInput): MemoryEvent {
  const note = input.note.trim();
  if (note.length === 0) {
    throw new MemoryValidationError('Write a short note before saving.');
  }

  const capturedAt = input.capturedAt.toISOString();
  const now = new Date().toISOString();

  const evidence: EvidenceItem[] = [
    {
      id: Crypto.randomUUID(),
      type: 'USER_NOTE',
      capturedAt,
      sourceDescription: 'Written by you',
    },
  ];

  let location: MemoryLocation | undefined;
  if (input.location) {
    const { capturedAt: locationCapturedAt, ...coords } = input.location;
    location = coords;
    evidence.push({
      id: Crypto.randomUUID(),
      type: 'LOCATION',
      capturedAt: locationCapturedAt,
      sourceDescription: 'Phone location (foreground GPS)',
    });
  }

  return {
    id: Crypto.randomUUID(),
    capturedAt,
    note,
    location,
    evidence,
    createdAt: now,
    updatedAt: now,
  };
}
