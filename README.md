# Petal Run: Neon Bay

An original, browser-playable, stylized 3D arcade racing story prototype. It uses Three.js and plain JavaScript, with no build step. The Three.js runtime is included locally.

## Run

Serve this directory over HTTP (service workers and installation require HTTPS in production; localhost is allowed during development):

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`.

## Install and publish

This is an offline-ready Progressive Web App. Deploy the complete folder to any static HTTPS host, such as GitHub Pages, then install it from the browser: use **Install app** in a supported Android browser, or **Share > Add to Home Screen** in iOS Safari. The manifest requests landscape orientation for racing.

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
- **S / Down:** brake
- **A / Left** and **D / Right:** steer
- **Space:** spend boost for a speed burst and brief shield
- **E:** pulse nearby patrol cars; pulse recharges over time and from pickups
- **Escape:** pause or resume
- Touch screens have steering, brake, throttle, boost, and pulse controls, plus optional tilt steering on compatible devices. Landscape mode gives the track the full display.

The sound toggle starts muted. Enabling it plays small synthesized effects. Traffic and patrol cars use original, stylized 3D models with fictional marques: NOVA, ASTER, SOLARA, and VANTA. The visuals are an original anime-inspired style, not copied characters or assets.
