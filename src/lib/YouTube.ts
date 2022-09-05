import { Stopwatch } from "@sapphire/stopwatch";
import chalk from "chalk";
import cliProgress from "cli-progress";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import {
  createWriteStream,
  ensureDir,
  ensureFile,
  existsSync,
  readFile,
  rm,
  writeFile,
} from "fs-extra";
import inquirer from "inquirer";
import { tmpdir } from "os";
import sanitize from "sanitize-filename";
import { ReadableStream } from "stream/web";
import { compareTwoStrings } from "string-similarity";
import { request } from "undici";
import { Innertube } from "youtubei.js";
import MusicResponsiveListItem from "youtubei.js/dist/src/parser/classes/MusicResponsiveListItem";
import { Daunroda } from "./Daunroda";
import { Processed } from "./Spotify";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hyperlinker = require("hyperlinker");

ffmpeg.setFfmpegPath(ffmpegPath!);

const reject = [
  "(live)",
  "music video",
  "karaoke version",
  "instrumental version",
];

export class YouTube {
  private client!: Innertube;
  private daunroda: Daunroda;
  private stopwatch = new Stopwatch().stop();
  private downloadMaybe: {
    res: MusicResponsiveListItem;
    name: string;
    destination: string;
    track: SpotifyApi.TrackObjectFull;
    playlist: string;
    reason: string;
  }[] = [];

  public constructor(daunroda: Daunroda) {
    this.daunroda = daunroda;
  }

  public async init() {
    this.client = await Innertube.create({});

    return this;
  }

