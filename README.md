# 飲食店データ・重複排除・チェーン除外パイプライン (Duplicate-Filter)

このシステムは、複数の媒体（Google Maps, 食べログ, ホットペッパーなど）から収集された店舗リストを読み込み、データの正規化、高度なチェーン判定、商業施設（モール）内店舗の除外、およびスコアリングに基づく重複排除を行う高性能なデータクレンジング・パイプラインです。

Next.js アプリケーション (`src/app/`) とのシームレスなAPI連携を維持しながら、コマンドライン（CLI）から直接CSVやJSONファイルをインポート・エクスポートすることができます。

---

## 🎨 主要な改善点と特徴

1. **元CSVヘッダーと並び順の完全保持（エクスポート機能の強化）**
   - 従来の固定スキーマ出力とは異なり、入力CSVのすべての列を元の順序で出力します。
   - 解析結果（正規化名、スコア、判定フラグ、除外理由）は、末尾に新規カラムとして追加されます。
   - 電話番号を持つ店舗を上に、空白の店舗を下に自動ソートしてエクスポートします。

2. **自動ソースプラットフォーム検出**
   - 入力データ内のヘッダー名（`map_url`, `tabelog_url`等）やURL列の値（`tabelog.com`, `hotpepper.jp`等）から、Google Maps / 食べログ / ホットペッパーのソース媒体を自動判定します。ファイル名に依存しない高い堅牢性を誇ります。

3. **外部化されたグラニュラー設定 (JSON)**
   - チェーン判定基準、スコア設定、商業施設キーワード、チェーンブランドマスターを `src/lib/config/` 内の JSON 設定ファイルに完全外部化し、コードを書き換えずに調整可能です。

4. **高精度チェーン店・商業施設スコアリング判定**
   - **出現回数カウント**: 同一ブランド名が全データ内で5件以上（設定可能）出現した場合、チェーン店フラグを自動付与。
   - **公式サイト URL 検証**: `/company/` や `/shop/` などの店舗ディレクトリ特徴を持つURLの検出。
   - **レビュー数スコア**: レビュー数が一定値以上（例: 500件以上など）の場合に加点。
   - **店名正規化の改善**: 「渋谷店」「南浦和店」のような地名＋店舗名サフィックスを正確に除去し、高い類似度マッチングを実現。

5. **柔軟な除外処理**
   - デフォルトでは重複店や除外対象（チェーン店、モール店舗）をフィルタリングして出力しますが、`--include-excluded` フラグを使用することで、除外理由（`exclude_reason`）を付加した全件ダンプが可能です。

---

## 📂 新しいフォルダ構成

リファクタリングにより、`src/lib/` 以下は高機能で保守しやすいモジュール分割に変更されました。

```
src/
├── app/                        ← Next.js Web UI（既存機能維持）
├── cli/
│   └── runRestaurantPipeline.ts  ← CLI実行用ランナースクリプト
└── lib/
    ├── config/                 ← 【NEW】JSON外部設定ファイル
    │   ├── chain_brands.json   ← チェーンブランドマスター・一般名詞
    │   ├── mall_keywords.json  ← 商業施設除外キーワード・フロア階数パターン
    │   └── scoring_config.json ← 重複スコアおよびチェーン店閾値設定
    ├── parser/                 ← 【NEW】CSV/JSON解析およびソース自動判定
    │   ├── detectSource.ts
    │   └── parseInputFiles.ts
    ├── normalize/              ← 地名サフィックス・日本の住所ハイフン正規化
    │   └── normalizers.ts
    ├── chain/                  ← スコアベースのチェーン店検出
    │   └── chainDetection.ts
    ├── mall/                   ← 商業施設（ショッピングモール）判定
    │   └── mallDetection.ts
    ├── duplicate/              ← 重複スコアリングおよび Union-Find
    │   ├── duplicateScoring.ts
    │   └── unionFind.ts
    ├── export/                 ← 【NEW】元CSVカラムを保持したエクスポート
    │   ├── csvExporter.ts
    │   └── jsonExporter.ts
    ├── utils/                  ← 地理セル、ハッシュ、類似度、ロガー
    │   ├── geo.ts
    │   ├── hash.ts
    │   ├── log.ts
    │   └── similarity.ts
    ├── merge-clusters.ts       ← 重複店舗クラスタの代表レコードマージ処理
    ├── pipeline.ts             ← 全体を統括するオーケストレーター
    ├── types.ts                ← 型定義の拡張（新規フラグ、生データ保存用）
    ├── constants.ts            ← 静的マッピングやソース優先度
    └── index.ts                ← モジュール公開用エントリーポイント
```

