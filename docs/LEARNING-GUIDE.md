# Saathi se seekho: Learning Guide (8 LPA → 15 LPA)

> Yeh document ek mentor ki tarah likha gaya hai. Maqsad hai: **is app mein jo cheezein use hui hain, unhe samjho → khud todo-phodo → naye features banao → agla app banao.**
> Har topic mein 4 cheezein hain: **Kya hai · Kis liye use hota hai · Is app mein kahan hai · Khud karke dekho.**

---

## Part 0: Seekhne ka tareeka (har app ke saath yahi loop chalao)

```text
1. Banao       → feature implement karo (docs dekh ke, copy-paste kam)
2. Todo        → jaan-boojh ke galat karo: dependency hatao, cancel mat karo, dekho kya tootta hai
3. Likho       → docs/LEARNINGS.md mein 5 line: "kya seekha, kyun zaroori hai, alternative kya tha"
4. Bolo        → 2 minute mein aloud explain karo (interview practice)
5. Commit      → ek feature = ek saaf commit ("feat: add task reminders with expo-notifications")
```

15 LPA wale interviews mein "maine use kiya" nahi, **"maine yeh kyun chuna aur kya tradeoff tha"** poochha jata hai. Step 2 aur 3 wahi skill banate hain.

---

## Part 1: Is app ke concepts, ek-ek karke

### 1.1 React Native + Expo (Dev Build, Prebuild)

- **Kya hai:** React Native se JavaScript/TypeScript mein Android + iOS app banti hai. Expo uske upar tooling hai (build, native config, libraries).
- **Kis liye:** Ek codebase se do platform. Expo ki wajah se native folders (`ios/`, `android/`) manually maintain nahi karne padte.
- **3 cheezein jo confuse karti hain:**
  | Term            | Matlab                                                                              |
  | --------------- | ----------------------------------------------------------------------------------- |
  | **Expo Go**     | Ready-made app jisme sirf Expo ki built-in native libraries hoti hain               |
  | **Dev Build**   | Tumhari apni app ka debug version, jisme tumhari custom native libraries bhi hain   |
  | **Prebuild / CNG** | `app.json` se `ios/` aur `android/` folders auto-generate karna                  |
- **Is app mein:** [app.json](../app.json) ke `plugins` (SQLCipher, build properties). ExecuTorch aur SQLCipher native code hain, isliye yahan **Expo Go nahi chalta, dev build chahiye**.
- **Khud karke dekho:**
  1. `app.json` mein `useSQLCipher: false` karo → `npx expo prebuild --clean` → `ios/Podfile` mein diff dekho.
  2. `ios/` folder delete karke `npm run ios` chalao. Samjho ki folder dobara kaise ban gaya.
- **Interview sawal:** "Expo Go vs development build?" · "Config plugin kya karta hai?"

### 1.2 TypeScript (strict mode)

- **Kya hai:** JavaScript + types. Galti compile time par pakdi jaati hai.
- **Kis liye:** Bade codebase mein refactor safely karna, autocomplete, team mein contract.
- **Is app mein:** [tsconfig.json](../tsconfig.json) mein `strict` + `noUncheckedIndexedAccess`. Isliye `array[0]` ka type `Item | undefined` hota hai aur code mein `!` ya `?.` dikhta hai.
- **Khud karke dekho:** `noUncheckedIndexedAccess` hatao aur `npm run typecheck` chalao. Phir wapas lagao aur dekho kitni jagah crash ho sakta tha.
- **Seekhne layak:** `z.infer`, `Pick`, `Omit`, `Partial`, discriminated unions (`status: 'idle' | 'ready'`), `as const`.

### 1.3 Redux Toolkit: global state