  public async processSongs(processed: Processed[]) {
    for (const playlist of processed) {
      await ensureDir(
        `${this.daunroda.config.downloadTo}/${sanitize(playlist.name)}`
      );
      const promises = [];

      const notFound: Set<string> = new Set();
      const songs: string[] = [];

      const progress = new cliProgress.SingleBar(
        {
          format: `Downloading ${chalk.blackBright(
            hyperlinker(playlist.name, playlist.url)
          )} [{bar}] ${chalk.greenBright(
            "{percentage}%"
          )} | ETA: ${chalk.yellowBright("{eta}s")} | ${chalk.blueBright(
            "{value}/{total}"
          )}`,
        },
        cliProgress.Presets.legacy
      );

      progress.start(playlist.songs.length, 0);

      this.stopwatch.restart();
      for (const song of playlist.songs) {
        if (!song.track) continue;
        const { track } = song;
        const name = `${track.artists[0].name} - ${track.name}`;

        const destination = `${this.daunroda.config.downloadTo}/${sanitize(
          playlist.name
        )}/${sanitize(name)}.${this.daunroda.config.audioContainer}`;

        // Skip searching and downloading if song is already downloaded
        if (existsSync(destination)) {
          songs.push(name);
          this.daunroda.emit("debug", `"${name}" is already downloaded.`);
          progress.increment();
          continue;
        }

        this.daunroda.emit("debug", `Searching for "${name}"...`);
        const searched = await this.client.music.search(name, { type: "song" });

        const result =
          searched?.results?.length &&
          // Find the first result that doesn't get filtered out
          (await searched?.results?.find((res) =>
            this.filter(res, name, destination, track, playlist.name, notFound)
          ));

        if (!result) continue;

        songs.push(name);

        // We push all the promises into an array to be able to concurrently download songs
        const promise = this.downloadSong(
          result.id!,
          destination,
          track,
          progress
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      progress.stop();
      this.stopwatch.stop();

      const m3u8 = songs
        .map(
          (name) =>
            `${sanitize(playlist.name)}/${sanitize(name)}.${
              this.daunroda.config.audioContainer
            }`
        )
        .join("\n");
      await writeFile(
        `${this.daunroda.config.downloadTo}/${sanitize(playlist.name)}.m3u8`,
        m3u8
      );

      const songsNotFound = notFound.size;
      this.daunroda.emit(
        "info",
        songsNotFound
          ? `Found and downloaded ${chalk.cyanBright(
              playlist.songs.length - songsNotFound
            )}/${chalk.cyanBright(
              playlist.songs.length
            )} songs from the "${chalk.blackBright(
              hyperlinker(playlist.name, playlist.url)
            )}" playlist in ${chalk.cyan(this.stopwatch.toString())}!\n`
          : `Found and downloaded all songs (${chalk.cyanBright(
              playlist.songs.length
            )}) from the "${chalk.blackBright(
              hyperlinker(playlist.name, playlist.url)
            )}" playlist in ${chalk.cyan(this.stopwatch.toString())}!\n`
      );
    }

    for (const download of this.downloadMaybe) {
      const { answer }: { answer: boolean } = await inquirer.prompt({
        type: "confirm",
        name: "answer",
        message: `\nFound ${chalk.cyanBright(
          download.name
        )} on YouTube (named ${chalk.cyanBright(
          download.res.name ?? download.res.title
        )}) but it was rejected because of ${
          download.reason
        }. Do you want to download ${hyperlinker(
          chalk.yellowBright("this"),
          `https://music.youtube.com/watch?v=${download.res.id}`
        )} anyway?`,
      });

      if (answer) {
        const progress = new cliProgress.SingleBar(
          {
            format: `Downloading ${chalk.blackBright(
              download.name
            )} [{bar}] ${chalk.greenBright(
              "{percentage}%"
            )} | ETA: ${chalk.yellowBright("{eta}s")} | ${chalk.blueBright(
              "{value}/{total}"
            )}`,
          },
          cliProgress.Presets.legacy
        );
        progress.start(1, 0);
        await this.downloadSong(
          download.res.id!,
          download.destination,
          download.track,
          progress
        );

        // Add newly downloaded song to playlist file
        let m3u8 = await readFile(
          `${this.daunroda.config.downloadTo}/${sanitize(
            download.playlist
          )}.m3u8`
        ).then((buff) => buff.toString());
        m3u8 += `\n${sanitize(download.playlist)}/${sanitize(download.name)}.${
          this.daunroda.config.audioContainer
        }`;
        await writeFile(
          `${this.daunroda.config.downloadTo}/${sanitize(
            download.playlist
          )}.m3u8`,
          m3u8
        );
        progress.stop();
      }
    }
  }

  /** Downloads a song from YouTube and adds the metadata from Spotify to it */
  public async downloadSong(
    id: string,
    destination: string,
    track: SpotifyApi.TrackObjectFull,
    progress: cliProgress.SingleBar
  ) {
    const audioStream = await this.client.download(id, {
      quality: "best",
      type: "audio",
    });

    const coverStream = await request(track.album.images[0].url).then((res) =>
      res.body.arrayBuffer()
    );

    const tmpImg = `${tmpdir()}/${(Math.random() + 1).toString(36)}.jpg`;
    const tmpAudio = `${tmpdir()}/${(Math.random() + 1).toString(36)}.${
      this.daunroda.config.audioContainer
    }`;

    await this.saveTmpAudio(audioStream, tmpAudio);
    await writeFile(tmpImg, Buffer.from(coverStream));

    const codec =
      this.daunroda.config.audioContainer === "mp3"
        ? "libmp3lame"
        : this.daunroda.config.audioContainer === "flac"
        ? "flac"
        : "libmp3lame";

    const bitrate =
      !isNaN(this.daunroda.config.audioBitrate) &&
      this.daunroda.config.audioBitrate <= 320
        ? `${this.daunroda.config.audioBitrate}k`
        : "320k";

    return new Promise<void>((resolve, reject) => {
      try {
        const ff = ffmpeg(tmpAudio)
          .input(tmpImg)
          .outputOptions(
            "-acodec",
            codec,
            "-b:a",
            bitrate,
            "-map",
            "0:0",
            "-map",
            "1:0",
            "-id3v2_version",
            "3",
            "-disposition:v",
            "attached_pic",
            "-metadata:s:v",
            'title="Album cover"',
            "-metadata:s:v",
            'comment="Cover (Front)"',
            "-metadata",
            `album=${track.album.name}`,
            "-metadata",
            `title=${track.name}`,
            "-metadata",
            `artist=${track.artists.map((artist) => artist.name).join(", ")}`,
            "-metadata",
            `album_artist=${track.album.artists
              .map((artist) => artist.name)
              .join(", ")}`
          );

        ff.saveToFile(destination);

        ff.on("error", reject);
        ff.on("end", async () => {
          await rm(tmpImg);
          await rm(tmpAudio);
          progress.increment();
          resolve();
        });
      } catch (err) {
        this.daunroda.emit("error", err);
      }
    });
  }

  /** Saves the audio stream from YouTube to a temporary file */
  private async saveTmpAudio(
    audioStream: ReadableStream<Uint8Array>,
    destination: string
  ) {
    await ensureFile(destination);

    // I was having a very weird, very hard to reproduce bug with Undici, but the youtubei.js package developer came in clutch with this solution. Many thanks https://github.com/LuanRT!
    const reader = audioStream.getReader();
    const file = createWriteStream(destination);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        file.write(value);
      }

      return true;
    } catch (err) {
      return new Error(
        `Something went wrong whilst downloading a song: ${err}`
      );
    } finally {
      reader.releaseLock();
    }
  }

  /** Filter out unwanted results */
  private filter(
    res: MusicResponsiveListItem,
    name: string,
    destination: string,
    track: SpotifyApi.TrackObjectFull,
    playlist: string,
    notFound: Set<string>
  ) {
    if (!notFound.has(name)) notFound.add(name);

    // If none of the artist names intersect or the titles aren't similar enough then reject this entry
    if (
      !res.artists?.some(
        (artist) =>
          artist.name.toLowerCase() === track.artists[0].name.toLowerCase()
      ) ||
      compareTwoStrings(res.title ?? res.name ?? "", track.name) < 0.6
    ) {
      this.daunroda.emit("debug", `Not found "${name}"`);
      return false;
    }

    const diff = this.difference(
      track.duration_ms / 1000,
      res.duration?.seconds ?? 0
    );

    if (
      !this.daunroda.config.allowForbiddenWording &&
      (reject.some(
        (rej) => res.title && res.title.toLowerCase().includes(rej)
      ) ||
        reject.some((rej) => res.name && res.name.toLowerCase().includes(rej)))
    ) {
      this.downloadMaybe.push({
        res,
        name,
        destination,
        track,
        playlist,
        reason: "the name on YouTube contains forbidden wording",
      });

      return false;
    }

    if (
      Math.round(Number(diff)) >
      (isNaN(this.daunroda.config.difference)
        ? 10
        : this.daunroda.config.difference)
    ) {
      this.daunroda.emit(
        "debug",
        `The difference in duration for ${name} is too big (${diff}%)`
      );

      this.downloadMaybe.push({
        res,
        name,
        destination,
        track,
        playlist,
        reason: "a big difference in duration",
      });

      return false;
    }

    // Remove the song from the not found set, since it was found by another entry
    if (notFound.has(name)) notFound.delete(name);
    return true;
  }

  private difference(a: number, b: number) {
    return ((100 * Math.abs(a - b)) / ((a + b) / 2)).toFixed(2);
  }
}
