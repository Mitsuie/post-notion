# Post-Notion (ポスト・ノーション)

> **Notionをバックエンドにした、摩擦ゼロのパーソナルSNS風ナレッジ収集基盤**

Post-Notion は、Notionデータベースをセキュアなデータ保管庫として活用しながら、「思考の断片・アイデア・気づき」をストレスなく連投・収集・閲覧できる極上の操作性を持ったパーソナルWebアプリケーション（PC & モバイルPWA対応）です。

Cloudflare Pages（エッジ実行・完全無料）およびローカルNode.js環境（WSL/Tailscale連携）の両方に対応するポータブルな設計を採用しています。

---

## 🌟 主な特徴・機能

### 1. 摩擦ゼロの高速連投 & エディタ体験
- **0秒連投**: `Cmd/Ctrl + Enter` で即座に投稿。送信完了を待たずにUIへ即時反映する「楽観的UI更新（Optimistic UI）」により、Notion APIの通信ラグを隠蔽。
- **Markdown記法の自動継続**: リスト（`- `, `* `, `+ `）、番号付きリスト（`1. `）、チェックボックス（`- [ ] `）、引用（`> `）でのEnter改行時にプレフィックスを自動継続。
- **Tab階層インデント**: `Tab` / `Shift + Tab` によるネスト下げ・上げ操作。
- **Notion階層ブロック連携**: 入力されたMarkdownテキストを解析し、Notionデータベースへネイティブな箇条書き・To-Do・引用および階層ネストブロックとして保存。

### 2. タイムライン & Notion風多機能フィルター
- **高速閲覧**: TanStack Queryによるクライアントキャッシュにより、2回目以降の表示は0秒で描画。
- **Notion風フィルターUI**:
  - 作成日フィルター（直近30日間、今日、直近7日、カレンダー範囲指定）。
  - タグ複数選択フィルター（OR条件絞り込み、縦スクロール対応チェックリスト）。
  - 適用中フィルターチップの常時表示とワンクリック解除。
- **スマート日時表示**: 当年の投稿は月日・時刻のみ（例: `09/25 15:30`）、前年以前は西暦付き（例: `2025/12/31 23:59`）で簡潔表示。ホバー/タップで完全な日時をツールチップ表示。
- **ピン留め固定**: 重要メモの上部固定表示（`Pinned` プロパティ連携）。

### 3. スレッド・返信（Notion Comments API連携）
- 各カードからインラインでスレッドを展開。Notion公式のコメント機能と完全同期。

### 4. 日報データベース（`DB_日報`）自動リレーション連携
- 投稿時に「日報に紐付ける」を有効にすると、Notion上の `DB_日報` から当日の日報ページを自動検索し、リレーションを自動付与。日報側からもその日に投下したメモ一覧を一元把握可能。

### 5. PWA & モバイル最適化
- iOS PWA（ホーム画面追加時）のDynamic Islandやホームバー領域を考慮したセーフエリア（Safe Area Insets）最適化。
- モバイル・デスクトップ両対応のレスポンシブデザイン。

### 6. 設定メニュー & Notion接続ヘルスチェック
- ヘッダーのハンバーガーメニューから開くスライドドロワーUI。
- ライトモード（☀️）/ ダークモード（🌙）の即時切り替え。
- バックエンドの疎通診断（APIキー、Posts DB、Tags DB、日報DBの接続状況・登録件数・プロパティ確認）。
- アプリ内キャッシュの強制クリア＆Notion最新状態再同期。

---

## 🛠️ 技術スタック

| レイヤー | 技術 | 用途 |
| :--- | :--- | :--- |
| **フロントエンド** | React 18, TypeScript, Vite | SPAクライアント |
| **状態・キャッシュ** | TanStack Query (React Query) v5 | 楽観的更新、非同期データキャッシュ |
| **UI・アイコン** | Vanilla CSS, Lucide React | インダストリアルモノトーンデザイン、アイコン |
| **BFF / API層** | Hono v4 | Web標準準拠の軽量高速APIフレームワーク |
| **Notion連携** | `@notionhq/client`, `notion-to-md` | Notion公式SDK、ブロックMarkdown相互変換 |
| **サーバー (Node.js)**| `@hono/node-server`, `dotenv`, `tsx` | スタンドアロン実行・ローカル配信 |
| **ホスティング (本番)**| Cloudflare Pages + Pages Functions | エッジサーバーレスホスティング (手法A) |
| **閉域網公開 (将来)** | Tailscale (`tailscale serve`) | 自宅WSLセルフホスト・認証なし0秒起動 (手法B) |

