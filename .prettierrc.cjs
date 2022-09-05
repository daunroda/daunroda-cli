const sapphirePrettierConfig = require("@sapphire/prettier-config");

module.exports = {
  ...sapphirePrettierConfig,
  tabWidth: 2,
  useTabs: false,
  singleQuote: false,
  printWidth: 80,
  overrides: [
    ...sapphirePrettierConfig.overrides,
    {
      files: ["*.md"],
      options: {
        printWidth: 80,
        proseWrap: "always"
      }
    }
  ]
};
