export type CaptureStream = 'location' | 'motion' | 'battery' | 'photo' | 'sound';

export type CaptureStatus = {
  running: boolean;
  startedAt: number | null; // epoch milliseconds
  // Samples per stream since the `sinceMs` passed to getStatus.
  counts: Partial<Record<CaptureStream, number>>;
  // Newest sample per stream, epoch milliseconds.
  lastSampleAt: Partial<Record<CaptureStream, number>>;
  latestPhotoUri: string | null;
  // Top YAMNet labels from the newest sound sample, e.g. ["Speech", "Music"].
  latestSoundLabels: string[];
};

// One row from the capture database. payload is a JSON string whose shape
// depends on the stream.
export type RawCaptureSample = {
  stream: CaptureStream | 'photo_rejected';
  t: number; // epoch milliseconds
  payload: string;
};

export type MemoraSensingModuleEvents = Record<string, never>;
