import chalk from "chalk";
import { ensureDir } from "fs-extra";
import { EventEmitter } from "stream";
import { Spotify } from "./Spotify";
import { YouTube } from "./YouTube";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hyperlinker = require("hyperlinker");

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
      `Processing ${chalk.greenBright(totalPlaylists)} on Spotify...`
    );
    const processed = await spotify.processPlaylists(this.config.playlists);

    let fetchedTracks = 0;
    processed.map((val) => (fetchedTracks += val.songs.length));
    this.emit(
      "info",
      `Fetched ${chalk.cyanBright(
        `${fetchedTracks} tracks`
      )} across ${chalk.greenBright(totalPlaylists)} on Spotify!`
    );

    this.emit(
      "info",
      `Searching and downloading songs from YouTube Music...\n`
    );
    await youtube.processSongs(processed);

    this.emit(
      "info",
      `${chalk.yellowBright(
        hyperlinker(
          "Success!",
          "https://www.myinstants.com/media/instants_images/boratgs.jpg"
        )
      )} Songs downloaded to ${chalk.blueBright(this.config.downloadTo)}.`
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
  audioContainer: string;
  /** The audio bitrate of the files (anywhere from 0 to 320) */
  audioBitrate: number;
  /** The percentage used to check against for the difference between the Spotify version and YouTube Music version in duration, and if it's higher than the percentage specified it will be skipped */
  difference: number;
  /** Whether to automatically allow the downloading of songs that contain forbidden wording on YouTube (such as live, karaoke, instrumental etc), if disabled you will be prompted if you want to download anyway or not) */
  allowForbiddenWording: boolean;
  /** An array of Spotify playlist IDs */
  playlists: string[];
}
