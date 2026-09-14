import Darwin
import ExpoModulesCore
import Foundation
import os
import UIKit

public final class DeviceHealthModule: Module {
  private var thermalObserver: NSObjectProtocol?
  private var previousBatteryMonitoring = false
  private var monitoring = false

  public func definition() -> ModuleDefinition {
    Name("DeviceHealth")
    Events("onThermalChange")

    AsyncFunction("start") {
      if self.monitoring { return }
      self.monitoring = true
      self.previousBatteryMonitoring = UIDevice.current.isBatteryMonitoringEnabled
      UIDevice.current.isBatteryMonitoringEnabled = true
      _ = ProcessInfo.processInfo.thermalState
      self.thermalObserver = NotificationCenter.default.addObserver(
        forName: ProcessInfo.thermalStateDidChangeNotification, object: nil, queue: .main
      ) { [weak self] _ in
        guard let self else { return }
        self.sendEvent("onThermalChange", self.thermalReading())
      }
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopMonitoring()
    }.runOnQueue(.main)

    AsyncFunction("sample") { () -> [String: Any] in
      self.sample()
    }

    OnDestroy {
      DispatchQueue.main.async { self.stopMonitoring() }
    }
  }

  private func stopMonitoring() {
    if let observer = thermalObserver { NotificationCenter.default.removeObserver(observer) }
    thermalObserver = nil
    if monitoring { UIDevice.current.isBatteryMonitoringEnabled = previousBatteryMonitoring }
    monitoring = false
  }

  private var physicalDevice: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    return true
    #endif
  }

  private func thermalReading() -> [String: Any] {
    guard physicalDevice else {
      return ["thermalLevel": NSNull(), "thermalLabel": "Unavailable on simulator", "isPhysicalDevice": false]
    }
    let level: Int
    let label: String
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: level = 0; label = "Nominal"
    case .fair: level = 1; label = "Fair"
    case .serious: level = 3; label = "Serious"
    case .critical: level = 4; label = "Critical"
    @unknown default:
      return ["thermalLevel": NSNull(), "thermalLabel": "Unknown", "isPhysicalDevice": true]
    }
    return ["thermalLevel": level, "thermalLabel": label, "isPhysicalDevice": true]
  }

  private func sample() -> [String: Any] {
    var reading = thermalReading()
    let info = ProcessInfo.processInfo
    reading["platform"] = "ios"
    reading["monotonicMs"] = info.systemUptime * 1000
    reading["processorCount"] = info.processorCount
    reading["deviceTotalMemoryMb"] = Double(info.physicalMemory) / 1_048_576
    reading["deviceAvailableMemoryMb"] = NSNull()
    // This is the current app's remaining allocation allowance, not whole-device free RAM.
    reading["appAvailableMemoryMb"] = Double(os_proc_available_memory()) / 1_048_576
    reading["batteryTemperatureC"] = NSNull()
    reading["lowPowerMode"] = info.isLowPowerModeEnabled
    // Keep the memory inspection off the UI thread; only UIKit battery access needs main.
    let battery = DispatchQueue.main.sync { (UIDevice.current.batteryLevel, UIDevice.current.batteryState) }
    let batteryLevel = battery.0
    reading["batteryPercent"] = physicalDevice && batteryLevel >= 0 ? Double(batteryLevel) * 100 : NSNull()
    let batteryState = battery.1
    reading["charging"] = physicalDevice && batteryState != .unknown
      ? (batteryState == .charging || batteryState == .full) : NSNull()

    var usage = rusage()
    if getrusage(RUSAGE_SELF, &usage) == 0 {
      reading["processCpuTimeMs"] = Double(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) * 1000
        + Double(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1000
    } else { reading["processCpuTimeMs"] = NSNull() }

    var taskInfo = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
    let capacity = Int(count)
    let result = withUnsafeMutablePointer(to: &taskInfo) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: capacity) { rebound in
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), rebound, &count)
      }
    }
    reading["appMemoryMb"] = result == KERN_SUCCESS ? Double(taskInfo.phys_footprint) / 1_048_576 : NSNull()
    reading["memoryMetric"] = "physical footprint"
    return reading
  }
}
