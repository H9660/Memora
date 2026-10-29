# Memora

Memora is an Android-first app for capturing, revisiting and searching personal experiences. It helps you rebuild what happened from saved evidence, such as your own notes, the time, where your phone was and photos. It does not invent memories.

> Memora is a memory-support tool. It is not a treatment for SDAM or any other condition, and it makes no clinical claims.

## Features

| | |
|---|---|
| **Remember This** | Write a note. Memora adds the time, and optionally your location and a photo. |
| **Timeline** | Saved memories, newest first, grouped by day. |
| **Memory detail** | Shows what *you wrote* separately from what *your phone recorded*. Every evidence item lists its source and time. |
| **Edit / delete** | Correct a note, remove the location or photo, or delete the whole memory. |
| **Search** | Keyword search over notes and place names, filtered by time range. Each result shows which field matched. |
| **Works without permissions** | If location or camera access is denied, you can still save. |

All data stays on the phone in SQLite. There is no account, no cloud and no background tracking.

## Run it

Requirements: Node.js and the Android phone you will test on.

```bash
npm install
npx expo start
```

- **Expo Go:** press `s` to switch to Expo Go, then scan the QR code with the Expo Go app. Everything Memora uses (`expo-sqlite`, `expo-image-picker`, `expo-file-system`, `expo-location`) works in Expo Go.
- **Development build:** this project includes `expo-dev-client`. Each time a native package is added, rebuild the app with `npx expo run:android` (needs the Android SDK) or `npx eas-cli@latest build --profile development --platform android`. An older development build will crash with "Cannot find native module".
- **Web:** press `w`. SQLite runs as WebAssembly. `metro.config.js` sets up the `.wasm` files and headers it needs. Photos are not copied into app storage on web.

Checks to run before committing:

```bash
npx expo lint
npx tsc --noEmit
```

## Project structure

```
src/
  app/                       # Screens (Expo Router)
    (tabs)/index.tsx         # Home / timeline
    (tabs)/search.tsx        # Search
    capture.tsx              # Remember This
    memory/[id].tsx          # Memory detail, edit, delete
  domain/                    # MemoryEvent, EvidenceItem, validation, edits
  repositories/              # MemoryRepository interface + SQLite implementation
  retrieval/                 # MemoryRetriever interface + keyword search
  services/                  # Location and photo providers
  components/memory-card.tsx
  hooks/use-memory-repository.ts
```

Screens only talk to the repository, the retriever and the services. Storage, search and sensors can each be replaced without changing the screens.

### Data model

Each `MemoryEvent` holds the user's note and a list of `EvidenceItem`s. Each item records its type (`USER_NOTE`, `LOCATION`, `PHOTO`, …), source and capture time. Photos are copied to `<app documents>/photos/`, and the evidence item stores the file path. The database schema is versioned with `PRAGMA user_version` in `sqlite-memory-repository.ts`.

## Demo (2–3 minutes)

1. Open Memora and show the timeline.
2. Tap **Remember This**. The location and time appear. Take a photo.
3. Write "Had lunch with my project team after the lab meeting" and tap **Save Memory**.
4. The memory appears under **Today**. Open it and show the difference between *You wrote*, *From your phone* and the evidence list.
5. Go to **Search**, type "lab", and show the result with "Matched in your note".

## Manual test checklist

- [ ] Save a note with location permission granted.
- [ ] Save a note after denying location permission.
- [ ] Save a note with GPS turned off.
- [ ] Take a photo, save, and see the thumbnail. Deny camera permission and still save.
- [ ] Close and reopen the app. Memories and photos are still there.
- [ ] Search for a word from a note. Try each time-range filter.
- [ ] Open a memory and check that the evidence sources are shown.
- [ ] Edit the note, remove the location or photo, and delete a memory. The timeline updates.
- [ ] No background recording or network upload happens. (Place names come from the phone's geocoder, which may contact an online service.)

## Known limitations

- Search is keyword matching, not full-text or semantic search.
- No activity recognition, calendar, background sensing or audio yet. These are later phases of the plan.
- Screens use a light theme only.
- If Android closes Memora while the camera is open, the photo is lost and you have to take it again.
