import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--strictPort").map((argument) => argument === "--host" ? "--hostname" : argument);
const child = spawn(process.execPath, [nextBin, "dev", ...forwardedArgs], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
