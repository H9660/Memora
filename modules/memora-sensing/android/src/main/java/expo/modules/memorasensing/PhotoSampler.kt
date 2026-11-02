package expo.modules.memorasensing

import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import org.json.JSONObject
import java.io.File
import java.util.Calendar

private const val TAG = "MemoraCapture"

// Takes photos with the back camera while the phone is worn in a chest pouch,
// following the paper's approach: sample more often while moving.
// The light/proximity sensors are on the screen side, against the body, so
// they can't tell whether the camera is covered; instead each photo is
// checked after capture and discarded if it is too dark.
// Runs on the main thread, as CameraX requires.
class PhotoSampler(
  private val service: LifecycleService,
  private val store: CaptureStore,
  private val recentMovement: () -> Double?,
) {
  private val main = Handler(Looper.getMainLooper())
  private val directory = File(service.filesDir, "capture-photos")
  private var lastAttemptAt = 0L
  private var busy = false

  private val check = object : Runnable {
    override fun run() {
      try {
        maybeCapture()
      } catch (t: Throwable) {
        Log.e(TAG, "Photo check failed", t)
      }
      main.postDelayed(this, CHECK_INTERVAL_MS)
    }
  }

  fun start() {
    main.postDelayed(check, FIRST_CHECK_DELAY_MS)
  }

  fun stop() {
    main.removeCallbacks(check)
  }

  private fun maybeCapture() {
    if (busy) return

    val now = System.currentTimeMillis()
    val moving = (recentMovement() ?: 0.0) >= MOVING_THRESHOLD
    val gap = now - lastAttemptAt
    if (gap < (if (moving) MOVING_GAP_MS else STILL_GAP_MS)) return

    val today = store.countsSince(startOfDay(now))["photo"] ?: 0
    if (today >= DAILY_CAP) return

    capture(if (moving) "moving" else "interval")
  }

  private fun capture(trigger: String) {
    busy = true
    lastAttemptAt = System.currentTimeMillis()

    val providerFuture = ProcessCameraProvider.getInstance(service)
    providerFuture.addListener({
      val provider = try {
        providerFuture.get()
      } catch (t: Throwable) {
        Log.w(TAG, "Camera unavailable", t)
        busy = false
        return@addListener
      }

      val imageCapture = ImageCapture.Builder()
        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
        .setResolutionSelector(
          ResolutionSelector.Builder()
            .setResolutionStrategy(
              ResolutionStrategy(TARGET_SIZE, ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER)
            )
            .build()
        )
        // Phone is upright in the pouch.
        .setTargetRotation(Surface.ROTATION_0)
        .build()

      try {
        provider.unbindAll()
        provider.bindToLifecycle(service, CameraSelector.DEFAULT_BACK_CAMERA, imageCapture)
      } catch (t: Throwable) {
        // e.g. another app is using the camera
        Log.w(TAG, "Could not open camera; skipping photo", t)
        busy = false
        return@addListener
      }

      // Give auto-exposure time to settle before the shot.
      main.postDelayed({ takePicture(provider, imageCapture, trigger) }, EXPOSURE_WARMUP_MS)
    }, ContextCompat.getMainExecutor(service))
  }

  private fun takePicture(provider: ProcessCameraProvider, imageCapture: ImageCapture, trigger: String) {
    directory.mkdirs()
    val takenAt = System.currentTimeMillis()
    val file = File(directory, "$takenAt.jpg")

    imageCapture.takePicture(
      ImageCapture.OutputFileOptions.Builder(file).build(),
      ContextCompat.getMainExecutor(service),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
          provider.unbindAll()
          try {
            record(file, takenAt, trigger)
          } finally {
            busy = false
          }
        }

        override fun onError(exception: ImageCaptureException) {
          provider.unbindAll()
          file.delete()
          Log.w(TAG, "Photo capture failed", exception)
          busy = false
        }
      }
    )
  }

  private fun record(file: File, takenAt: Long, trigger: String) {
    val quality = measure(file)
    if (quality == null || quality.brightness < DARK_THRESHOLD) {
      // Covered camera or darkness: nothing worth remembering, so don't keep it.
      file.delete()
      store.insert(
        "photo_rejected",
        takenAt,
        JSONObject().put("reason", "dark").put("brightness", quality?.brightness ?: 0.0)
      )
      return
    }

    store.insert(
      "photo",
      takenAt,
      JSONObject()
        .put("uri", "file://${file.absolutePath}")
        .put("trigger", trigger)
        .put("brightness", quality.brightness)
        // Stored for tuning a blur filter on real pouch photos; not used yet.
        .put("sharpness", quality.sharpness)
    )
  }

  private class Quality(val brightness: Double, val sharpness: Double)

  // Mean luminance (0–255) and variance of the Laplacian (higher = sharper),
  // computed on a downscaled copy.
  private fun measure(file: File): Quality? {
    val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = 8 })
      ?: return null
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    bitmap.recycle()

    val luma = DoubleArray(pixels.size) { i ->
      val p = pixels[i]
      0.299 * ((p shr 16) and 0xFF) + 0.587 * ((p shr 8) and 0xFF) + 0.114 * (p and 0xFF)
    }

    var sum = 0.0
    var lapSum = 0.0
    var lapSumSquares = 0.0
    var lapCount = 0
    for (y in 0 until height) {
      for (x in 0 until width) {
        val i = y * width + x
        sum += luma[i]
        if (x in 1 until width - 1 && y in 1 until height - 1) {
          val lap = luma[i - 1] + luma[i + 1] + luma[i - width] + luma[i + width] - 4 * luma[i]
          lapSum += lap
          lapSumSquares += lap * lap
          lapCount++
        }
      }
    }

    val lapMean = if (lapCount > 0) lapSum / lapCount else 0.0
    val sharpness = if (lapCount > 0) lapSumSquares / lapCount - lapMean * lapMean else 0.0
    return Quality(brightness = sum / luma.size, sharpness = sharpness)
  }

  private fun startOfDay(now: Long): Long = Calendar.getInstance().apply {
    timeInMillis = now
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  private companion object {
    val TARGET_SIZE = Size(1280, 960)

    const val FIRST_CHECK_DELAY_MS = 5_000L
    const val CHECK_INTERVAL_MS = 30_000L
    const val MOVING_GAP_MS = 2 * 60_000L
    const val STILL_GAP_MS = 15 * 60_000L
    const val DAILY_CAP = 300
    const val EXPOSURE_WARMUP_MS = 1_000L

    // sd of acceleration magnitude (m/s²) over a minute; walking is ~0.5–2.
    const val MOVING_THRESHOLD = 0.3
    // Mean luminance below this is treated as covered/dark.
    const val DARK_THRESHOLD = 25.0
  }
}