---

## 📁 リポジトリの構成要素

フロントエンド（SPA）と共通BFF（Hono）を単一リポジトリで管理するポータブルモノレポ構成です。

```text
post-notion/
├── src/                        # フロントエンド (React + TypeScript + Vite)
│   ├── components/             # UIコンポーネント (Timeline, PostCard, InputBar, SettingsDrawer等)
│   ├── hooks/                  # TanStack Query カスタムフック (usePosts, useCreatePost等)
│   ├── types/                  # クライアント側型定義
│   ├── utils/                  # 日時フォーマッター、ヘルパー関数
│   ├── App.tsx                 # アプリケーションルート
│   └── main.tsx                # エントリーポイント
├── api/                        # 共通BFFロジック (Hono)
│   ├── app.ts                  # Honoアプリケーション本体 (CORS、ルーティング定義)
│   ├── notion.ts               # Notion SDKクライアント初期化・環境変数バリデーション
│   ├── types.ts                # バックエンド・API型定義
│   └── routes/
│       ├── posts.ts            # GET: タイムライン取得 / POST: 投稿作成 / コメントCRUD
│       ├── tags.ts             # GET: タグ管理DBからの一覧取得
│       └── status.ts           # GET: Notion接続疎通診断 (ヘルスチェック)
├── functions/                  # 【Cloudflare Pages Functions 用】
│   └── api/
│       └── [[route]].ts        # HonoアプリをPages Functionsにマウント
├── server/                     # 【Node.js スタンドアロン実行用】
│   └── index.ts                # dist/静的配信 + Hono APIマウント (Port 3000)
├── public/                     # PWAマニフェスト、アプリアイコン
├── reference/                  # プロジェクト設計書・仕様書・運用ガイド
│   ├── Notionで構築するSNS風ナレッジ収集基盤.md
│   ├── GitHub_Flow開発ワークフロー.md
│   └── Phase3_手法B_Tailscale実装計画書.md
├── index.html                  # HTMLテンプレート
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml               # Cloudflare Pages設定ファイル
```

---

## 🚀 クローン後のセットアップ手順

### 1. 前提条件
- **Node.js**: v20.0.0 以上
- **npm**: v10.0.0 以上
- **Notion アカウント**: 内部インテグレーション作成権限

---

### 2. リポジトリのクローンと依存パッケージのインストール

```bash
git clone https://github.com/Mitsuie/post-notion.git
cd post-notion
npm install
```

---

### 3. Notion 側の準備

