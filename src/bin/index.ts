#!/usr/bin/env node

import { readFile, stat, writeFile } from "fs-extra";
import inquirer from "inquirer";
import { homedir } from "os";
import { parse } from "path";
import { Daunroda } from "..";
import { Config } from "../lib/Daunroda";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inquirerdir = require("inquirer-select-directory");

const args = process.argv.slice(2);
inquirer.registerPrompt("directory", inquirerdir);

class DaunrodaCLI {
  private config: Config | undefined;

  public constructor() {
    this.init().catch(console.error);
  }

  private async init() {
    await this.loadConfig();
    this.actions().catch(console.error);
  }

  private async actions() {
    const { choice } = await inquirer.prompt([
      {
        name: "choice",
        message: "Choose what action you want to do",
        type: "list",
        choices: [
          "Download playlists",
          "Show config",
          "Re-make config",
          "Add playlist",
          "Delete last playlist",
          "Exit",
        ],
      },
    ]);

    switch (choice) {
      case "Download playlists":
        await this.download();
        this.actions().catch(console.error);
        break;
      case "Show config":
        console.log(this.config);
        this.actions().catch(console.error);
        break;

      case "Re-make config":
        await this.createConfig();
        console.log("Successfully recreated the config file.");
        this.actions().catch(console.error);
        break;

      case "Add playlist":
        await this.addPlaylist();
        console.log("Successfully added a new playlist.");
        this.actions().catch(console.error);
        break;
      case "Delete last playlist":
        if (!this.config!.playlists.length) {
          console.log("There's no playlist to remove!");
          this.actions().catch(console.error);
        }

        this.config!.playlists.pop();
        await this.saveConfig();
        console.log("Successfully removed the last playlist.");
        this.actions().catch(console.error);
        break;

      case "Exit":
        process.exit(0);
      default:
        null;
    }
  }

  private async createConfig() {
    const {
      spotifyClientID,
      spotifySecret,
      downloadTo,
      audioContainer,
      audioBitrate,
      difference,
      allowForbiddenWording,
    } = await inquirer.prompt([
      {
        name: "spotifyClientID",
        message: "What is your Spotify client id?",
      },
      {
        name: "spotifySecret",
        message: "What is your Spotify client secret?",
      },
      {
        name: "downloadTo",
        message: "Where should I download songs to?",
        type: "directory",
        basePath: parse(__dirname).root,
      },
      {
        name: "audioContainer",
        message:
          "In what audio container do you want to download the songs in?",
        type: "list",
        default: "mp3",
        choices: ["mp3", "flac"],
      },
      {
        name: "audioBitrate",
        message:
          "What audio bitrate should MP3 files have? (defaults to 128kbps)",
        default: 128,
        validate: (input) =>
          !isNaN(input) || input > 320
            ? true
            : "Please input a bitrate between 0 and 320kbps!",
      },
      {
        name: "difference",
        message:
          "What percentage number should be used to check against the difference between the Spotify version and YouTube Music version in duration (if higher than this it will be skipped from auto-downloading)",
        default: 10,

        validate: (input) =>
          isNaN(input) ? "Please input a number to use!" : true,
      },
      {
        name: "allowForbiddenWording",
        message:
          "Should I automatically download songs that contain forbidden wording on YouTube (such as live, karaoke, instrumental etc), if disabled you will be prompted if you want to download anyway or not",
        default: false,
        type: "confirm",
      },
    ]);

    this.config = {
      spotifyClientID,
      spotifySecret,
      downloadTo,
      audioContainer,
      audioBitrate,
      difference,
      allowForbiddenWording,
      playlists: [],
    };

    await this.saveConfig();
    await this.addPlaylist();
  }

  private async saveConfig() {
    await writeFile(
      `${homedir()}/.daunroda-config.json`,
      JSON.stringify(this.config)
    );
  }

  private async loadConfig() {
    await stat(`${homedir()}/.daunroda-config.json`).catch((err) => {
      if (err.code !== "ENOENT") {
        console.log("Something went wrong while reading the config file.");
        process.exit(1);
      }

      console.log(
        `You don't seem to have a config file created, creating one...`
      );

      return this.createConfig();
    });

    if (!this.config)
      this.config = await readFile(`${homedir()}/.daunroda-config.json`).then(
        (buffer) => JSON.parse(buffer.toString())
      );
  }

  private async addPlaylist() {
    const { spotifyPlaylist }: { spotifyPlaylist: string } =
      await inquirer.prompt([
        {
          name: "spotifyPlaylist",
          message: "Please paste the Spotify Playlist's link or URI:",
          validate: (input: string) =>
            input && input.toLowerCase().includes("playlist")
              ? true
              : "Please provide a valid Spotify playlist.",
        },
      ]);

    const id = spotifyPlaylist.split(/playlist[\/:]/)[1].split("?")[0];

    if (this.config!.playlists.includes(id))
      return console.log(
        "You already have this playlist addin the configuration."
      );
    this.config!.playlists.push(id);
    await this.saveConfig();
  }

  private async download() {
    if (!this.config!.playlists.length)
      return console.info(
        "You don't seem to have any Spotify playlists present, I have nothing to download."
      );

    const daunroda = new Daunroda(this.config!);
    if (args.includes("--v")) daunroda.on("debug", console.debug);
    daunroda.on("info", console.info);
    daunroda.on("error", console.error);

    await daunroda.run();
  }
}

new DaunrodaCLI();
