# Device Health Monitor

Open **Settings → Device health & performance** or the **Health** button in the header. During an AI request the assistant and note editor also offer **View live device health**. Viewing these graphs does not unmount the running AI workflow.

## Recording

- Starts automatically before model download or inference, takes a baseline reading, then samples about every 3 seconds plus selected phase/thermal transitions.
- Includes model loading, generation and a 12-second cooldown. A manual recording can span an idle baseline, an AI request and recovery afterward.
- Stops and saves when the app backgrounds. It does not run a background service or acquire a wake lock.
- Retains the last 12 completed sessions, up to 300 readings each. A long session retains its first reading and latest readings; dropped intervals appear as graph gaps.
- CPU/memory peaks refer to retained samples. The highest OS thermal level is also retained from native events, including warnings between samples.
- Unfinished recordings are in memory until they end. An OS kill/crash can lose that active recording; completed recordings remain in the encrypted native vault.
- Graphs support metric switching, tap-to-inspect and previous/next sample controls. JSON sharing is an explicit user action through the OS share sheet. Exported recordings include measurements, not prompts, notes, device identifiers, process cumulative CPU counters or system uptime.

## What each metric means

| Metric                   | iOS                                        | Android                                          | Scope / limitation                                                                                                                      |
| ------------------------ | ------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| App CPU                  | `getrusage(RUSAGE_SELF)` deltas            | `Process.getElapsedCpuTime()` deltas             | This process only, including native AI. One busy core = 100%, so several cores can exceed 100%. It is not whole-device CPU.             |
| App RAM                  | `task_info` physical footprint             | `Debug.getPss()`                                 | Includes native model memory. Footprint and PSS have different definitions; compare on the same device.                                 |
| Device RAM               | `physicalMemory` total                     | `ActivityManager.MemoryInfo` total and available | iOS total memory is not free memory.                                                                                                    |
| App headroom             | `os_proc_available_memory()`               | Unavailable                                      | iOS estimate of remaining app allocation allowance, not free device RAM.                                                                |
| Thermal state            | `ProcessInfo.thermalState` + notifications | `PowerManager.currentThermalStatus` + listener   | Whole-device OS thermal pressure. This is an ordinal state, not degrees Celsius. Some Android vendors may provide incomplete reporting. |
| Battery heat             | Unavailable                                | `ACTION_BATTERY_CHANGED / EXTRA_TEMPERATURE`     | Android battery sensor in °C, not CPU, skin or case temperature.                                                                        |
| Battery level / charging | `UIDevice`                                 | `BatteryManager` broadcast                       | Whole-device battery level. Charging or unknown power state disables the delta comparison.                                              |
| JS delay                 | Sampling timer lateness                    | Sampling timer lateness                          | An app JS responsiveness indicator, not FPS or a benchmark of all other apps.                                                           |

Swift keeps the memory inspection off the main thread; only UIKit battery access is dispatched to main. Kotlin readings run in the module's async queue. Readings are schema-validated, nullable sensors stay null, and CPU percentages use monotonic time differences. No root access, private temperature API or special Android monitoring permission is used.

Simulator/emulator sessions are labeled. Their process RAM/CPU belong to the simulation host, and thermal/battery values are suppressed. Browser recording is disabled because mobile sensors are unavailable.

## Thermal protection

Enabled by default and configurable in Settings. A preflight reading blocks the operation if a real device already reports iOS **serious/critical**, or Android **severe or above**. Native events and subsequent samples request cancellation if that state appears during AI. Session output records `thermal-stop`. Native inference resources are disposed only once generation has settled, never while tensors are in use.

The guard is advisory, not a hardware safety guarantee. OS events can be delayed; a JS stall can delay cancellation; some native model loading operations cannot be interrupted immediately. If monitoring fails or the OS does not expose a reading, the UI shows the limitation. The app does not override OS throttling, charging or thermal controls. It cannot conclude that no battery wear, heat or effect on other apps exists.

## A useful experiment on a real phone

1. Use the same phone, power-saving setting, brightness and charging state for comparisons. Let it return to a similar starting thermal state.
2. Start a manual recording; leave the app idle for 15–30 seconds.
3. Run one short AI request, view the graphs while it runs, then allow 15–30 seconds recovery.
4. Stop and save. Compare app RAM/CPU, thermal severity, JS delay and battery readings with the idle portion.
5. Repeat with the same request in a release build. Development tooling and the monitor itself affect measurements; battery percentage is coarse for short sessions.

Use Instruments / Android Studio Profiler for deeper profiling of CPU, allocations, native threads and frame rendering. Do not intentionally heat a device or run a prolonged stress test just to produce a graph.

## Validation and limits in this workspace

- Native Swift module was autolinked, compiled and installed in the iOS simulator build. The generated Expo module provider includes `DeviceHealthModule`.
- Browser Health dialog was visually inspected, including its disabled sensor/recording state.
- Automated tests cover CPU math, unsupported readings, bounded samples, graph gaps, migration, session lifecycle, native thermal events, thermal preflight, manual recording and background cleanup.
- Real battery/thermal sensor readings and model inference on physical hardware remain unverified. Simulator UI control was unavailable in this session. Android native compilation still requires an installed Android SDK; Android JS bundling alone is not a Kotlin build.

## Official references

- [Apple thermal states](https://developer.apple.com/documentation/foundation/processinfo/thermalstate-swift.enum) and [thermal state notification](https://developer.apple.com/documentation/foundation/processinfo/thermalstatedidchangenotification).
- [Apple available app memory](https://developer.apple.com/documentation/os/os_proc_available_memory), including why it is not the device's physical free memory.
- [Android PowerManager thermal API](https://developer.android.com/reference/android/os/PowerManager) and [Android battery API](https://developer.android.com/reference/android/os/BatteryManager).
- [Android process CPU time](<https://developer.android.com/reference/android/os/Process#getElapsedCpuTime()>) and [HardwarePropertiesManager restrictions](https://developer.android.com/reference/android/os/HardwarePropertiesManager), which are why unrestricted CPU temperature / every-process monitoring is not promised.
- [Expo local native modules](https://docs.expo.dev/modules/get-started/).
- [Apple required API reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype). The generated app privacy manifest already declares `35F9.1` for in-app elapsed-time measurement. System uptime is used only to calculate deltas and is excluded from recorded/exported data.
