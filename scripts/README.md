# scripts

## rotate-cat.ts

README.md の `<!-- cat:start -->` 〜 `<!-- cat:end -->` 内の猫画像を日替わりで切り替えるスクリプトです。
UTC の年間通算日 `doy` から `doy % 3 + 1` 番目の画像 (`images/cat{1,2,3}.gif`) を選びます。

GitHub Actions (`.github/workflows/rotate-cat.yml`) では、[scriptc](https://scriptc.dev) でビルドしてコミット済みのネイティブバイナリ `bin/rotate-cat` を直接実行します (Node.js のセットアップは不要)。

- 変更があれば README.md を書き換え、`changed` / `unchanged` を出力
- `GITHUB_ENV` が設定されていれば `CHANGED=true` / `CHANGED=false` を追記
- テスト用に `CAT_DAY=<1-366>` で通算日を上書き可能

```sh
CAT_DAY=291 ./bin/rotate-cat
```

## バイナリの再ビルド

macOS 13 (Intel) では scriptc のコンパイラが動かないため、Linux x86_64 でビルドします。

- 環境: Linux x86_64 (Debian 13, glibc 2.41) / Node.js v24.22.0 / scriptc 0.3.6 / clang 19
- 生成物の要求 glibc: 2.38 以上 (`ubuntu-24.04` ランナーは glibc 2.39)

```sh
npm i -g --allow-scripts=scriptc scriptc@0.3.6
scriptc coverage scripts/rotate-cat.ts   # 100% static であることを確認
scriptc build scripts/rotate-cat.ts -o bin/rotate-cat --strip --no-keep-llvm
git update-index --chmod=+x bin/rotate-cat
```
