# HOWTO

このリポジトリ (プロフィール README) の猫画像を日替わりで切り替える仕組みについてまとめたドキュメントです。

## 1. 仕組みの概要

### ファイル構成

| パス | 役割 |
|---|---|
| `README.md` | プロフィール本体。`<!-- cat:start -->` 〜 `<!-- cat:end -->` の間に猫画像を置く |
| `images/cat1.gif` 〜 `images/cat3.gif` | 切り替え対象の画像 |
| `scripts/rotate-cat.ts` | 切り替え処理の TypeScript ソース |
| `bin/rotate-cat` | `scripts/rotate-cat.ts` を [scriptc](https://scriptc.dev) でビルドした Linux x86_64 ネイティブバイナリ (コミット済み) |
| `.github/workflows/rotate-cat.yml` | 毎日バイナリを実行し、変更があればコミットするワークフロー |
| `.github/dependabot.yml` | GitHub Actions の依存を毎週更新 |

### 切り替えの流れ

1. ワークフローがリポジトリを checkout し、`./bin/rotate-cat` を実行する
2. UTC の年間通算日 `doy` (1〜366) から `doy % 3 + 1` 番目の画像を選ぶ (手動実行で画像を指定した場合はその画像)
3. `README.md` のマーカー内にある `images/catN.gif` だけを書き換える (マーカー外は変更しない)
4. 内容が変わったときだけ書き込み、`changed` / `unchanged` を出力する
5. `$GITHUB_ENV` に `CHANGED=true` / `CHANGED=false` を追記する
6. `CHANGED=true` のときだけ `github-actions[bot]` として `🐱 Daily cat rotation` をコミット・push する

### スケジュール

- 毎日 03:17 UTC (= 12:17 JST) に実行 (`cron: '17 3 * * *'`)
- `workflow_dispatch` で手動実行も可能 (入力 `cat` で画像を指定できる。「4. 使い方」を参照)
- GitHub の混雑状況により、実際の開始は数分〜数十分遅れることがある

## 2. 開発環境の構築

### ビルドホストの要件

- Linux x86_64 (glibc 2.34 以上)
- Node.js 24 以上 (scriptc のインストールに必要)
- clang (glibc 系 Linux でのリンクに使用)

```sh
# 例: Debian / Ubuntu
sudo apt-get install -y clang
npm i -g scriptc --allow-scripts=scriptc   # postinstall でネイティブコンパイラを取得する
scriptc --version
```

`--allow-scripts=scriptc` を付けないと postinstall が実行されず、`scriptc` コマンドが使えません。

### macOS について

- scriptc のコンパイラは macOS 15 以上が必要なため、**macOS 13 では動きません**。Linux マシンや VM / コンテナでビルドしてください。
- macOS 15 以上なら、[scriptc のクロスコンパイル手順](https://scriptc.dev/docs/platforms) に沿って Linux 向けにビルドできます (未検証)。
  1. zig をインストールする (`brew install zig`)
  2. scriptc と同じバージョンのランタイムパック `@scriptc/runtime-linux-x64-gnu` をプロジェクトに追加する
  3. `SCRIPTC_TARGET` に Linux のターゲットを指定してビルドする

  ```sh
  npm install --save-dev @scriptc/runtime-linux-x64-gnu@"$(scriptc --version)"
  SCRIPTC_TARGET=x86_64-linux-gnu.2.34 scriptc build scripts/rotate-cat.ts -o bin/rotate-cat --strip --no-keep-llvm
  ```

  クロスコンパイルしたバイナリは、ネイティブビルドしたものと sha256 が一致しません。

## 3. 開発方法

### 3.1 ソースを編集する

`scripts/rotate-cat.ts` を編集します。依存パッケージはなく、`node:fs` と `process.env` だけを使っています。

### 3.2 coverage を確認する

```sh
scriptc coverage scripts/rotate-cat.ts
```

`fully static` (100%) になることを確認します。静的にコンパイルできない箇所があれば、出力の指示に従って書き換えます。

### 3.3 ビルドする

```sh
scriptc build scripts/rotate-cat.ts -o bin/rotate-cat --strip --no-keep-llvm
```

### 3.4 ローカルでテストする

一時ディレクトリに README をコピーし、`CAT_DAY` (1〜366) で通算日を指定して動作を確認します。

```sh
tmp=$(mktemp -d)
cp README.md bin/rotate-cat "$tmp/"
cd "$tmp"
for d in 1 2 3; do
  GITHUB_ENV="$tmp/env" CAT_DAY=$d ./rotate-cat
  grep -o 'images/cat[0-9]*\.gif' README.md
done
CAT_DAY=3 ./rotate-cat   # 2 回目は unchanged になる (冪等)
cat "$tmp/env"
```

- 通算日 1 → cat2、2 → cat3、3 → cat1 になれば正常
- `CAT_INDEX_OVERRIDE=2 ./rotate-cat` のように画像を直接指定することもできる (未指定 / `auto` なら日付で選択)
- `CAT_DAY` / `CAT_INDEX_OVERRIDE` が不正な値のときや、マーカーが見つからないときは exit 1 で終了する (README.md と `GITHUB_ENV` は変更しない)

### 3.5 バイナリを確認してコミットする

```sh
file bin/rotate-cat        # ELF 64-bit LSB pie executable, x86-64, ... stripped
sha256sum bin/rotate-cat   # 下の「現在のバイナリ」の sha256 を更新する
git add scripts/rotate-cat.ts bin/rotate-cat HOWTO.md
git update-index --chmod=+x bin/rotate-cat
git ls-files -s bin/rotate-cat   # 100755 になっていること
```

### 現在のバイナリ

| 項目 | 値 |
|---|---|
| ファイル | `bin/rotate-cat` (ELF 64-bit x86-64, stripped, 332,736 bytes) |
| sha256 | `23bb2efee77ff6e1a24a181d51ad68ad1651c548e28a411dd00fe9b5b673587e` |
| ビルド環境 | Debian 13 (glibc 2.41) / Node.js v24.22.0 / scriptc 0.3.6 / clang 19 |
| ビルドコマンド | `scriptc build scripts/rotate-cat.ts -o bin/rotate-cat --strip --no-keep-llvm` |
| 要求 glibc | 2.38 以上 |

同じ環境で再ビルドすると、同じ sha256 になることを確認済みです。

## 4. 使い方

### 画像を差し替える

- 同じファイル名 (`images/cat1.gif` など) で上書きするだけで反映されます。コードの変更は不要です。

### 画像を追加・削除する

1. `images/catN.gif` の連番で画像を置く (`cat1` から欠番なし)
2. `scripts/rotate-cat.ts` の `CAT_COUNT` を画像の枚数に変更する
3. `.github/workflows/rotate-cat.yml` の入力 `cat` の `options` に番号を追加・削除する
4. 「3. 開発方法」に沿って再ビルドし、sha256 を更新する

### スケジュールを変更する

`.github/workflows/rotate-cat.yml` の `cron` を変更します。時刻は UTC です (JST = UTC + 9 時間)。

```yaml
on:
  schedule:
    - cron: '17 3 * * *'   # 03:17 UTC = 12:17 JST
```

### 手動で実行する

入力 `cat` で表示する画像を選べます。

| 値 | 動作 |
|---|---|
| `auto` (既定) | スケジュール実行と同じく日付で選択 |
| `1` / `2` / `3` | `images/catN.gif` に切り替え |

- GitHub の Actions タブ →「Daily Cat Rotation」→「Run workflow」→「cat」で値を選んで「Run workflow」
- または CLI で実行する

```sh
gh workflow run rotate-cat.yml -R tkc310/tkc310              # auto
gh workflow run rotate-cat.yml -R tkc310/tkc310 -f cat=2     # cat2.gif に切り替え
gh run watch -R tkc310/tkc310 "$(gh run list -R tkc310/tkc310 --workflow rotate-cat.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

手動で指定した画像は、次のスケジュール実行 (12:17 JST) で日付に応じた画像に戻ります。

### sed 版に戻す

バイナリが動かなくなった場合などは、ワークフローの「Rotate cat image」ステップを次の内容に置き換えると、以前の bash + sed 版に戻せます。

```yaml
      - name: Rotate cat image
        run: |
          set -euo pipefail
          DAY_OF_YEAR=$(date +%j)
          CAT_INDEX=$((10#$DAY_OF_YEAR % 3 + 1))
          echo "Day of year: $DAY_OF_YEAR"
          echo "Selected cat: cat${CAT_INDEX}.gif"
          sed -i "s|images/cat[1-3]\.gif|images/cat${CAT_INDEX}.gif|g" README.md
          if git diff --quiet README.md; then
            echo "CHANGED=false" >> "$GITHUB_ENV"
          else
            echo "CHANGED=true" >> "$GITHUB_ENV"
          fi
```

sed 版はマーカー外の `images/cat[1-3].gif` も置換する点に注意してください。
また、sed 版は入力 `cat` に対応していないため、戻す場合は `workflow_dispatch` の `inputs` と `env` の `CAT_INDEX_OVERRIDE` も削除してください。

## 5. セキュリティ

### ワークフローのハードニング

- トップレベルは `permissions: contents: read`、書き込み (`contents: write`) は `rotate` ジョブにだけ付与
- `actions/checkout` はコミット SHA で固定 (`11bd719…` = v4.2.2)。更新は Dependabot の PR で行う
- 使用する Action は `actions/checkout` のみ。Node.js のセットアップや外部ダウンロードはしない
- ランナーは `ubuntu-24.04` に固定し、`timeout-minutes: 5` を設定
- `concurrency` で同時実行を防止 (`cancel-in-progress: false`)
- 各ステップで `set -euo pipefail`
- 手動実行の入力 `cat` は `type: choice` で値を限定し、`run` に `${{ }}` で埋め込まず `env` (`CAT_INDEX_OVERRIDE`) 経由で渡す。バイナリ側でも `auto` / `1`〜`3` 以外は exit 1 にする
- コミットは変更があるときだけ `github-actions[bot]` として行う

### コミット済みバイナリの扱い

- `bin/rotate-cat` は中身をレビューできないため、**必ず `scripts/rotate-cat.ts` から再ビルドしたものをコミット**してください。手を加えたバイナリや出所の分からないバイナリはコミットしないでください。
- 更新するときは、この HOWTO の「現在のバイナリ」にある sha256 とビルド環境も一緒に更新し、PR にも sha256 を書いてください。
- レビューする側は、同じ環境で再ビルドして sha256 が一致するかを確認できます。
- GitHub Releases、パッケージの公開、attestation は使っていません。

### glibc の要件

- 現在のバイナリは `fmod@GLIBC_2.38` を参照しているため、**glibc 2.38 以上**が必要です (ビルドホストの libm に依存)。
- `ubuntu-24.04` ランナー (glibc 2.39) では動作します。`ubuntu-22.04` (glibc 2.35) など古いランナーに変える場合は、動作しません。

```sh
objdump -T bin/rotate-cat | grep -o 'GLIBC_[0-9.]*' | sort -uV | tail -1   # 要求する最大バージョン
```
