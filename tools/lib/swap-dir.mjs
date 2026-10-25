// 완성된 폴더(from)를 대상(to)으로 바꿔 넣는다. 도중에 실패하면 기존 to 를 그대로 되돌린다.
import { existsSync, renameSync, rmSync } from "node:fs";

export function swapDir(from, to) {
  const old = `${to}.old-${process.pid}`;
  const had = existsSync(to);
  if (had) renameSync(to, old);
  try {
    renameSync(from, to);
  } catch (e) {
    if (had) renameSync(old, to);
    throw e;
  }
  if (had) rmSync(old, { recursive: true, force: true });
}
