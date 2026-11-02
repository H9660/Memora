package expo.modules.memorasensing

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

// Raw samples from the capture service. The app later turns these into
// memory events; nothing here is shown to the user directly.
class CaptureStore private constructor(context: Context) :
  SQLiteOpenHelper(context, DATABASE_NAME, null, SCHEMA_VERSION) {

  override fun onConfigure(db: SQLiteDatabase) {
    db.enableWriteAheadLogging()
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream TEXT NOT NULL,
        t INTEGER NOT NULL,
        payload TEXT NOT NULL
      )
      """
    )
    db.execSQL("CREATE INDEX idx_samples_stream_t ON samples (stream, t)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

  // t is wall-clock epoch milliseconds of when the sample was taken.
  fun insert(stream: String, t: Long, payload: JSONObject) {
    writableDatabase.insert(
      "samples",
      null,
      ContentValues().apply {
        put("stream", stream)
        put("t", t)
        put("payload", payload.toString())
      }
    )
  }

  fun countsSince(sinceMs: Long): Map<String, Int> {
    val counts = mutableMapOf<String, Int>()
    readableDatabase.rawQuery(
      "SELECT stream, COUNT(*) FROM samples WHERE t >= ? GROUP BY stream",
      arrayOf(sinceMs.toString())
    ).use { cursor ->
      while (cursor.moveToNext()) {
        counts[cursor.getString(0)] = cursor.getInt(1)
      }
    }
    return counts
  }

  fun latestTimes(): Map<String, Long> {
    val times = mutableMapOf<String, Long>()
    readableDatabase.rawQuery("SELECT stream, MAX(t) FROM samples GROUP BY stream", null).use { cursor ->
      while (cursor.moveToNext()) {
        times[cursor.getString(0)] = cursor.getLong(1)
      }
    }
    return times
  }

  // All samples with fromMs <= t < toMs, oldest first. Payloads stay JSON
  // strings; the app parses them.
  fun samplesBetween(fromMs: Long, toMs: Long): List<Map<String, Any>> {
    val samples = mutableListOf<Map<String, Any>>()
    readableDatabase.rawQuery(
      "SELECT stream, t, payload FROM samples WHERE t >= ? AND t < ? ORDER BY t",
      arrayOf(fromMs.toString(), toMs.toString())
    ).use { cursor ->
      while (cursor.moveToNext()) {
        samples.add(
          mapOf(
            "stream" to cursor.getString(0),
            "t" to cursor.getLong(1).toDouble(),
            "payload" to cursor.getString(2),
          )
        )
      }
    }
    return samples
  }

  fun latestPayload(stream: String): JSONObject? {
    readableDatabase.rawQuery(
      "SELECT payload FROM samples WHERE stream = ? ORDER BY t DESC LIMIT 1",
      arrayOf(stream)
    ).use { cursor ->
      return if (cursor.moveToFirst()) JSONObject(cursor.getString(0)) else null
    }
  }

  companion object {
    const val DATABASE_NAME = "capture.db"
    private const val SCHEMA_VERSION = 1

    @Volatile
    private var instance: CaptureStore? = null

    fun get(context: Context): CaptureStore =
      instance ?: synchronized(this) {
        instance ?: CaptureStore(context.applicationContext).also { instance = it }
      }
  }
}
