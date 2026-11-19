# Petal Run: Neon Bay

An original, browser-playable 3D arcade racing story prototype with a realistic-inspired neon night look. It uses Three.js and plain JavaScript, with no build step. The Three.js runtime is included locally.

## Run

Serve this directory over HTTP (service workers and installation require HTTPS in production; localhost is allowed during development):

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`.

## Install and publish

This is an offline-ready Progressive Web App. GitHub Actions deploys the site to GitHub Pages when changes are pushed to the repository's default branch. The site URL is `https://deatharia.github.io/Motion/`; GitHub Pages serves it over HTTPS. After the first successful Actions deployment, confirm **Enforce HTTPS** is enabled in **Settings > Pages**. Install it from the browser with **Install app** on a supported Android browser, or **Share > Add to Home Screen** in iOS Safari. The manifest requests landscape orientation for racing.

## Build for Google Play

The project includes a Capacitor Android wrapper setup. To generate and build its native Android project, install Node.js 22 LTS and Android Studio with the Android SDK, then run:

```sh
npm install
npm run android:add
npm run android:open
```

In Android Studio, import `icon-512.png` as the launcher icon, then use **Build > Generate Signed Bundle / APK** and choose **Android App Bundle**. Create and securely back up a signing key, then upload the signed `.aab` through your Google Play Console account. For later game updates, run `npm run android:sync` before rebuilding. The setup script keeps Android gameplay in landscape.

The native project and signed release bundle are generated locally; neither signing credentials nor a Google Play account are included in this repository.

## Story

Neon Bay's last seed vault needs to reach the Skygarden before the night patrol closes in. Collect three pink bloom cores around the city, then return to the glowing garage at the northwest end of the circuit. Patrol cars join as time passes. Outrun them with boosts or use a pulse to stun them.

## Controls

- **W / Up:** accelerate
- **S / Down:** brake; keep holding once stopped to reverse
- **A / Left** and **D / Right:** steer
- **Space:** spend boost for a speed burst and brief shield
- **E:** pulse nearby patrol cars; pulse recharges over time and from pickups
- **Escape:** pause or resume
- **C:** cycle between cockpit, hood, and chase camera views
- Touch screens have steering, brake, throttle, boost, and pulse controls, plus optional tilt steering on compatible devices. Landscape mode gives the track the full display.

The sound toggle starts muted. Enabling it plays small synthesized effects. Front tyres steer into turns, and all tyres roll forward or backward with signed vehicle speed. Acceleration, braking, and steering subtly animate chassis pitch, body roll, and suspension bounce; boost lights the exhaust and widens the chase-camera field of view, while fast cornering adds pooled tyre smoke and short-lived skid marks. Brake lights brighten under braking, and speed lines and restrained camera shake respond to velocity. These effects use reusable scene objects to limit per-frame allocations. The city buildings now feature saturated jewel-tone facades, multicolored glowing windows, and neon architectural accents. Small or touch-first screens cap render pixel ratio at 1 and disable antialiasing and dynamic shadows to prioritize frame time. The night scene uses physical car paint and glass, wet-textured asphalt, headlight beams, street lighting, and atmospheric fog. A lightweight, time-animated screen-space shader adds shifting neon filaments and wave rings that intensify with speed, boost, and patrol heat for a 4D-style sense of motion; it is a visual effect, not a fourth spatial dimension. Traffic and patrol cars use original 3D models with fictional marques: NOVA, ASTER, SOLARA, and VANTA. The game has its own setting and assets; it does not reproduce another game's cars, locations, or artwork.
