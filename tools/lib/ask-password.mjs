// 비밀번호를 화면에 보이지 않게 입력받는다. (터미널이 아니면 에코 걱정이 없으므로 그냥 한 줄 읽음)
import { Writable } from "node:stream";
import readline from "node:readline/promises";

export async function askHidden(prompt) {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin });
    const line = await rl.question("");
    rl.close();
    return line;
  }
  let muted = false;
  const out = new Writable({
    write(chunk, enc, cb) {
      if (!muted) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  process.stdout.write(prompt);
  muted = true; // 이후 입력 글자(에코)는 화면에 쓰지 않는다
  try {
    return await rl.question("");
  } finally {
    rl.close();
    process.stdout.write("\n");
  }
}

// 새 비밀번호를 정할 때: 같은 값을 두 번 입력받아 오타를 막는다.
export async function askNewPassword() {
  const a = await askHidden("비밀번호(입력은 보이지 않음): ");
  const b = await askHidden("비밀번호 다시 입력: ");
  if (a !== b) throw new Error("두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.");
  return a;
}
