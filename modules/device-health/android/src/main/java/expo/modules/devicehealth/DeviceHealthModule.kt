package expo.modules.devicehealth

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceHealthModule : Module() {
  private var powerManager: PowerManager? = null
  private var thermalListener: PowerManager.OnThermalStatusChangedListener? = null

  override fun definition() = ModuleDefinition {
    Name("DeviceHealth")
    Events("onThermalChange")

    AsyncFunction("start") {
      val context = appContext.reactContext ?: return@AsyncFunction
      if (thermalListener == null) {
        powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val listener = PowerManager.OnThermalStatusChangedListener { level ->
          sendEvent("onThermalChange", thermalReading(level))
        }
        runCatching {
          powerManager?.addThermalStatusListener(context.mainExecutor, listener)
          thermalListener = listener
        }
      }
    }

    AsyncFunction("stop") { stopMonitoring() }
    AsyncFunction("sample") { sample() }
    OnDestroy { stopMonitoring() }
  }

  private fun stopMonitoring() {
    thermalListener?.let { listener -> runCatching { powerManager?.removeThermalStatusListener(listener) } }
    thermalListener = null
  }

  private fun isPhysicalDevice(): Boolean = !(Build.FINGERPRINT.startsWith("generic")
    || Build.FINGERPRINT.contains("emulator") || Build.MODEL.contains("Emulator")
    || Build.MODEL.contains("Android SDK built for") || Build.HARDWARE.contains("goldfish")
    || Build.HARDWARE.contains("ranchu"))

  private fun thermalReading(level: Int?): Map<String, Any?> {
    val physical = isPhysicalDevice()
    val supported = level?.takeIf { physical && it in 0..6 }
    val labels = listOf("None", "Light", "Moderate", "Severe", "Critical", "Emergency", "Shutdown")
    return mapOf("thermalLevel" to supported,
      "thermalLabel" to (supported?.let { labels[it] } ?: "Unavailable"),
      "isPhysicalDevice" to physical)
  }

  private fun sample(): Map<String, Any?> {
    val context = appContext.reactContext ?: throw IllegalStateException("App context is not available")
    val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    val activity = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    val memory = ActivityManager.MemoryInfo()
    val hasMemory = runCatching { activity?.getMemoryInfo(memory); activity != null }.getOrDefault(false)
    val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val temperature = battery?.takeIf { it.hasExtra(BatteryManager.EXTRA_TEMPERATURE) }
      ?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)?.div(10.0)
    val physical = isPhysicalDevice()
    val thermal = runCatching { power?.currentThermalStatus }.getOrNull()
    return thermalReading(thermal) + mapOf(
      "platform" to "android",
      "monotonicMs" to SystemClock.elapsedRealtime().toDouble(),
      "processorCount" to Runtime.getRuntime().availableProcessors(),
      "processCpuTimeMs" to Process.getElapsedCpuTime().toDouble(),
      "appMemoryMb" to runCatching { Debug.getPss() / 1024.0 }.getOrNull(),
      "memoryMetric" to "PSS",
      "deviceTotalMemoryMb" to if (hasMemory) memory.totalMem / 1048576.0 else null,
      "deviceAvailableMemoryMb" to if (hasMemory) memory.availMem / 1048576.0 else null,
      "appAvailableMemoryMb" to null,
      "batteryTemperatureC" to temperature?.takeIf { physical && it in -20.0..100.0 },
      "batteryPercent" to if (physical && level >= 0 && scale > 0) level * 100.0 / scale else null,
      "charging" to if (physical && status > 0 && status != BatteryManager.BATTERY_STATUS_UNKNOWN)
        (status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL) else null,
      "lowPowerMode" to power?.isPowerSaveMode
    )
  }
}
