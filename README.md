# Daunroda

The Spotify to YouTube Music downloader that doesn't download all kinds of
bullshit from YouTube (karaoke/instrumental versions, music video versions etc)

⚠️ This is a very very alpha release of this so expect things to break!

## Features

- Spotify metadata embedded in files
- Playlist file creation (.m3u8)
- Concurrent music downloading from YouTube

## Usage (⚠️ NPM Version is currently broken due to a dependency error)

1. As a CLI app:

- Download the
  [latest release](https://github.com/alexthemaster/daunroda/releases)
  executable and run it.

2. As package (currently broken):

- `npm i daunroda`
- In JavaScript:

```js
const { Daunroda } = require("daunroda");
const daunroda = new Daunroda({
  spotifyClientID:
    "fillMe (https://developer.spotify.com/dashboard/applications)",
  spotifySecret:
    "fillMe (https://developer.spotify.com/dashboard/applications)",
  downloadTo: "./downloads",
  audioContainer: "mp3 | flac",
  // only applies to mp3
  audioBitrate: 320,
  // any number, really, used to check what the difference between the Spotify version and YouTube Music version is in length, and if it's higher than the percentage specified here it will be skipped
  difference: 10,
  // whether to automatically allow the downloading of songs that contain forbidden wording on YouTube (such as live, karaoke, instrumental etc), if disabled you will be prompted if you want to download anyway or not
  allowForbiddenWording: false,
  playlists: ["spotify", "playlist", "ids", "go", "here"]
});

daunroda.run().catch(console.error);

daunroda.on("info", console.info);
daunroda.on("error", console.error);
```

- In TypeScript:

```ts
import { Daunroda } from "daunroda";
const daunroda = new Daunroda({
  spotifyClientID:
    "fillMe (https://developer.spotify.com/dashboard/applications)",
  spotifySecret:
    "fillMe (https://developer.spotify.com/dashboard/applications)",
  downloadTo: "./downloads",
  audioContainer: "mp3 | flac",
  // only applies to mp3
  audioBitrate: 320,
  // any number, really, used to check what the difference between the Spotify version and YouTube Music version is in length, and if it's higher than the percentage specified here it will be skipped
  difference: 10,
  // whether to automatically allow the downloading of songs that contain forbidden wording on YouTube (such as live, karaoke, instrumental etc), if disabled you will be prompted if you want to download anyway or not
  allowForbiddenWording: false,
  playlists: ["spotify", "playlist", "ids", "go", "here"]
});

daunroda.run().catch(console.error);

daunroda.on("info", console.info);
daunroda.on("error", console.error);
```
