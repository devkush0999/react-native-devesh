# Research and implementation decisions

Researched on 14 September 2026 against official documentation, npm registry metadata and the actually installed package source. Documentation snippets from older ExecuTorch releases use incompatible APIs, so the installed TypeScript definitions were the implementation authority.

## Why this app

Daily notes and task planning fit an on-device model well: input is short and personal, the output is reviewable, and core utility does not depend on network connectivity or LLM availability. Medical advice and financial decisions would require a very different accuracy and verification standard. This version focuses on planning and personal information recall.

## Version matrix

| Dependency   | Selected version     | Decision                                 |
| ------------ | -------------------- | ---------------------------------------- |
| Expo         | 57.0.22              | Current stable template queried from npm |
| React Native | 0.86.3               | Expo 57 supported version                |
| React        | 19.2.3               | Expo template version                    |
| ExecuTorch   | 0.10.2               | Stable npm release; pinned               |
| Worklets     | 0.10.1               | Satisfies ExecuTorch and Expo 57         |
| Blob Util    | 0.24.x               | Required model file transport peer       |
| Target OS    | iOS 17+, Android 13+ | Native deployment targets                |

The official [compatibility table](https://docs.swmansion.com/react-native-executorch/docs/other/compatibility) explains why Expo 54-era examples should not be copied into a 0.10 project. The [installation guide](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) requires New Architecture and a custom native development build.

## AI integration

The [current chat API](https://docs.swmansion.com/react-native-executorch/docs/extensions/llm-chat-and-generation) provides `createLLMChatSession`, streamed tokens, cancellation and disposal. The package source confirmed there is no public history reset method on this session. Saathi therefore creates a new session for each independent workflow, with bounded note/task context, and disposes only after the active send promise settles. Tests cover cancellation during loading and active inference.

Qwen3 0.6B was selected as a compact multilingual starting point using the explicit `models.llm.QWEN3_0_6B.XNNPACK_8DA4W` preset. The [Qwen model card](https://huggingface.co/Qwen/Qwen3-0.6B) documents multilingual support and thinking control. Saathi requests `/no_think` and strips any remaining thinking tags before displaying/parsing output. This is not a substitute for measuring instruction-following quality on this particular quantized export.

Model URLs come from the pinned package's `v0.10.0` model registry. For a store release, record checksums and immutable upstream revisions as part of a model manifest. This initial build relies on the library's cache implementation and pinned registry configuration.

Only the XNNPACK backend is requested in `package.json`; unused vision/audio/GPU binaries are omitted. This follows the [native libraries configuration guide](https://docs.swmansion.com/react-native-executorch/docs/core-and-advanced/native-libraries). The installed `rne-build-config.json` confirms that XNNPACK is enabled and CoreML, MLX, Vulkan, OpenCV and phonemis are disabled.

The [downloading guide](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/downloading-models) documents download caching, AbortSignal support and the telemetry opt-out. Saathi passes a signal, surfaces progress/retry and calls `setTelemetryEnabled(false)` before downloading. Setup still contacts the model host and its download-counter endpoint; personal note content is never part of those requests.

## Storage and review boundary

[Expo SQLite](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/) documents its SQLCipher plugin, while [Expo storage guidance](https://docs.expo.dev/develop/user-interface/store-data/) describes the role of SecureStore. The installed SDK 57 modules provide the methods used here. Saathi configures SQLCipher in prebuild, generates a 32-byte random key, validates its hex representation before the key PRAGMA, and uses bound parameters for stored content. It checks `cipher_version` and refuses to silently fall back to plaintext storage on native.

The web adapter is intentionally different and labeled: browser localStorage is unencrypted. There is no fake web AI fallback. Notes are selected with tokenized keyword matching; no embedding model or semantic search is implied.

Zod schemas reject malformed AI output, impossible dates and oversized suggestions. The model receives no tools, no external credentials and no mutation capability. Only reviewed tasks reach Redux and the repository. Prompt instructions alone cannot make an LLM perfectly injection-resistant, so the meaningful control is the absence of automatic actions.

## Dependency audit

The initial npm audit reported 10 moderate findings through one chain: Expo's Xcode project tooling depended on `uuid@7`. Inspection showed that `xcode` calls only `uuid.v4()` to generate project identifiers. A scoped override to `uuid@11.1.1` preserves the CommonJS `v4` interface and includes the advisory fix. Validate this override when upgrading Expo, and remove it once upstream updates the dependency. Do not run `npm audit fix --force`: its suggested Expo downgrade is incompatible with this project.

## Deliberate next steps

Benchmark on physical Android/iOS hardware before selecting larger models or keeping a session resident. Evaluate a fixed English/Hinglish corpus of task extraction, dates, negation, irrelevant notes and injection-like text. Add notifications only with a permission and scheduling/reconciliation design; add OCR or speech only after the base model's memory budget is measured.
