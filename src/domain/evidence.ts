export type EvidenceType =
  | 'USER_NOTE'
  | 'SELF_REPORT'
  | 'LOCATION'
  | 'PHOTO'
  | 'MOTION'
  | 'AUDIO_TRANSCRIPT'
  | 'CALENDAR'
  | 'BLUETOOTH'
  | 'WEARABLE';

export type EvidenceItem = {
  id: string;
  type: EvidenceType;
  capturedAt: string; // ISO-8601 timestamp
  sourceDescription: string;
  payloadRef?: string; // e.g. local photo URI; avoid duplicating large blobs
};

// Evidence the user wrote or chose themselves, as opposed to device-collected context.
export function isUserProvided(type: EvidenceType): boolean {
  return type === 'USER_NOTE' || type === 'SELF_REPORT';
}
