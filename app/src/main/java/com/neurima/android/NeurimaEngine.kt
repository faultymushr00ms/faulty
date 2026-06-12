package com.neurima.android

import kotlin.math.cos
import kotlin.math.PI

/**
 * Timing desynchronization DSP engine.
 *
 * Rather than adding tones (binaural beats), this applies a dynamically
 * varying interaural time difference to stereo audio at the sample level.
 * The delay between left and right channels oscillates at [targetFrequency],
 * creating rhythmic neural timing cues without any audible artifacts.
 *
 * Algorithm:
 *   delay(t) = maxDelaySamples * 0.5 * (1 - cos(2π * f * t))
 *
 * The right channel is read from a circular delay buffer using the computed
 * offset, while the left channel passes through unmodified.
 */
class NeurimaEngine(val sampleRate: Int = 44100) {

    // Target oscillation frequency in Hz (brain-wave band)
    var targetFrequency: Double = 4.0

    // Peak interaural delay in milliseconds
    var maxDelayMs: Double = 12.0

    private val maxBufferSamples = (sampleRate * 0.25).toInt() // 250 ms hard cap
    private val delayBuffer = FloatArray(maxBufferSamples)

    private var writePos = 0
    private var phase = 0.0   // 0.0 – 1.0, wraps each cycle

    fun reset() {
        delayBuffer.fill(0f)
        writePos = 0
        phase = 0.0
    }

    /**
     * Process [frameCount] stereo frames in-place on interleaved [samples].
     * Each frame: [L0, R0, L1, R1, …]
     */
    fun process(samples: ShortArray, frameCount: Int) {
        val phaseInc = targetFrequency / sampleRate
        val maxDelay = (maxDelayMs * sampleRate / 1000.0).toInt().coerceAtMost(maxBufferSamples - 1)

        for (i in 0 until frameCount) {
            val li = i * 2
            val ri = li + 1

            val rightIn = samples[ri] / 32768f

            // Write right channel into delay buffer
            delayBuffer[writePos] = rightIn

            // Dynamic delay oscillates between 0 and maxDelay at targetFrequency
            val delaySamples = (maxDelay * 0.5 * (1.0 - cos(2.0 * PI * phase))).toInt()

            // Read delayed right sample
            val readPos = ((writePos - delaySamples) + maxBufferSamples * 2) % maxBufferSamples
            val rightOut = delayBuffer[readPos]

            // Left channel is unchanged; right channel carries the timing offset
            samples[ri] = (rightOut * 32767f).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()

            writePos = (writePos + 1) % maxBufferSamples
            phase += phaseInc
            if (phase >= 1.0) phase -= 1.0
        }
    }
}
