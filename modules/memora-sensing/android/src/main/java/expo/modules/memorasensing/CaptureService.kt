package expo.modules.memorasensing

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

private const val TAG = "MemoraCapture"
private const val CHANNEL_ID = "memora_capture"
private const val NOTIFICATION_ID = 2101
private const val ACTION_STOP = "expo.modules.memorasensing.STOP"

// Always-on capture runs inside this foreground service so Android keeps it
// alive with the screen off. Its notification cannot be hidden: it is the
// user's constant reminder that Memora is capturing, and its Stop button.
class CaptureService : Service() {
  private var worker: HandlerThread? = null
  private var workerHandler: Handler? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var motion: MotionSampler? = null
  private var location: LocationSampler? = null
  private var battery: BatterySampler? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopCapture()
      return START_NOT_STICKY
    }

    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        buildNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
      )
      if (!running) {
        startSampling()
        running = true
        startedAt = System.currentTimeMillis()
        Log.i(TAG, "Capture started")
      }
    } catch (t: Throwable) {
      // Typically a missing runtime permission, or a start from the background.
      Log.e(TAG, "Could not enter the foreground; capture not started", t)
      stopSelf()
    }

    // Android won't let camera/microphone capture restart itself without the
    // user, so don't ask to be recreated after being killed.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopSampling()
    running = false
    startedAt = null
    Log.i(TAG, "Capture stopped")
    super.onDestroy()
  }

  // Sensors and database writes all run on one worker thread. A partial wake
  // lock keeps the CPU sampling with the screen off, as continuous capture
  // requires; its battery cost is measured in field testing.
  @SuppressLint("WakelockTimeout")
  private fun startSampling() {
    wakeLock = getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Memora:capture")
      .apply { acquire() }

    val thread = HandlerThread("MemoraCaptureWorker").apply { start() }
    val handler = Handler(thread.looper)
    worker = thread
    workerHandler = handler

    val store = CaptureStore.get(this)
    handler.post {
      try {
        motion = MotionSampler(this, store).also {
          if (!it.start(handler)) Log.w(TAG, "No accelerometer; motion not recorded")
        }
        location = LocationSampler(this, store).also { it.start(thread.looper) }
        battery = BatterySampler(this, store).also { it.start(handler) }
      } catch (t: Throwable) {
        Log.e(TAG, "Could not start sensors", t)
      }
    }
  }

  private fun stopSampling() {
    workerHandler?.post {
      motion?.stop()
      location?.stop()
      battery?.stop()
      motion = null
      location = null
      battery = null
    }
    worker?.quitSafely()
    worker = null
    workerHandler = null

    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private fun stopCapture() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun buildNotification() = NotificationCompat.Builder(this, ensureChannel())
    .setSmallIcon(applicationInfo.icon)
    .setContentTitle("Memora is capturing")
    .setContentText("Tap to open Memora")
    .setOngoing(true)
    .setCategory(NotificationCompat.CATEGORY_SERVICE)
    .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    .setContentIntent(openAppIntent())
    .addAction(0, "Stop", stopIntent(this))
    .build()

  private fun ensureChannel(): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Background capture",
        NotificationManager.IMPORTANCE_LOW,
      ).apply { description = "Shown while Memora is capturing in the background" }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
    return CHANNEL_ID
  }

  private fun openAppIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE)
  }

  companion object {
    @Volatile
    var running = false
      private set

    @Volatile
    var startedAt: Long? = null
      private set

    // Must be called while Memora is in the foreground: Android blocks
    // starting location/camera/microphone foreground services from the background.
    fun start(context: Context) {
      ContextCompat.startForegroundService(context, Intent(context, CaptureService::class.java))
    }

    fun stop(context: Context) {
      context.startService(Intent(context, CaptureService::class.java).setAction(ACTION_STOP))
    }

    private fun stopIntent(context: Context): PendingIntent = PendingIntent.getService(
      context,
      1,
      Intent(context, CaptureService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