#### (1) 内部インテグレーションの作成
1. [Notion Developers: My integrations](https://www.notion.so/my-integrations) にアクセスします。
2. **「新しいインテグレーション」** を作成し、名前（例: `post-notion`）を設定します。
3. 以下のケーパビリティ（権限）を有効にします：
   - コンテンツの読み取り / 更新 / 挿入
   - コメントの読み取り / 挿入
4. 発行された **「内部インテグレーションシークレット」**（`ntn_...` または `secret_...`）を控えます。

#### (2) バックエンド用データベースの準備
Notion 上に以下のデータベースを作成し、右上の「...」メニュー →「コネクトの追加」から、作成したインテグレーション（`post-notion`）を追加してアクセス権を付与します。

1. **Posts データベース（投稿保存用）**:
   - `タイトル` (Title): タイトル / 要約
   - `作成日時` (Created Time): 自動生成
   - `作成者` (Created By): 自動生成
   - `タグ` (Relation): タグ管理データベースへのリレーション
   - `ピン止め` (Checkbox): 上部固定フラグ
   - `コメント追加回数` (Number): コメント件数キャッシュ用
   - `DB_日報` (Relation): 日報データベースへのリレーション（任意）
   - `日報日付` (Date): 投稿日（任意）
2. **タグ管理データベース（タグマスタ）**:
   - `名前` (Title): タグ名称（例: `01_Notion`, `02_開発`, `03_読書メモ`）
   - `Posts` (Relation): Postsデータベースへの逆リレーション
3. **日報データベース（日報自動連携用・オプション）**:
   - `日付` (Date): 日報の日付
   - `名前` (Title): 日報タイトル

各データベースのURLから **32桁の英数字（データベースID）** を控えます。
（例: `https://www.notion.so/myworkspace/<32桁のID>?v=...`）

---

### 4. 環境変数の設定

プロジェクトルートに環境変数ファイルを作成します。  
本プロジェクトでは、Cloudflare ローカル開発用の `.dev.vars` または標準の `.env` のどちらでも動作します（`.env.example` をコピーして作成可能）。

```bash
cp .env.example .dev.vars
```

`.dev.vars`（または `.env`）を開き、控えた値を入力します：

```env
# Notion インテグレーションシークレット
NOTION_API_KEY="ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 各種データベースID (32桁の英数字)
NOTION_POSTS_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
NOTION_TAGS_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 日報データベースID (日報連携機能を使用する場合)
NOTION_DAILY_REPORT_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

> [!CAUTION]
> `.dev.vars` および `.env` には機密情報が含まれるため、絶対に Git コミットしないでください（`.gitignore` に登録済みです）。

---

### 5. ローカル起動・開発

目的に応じて以下のコマンドを使用します：

#### A. フロントエンド高速開発（UIモック・Vite）
```bash
npm run dev
```
- `http://localhost:5173` で起動します（※API呼び出しにはバックエンドが必要です）。

#### B. Cloudflare Pages 互換ローカル実行（推奨）
Cloudflare Pages Functions を含めたフルスタック環境をローカルでシミュレートします。
```bash
npm run build
npm run pages:dev
```
- `http://localhost:8788` で起動します。
- `.dev.vars` の値が Pages Functions に自動バインドされます。

#### C. Node.js スタンドアロンサーバー実行
Cloudflare を介さず、Node.js サーバー単体で静的配信および API を稼働させます。
```bash
npm run serve
```
- フロントエンドのビルド（`npm run build`）と Node サーバー（`server/index.ts`）の起動を一括実行します。
- `http://localhost:3000` で起動します。

---

### 6. 動作確認

ブラウザでアクセス後、右上の設定メニュー（三本線アイコン）を開き、**「Notion接続診断」** を確認します。
- Posts DB、Tags DB、日報DBの疎通状況がグリーン（接続中）になっていればセットアップ完了です！

---

## 🌐 本番デプロイ（Cloudflare Pages）

本プロジェクトは Cloudflare Pages に最適化されています。

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログインし、`Workers & Pages` > `Create application` > `Pages` > `Connect to Git` を選択。
2. 本リポジトリ（`post-notion`）を選択。
3. ビルド設定を入力：
   - **Framework preset**: `None`（または `Vite`）
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **環境変数の追加**:
   - `Settings` > `Environment variables` にて、`.dev.vars` に設定したキー（`NOTION_API_KEY`, `NOTION_POSTS_DATABASE_ID` 等）を `Production` および `Preview` に登録。
5. デプロイ完了後、発行された `https://<project-name>.pages.dev` からアクセス可能になります。

---

## 🌿 開発ワークフロー（ブランチ運用）

本プロジェクトでは **GitHub Flow** を採用しています。
詳細な運用手順、ブランチ命名規則、コミット規約については [reference/GitHub_Flow開発ワークフロー.md](reference/GitHub_Flow開発ワークフロー.md) をご参照ください。

- **本番ブランチ**: `main`（直接 push 禁止、PR 経由でマージ）
- **作業ブランチ**: `feat/*`, `fix/*`, `chore/*`, `docs/*`
- **コミットメッセージ**: Conventional Commits（`feat:`, `fix:`, `chore:` 等）

---

## 📄 ドキュメント・仕様書一覧

より詳細なアーキテクチャ設計や将来構想については、`reference/` ディレクトリ配下のドキュメントをご覧ください：

- [Notionで構築するSNS風ナレッジ収集基盤.md](reference/Notionで構築するSNS風ナレッジ収集基盤.md): システム全体の基本設計書・UI仕様・キャッシュ設計
- [GitHub_Flow開発ワークフロー.md](reference/GitHub_Flow開発ワークフロー.md): ブランチ運用・デプロイ手順書
- [Phase3_手法B_Tailscale実装計画書.md](reference/Phase3_手法B_Tailscale実装計画書.md): Tailscale / Node.jsセルフホスト実装計画書

---

## 📜 ライセンス

Private Repository (Personal Knowledge Base)
