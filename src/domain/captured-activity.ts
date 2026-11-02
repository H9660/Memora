import type { RawCaptureSample } from '../../modules/memora-sensing';

export type CapturedLocation = { t: number; lat: number; lon: number; accuracy: number };
export type CapturedPhoto = { t: number; uri: string; trigger: 'moving' | 'interval' };
export type CapturedSound = { t: number; labels: { label: string; score: number }[]; loudnessDb: number };

export type HourActivity = {
  start: number; // epoch ms, start of the hour
  locations: CapturedLocation[];
  photos: CapturedPhoto[];
  sounds: CapturedSound[];
  // How often each top sound label was heard this hour, most frequent first.
  soundCounts: { label: string; count: number }[];
  movingMinutes: number;
  stillMinutes: number;
  batteryLevel: number | null; // last reading in the hour
};

export type DayActivity = {
  hours: HourActivity[]; // only hours with something captured, newest first
  photoCount: number;
  locationCount: number;
  soundCount: number;
  movingMinutes: number;
  rejectedPhotoCount: number; // dark photos discarded by the capture service
};

// Same threshold the capture service uses to decide you're moving
// (sd of acceleration magnitude over a minute, m/s²).
const MOVING_THRESHOLD = 0.3;

export function summarizeDay(samples: RawCaptureSample[]): DayActivity {
  const hours = new Map<number, HourActivity>();
  const hourFor = (t: number) => {
    const start = startOfLocalHour(t);
    let hour = hours.get(start);
    if (!hour) {
      hour = {
        start,
        locations: [],
        photos: [],
        sounds: [],
        soundCounts: [],
        movingMinutes: 0,
        stillMinutes: 0,
        batteryLevel: null,
      };
      hours.set(start, hour);
    }
    return hour;
  };

  let rejectedPhotoCount = 0;

  for (const sample of samples) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(sample.payload);
    } catch {
      continue;
    }

    switch (sample.stream) {
      case 'location':
        hourFor(sample.t).locations.push({
          t: sample.t,
          lat: Number(payload.lat),
          lon: Number(payload.lon),
          accuracy: Number(payload.accuracy),
        });
        break;
      case 'photo':
        hourFor(sample.t).photos.push({
          t: sample.t,
          uri: String(payload.uri),
          trigger: payload.trigger === 'moving' ? 'moving' : 'interval',
        });
        break;
      case 'sound':
        hourFor(sample.t).sounds.push({
          t: sample.t,
          labels: Array.isArray(payload.labels) ? payload.labels : [],
          loudnessDb: Number(payload.loudnessDb),
        });
        break;
      case 'motion': {
        const hour = hourFor(sample.t);
        if (Number(payload.sd) >= MOVING_THRESHOLD) hour.movingMinutes++;
        else hour.stillMinutes++;
        break;
      }
      case 'battery':
        hourFor(sample.t).batteryLevel = Number(payload.level);
        break;
      case 'photo_rejected':
        rejectedPhotoCount++;
        break;
    }
  }

  const sorted = [...hours.values()].sort((a, b) => b.start - a.start);
  for (const hour of sorted) {
    hour.soundCounts = countTopLabels(hour.sounds);
  }

  return {
    hours: sorted,
    photoCount: sorted.reduce((n, h) => n + h.photos.length, 0),
    locationCount: sorted.reduce((n, h) => n + h.locations.length, 0),
    soundCount: sorted.reduce((n, h) => n + h.sounds.length, 0),
    movingMinutes: sorted.reduce((n, h) => n + h.movingMinutes, 0),
    rejectedPhotoCount,
  };
}

// Counts each sample's top label, so "Speech ×3" means speech was the main
// sound in 3 of the hour's samples.
function countTopLabels(sounds: CapturedSound[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const sound of sounds) {
    const top = sound.labels[0]?.label;
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Local-time hour, so half-hour time zones (e.g. UTC+5:30) group correctly.
function startOfLocalHour(t: number): number {
  const date = new Date(t);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

export function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