- **Kya hai:** App-wide state ek jagah (store). Change sirf "action" dispatch karke hota hai.
- **Kis liye:** Jab bahut saari screens ek hi data padhti/likhti hain (notes, tasks, cart, user).
- **Is app mein:** [store.ts](../src/store/store.ts): `createSlice` (reducers + actions), `configureStore`, typed hooks `useAppSelector` / `useAppDispatch`. `store.subscribe` se har change par data save hota hai.
- **Kab kya use karte hain** (bahut poochha jata hai):
  | Tool                   | Kis type ki state                          | Example                          |
  | ---------------------- | ------------------------------------------ | -------------------------------- |
  | `useState`             | Ek component ki local state                | Input text, modal open/close     |
  | Context                | Kam badalne wali global cheez              | Theme, language                  |
  | **Redux Toolkit**      | Badi, shared, client-side state            | Notes, cart, bade team projects  |
  | Zustand                | Wahi, lekin kam boilerplate                | Chhote/medium apps               |
  | **TanStack Query**     | **Server** se aaya data (cache, refetch)   | Product list, profile API        |
  | RTK Query              | TanStack jaisa, Redux ke andar             | Already Redux wale projects      |
- **Khud karke dekho:**
  1. Ek naya action `pinNote` banao. Note mein `pinned: boolean` add karo (Zod schema bhi update karo), aur pinned notes list mein upar dikhao.
  2. Isi app ka ek copy branch banao aur Redux ki jagah **Zustand** lagao. Fark khud mehsoos karo.
  3. `createSelector` se ek memoized selector `selectTodayTasks` banao.

### 1.4 `useSyncExternalStore`: Redux ke bahar ki state

