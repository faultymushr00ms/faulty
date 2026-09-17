package com.neurima.android

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteOrder

enum class PlayerState { IDLE, PLAYING, PAUSED, STOPPED }

class NeurimaPlayer(private val context: Context) {

    val engine = NeurimaEngine()

    var onStateChange: ((PlayerState) -> Unit)? = null
    var onProgress: ((Float) -> Unit)? = null  // 0f–1f

    var state: PlayerState = PlayerState.IDLE
        private set(v) { field = v; onStateChange?.invoke(v) }

    private var playJob: Job? = null
    private val scopeJob = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Default + scopeJob)

    private var audioTrack: AudioTrack? = null
    private var sourceUri: Uri? = null

    @Volatile private var paused = false

    fun load(uri: Uri) {
        stop()
        sourceUri = uri
        state = PlayerState.IDLE
    }

    fun play() {
        if (state == PlayerState.PAUSED) {
            paused = false
            audioTrack?.play()
            state = PlayerState.PLAYING
            return
        }
        val uri = sourceUri ?: return
        engine.reset()
        paused = false

        playJob = scope.launch {
            runPlayback(uri)
        }
    }

    fun pause() {
        if (state != PlayerState.PLAYING) return
        paused = true
        audioTrack?.pause()
        state = PlayerState.PAUSED
    }

    fun stop() {
        paused = false
        scope.launch {
            playJob?.cancelAndJoin()
            withContext(Dispatchers.Main) {
                audioTrack?.stop()
                audioTrack?.release()
                audioTrack = null
                state = PlayerState.STOPPED
            }
        }
    }

    private suspend fun runPlayback(uri: Uri) {
        withContext(Dispatchers.IO) {
            val extractor = MediaExtractor()
            try {
                extractor.setDataSource(context, uri, null)

                val trackIndex = selectAudioTrack(extractor) ?: return@withContext
                extractor.selectTrack(trackIndex)

                val format = extractor.getTrackFormat(trackIndex)
                val mime = format.getString(MediaFormat.KEY_MIME)!!
                val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                val channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION))
                    format.getLong(MediaFormat.KEY_DURATION) else 0L

                engine.sampleRate.let { /* engine uses its own sampleRate field */ }
                val engineSampleRate = sampleRate

                val codec = MediaCodec.createDecoderByType(mime)
                codec.configure(format, null, null, 0)
                codec.start()

                val channelMask = if (channelCount >= 2)
                    AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO

                val minBuf = AudioTrack.getMinBufferSize(
                    sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT
                )
                val bufSize = maxOf(minBuf, 4096 * channelCount * 2)

                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(channelMask)
                            .build()
                    )
                    .setBufferSizeInBytes(bufSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

                audioTrack = track

                // Update engine sample rate to match decoded audio
                val eng = NeurimaEngine(engineSampleRate).also {
                    it.targetFrequency = engine.targetFrequency
                    it.maxDelayMs = engine.maxDelayMs
                }

                track.play()
                withContext(Dispatchers.Main) { state = PlayerState.PLAYING }

                val info = MediaCodec.BufferInfo()
                var inputDone = false
                var outputDone = false
                val pcmChunk = ShortArray(bufSize / 2)

                while (isActive && !outputDone) {
                    while (paused && isActive) {
                        kotlinx.coroutines.delay(50)
                    }

                    if (!inputDone) {
                        val inIdx = codec.dequeueInputBuffer(10_000)
                        if (inIdx >= 0) {
                            val inBuf = codec.getInputBuffer(inIdx)!!
                            val sampleSize = extractor.readSampleData(inBuf, 0)
                            if (sampleSize < 0) {
                                codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                val pts = extractor.sampleTime
                                codec.queueInputBuffer(inIdx, 0, sampleSize, pts, 0)
                                extractor.advance()
                            }
                        }
                    }

                    val outIdx = codec.dequeueOutputBuffer(info, 10_000)
                    if (outIdx >= 0) {
                        val outBuf = codec.getOutputBuffer(outIdx)!!

                        if (info.size > 0) {
                            val shortCount = info.size / 2
                            val chunk = if (shortCount <= pcmChunk.size) pcmChunk
                                        else ShortArray(shortCount)

                            outBuf.order(ByteOrder.LITTLE_ENDIAN)
                            outBuf.asShortBuffer().get(chunk, 0, shortCount)

                            // Only apply desync to stereo audio
                            if (channelCount >= 2) {
                                eng.process(chunk, shortCount / channelCount)
                            }

                            track.write(chunk, 0, shortCount)

                            if (durationUs > 0) {
                                val progress = info.presentationTimeUs.toFloat() / durationUs
                                withContext(Dispatchers.Main) { onProgress?.invoke(progress.coerceIn(0f, 1f)) }
                            }
                        }

                        codec.releaseOutputBuffer(outIdx, false)

                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            outputDone = true
                        }
                    }
                }

                codec.stop()
                codec.release()
                track.stop()
                track.release()
                audioTrack = null

                withContext(Dispatchers.Main) {
                    state = PlayerState.STOPPED
                    onProgress?.invoke(0f)
                }
            } finally {
                extractor.release()
            }
        }
    }

    private fun selectAudioTrack(extractor: MediaExtractor): Int? {
        for (i in 0 until extractor.trackCount) {
            val fmt = extractor.getTrackFormat(i)
            val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
            if (mime.startsWith("audio/")) return i
        }
        return null
    }

    fun release() {
        stop()
        scopeJob.cancel()
    }
}
