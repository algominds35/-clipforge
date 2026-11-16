import { spawn } from "node:child_process";

export async function runProcess(bin: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const cap = 256 * 1024;

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < cap) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < cap) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(new Error(`Unable to start ${bin}. ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${bin} exited with code ${code ?? "unknown"}: ${stderr.slice(-2000)}`));
    });
  });
}
