# Restaurant Pipeline Usage Guide

このプロジェクトは、既存の Next.js プロジェクトに **Node.js / TypeScript 製の店舗統合パイプライン** を追加したものです。
API に依存せず、ローカル環境で CSV や JSON のデータを統合・正規化・重複排除・チェーン判定を行うことができます。

## セットアップ

まずは依存関係をインストールしてください。

```bash
npm install
```

## 動作確認 (テスト)

実装されたロジック（正規化、チェーン判定、重複スコア判定など）が正しく動作するか、テストを実行して確認できます。

```bash
npm run pipeline:test
```

## パイプラインの実行

`npm run pipeline:run` コマンドを使用して、パイプラインを実行します。

### 基本的な実行方法

```bash
npm run pipeline:run -- \
  --input data/google.csv,data/tabelog.json \
  --output output/result.json \
  --chainDb data/chains.json
```

- `--input`: 入力ファイルのパス。カンマ区切りで複数指定可能です（CSV, JSON 対応）。
- `--output`: 実行結果の保存先パス（デフォルト: `output/restaurant-dedup-result.json`）。
- `--chainDb`: チェーン店マスターデータのパス（CSV, JSON 対応）。

### オプション

- `--removeBusinessWords`: 店名から業態語（「居酒屋」「カフェ」「焼肉」など）を除去して正規化を行いたい場合に指定します。

```bash
npm run pipeline:run -- --input data/input.csv --removeBusinessWords
```

## 出力データについて

出力される JSON は以下の構造を持ちます。

- `summary`: 処理件数の統計情報。
- `stores`: 統合された店舗データ。各店舗には以下の情報が含まれます：
  - `storeId`: 正規化情報に基づくハッシュ ID。
  - `sources`: どの媒体（google, tabelog 等）から統合されたかのリスト。
  - `logs`: **重要**。正規化の理由、チェーン判定の理由、重複判定のスコア内訳などが記録されており、デバッグに役立ちます。
- `chainExcluded`: チェーン店として判定され、除外されたレコード。

## 主要な設定の変更

重複判定のスコア設定などは `src/lib/restaurant-pipeline/constants.ts` で調整可能です。

- `DUPLICATE_SCORE_THRESHOLD`: 重複とみなす閾値（デフォルト 80点）。
- `SCORING_WEIGHTS`: 各項目（電話一致、距離、店名類似など）の加点幅。

---

## 実装のポイント（振り返り）

1. **マルチソース統合**: Google, 食べログ, ホットペッパーなどの異なるソースを1つのスキーマに統一。
2. **高度な正規化**: 電話番号、住所、店名の揺れを吸収。
3. **スコア制重複判定**: 単なる一致ではなく、複数の要素を組み合わせて 80点以上で重複と判定。
4. **Union-Find クラスタリング**: A=B, B=C なら A=C と判定し、複数のレコードを1つの店舗として統合。
5. **デバッグログ**: なぜその判定になったかが JSON に残るため、精度の調整が容易。
