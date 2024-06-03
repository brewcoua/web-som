import CleanCSS from "clean-css";
import { renameSync, rmSync } from "fs";
import type { BunPlugin } from "bun";

const InlineStylePlugin: BunPlugin = {
  name: "inline-style",
  setup(build) {
    // Bundle CSS files as text
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const value = await Bun.file(args.path).text();
      const minified = new CleanCSS().minify(value);

      return {
        contents: minified.styles,
        loader: "text",
      };
    });
  },
};

async function main() {
  process.env.FORCE_COLOR = "1";

  rmSync("dist", { recursive: true, force: true });

  await Bun.build({
    entrypoints: ["./src/main.ts"],
    outdir: "./dist",
    plugins: [InlineStylePlugin],
  });
  renameSync("./dist/main.js", "./dist/SoM.js");

  await Bun.build({
    entrypoints: ["./src/main.ts"],
    outdir: "./dist",
    plugins: [InlineStylePlugin],
    minify: true,
  });
  renameSync("./dist/main.js", "./dist/SoM.min.js");
}

main().catch(console.error);
