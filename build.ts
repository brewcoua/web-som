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

  const result1 = await Bun.build({
    entrypoints: ["./src/main.ts"],
    outdir: "./dist",
    plugins: [InlineStylePlugin],
  });
  if (!result1.success) {
    result1.logs.forEach(console.log);
    process.exit(1);
  }
  renameSync("./dist/main.js", "./dist/SoM.js");

  const result2 = await Bun.build({
    entrypoints: ["./src/main.ts"],
    outdir: "./dist",
    plugins: [InlineStylePlugin],
    minify: true,
  });
  if (!result2.success) {
    result2.logs.forEach(console.log);
    process.exit(1);
  }

  renameSync("./dist/main.js", "./dist/SoM.min.js");
}

main().catch(console.error);
