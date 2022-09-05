import { Daunroda } from "./";
import config from "./config.json";

const args = process.argv.slice(2);

const daunroda = new Daunroda(config);
daunroda.run().catch(console.error);

if (args.find((el) => el === "--v")) daunroda.on("debug", console.debug);
daunroda.on("info", console.info);
daunroda.on("error", console.error);
