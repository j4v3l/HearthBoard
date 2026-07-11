import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const HEALTH_TIMEOUT_MS = 15_000;

export function waitForHealth(baseUrl, timeoutMs = HEALTH_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // retry
      }

      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${baseUrl}/api/health`));
        return;
      }

      setTimeout(attempt, 200);
    };

    void attempt();
  });
}

export async function startTestServer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hearthboard-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  const port = String(39_000 + Math.floor(Math.random() * 1_000));
  const baseUrl = `http://127.0.0.1:${port}`;

  const proc = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: port,
      HOST: "127.0.0.1",
      DATABASE_PATH: dbPath,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  const exitPromise = new Promise((resolve) => {
    proc.once("exit", (code, signal) => resolve({ code, signal }));
  });

  try {
    await Promise.race([
      waitForHealth(baseUrl),
      exitPromise.then(({ code, signal }) => {
        throw new Error(`Test server exited before becoming healthy (code=${code ?? "null"}, signal=${signal ?? "null"})`);
      }),
    ]);
  } catch (error) {
    await new Promise((resolve) => {
      if (proc.killed) {
        resolve();
        return;
      }
      proc.once("exit", resolve);
      proc.kill("SIGTERM");
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }

  return {
    baseUrl,
    proc,
    cleanup: async () => {
      if (!proc.killed) {
        proc.kill("SIGTERM");
        await new Promise((resolve) => proc.once("exit", resolve));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export async function withTestServer(run) {
  const server = await startTestServer();
  try {
    return await run(server);
  } finally {
    await server.cleanup();
  }
}
