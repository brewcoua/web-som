import CleanCSS from "clean-css";
import { renameSync, rmSync } from "fs";
import { exec } from "child_process";

async function main() {
  process.env.FORCE_COLOR = "1";

  // Clear dist
  rmSync("dist", { recursive: true, force: true });

  // Build non-minified SoM.js
  exec(
    "bun build ./src/main.ts --outfile ./dist/SoM.js",
    (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return;
      }
      console.log(stdout);
    }
  );

  // Build minified SoM.min.js
  exec(
    "bun build ./src/main.ts --outfile ./dist/SoM.min.js --minify",
    (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return;
      }
      console.log(stdout);
    }
  );

  // Copy style.css to dist and minify it
  const css = await Bun.file("./src/style.css").text();
  await Bun.write("dist/SoM.css", css);

  const minified = new CleanCSS().minify(css);
  await Bun.write("dist/SoM.min.css", minified.styles);
}

main().catch(console.error);
