export type CaptureStream = 'location' | 'motion' | 'battery';

export type CaptureStatus = {
  running: boolean;
  startedAt: number | null; // epoch milliseconds
  // Samples per stream since the `sinceMs` passed to getStatus.
  counts: Partial<Record<CaptureStream, number>>;
  // Newest sample per stream, epoch milliseconds.
  lastSampleAt: Partial<Record<CaptureStream, number>>;
};

export type MemoraSensingModuleEvents = Record<string, never>;
