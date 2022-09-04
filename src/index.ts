import { ensureDir } from "fs-extra";
import { downloadTo, playlists } from "./config.json";
import { Spotify } from "./lib/Spotify";
import { YouTube } from "./lib/YouTube";

const args = process.argv.slice(2);
if (!args.find((el) => el === "--v")) console.debug = () => null;

async function main() {
  const spotify = await new Spotify().init();
  const yt = await new YouTube().init();

  await ensureDir(downloadTo);

  const totalPlaylists = `${playlists.length} ${
    playlists.length > 1 ? "playlists" : "playlist"
  }`;

  console.info(`Processing ${totalPlaylists} on Spotify...`);
  const processed = await spotify.processPlaylists(playlists);

  let fetchedTracks = 0;
  processed.map((val) => (fetchedTracks += val.songs.length));
  console.info(
    `Fetched ${fetchedTracks} tracks across ${totalPlaylists} on Spotify!`
  );

  console.info("Searching and downloading songs from YouTube Music...");
  await yt.processSongs(processed);
  console.log(processed[0].songs[0].youtube);
}

main().catch(console.error);