- **Kya hai:** React hook jo kisi bhi bahari object (class, library) ko subscribe karke React ko re-render karwata hai.
- **Kis liye:** Jo cheez Redux mein nahi rakh sakte, jaise AbortController, native AI session, WebSocket connection. Redux mein sirf plain serializable data jaana chahiye.
- **Is app mein:** [useAI.ts](../src/features/ai/useAI.ts) aur `usePerformanceMonitor()`. Class ke `subscribe` / `getSnapshot` methods ko dekho [engine.core.ts](../src/features/ai/engine.core.ts#L37-L47).
- **Khud karke dekho:** Ek chhota `NetworkStatus` class banao (online/offline) aur `useSyncExternalStore` se header mein "Offline" badge dikhao. Library: `@react-native-community/netinfo`.

### 1.5 Zod: runtime validation

- **Kya hai:** Schema library. TypeScript sirf compile time par check karta hai, Zod **app chalte waqt** data check karta hai.
- **Kis liye:** Jo data tumhare control mein nahi hai: API response, AsyncStorage/DB se load kiya data, form input, **AI ka output**.
- **Is app mein:** [models.ts](../src/domain/models.ts) mein schemas hain aur unhi se types bante hain (`z.infer`). [prompts.ts](../src/features/ai/prompts.ts#L20-L34) mein AI ka JSON validate hota hai.
- **Khud karke dekho:** `react-hook-form` + `zodResolver` se TaskEditor ka form dobara banao. Har field ke niche error message aana chahiye. Yeh combination job mein bahut common hai.

### 1.6 Storage: kaunsa storage kis kaam ka

| Storage                    | Kya hai                              | Kab use karo                          | Is app mein              |
| -------------------------- | ------------------------------------ | ------------------------------------- | ------------------------ |
| AsyncStorage               | Simple key-value, unencrypted         | Chhoti settings                       | ❌                        |
| **MMKV**                   | Bahut fast key-value, encryption option | Settings, tokens cache, Zustand persist | ❌ (seekhna chahiye)   |
| **SecureStore**            | Keychain (iOS) / Keystore (Android)   | Passwords, JWT token, encryption key  | ✅ DB key                 |
| **SQLite**                 | Real database, SQL queries            | Bahut saara structured data, search   | ✅                        |
| **SQLCipher**              | Encrypted SQLite                      | Personal/health/finance data          | ✅                        |
| localStorage               | Browser storage                       | Web                                   | ✅ web preview            |

- **Is app mein:** [repository.ts](../src/data/repository.ts): random key banao → SecureStore mein rakho → `PRAGMA key` se DB kholo. [repository.web.ts](../src/data/repository.web.ts) web version hai.
- **Samajhne wali baat:** Abhi saara data **ek hi row mein JSON** ki tarah save hota hai. Seekhne ke liye simple hai, lekin real apps mein har cheez ki alag table hoti hai.
- **Khud karke dekho (bada exercise, sabse zyada seekhoge):**
  1. **Drizzle ORM** lagao aur `notes`, `tasks` ki alag tables banao.
  2. **Migration** likho: purana JSON row padho → tables mein daalo.
  3. Search ko **SQLite FTS5** par le jao (`CREATE VIRTUAL TABLE notes_fts USING fts5(...)`).
  4. Sochho: 10,000 notes par kaunsa design fast chalega aur kyun.

### 1.7 On-device AI model (LLM): sabse interesting part

- **Kya hai:** LLM (Large Language Model) text padhke text banata hai. Yahan **Qwen3 0.6B** model **phone ke andar hi** chalta hai. Na internet chahiye, na API key.
- **Runtime:** `react-native-executorch` (Meta ke PyTorch ka mobile runtime).
- **Terms jo samajhne hain:**
  | Term                 | Matlab                                                     | Is app mein                                 |
  | -------------------- | ---------------------------------------------------------- | ------------------------------------------- |
  | **0.6B**             | 60 crore parameters (model ka size)                        | Chhota hai, isliye phone par chal jata hai  |
  | **Quantization** (8da4w) | Weights ko 4-bit/8-bit mein compress karna, size aur RAM kam | `XNNPACK_8DA4W` preset                  |
  | **XNNPACK**          | CPU par fast math karne wala backend                       | `package.json` → `backends`                 |
  | **Token**            | Text ka chhota tukda (~¾ word)                             | `maxNewTokens: 600`                         |
  | **System prompt**    | Model ko role aur rules batana                             | `systemPrompt()` in [prompts.ts](../src/features/ai/prompts.ts#L36) |
  | **Temperature**      | Randomness. Kam (0.3) = consistent jawab                   | [engine.ts:23](../src/features/ai/engine.ts#L23) |
  | **Streaming**        | Jawab token-by-token aana                                  | `onToken` callback                          |
  | **Structured output**| Model se JSON mangwana aur validate karna                  | `extractionPrompt` + `parseTaskDrafts`      |
  | **Prompt injection** | Note ke andar likhi baat model ko bhatka de                | Data ko quote karke dena + human review     |
  | **RAG**              | Pehle relevant data dhoondo, phir model ko do              | `retrieveNotes()`, keyword-based            |
- **Flow samjho:** Settings → model download → note likho → "Find action items" → model JSON deta hai → Zod check → user tasks select karta hai → save.
- **Khud karke dekho:**
  1. `temperature` 0.3 se 1.0 karo, same note 3 baar chalao, aur output ka fark note karo.
  2. Naya AI mode **"Summarize note"** banao (`AssistantMode` mein add karo, prompt likho).
  3. **Mood/category detection:** note likhte hi AI se `Personal | Work | Ideas` suggest karwao (JSON output + Zod).
  4. **Semantic search:** ExecuTorch ka text embeddings model lagao aur keyword search se compare karo.
  5. **Voice note:** ExecuTorch ka Whisper (speech-to-text) model → bolo → note ban jaye.
- **Alternatives jaano (interview mein bolne layak):**
  - On-device: `llama.rn` (llama.cpp, GGUF models), MediaPipe (Gemma), **Apple Foundation Models** (iOS mein built-in), **Gemini Nano** (Android).
  - Cloud: OpenAI / Claude / Gemini API. Quality zyada, lekin internet, cost aur privacy ka tradeoff hai.
  - **Practical tip:** Zyada tar companies cloud API use karti hain. Agle app mein **cloud AI + streaming + backend proxy** zaroor banao (Part 3 dekho).

### 1.8 Cancellation: AbortController

- **Kya hai:** Kisi chalte async kaam (download, fetch, AI) ko beech mein rokne ka standard tareeka.
- **Kis liye:** User screen chhod de, "Stop" dabaye, ya naya search type kare, toh purani request band karni hoti hai. Warna memory waste hoti hai aur galat data dikhta hai.
- **Is app mein:** [engine.core.ts:49-131](../src/features/ai/engine.core.ts#L49-L131): download aur generation dono cancel ho sakte hain.
- **Khud karke dekho:** Search input par `fetch` + AbortController ka **debounced search** banao (kisi free API se, jaise `dummyjson.com/products/search`). Har keypress par pichhli request cancel honi chahiye.

### 1.9 Native Module (Swift + Kotlin): Expo Modules API

- **Kya hai:** Jab koi cheez JavaScript se nahi ho sakti (battery temperature, thermal state), tab native code likhkar JS mein expose karte hain.
- **Is app mein:** [modules/device-health](../modules/device-health):
  - `AsyncFunction("sample")` → JS mein `await DeviceHealth.sample()`
  - `Events("onThermalChange")` → native se JS ko event bhejna
  - [index.ts](../modules/device-health/index.ts) mein `requireOptionalNativeModule`: module na ho toh `null`, crash nahi.
- **Kis liye (job mein):** Payment SDKs, Bluetooth, custom camera, ya koi company ki native SDK integrate karna. **15+ LPA roles mein native module ka thoda experience bada plus hai.**
- **Khud karke dekho:**
  1. Is module mein `getStorageInfo()` add karo: free disk space (iOS: `FileManager`, Android: `StatFs`). Model download se pehle check karo ki 2 GB free hai ya nahi.
  2. Ek naya module banao: `npx create-expo-module --local` → **screenshot detect** event.
- **Seekhne layak theory:** New Architecture: **JSI, TurboModules, Fabric, Hermes**. Interview mein "Bridge vs JSI" zaroor poochha jata hai.

### 1.10 App lifecycle: AppState

- **Kya hai:** App `active` / `inactive` / `background` state mein kab gayi, yeh batata hai.
- **Is app mein:** [App.tsx:50-53](../App.tsx#L50-L53): background mein jaate hi privacy screen dikhti hai aur AI band hota hai. [useToday.ts](../src/ui/useToday.ts): app wapas aane par date refresh.
- **Chhota bug = achha exercise:** iOS mein notification pull-down karne par bhi state `inactive` hoti hai, aur yahan AI cancel ho jata hai. Fix karo: cancel sirf `background` par ho. Isse `inactive` vs `background` ka fark pakka yaad ho jayega.

### 1.11 UI building blocks

| Component / API             | Kis liye                                        | Is app mein                                    |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| **Modal**                   | Screen ke upar sheet/popup                      | `Sheet` in [components.tsx](../src/ui/components.tsx#L277) |
| **FlatList**                | Lambi list, sirf visible items render           | NotesScreen, TasksScreen                       |
| KeyboardAvoidingView        | Keyboard input ko na dhake                      | `Sheet` ke andar                               |
| SafeAreaView                | Notch / home bar se bachna                      | App.tsx                                        |
| Pressable + accessibility   | Button + screen reader support                  | `Button`, `TaskRow`                            |
| react-native-svg            | Custom graphics/charts                          | [PerformanceChart.tsx](../src/features/performance/PerformanceChart.tsx) |
| Context theme               | Light/dark mode                                 | [theme.tsx](../src/ui/theme.tsx)               |
| ErrorBoundary               | Crash hone par fallback screen                  | App.tsx                                        |
| `.web.ts` files             | Platform-specific code                          | `engine.web.ts`, `repository.web.ts`           |

- **Khud karke dekho:**
  1. **FlatList → FlashList** (Shopify) lagao aur 1000 dummy notes par scroll performance compare karo.
  2. **Reanimated**: task complete hone par checkmark animation aur swipe-to-delete (`react-native-gesture-handler`).
  3. **Dark mode bug:** error screen ka background hardcoded light hai ([App.tsx:236](../App.tsx#L236)) aur text dark theme ka hai. Theme color use karke fix karo.

### 1.12 Testing + CI

- **Is app mein:** Vitest ke 30 tests (pure logic). `vi.mock` se native module fake kiya gaya hai, aur `vi.useFakeTimers` se 3-second timers turant chal jaate hain ([monitor.test.ts](../src/features/performance/monitor.test.ts)). GitHub Actions har push par `typecheck + test + prettier` chalata hai ([quality.yml](../.github/workflows/quality.yml)).
- **Testing pyramid:**
  | Level      | Tool                                   | Is app mein |
  | ---------- | -------------------------------------- | ----------- |
  | Unit       | Vitest / Jest                          | ✅           |
  | Component  | React Native Testing Library           | ❌ seekho    |
  | E2E        | **Maestro** (sabse aasaan) / Detox     | ❌ seekho    |
- **Khud karke dekho:**
  1. `store.ts` ke `persistCurrent` ka test likho (repository mock karke). Yeh sabse important code hai aur abhi untested hai.
  2. **ESLint** (`npx expo lint`) lagao aur dekho kitni warnings aati hain. `react-hooks/exhaustive-deps` kya bolta hai, samjho.
  3. Ek **Maestro** flow likho: note banao → save → list mein dikhe.

---

## Part 2: Isi app mein aage kya banao (feature → kya seekhoge)

Aasan se mushkil order mein. Har feature ek alag branch + commit.

| #  | Feature                                          | Kya seekhoge                                         | Level  |
| -- | ------------------------------------------------ | ---------------------------------------------------- | ------ |
| 1  | ESLint + Prettier + Husky pre-commit             | Tooling, code quality                                | ⭐      |
| 2  | Date picker (text input ki jagah)                 | Third-party UI lib, platform differences             | ⭐      |
| 3  | **Expo Router** se navigation + Android back      | File-based routing, deep links, stack/tabs           | ⭐⭐    |
| 4  | **Task reminders**: `expo-notifications`          | Permissions, local notifications, scheduling         | ⭐⭐    |
| 5  | **Biometric lock**: `expo-local-authentication`   | Security UX, AppState ke saath lock                  | ⭐⭐    |
| 6  | i18n: English/Hindi UI (`i18next`)                | Localization, pluralization                          | ⭐⭐    |
| 7  | Reanimated animations + swipe actions             | UI thread vs JS thread, gestures                     | ⭐⭐    |
| 8  | Note mein image attach (`expo-image-picker`)      | File system, permissions, image caching              | ⭐⭐    |
| 9  | **Drizzle + SQLite tables + migrations + FTS5**   | Real DB design, migrations                           | ⭐⭐⭐  |
| 10 | Export/import backup (JSON/CSV + share)           | File system, encryption, data portability            | ⭐⭐⭐  |
| 11 | Semantic search (embeddings)                      | Vectors, RAG, cosine similarity                      | ⭐⭐⭐  |
| 12 | **Cloud sync** (Supabase: auth + Postgres)        | Backend, auth, offline-first sync, conflicts         | ⭐⭐⭐⭐ |
| 13 | Sentry crash reporting + EAS Update (OTA)         | Production monitoring, release process               | ⭐⭐⭐  |
| 14 | Play Store internal testing par publish           | Signing, EAS Build/Submit, store listing             | ⭐⭐⭐  |

**#12 aur #14 resume par sabse zyada weight rakhte hain.** "Published app + sync backend" = real-world experience.

---

## Part 3: Agle practice apps (har app naye skills cover kare)

Saathi ne offline, AI aur native cover kar diya. 15 LPA wale interviews mein jo **baaki** skills poochhe jaate hain, woh in apps se aayenge:

### App 2: Food/Shopping app (API-driven) ⭐ sabse zaroori
- **Skills:** REST API, **TanStack Query** (caching, pagination, infinite scroll, pull-to-refresh), **auth** (login, JWT, refresh token, SecureStore), cart ke liye Zustand/Redux, forms (react-hook-form + Zod), **Razorpay test mode**, deep links, push notifications (FCM via expo-notifications).
- **Backend:** DummyJSON/FakeStore se shuru karo, phir khud ka Node.js (Express/Fastify) ya Supabase.
- **Kyun:** 80% company apps yahi hoti hain: API + auth + list + form + payment.

### App 3: Chat app (real-time)
- **Skills:** WebSocket / Socket.IO ya Supabase Realtime / Firebase, **optimistic updates**, offline message queue, image upload with progress, typing indicator, FlashList inverted list, background/foreground reconnect.
- **Bonus:** AI chatbot inside chat: **cloud LLM streaming** through your own backend (API key kabhi app mein mat rakho).

### App 4: Reels/Video feed
- **Skills:** `expo-video`, FlashList performance, preloading, caching, Reanimated gestures (double-tap like), **performance profiling** (React DevTools Profiler, Flashlight), memory leaks.

### App 5: Maps / Delivery tracking
- **Skills:** `react-native-maps`, location permissions, **background location**, geofencing, polyline route, live tracking via socket.

### App 6 (optional): Expense tracker with charts + sync
- **Skills:** offline-first sync (WatermelonDB / PowerSync), charts (Victory Native / Skia), CSV export, biometric lock, monthly reports.

> Har app ke README mein ek **"Decisions & Tradeoffs"** section likho, jaise Saathi ke README mein hai. Interview mein yahi dikhana hai.

---

## Part 4: 15 LPA React Native role ke liye skills checklist

Tick karte jao:

**JavaScript / React core**
- [ ] Event loop, closures, promises vs async/await, `this`, debounce/throttle khud likhna
- [ ] React re-render kab hota hai, `memo` / `useMemo` / `useCallback` kab zaroori hain
- [ ] Hooks rules, custom hooks, `useEffect` cleanup, stale closure bug

**React Native**
- [ ] New Architecture: JSI, Fabric, TurboModules, Hermes
- [ ] FlatList/FlashList optimization, image optimization, Reanimated worklets
- [ ] Navigation (Expo Router / React Navigation), deep linking
- [ ] Permissions, notifications, background tasks
- [ ] Ek native module khud likha ho ✅ (Saathi mein dekh chuke ho)

**Data & API**
- [ ] TanStack Query / RTK Query, pagination, caching, retry
- [ ] Auth flow: access + refresh token, secure storage, logout everywhere
- [ ] Offline-first basics: local DB + sync queue

**Quality & Release**
- [ ] TypeScript strict, ESLint, unit + component tests, ek E2E flow
- [ ] EAS Build, app signing, Play Store / App Store release, OTA updates
- [ ] Sentry/Crashlytics, performance profiling

**Mobile system design** (senior interviews)
- [ ] "Design a chat app / offline notes sync / image feed", sab mobile ke nazariye se
- [ ] Caching strategy, conflict resolution, pagination design

**Portfolio**
- [ ] 3–4 GitHub projects with clean README + screenshots/GIF
- [ ] Kam se kam 1 app Play Store par live (internal testing bhi chalega)
- [ ] LinkedIn par har project ki chhoti post ya demo video

---

## Part 5: Suggested 10-week plan

| Week  | Kaam                                                                             |
| ----- | -------------------------------------------------------------------------------- |
| 1     | Saathi ka Part 1 padho + har "Khud karke dekho" ka pehla exercise                |
| 2     | Saathi: ESLint, Expo Router, notifications (Part 2: #1, #3, #4)                  |
| 3     | Saathi: Drizzle + migrations + FTS5 (#9) + ek naya AI mode                       |
| 4–5   | **App 2** (Shopping): API, TanStack Query, auth, cart, payment test              |
| 6     | App 2 ko Play Store internal testing par daalo + Sentry                          |
| 7–8   | **App 3** (Chat): realtime, optimistic UI, cloud AI bot                          |
| 9     | Performance deep-dive (App 4 ka mini version) + New Architecture theory          |
| 10    | Resume update, READMEs, mock interviews (JS + RN + mobile system design)         |

Saath mein roz 30–45 minute: JS fundamentals + thoda DSA (arrays, strings, hashmap). Kai product companies mein ek DSA round hota hai.

---

**Yaad rakhna:** Har feature ke baad khud se 3 sawal poochho: *"Yeh kyun use kiya? Iske bina kya hota? Iska alternative kya tha?"* Jis din yeh teeno kisi bhi feature ke liye bina ruke bol paoge, us din 15 LPA wala interview mushkil nahi lagega.
