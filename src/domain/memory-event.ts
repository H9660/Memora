import * as Crypto from 'expo-crypto';

import { EvidenceItem } from './evidence';

export type MemoryLocation = {
  latitude: number;
  longitude: number;
  placeName?: string | null;
};

export function formatPlace(location: MemoryLocation): string {
  return (
    location.placeName ??
    `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
  );
}

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
  photo?: { uri: string; capturedAt: string };
};

export type MemoryEdits = {
  note: string;
  removeLocation?: boolean;
  removePhoto?: boolean;
};

export class MemoryValidationError extends Error {}

function validateNote(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    throw new MemoryValidationError('Write a short note before saving.');
  }
  return trimmed;
}

export function getPhotoUri(event: MemoryEvent): string | undefined {
  return event.evidence.find((item) => item.type === 'PHOTO')?.payloadRef;
}

export function createMemoryEvent(input: NewMemoryInput): MemoryEvent {
  const note = validateNote(input.note);

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

  if (input.photo) {
    evidence.push({
      id: Crypto.randomUUID(),
      type: 'PHOTO',
      capturedAt: input.photo.capturedAt,
      sourceDescription: 'Photo taken with your camera',
      payloadRef: input.photo.uri,
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

// Applies the user's corrections. Removed evidence is dropped entirely rather
// than hidden, so it no longer exists in the record.
export function applyMemoryEdits(event: MemoryEvent, edits: MemoryEdits): MemoryEvent {
  const note = validateNote(edits.note);
  const evidence = event.evidence.filter(
    (item) =>
      !(edits.removeLocation && item.type === 'LOCATION') &&
      !(edits.removePhoto && item.type === 'PHOTO'),
  );

  return {
    ...event,
    note,
    location: edits.removeLocation ? undefined : event.location,
    evidence,
    updatedAt: new Date().toISOString(),
  };
}
