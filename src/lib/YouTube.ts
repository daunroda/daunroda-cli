import { Stopwatch } from "@sapphire/stopwatch";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { ensureDir, existsSync, rm, writeFile } from "fs-extra";
import { tmpdir } from "os";
import sanitize from "sanitize-filename";
import { Readable } from "stream";
import { request } from "undici";
import { Innertube } from "youtubei.js";
import ytdl from "ytdl-core";
import {
  audioBitrate,
  audioContainer,
  difference,
  downloadTo,
} from "../config.json";
import { Processed } from "./Spotify";

ffmpeg.setFfmpegPath(ffmpegPath!);

const codec =
  audioContainer === "mp3"
    ? "libmp3lame"
    : audioContainer === "flac"
    ? "flac"
    : "libmp3lame";

const bitrate =
  !isNaN(parseFloat(audioBitrate)) && Number(audioBitrate) <= 320
    ? `${Number(audioBitrate)}k`
    : "320k";

export class YouTube {
  private client!: Innertube;
  private stopwatch = new Stopwatch().stop();

  public async init() {
    this.client = await Innertube.create({});

    return this;
  }

  public async processSongs(processed: Processed[]) {
    for (const playlist of processed) {
      await ensureDir(`${downloadTo}/${sanitize(playlist.name)}`);
      const promises = [];

      const notFound: { playlist: string; songs: string[] }[] = [];
      const bigDifference: string[] = [];
      const songs: string[] = [];

      this.stopwatch.restart();
      for (const song of playlist.songs) {
        if (!song.track) continue;
        const { track } = song;
        const name = `${track.artists[0].name} - ${track.name}`;
        const duration = track.duration_ms / 1000;

        const destination = `${downloadTo}/${sanitize(
          playlist.name
        )}/${sanitize(name)}.${audioContainer}`;

        // Skip searching and downloading if song is already downloaded
        if (existsSync(destination)) {
          songs.push(name);
          console.debug(`"${name}" is already downloaded.`);
          continue;
        }

        console.debug(`Searching for "${name}"...`);
        const searched = await this.client.music.search(name, { type: "song" });

        const result = searched?.results?.[0];
        if (!result) {
          console.debug(`Not found "${name}"`);

          const array = notFound.find((el) => el.playlist === playlist.id);

          if (!array) notFound.push({ playlist: playlist.id, songs: [name] });
          else if (array) array.songs.push(name);

          continue;
        }

        const diff = this.difference(duration, result.duration?.seconds ?? 0);
        console.debug(
          `Difference between Spotify and YouTube Music version: ${diff}%`
        );

        if (
          Math.round(Number(diff)) >
          (isNaN(parseFloat(difference)) ? 10 : Number(difference))
        ) {
          console.debug(
            `The difference in duration for ${name} is too big (${diff}%), skipping song...`
          );
          bigDifference.push(name);

          continue;
        }

        songs.push(name);

        // We push all the promises into an array to be able to concurrently download songs
        const promise = this.downloadSong(result.id!, destination, track);
        promises.push(promise);
      }

      await Promise.all(promises);

      this.stopwatch.stop();

      const m3u8 = songs
        .map(
          (name) =>
            `${sanitize(playlist.name)}/${sanitize(name)}.${audioContainer}`
        )
        .join("\n");
      await writeFile(`${downloadTo}/${sanitize(playlist.name)}.m3u8`, m3u8);

      const songsNotFound = notFound.find((el) => el.playlist === playlist.id);
      console.info(
        songsNotFound
          ? `Found ${
              playlist.songs.length - songsNotFound.songs.length
            } songs out of ${playlist.songs.length} from the "${
              playlist.name
            }" playlist and downloaded ${
              bigDifference.length > 1
                ? `${playlist.songs.length - bigDifference.length}`
                : "all"
            } in ${this.stopwatch.toString()}!`
          : `Found all songs (${playlist.songs.length}) from the "${
              playlist.name
            }" playlist and downloaded ${
              bigDifference.length > 1
                ? `all but ${bigDifference.length} due to there being a big difference in length`
                : "all"
            } in ${this.stopwatch.toString()}!`
      );
    }
  }

  public async downloadSong(
    id: string,
    destination: string,
    track: SpotifyApi.TrackObjectFull
  ) {
    const audioStream = ytdl(`https://youtu.be/${id}`, {
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    });

    audioStream.on("error", (err) =>
      console.error(
        `There was an error whilst downloading "${track.name}": ${err.message}`
      )
    );

    const coverStream = await request(track.album.images[0].url).then((res) =>
      res.body.arrayBuffer()
    );

    const tmpImg = `${tmpdir()}/${(Math.random() + 1).toString(36)}.jpg`;
    const tmpAudio = `${tmpdir()}/${(Math.random() + 1).toString(
      36
    )}.${audioContainer}`;

    await this.saveTmpAudio(audioStream, tmpAudio);
    await writeFile(tmpImg, Buffer.from(coverStream));

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
          resolve();
        });
      } catch (err) {
        console.error(err);
      }
    });
  }

  private saveTmpAudio(audioStream: Readable, destination: string) {
    return new Promise((resolve) => {
      const ff = ffmpeg(audioStream)
        .outputOptions("-acodec", codec, "-b:a", bitrate)
        .saveToFile(destination);
      ff.on("end", resolve);
    });
  }

  private difference(a: number, b: number) {
    return ((100 * Math.abs(a - b)) / ((a + b) / 2)).toFixed(2);
  }
}
