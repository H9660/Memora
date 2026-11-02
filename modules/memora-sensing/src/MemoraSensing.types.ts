export type CaptureStatus = {
  running: boolean;
  startedAt: number | null; // epoch milliseconds
};

export type MemoraSensingModuleEvents = Record<string, never>;
