# Install Saathi on your iPhone

The EAS `preview` profile creates a standalone internal build with the JavaScript bundle included. You can use it without a running laptop or Metro. The native ExecuTorch/audio/SQLCipher modules require this build; Expo Go cannot run them.

## Install

1. Open the [Saathi builds page](https://expo.dev/accounts/devesh-rn/projects/saathi-private-ai/builds) in Safari on the registered iPhone. Choose the latest successful **iOS / preview** build and use its **Install** button.
2. Open Saathi from the Home Screen. If iOS requests Developer Mode, enable **Settings → Privacy & Security → Developer Mode**, restart, and confirm **Turn On** on the phone. See [Expo's Developer Mode instructions](https://docs.expo.dev/guides/ios-developer-mode/).
3. This app requires **iOS 17 or later**. Only iPhones included in the build's provisioning profile can install it. For another phone, register it using `eas device:create`, then rebuild interactively or re-sign the existing build. See [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

## First test

1. Create a note and task, close the app, and reopen it to check local persistence.
2. On Wi-Fi, open **Settings → Voice notes & read-aloud → Download / load speech pack**. Wait for setup to finish.
3. Open **Saathi AI → Voice studio**, choose English or Hindi, record a short sentence, finish, review the transcript, and save it. Audio itself is not saved.
4. For read-aloud, load the English or Hindi voice pack. Summaries need **Settings → Your on-device AI** loaded too; the voice assistant needs speech, text AI, and the selected voice.
5. Check **Settings → Device health & performance** during and after model use. iOS exposes thermal severity, not a temperature in °C; CPU and memory readings describe this app. Keep thermal protection enabled. These measurements do not guarantee zero device impact.
6. After successful downloads, restart, load the cached packs in airplane mode, and repeat a short test. The setup buttons reuse cached files on later launches.

For a failed test, note the iPhone model, iOS version, selected language/pack, exact visible error, and the steps that triggered it. Use [the voice acceptance checklist](VOICE.md#verification-and-physical-acceptance) for longer testing.

## Build the next version

From the linked project, with EAS CLI installed and the Expo account signed in:

```sh
eas build --platform ios --profile preview
```

Use the **preview** profile for independent phone testing. The **development** profile is for working with Metro. This internal build does not require a TestFlight submission.
