package com.neurima.android

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.neurima.android.ui.theme.NeurimaTheme
import kotlin.math.PI
import kotlin.math.sin

data class Mode(val label: String, val freq: Double, val description: String)

val MODES = listOf(
    Mode("Delta",  2.0,   "Deep sleep / recovery  0.5–4 Hz"),
    Mode("Theta",  6.0,   "Creativity / REM  4–8 Hz"),
    Mode("Alpha",  10.0,  "Relaxed focus  8–12 Hz"),
    Mode("Beta",   20.0,  "Alert / active  12–30 Hz"),
    Mode("Gamma",  40.0,  "High cognition  30–80 Hz"),
    Mode("100 Hz", 100.0, "High-frequency timing  100 Hz"),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NeurimaTheme {
                NeurimaApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NeurimaApp() {
    val context = LocalContext.current

    val player = remember { NeurimaPlayer(context) }

    var playerState by remember { mutableStateOf(PlayerState.IDLE) }
    var progress by remember { mutableFloatStateOf(0f) }
    var selectedFileName by remember { mutableStateOf<String?>(null) }
    var selectedMode by remember { mutableStateOf(MODES[1]) }  // Theta default
    var intensity by remember { mutableFloatStateOf(0.6f) }    // 0–1 maps to 1–20ms

    LaunchedEffect(player) {
        player.onStateChange = { playerState = it }
        player.onProgress = { progress = it }
    }

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    val filePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            val name = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                if (idx >= 0) cursor.getString(idx) else null
            } ?: uri.lastPathSegment ?: "Audio file"
            selectedFileName = name
            player.stop()
            player.load(uri)
        }
    }

    fun applySettings() {
        player.engine.targetFrequency = selectedMode.freq
        player.engine.maxDelayMs = 1.0 + intensity * 19.0  // 1–20 ms
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Neurima", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {

            // Oscillation visualiser
            OscillationVisualiser(
                playing = playerState == PlayerState.PLAYING,
                frequency = selectedMode.freq.toFloat(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp)
            )

            // File picker
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = selectedFileName ?: "No file selected",
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    FilledTonalButton(
                        onClick = { filePicker.launch("audio/*") },
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        Icon(Icons.Default.FolderOpen, contentDescription = null)
                        Text("  Browse", fontSize = 13.sp)
                    }
                }
            }

            // Progress bar
            if (playerState == PlayerState.PLAYING || playerState == PlayerState.PAUSED) {
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Mode selector (3 × 2 grid)
            Text("Mode", style = MaterialTheme.typography.labelLarge)
            MODES.chunked(3).forEach { row ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    row.forEach { mode ->
                        val selected = mode == selectedMode
                        Button(
                            onClick = {
                                selectedMode = mode
                                applySettings()
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = if (selected)
                                ButtonDefaults.buttonColors()
                            else
                                ButtonDefaults.outlinedButtonColors()
                        ) {
                            Text(mode.label, fontSize = 11.sp, maxLines = 1)
                        }
                    }
                }
            }
            Text(
                text = selectedMode.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Intensity slider
            Text("Timing depth: ${(1.0 + intensity * 19.0).toInt()} ms", style = MaterialTheme.typography.labelLarge)
            Slider(
                value = intensity,
                onValueChange = { intensity = it; applySettings() },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.weight(1f))

            // Playback controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { player.stop() },
                    enabled = playerState != PlayerState.IDLE && playerState != PlayerState.STOPPED
                ) {
                    Icon(Icons.Default.Stop, contentDescription = "Stop", modifier = Modifier.size(32.dp))
                }

                Surface(
                    shape = RoundedCornerShape(50),
                    color = if (selectedFileName != null)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .size(72.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        IconButton(
                            onClick = {
                                applySettings()
                                when (playerState) {
                                    PlayerState.PLAYING -> player.pause()
                                    PlayerState.PAUSED  -> player.play()
                                    else                -> player.play()
                                }
                            },
                            enabled = selectedFileName != null,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            Icon(
                                imageVector = if (playerState == PlayerState.PLAYING)
                                    Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = "Play / Pause",
                                modifier = Modifier.size(40.dp),
                                tint = if (selectedFileName != null)
                                    MaterialTheme.colorScheme.onPrimary
                                else
                                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            )
                        }
                    }
                }

                // Placeholder to balance the row
                IconButton(onClick = {}, enabled = false) {
                    Icon(Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(32.dp), tint = Color.Transparent)
                }
            }

            Text(
                text = "Timing desynchronization • no added tones",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun OscillationVisualiser(
    playing: Boolean,
    frequency: Float,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "osc")

    // When playing, animate at a speed related to the frequency (clamped for visual comfort)
    val durationMs = if (playing) (3000f / frequency.coerceIn(0.5f, 10f)).toInt() else 3000

    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs = durationMs, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )

    val primary = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val midY = h / 2f
        val amp = h * 0.35f
        val steps = 200

        // Left channel (solid) — unmodified
        for (i in 0 until steps) {
            val x0 = w * i / steps
            val x1 = w * (i + 1) / steps
            val t0 = i.toFloat() / steps + phase
            val t1 = (i + 1).toFloat() / steps + phase
            val y0 = midY - amp * sin(2 * PI.toFloat() * t0).toFloat()
            val y1 = midY - amp * sin(2 * PI.toFloat() * t1).toFloat()
            drawLine(
                color = primary.copy(alpha = if (playing) 0.9f else 0.4f),
                start = Offset(x0, y0),
                end = Offset(x1, y1),
                strokeWidth = 3f,
                cap = StrokeCap.Round
            )
        }

        // Right channel (dashed appearance via alpha) — shows variable time offset
        val delayFraction = 0.15f + 0.1f * sin(2 * PI.toFloat() * phase * frequency / 6f)
        for (i in 0 until steps) {
            if (i % 3 == 0) continue // skip every 3rd segment for visual dash
            val x0 = w * i / steps
            val x1 = w * (i + 1) / steps
            val t0 = i.toFloat() / steps + phase + delayFraction
            val t1 = (i + 1).toFloat() / steps + phase + delayFraction
            val y0 = midY - amp * sin(2 * PI.toFloat() * t0).toFloat()
            val y1 = midY - amp * sin(2 * PI.toFloat() * t1).toFloat()
            drawLine(
                color = secondary.copy(alpha = if (playing) 0.7f else 0.3f),
                start = Offset(x0, y0),
                end = Offset(x1, y1),
                strokeWidth = 2f,
                cap = StrokeCap.Round
            )
        }
    }
}
