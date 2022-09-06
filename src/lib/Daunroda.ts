import { blueBright, cyanBright, greenBright, yellowBright } from "colorette";
import { EventEmitter } from "node:stream";
import terminalLink from "terminal-link";
import { ensureDir } from "./fs-utils";
import { Spotify } from "./Spotify";
import { YouTube } from "./YouTube";

export class Daunroda extends EventEmitter {
  public config: Config;
  public constructor(config: Config) {
    super();
    this.config = config;
  }

  public async run() {
    const spotify = await new Spotify(this).init();
    const youtube = await new YouTube(this).init();

    if (
      this.config.audioContainer !== "mp3" &&
      this.config.audioContainer !== "flac"
    )
      throw new Error('Only "mp3" and "flac" are valid audio containers.');
    await ensureDir(this.config.downloadTo);

    const totalPlaylists = `${this.config.playlists.length} ${
      this.config.playlists.length > 1 ? "playlists" : "playlist"
    }`;

    this.emit(
      "info",
      `Processing ${greenBright(totalPlaylists)} on Spotify...`
    );
    const processed = await spotify.processPlaylists(this.config.playlists);

    let fetchedTracks = 0;
    processed.map((val) => (fetchedTracks += val.songs.length));
    this.emit(
      "info",
      `Fetched ${cyanBright(`${fetchedTracks} tracks`)} across ${greenBright(
        totalPlaylists
      )} on Spotify!`
    );

    this.emit(
      "info",
      `Searching and downloading songs from YouTube Music...\n`
    );
    await youtube.processSongs(processed);

    this.emit(
      "info",
      `${yellowBright(
        terminalLink(
          "Success!",
          "https://www.myinstants.com/media/instants_images/boratgs.jpg"
        )
      )} Songs downloaded to ${blueBright(this.config.downloadTo)}.`
    );
  }
}

export interface Config {
  /** Spotify application Client ID */
  spotifyClientID: string;
  /** Spotify application Client Secret */
  spotifySecret: string;
  /** The folder to download the songs to */
  downloadTo: string;
  /** The audio container (extension) of the files (mp3 or flac) */
  audioContainer: "mp3" | "flac";
  /** The audio bitrate of mp3 files (anywhere from 0 to 320) */
  audioBitrate: number;
  /** The percentage number used to check against the difference between the Spotify version and YouTube Music version in duration (if higher than this it will be skipped from auto-downloading) */
  difference: number;
  /** Whether to automatically allow the downloading of songs that contain forbidden wording on YouTube (such as live, karaoke, instrumental etc), if disabled you will be prompted if you want to download anyway or not) */
  allowForbiddenWording: boolean;
  /** An array of Spotify playlist IDs */
  playlists: string[];
}
