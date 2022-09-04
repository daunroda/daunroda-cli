import chalk from "chalk";
import { ensureDir } from "fs-extra";
import { downloadTo, playlists } from "./config.json";
import { Spotify } from "./lib/Spotify";
import { YouTube } from "./lib/YouTube";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hyperlinker = require("hyperlinker");

const args = process.argv.slice(2);
if (!args.find((el) => el === "--v")) console.debug = () => null;

async function main() {
  const spotify = await new Spotify().init();
  const youtube = await new YouTube().init();

  await ensureDir(downloadTo);

  const totalPlaylists = `${playlists.length} ${
    playlists.length > 1 ? "playlists" : "playlist"
  }`;

  console.info(`Processing ${chalk.greenBright(totalPlaylists)} on Spotify...`);
  const processed = await spotify.processPlaylists(playlists);

  let fetchedTracks = 0;
  processed.map((val) => (fetchedTracks += val.songs.length));
  console.info(
    `Fetched ${chalk.cyanBright(
      `${fetchedTracks} tracks`
    )} across ${chalk.greenBright(totalPlaylists)} on Spotify!`
  );

  console.info(`Searching and downloading songs from YouTube Music...\n`);
  await youtube.processSongs(processed);

  console.info(
    `${chalk.yellowBright(
      hyperlinker(
        "Success!",
        "https://www.myinstants.com/media/instants_images/boratgs.jpg"
      )
    )} Songs downloaded to ${chalk.blueBright(downloadTo)}.`
  );
}

main().catch(console.error);
