// README.md の猫画像を日替わりで切り替える。
// scriptc で Linux x64 のネイティブバイナリ (bin/rotate-cat) にビルドして使う。
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const README = "README.md";
const START = "<!-- cat:start -->";
const END = "<!-- cat:end -->";
const CAT_COUNT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// UTC の年間通算日 (1-366)。テスト用に CAT_DAY で上書きできる。
function dayOfYear(): number {
  const override = process.env.CAT_DAY;
  if (override !== undefined && override !== "") {
    const n = Number(override);
    if (!Number.isInteger(n) || n < 1 || n > 366) {
      throw new Error(`invalid CAT_DAY: ${override}`);
    }
    return n;
  }
  const now = new Date();
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - startOfYear) / DAY_MS) + 1;
}

// 手動実行時の画像指定 (workflow_dispatch の入力 cat)。
// 未指定 / "auto" なら null (日付で選択)、"1"〜CAT_COUNT ならその番号、それ以外はエラー。
function indexOverride(): number | null {
  const raw = process.env.CAT_INDEX_OVERRIDE;
  if (raw === undefined || raw === "" || raw === "auto") {
    return null;
  }
  const n = Number(raw);
  if (!/^[1-9][0-9]*$/.test(raw) || n > CAT_COUNT) {
    throw new Error(`invalid CAT_INDEX_OVERRIDE: ${raw} (expected auto or 1-${CAT_COUNT})`);
  }
  return n;
}

function signal(changed: boolean): void {
  const envFile = process.env.GITHUB_ENV;
  if (envFile !== undefined && envFile !== "") {
    appendFileSync(envFile, `CHANGED=${changed ? "true" : "false"}\n`);
  }
}

function main(): void {
  const override = indexOverride();
  let index: number;
  if (override === null) {
    const day = dayOfYear();
    index = (day % CAT_COUNT) + 1;
    console.log(`Day of year: ${day}`);
  } else {
    index = override;
    console.log(`Override: cat${index}.gif`);
  }
  console.log(`Selected cat: cat${index}.gif`);

  const content = readFileSync(README, "utf8");
  const start = content.indexOf(START);
  const end = start === -1 ? -1 : content.indexOf(END, start + START.length);
  if (start === -1 || end === -1) {
    throw new Error(`markers not found in ${README}`);
  }

  const bodyStart = start + START.length;
  const body = content.slice(bodyStart, end);
  const newBody = body.replace(/images\/cat[1-9]\d*\.gif/g, `images/cat${index}.gif`);
  const updated = content.slice(0, bodyStart) + newBody + content.slice(end);

  const changed = updated !== content;
  if (changed) {
    writeFileSync(README, updated);
  }
  console.log(changed ? "changed" : "unchanged");
  signal(changed);
}

main();
