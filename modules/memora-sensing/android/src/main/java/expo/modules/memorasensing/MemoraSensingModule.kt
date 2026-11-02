package expo.modules.memorasensing

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MissingPermissionException(permission: String) :
  CodedException("ERR_MISSING_PERMISSION", "Permission $permission is required to start capture", null)

class MemoraSensingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MemoraSensing")

    AsyncFunction("startCapture") {
      // The service runs as a location foreground service, which Android
      // refuses to start without location permission.
      if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
        !hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
      ) {
        throw MissingPermissionException(Manifest.permission.ACCESS_FINE_LOCATION)
      }
      CaptureService.start(context)
    }

    Function("stopCapture") {
      CaptureService.stop(context)
    }

    // counts: samples per stream taken at or after sinceMs.
    // lastSampleAt: newest sample per stream, any time.
    Function("getStatus") { sinceMs: Double ->
      val store = CaptureStore.get(context)
      mapOf(
        "running" to CaptureService.running,
        "startedAt" to CaptureService.startedAt?.toDouble(),
        "counts" to store.countsSince(sinceMs.toLong()),
        "lastSampleAt" to store.latestTimes().mapValues { it.value.toDouble() },
      )
    }
  }

  private fun hasPermission(permission: String) =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}
