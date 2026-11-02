package expo.modules.memorasensing

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.io.Closeable
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

private const val TAG = "MemoraCapture"

// Every few minutes, listens for 3 s and stores only what kind of sound it
// was (YAMNet labels such as "Speech" or "Traffic noise") and how loud.
// The audio itself stays in memory and is discarded right after
// classification; it is never written to storage.
// Runs on its own thread because recording blocks for the clip length.
class AudioSampler(private val context: Context, private val store: CaptureStore) {
  private val thread = HandlerThread("MemoraAudio")
  private var handler: Handler? = null
  private var classifier: SoundClassifier? = null

  private val tick = object : Runnable {
    override fun run() {
      try {
        sample()
      } catch (t: Throwable) {
        Log.e(TAG, "Sound sample failed", t)
      }
      handler?.postDelayed(this, INTERVAL_MS)
    }
  }

  fun start() {
    thread.start()
    handler = Handler(thread.looper).also { it.postDelayed(tick, FIRST_DELAY_MS) }
  }

  fun stop() {
    handler?.removeCallbacks(tick)
    handler?.post {
      classifier?.close()
      classifier = null
    }
    handler = null
    thread.quitSafely()
  }

  private fun sample() {
    val audio = record() ?: return
    val takenAt = System.currentTimeMillis()

    val sounds = (classifier ?: SoundClassifier(context).also { classifier = it }).classify(audio)
    store.insert(
      "sound",
      takenAt,
      JSONObject()
        .put(
          "labels",
          JSONArray(sounds.map { (label, score) -> JSONObject().put("label", label).put("score", score.toDouble()) })
        )
        .put("loudnessDb", loudnessDb(audio))
    )
  }

  // 3 s of 16 kHz mono audio as floats in [-1, 1], or null if the microphone
  // is unavailable (e.g. during a phone call).
  @SuppressLint("MissingPermission") // The service only starts this with permission.
  private fun record(): FloatArray? {
    val sampleCount = SAMPLE_RATE * CLIP_SECONDS
    val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val recorder = AudioRecord(
      MediaRecorder.AudioSource.MIC,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      max(minBuffer, sampleCount * 2),
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      Log.w(TAG, "Microphone unavailable; skipping sound sample")
      return null
    }

    val pcm = ShortArray(sampleCount)
    var read = 0
    try {
      recorder.startRecording()
      while (read < sampleCount) {
        val n = recorder.read(pcm, read, sampleCount - read)
        if (n <= 0) break
        read += n
      }
    } finally {
      recorder.stop()
      recorder.release()
    }

    if (read < sampleCount) return null
    return FloatArray(sampleCount) { pcm[it] / 32768f }
  }

  // RMS level in dBFS: 0 is maximum, about -90 is digital silence.
  private fun loudnessDb(audio: FloatArray): Double {
    var sumSquares = 0.0
    for (s in audio) sumSquares += s * s
    val rms = sqrt(sumSquares / audio.size)
    return if (rms > 0) 20 * log10(rms) else -120.0
  }

  private companion object {
    const val SAMPLE_RATE = 16_000 // YAMNet's input rate
    const val CLIP_SECONDS = 3
    const val FIRST_DELAY_MS = 10_000L
    const val INTERVAL_MS = 5 * 60_000L
  }
}

// YAMNet (AudioSet's 521 sound classes) via LiteRT. The model takes fixed
// windows of 15,600 samples (0.975 s); scores are averaged over the clip.
class SoundClassifier(context: Context) : Closeable {
  private val interpreter: Interpreter
  private val labels: List<String>
  private val windowSize: Int
  private val classCount: Int

  init {
    val bytes = context.assets.open("yamnet.tflite").use { it.readBytes() }
    val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    model.put(bytes).rewind()
    interpreter = Interpreter(model)
    windowSize = interpreter.getInputTensor(0).numElements()
    classCount = interpreter.getOutputTensor(0).numElements()
    labels = context.assets.open("yamnet_labels.txt").bufferedReader().readLines()
    check(labels.size == classCount) { "YAMNet has $classCount outputs but ${labels.size} labels" }
  }

  fun classify(audio: FloatArray, top: Int = 3, minScore: Float = 0.1f): List<Pair<String, Float>> {
    val input = ByteBuffer.allocateDirect(windowSize * 4).order(ByteOrder.nativeOrder())
    val output = ByteBuffer.allocateDirect(classCount * 4).order(ByteOrder.nativeOrder())
    val sums = FloatArray(classCount)
    var windows = 0

    var start = 0
    while (start + windowSize <= audio.size) {
      input.clear()
      for (i in start until start + windowSize) input.putFloat(audio[i])
      input.rewind()
      output.clear()
      interpreter.run(input, output)
      output.rewind()
      for (c in 0 until classCount) sums[c] += output.getFloat()
      windows++
      start += windowSize
    }
    if (windows == 0) return emptyList()

    return sums.indices
      .map { labels[it] to sums[it] / windows }
      .filter { it.second >= minScore }
      .sortedByDescending { it.second }
      .take(top)
  }

  override fun close() = interpreter.close()
}
