# Device acceptance checklist

These tests are release gates, not claims that they were executed in this session.

## Core data

1. Install the development build. Create/edit a note, choose a category, search for a word and reopen it.
2. Force-close/relaunch. Check the note, edited text and category persist.
3. Create tasks for today/tomorrow/anytime; mark one complete, reopen, then verify Today / All / Done and overdue behavior.
4. At midnight and after returning from the background, verify Today refreshes using local device time.
5. Fill storage enough to cause a write failure. Check the save error and retry remain visible; do not force-close until retry succeeds.
6. Try an invalid date, blank title and long note. Confirm validation prevents invalid saves.
7. Verify the native database is SQLCipher-encrypted and cannot be opened as ordinary SQLite. Check key restoration and reinstall behavior on both platforms.

## Model and inference

1. Start setup on Wi-Fi; cancel mid-download; retry. Verify final readiness and failure messaging.
2. Complete setup, switch to airplane mode, relaunch, load cached AI and run a short request. Check that all three model resources resolve without network access.
3. Extract tasks from “Tomorrow send the project update. Buy groceries.” Review all suggested dates/priorities, deselect a task and save.
4. Use a note with no action items. The app should support an empty result or show a validation error; no task should be invented and saved automatically.
5. Stop generation during loading and token streaming. Background the app. Confirm no crash or saved partial task draft.
6. Retry after cancellation and after model/context errors. Attempt two concurrent requests: only one should run.
7. Ask about a saved fact and an absent fact. Confirm sources are shown, unrelated notes are excluded, and unsupported facts are not treated as reliable answers.
8. Try Hinglish, negated actions (“do not call today”), relative dates, ambiguous deadlines and instruction-like text inside notes. Review output accuracy; UI validation does not guarantee semantic correctness.
9. Record first-token latency, peak RAM, model load time and thermal/battery impact on real devices.

## UI and distribution

- Test iPhone, iPad, small Android, keyboard avoidance, TalkBack/VoiceOver, larger font sizes and light/dark/system appearance.
- Verify unsaved note dismissal, task edits, error banners and AI retry affordances.
- Test Android 13 minimum and current Android; iOS 17 minimum and current iOS.
- Verify notification permissions are never requested: reminders are not part of this version.
- Confirm Android backups are disabled and review iOS vault/key backup and recovery policy.
- Verify a production build, signing, actual application IDs, model license notices and store privacy/encryption declarations before release.

## Device Health Monitor

- Rebuild the native app after adding the local module; a JavaScript refresh is insufficient.
- Record idle → AI → cooldown on a real iPhone and Android phone. Verify timestamps, phase bands, CPU convention, memory definitions and missing sensor labels.
- Open Health while generation streams. Verify the AI request continues and that returning preserves its answer.
- Check long recordings retain the first/latest 300 samples and that graph gaps are visible.
- Relaunch and verify completed sessions remain; verify JSON sharing excludes notes, prompts and system uptime.
- Verify charging disables battery-change comparisons. Short sessions can legitimately show 0 percentage-point change.
- Exercise thermal state changes through official development tools; do not overheat hardware. Verify default protection blocks/stops AI, saves the thermal-stop outcome and allows retry after cooling.
- Verify active recording stops on background and timers/listeners do not accumulate after repeated start/stop.
- Compare monitor-on/off runs using Instruments or Android Studio Profiler to quantify measurement overhead.
