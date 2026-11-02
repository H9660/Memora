package expo.modules.memorasensing

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
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
      running = true
      startedAt = System.currentTimeMillis()
      Log.i(TAG, "Capture started")
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
    running = false
    startedAt = null
    Log.i(TAG, "Capture stopped")
    super.onDestroy()
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
