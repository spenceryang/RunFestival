# Feature Requests

Potential features to implement next, prioritized by effort and impact.

---

## 1. Heart Rate Zone Coaching (Zone 2 Training)

**Priority:** High
**Effort:** Medium-term (requires Capacitor native wrapper)

Real-time heart rate zone coaching during runs. Coach announces when you drift out of Zone 2, adjusts pace recommendations based on HR, and provides post-run HR zone analysis in recap.

### Why
Zone 2 training is the most effective way to build aerobic base. Most runners run too hard on easy days. An AI coach that monitors HR zones and gently nudges you back into Zone 2 would be a killer feature.

### Technical Path
- **Web Bluetooth API** works on Android Chrome and macOS Chrome/Edge — can connect to BLE heart rate monitors directly from the PWA
- **iOS Safari blocks Web Bluetooth entirely** — Apple does not support it and has no plans to
- **Solution: Capacitor.js wrapper** — wrap the existing Next.js PWA as a native iOS/Android app
  - Capacitor runs the web app in a native WebView with access to native APIs
  - Use `@capacitor-community/bluetooth-le` for BLE heart rate monitors
  - Use HealthKit plugin for Apple Watch HR data on iOS
  - Existing Next.js code runs inside Capacitor with minimal changes — it's designed exactly for this upgrade path
- HR zones calculated from user's max HR (220 - age, or manual input)
- Zone data injected into coaching context for Head Coach to reference

### Implementation Steps
1. Add age / max HR / resting HR to user profile
2. Create `heart-rate-monitor.ts` service (Web Bluetooth for Android, HealthKit for iOS via Capacitor)
3. Add HR zone calculation utility (zones 1-5 based on max HR)
4. Extend `run-store.ts` with `currentHeartRate`, `heartRateZone`, `hrHistory`
5. Add HR zone trigger to trigger engine (fires when zone changes for >30s)
6. Add HR zone data to coaching context builder
7. Display HR zone on run screen UI
8. Add HR zone analysis to recap

---

## 2. Indoor Treadmill Mode (Accelerometer-Based)

**Priority:** Medium
**Effort:** Short-term (PWA-only, no native wrapper needed)

Detect running cadence and estimate pace on a treadmill using the phone's accelerometer, without GPS.

### Why
Treadmill runners currently can't use RunFestival because GPS doesn't work indoors. Accelerometer-based step detection enables coaching for indoor runs.

### Technical Path
- **`DeviceMotionEvent` works on iOS Safari** — accelerometer access is available in the PWA today
- iOS 13+ requires permission prompt (`DeviceMotionEvent.requestPermission()`)
- Detect steps from acceleration spikes, calculate cadence (steps/min)
- Estimate pace from cadence using calibration curve (or let user set treadmill speed manually)
- No GPS points — skip map in recap, show time-based splits instead

### Implementation Steps
1. Add "Indoor / Treadmill" option to setup page activity type selector
2. Create `accelerometer-tracker.ts` — step detection from `DeviceMotionEvent`
3. Cadence-to-pace estimation (with optional manual speed override)
4. Modify run screen to hide map in treadmill mode
5. Modify recap to show time-based analysis (no route map)
6. Coach references cadence instead of GPS pace for treadmill runs

---

## 3. Capacitor Native App Wrapper (App Store)

**Priority:** High (enables features 1 & 2+)
**Effort:** Medium-term

Wrap the existing PWA with Capacitor.js for iOS App Store and Google Play distribution. Unlocks native APIs while keeping the existing Next.js codebase.

### Why
Unlocks HealthKit (Apple Watch HR), CoreBluetooth (BLE HR monitors), CoreMotion (better accelerometer), push notifications, and App Store distribution. The existing Next.js code runs inside Capacitor with minimal changes — it's designed exactly for this upgrade path.

### What Capacitor Unlocks
- **HealthKit** — Apple Watch heart rate, workout data, step count
- **CoreBluetooth / BLE** — Direct connection to Bluetooth heart rate monitors
- **CoreMotion** — Higher-fidelity accelerometer for treadmill mode
- **Push Notifications** — Streak reminders, community milestones
- **Background Audio** — More reliable audio playback during runs
- **App Store presence** — Discoverability, reviews, distribution

### Implementation Steps
1. `npx cap init` + configure for iOS and Android
2. Set up Capacitor config to point at the Next.js build output
3. Add native plugins: HealthKit, BLE, push notifications
4. Create platform abstraction layer (`src/lib/platform/`) that switches between Web APIs and native APIs
5. TestFlight beta → App Store submission
6. Keep PWA as the web version, Capacitor as the native version — same codebase

---

## 4. Social Features

**Priority:** Low
**Effort:** Large

- Follow friends, see their runs in your feed
- Challenge friends to weekly distance/streak goals
- Share recaps to social media (image card generation)
- Group runs with shared coaching channel

---

## 5. Training Plans

**Priority:** Medium
**Effort:** Large

- AI-generated multi-week training plans (5K, 10K, half marathon, marathon)
- Daily run prescriptions with target pace/distance
- Coach adapts mid-plan based on your performance trends
- Integrates with streak tracking
