# Daunroda

The Spotify to YouTube Music downloader that doesn't download all kinds of bullshit from YouTube (karaoke/instrumental versions, music video versions etc)

⚠️ This is a very very alpha release of this so expect things to break!

## Features

- Spotify metadata embedded in files
- Playlist file creation (.m3u8)
- Concurrent music downloading from YouTube

## Usage

- Install [Nodejs](https://nodejs.org/en/download/) (version 18.0.0 or newer)
- Clone this repository
- Run `npm ci`
- Copy the contents of `config.example.json` from the `src` folder into a new file called `config.json` (also in the `src` folder) and fill the information needed in.
- Run `npm start` or `npm run dev` for verbose messages