---

## 🛠️ CLI 実行方法

パイプラインの実行には `npm run pipeline:run` を使用します。

### 1. CSVエクスポート（推奨: 元のCSVヘッダーを保持）
出力ファイル名が `.csv` で終わるか、または `--format csv` を明示すると、自動的にCSV形式でエクスポートされます。

```bash
npm run pipeline:run -- \
  --input data/google.csv \
  --output output/restaurant-clean-result.csv \
  --chainDb data/chains.json
```

### 2. 除外店舗も含めて全件エクスポート (`--include-excluded`)
通常は重複店やチェーン店・モール店舗は除外されますが、このフラグを指定すると、判定結果（フラグ・理由）を含めた状態で全件が出力されます。

```bash
npm run pipeline:run -- \
  --input data/google.csv \
  --output output/restaurant-clean-result.csv \
  --chainDb data/chains.json \
  --include-excluded
```

### 3. その他の便利な実行オプション

| オプションフラグ | 設定内容 |
|:---|:---|
| `--input <path1,path2>` | 入力ファイル。カンマ区切りで複数ファイルを指定可能（CSV / JSON 両対応） |
| `--output <path>` | 保存先ファイルのパス（デフォルト: `output/restaurant-dedup-result.json`） |
| `--chainDb <path>` | チェーン店データベース（CSV / JSON 対応。デフォルト: `api/masters/chains_master.csv`） |
| `--format <csv\|json>` | 出力フォーマットの強制指定（未指定時は出力ファイルの拡張子で自動判定） |
| `--exclude-commercial` | 商業施設（ショッピングモール）内の店舗を完全に除外対象にする（デフォルト: false） |
| `--strip-prefecture` | 住所正規化時に都道府県名（「東京都」等）を除去する（デフォルト: false） |
| `--remove-business-words` | 店名から「居酒屋」「カフェ」などの業態語を除去して正規化する（デフォルト: false） |

---

## ⚙️ 外部設定ファイルのパラメータ調整

設定を変更するには、`src/lib/config/` 内の各 JSON ファイルを編集します。

### `scoring_config.json`
チェーン判定および重複排除の閾値を設定します。
```json
{
  "duplicate": {
    "duplicateThreshold": 70,
    "phoneMatchScore": 100,
    "urlMatchScore": 70,
    "distanceThresholdMeters": 30,
    "nameSimilarityThreshold": 0.85,
    "addressSimilarityThreshold": 0.80
  },
  "chain": {
    "occurrenceThreshold": 5,
    "reviewThreshold": 500,
    "chainMinScore": 60
  }
}
```

### `mall_keywords.json`
商業施設除外用のキーワード辞書です。
- `strictWords`: イオン、パルコなど、完全マッチする商業施設名。
- `facilityWords`: 「ビル」「モール」など店舗住所から施設を特定するためのサフィックス。

---

## 🧪 テストの実行

正規化や重複・チェーン・商業施設などの各種判定ロジックに対して、テストコードが用意されています。

```bash
npm run pipeline:test
```

---

## 📝 出力CSVに追加される解析カラム

エクスポートされたCSVの末尾には、以下のクレンジング分析結果カラムが自動付与されます。

| 追加カラム名 | 説明 | 例 |
|:---|:---|:---|
| `normalized_name` | 地名・記号・業態語などを除外した、照合用の正規化店舗名 | `鳥貴族` |
| `normalized_address` | 丁目・番地・ビル名等の表記揺れを補正した正規化住所 | `東京都渋谷区道玄坂1-1-1` |
| `duplicate_score` | 他店舗との重複類似度スコア (0〜100) | `100` |
| `chain_flag` | チェーン店判定されたかどうかのフラグ | `true` / `false` |
| `mall_flag` | 商業施設（ショッピングモール）店舗と判定されたかのフラグ | `true` / `false` |
| `exclude_reason` | 除外された理由（`duplicate`, `chain_store`, `mall_tenant`）のパイプ区切り | `chain_store` |
