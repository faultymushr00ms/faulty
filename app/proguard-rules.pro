# Default ProGuard rules for Neurima
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.annotation.Keep <methods>;
}
