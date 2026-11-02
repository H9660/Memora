import { NativeModule, requireOptionalNativeModule } from 'expo';

import { CaptureStatus, MemoraSensingModuleEvents } from './MemoraSensing.types';

declare class MemoraSensingModule extends NativeModule<MemoraSensingModuleEvents> {
  // Must be called while Memora is in the foreground, after location
  // permission is granted. Rejects with ERR_MISSING_PERMISSION otherwise.
  startCapture(): Promise<void>;
  stopCapture(): void;
  getStatus(sinceMs: number): CaptureStatus;
}

// null on web, iOS, Expo Go, or a development build made before this module
// existed. Callers must handle that.
export default requireOptionalNativeModule<MemoraSensingModule>('MemoraSensing');
