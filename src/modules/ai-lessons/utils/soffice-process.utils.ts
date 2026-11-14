import { spawn } from 'node:child_process';
import type { SofficeExecOptions } from '../types/pdf-conversion.types';

function killProcessGroup(pid: number | undefined): void {
  if (!pid) return;
  try {
    // Negative pid: the whole group, i.e. `soffice` and its `soffice.bin` child.
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Group already gone.
  }
}

/**
 * Runs LibreOffice in its own process group. `execFile`'s timeout signals only
 * the launcher and can leave `soffice.bin` running after the slot is released;
 * here a timeout (or any failure) kills the whole group.
 */
export function runSofficeProcess(
  file: string,
  args: readonly string[],
  options: SofficeExecOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(file, [...args], {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        killProcessGroup(child.pid);
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(`${file} excedeu o tempo limite de ${options.timeout} ms`),
        ),
      options.timeout,
    );
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < options.maxBuffer) stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code, signal) =>
      finish(
        code === 0
          ? undefined
          : new Error(
              `${file} terminou com ${code === null ? `sinal ${String(signal)}` : `código ${code}`}: ${stderr.trim().slice(0, 2000)}`,
            ),
      ),
    );
  });
}
