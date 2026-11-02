package expo.modules.memorasensing

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.sqrt

// Each sampler runs on the capture service's worker thread and writes to
// CaptureStore. start/stop must be called on that thread.

// Accelerometer at ~10 Hz (the paper used 8–15 Hz), stored as one summary
// per wall-clock minute rather than ~600 raw readings.
class MotionSampler(context: Context, private val store: CaptureStore) : SensorEventListener {
  private val sensorManager = context.getSystemService(SensorManager::class.java)

  private var windowStart = -1L
  private var count = 0
  private var sum = 0.0
  private var sumSquares = 0.0
  private var peak = 0.0

  fun start(handler: Handler): Boolean {
    val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return false
    return sensorManager.registerListener(this, sensor, SAMPLING_PERIOD_US, MAX_REPORT_LATENCY_US, handler)
  }

  fun stop() {
    sensorManager.unregisterListener(this)
    flush()
  }

  override fun onSensorChanged(event: SensorEvent) {
    // Batched events arrive late; event.timestamp is on the elapsed-realtime clock.
    val ageMs = (SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000
    val wallMs = System.currentTimeMillis() - ageMs
    val minute = wallMs - wallMs % 60_000
    if (minute != windowStart) {
      flush()
      windowStart = minute
    }

    val (x, y, z) = event.values
    val magnitude = sqrt((x * x + y * y + z * z).toDouble())
    count++
    sum += magnitude
    sumSquares += magnitude * magnitude
    peak = max(peak, magnitude)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun flush() {
    if (count == 0) return
    val mean = sum / count
    // Spread of acceleration magnitude: ~0 when still, grows with movement.
    val sd = sqrt(max(0.0, sumSquares / count - mean * mean))
    store.insert(
      "motion",
      windowStart,
      JSONObject().put("n", count).put("mean", mean).put("sd", sd).put("max", peak)
    )
    count = 0
    sum = 0.0
    sumSquares = 0.0
    peak = 0.0
  }

  private companion object {
    const val SAMPLING_PERIOD_US = 100_000 // 10 Hz
    const val MAX_REPORT_LATENCY_US = 10_000_000 // let the sensor batch up to 10 s
  }
}

class LocationSampler(context: Context, private val store: CaptureStore) {
  private val client = LocationServices.getFusedLocationProviderClient(context)

  private val callback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      for (location in result.locations) {
        val payload = JSONObject()
          .put("lat", location.latitude)
          .put("lon", location.longitude)
          .put("accuracy", location.accuracy.toDouble())
        if (location.hasSpeed()) payload.put("speed", location.speed.toDouble())
        if (location.hasAltitude()) payload.put("altitude", location.altitude)
        store.insert("location", location.time, payload)
      }
    }
  }

  // The service only starts after location permission is granted.
  // High accuracy (GPS when available) so places resolve to a building rather
  // than ~100 m Wi-Fi/cell estimates; battery cost is measured in field tests.
  @SuppressLint("MissingPermission")
  fun start(looper: Looper) {
    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
      .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
      .build()
    client.requestLocationUpdates(request, callback, looper)
  }

  fun stop() {
    client.removeLocationUpdates(callback)
  }

  private companion object {
    const val INTERVAL_MS = 2 * 60_000L
    const val MIN_INTERVAL_MS = 60_000L
  }
}

class BatterySampler(context: Context, private val store: CaptureStore) {
  private val batteryManager = context.getSystemService(BatteryManager::class.java)
  private var handler: Handler? = null

  private val tick = object : Runnable {
    override fun run() {
      store.insert(
        "battery",
        System.currentTimeMillis(),
        JSONObject()
          .put("level", batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
          .put("charging", batteryManager.isCharging)
      )
      handler?.postDelayed(this, INTERVAL_MS)
    }
  }

  fun start(handler: Handler) {
    this.handler = handler
    handler.post(tick)
  }

  fun stop() {
    handler?.removeCallbacks(tick)
    handler = null
  }

  private companion object {
    const val INTERVAL_MS = 5 * 60_000L
  }
}
