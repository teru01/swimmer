# Swimmer リリース品質チェックリスト

## Critical (バグ)

- [x] Init Container のステータス参照バグ修正 (`ResourceDetailPane.tsx:1586-1589` — `containerStatuses` → `initContainerStatuses`)
- [x] ClusterOverview.css の VSCode テーマ変数をプロジェクトのCSS変数に置換
- [ ] 未定義CSS変数の定義追加 (`--bg-hover`, `--color-primary-low`)
- [ ] StatefulSet の Ready カラムの無意味な条件分岐を修正 (`ResourceList.tsx:829-833`)

## High (セキュリティ / 安全性)

- [ ] `terminal.rs` の `unwrap()` を `map_err` によるエラーハンドリングに置換 (178, 190, 221行目)
- [ ] ログレベルをリリースビルドでは `Info` 以上に変更 (`lib.rs:110`)
- [ ] `navigator.clipboard.writeText()` の未処理 Promise を修正 (`App.tsx:34`, `ClusterOverview.tsx` 複数箇所)

## High (リソースリーク / クリーンアップ)

- [ ] temp kubeconfig がカスタム kubeconfig path を無視する問題を修正 (`terminal.rs:28`)
- [ ] Watch ストリームのエラー時に再接続する仕組みを追加 (`k8s_api.rs:1207-1209`)
- [ ] シリアライゼーションエラーの黙殺をログ出力に変更 (`k8s_api.rs` の `filter_map`)

## High (CSS / 設定)

- [ ] ESLint設定の重複解消 (`.eslintrc.json` を削除し `eslint.config.mjs` のみにする)
- [ ] lint スクリプトを ESLint v9 flat config 対応に修正 (`package.json`)
- [ ] `release.yml` の `npm install` → `npm ci` に変更
- [ ] App.css のテンプレート残骸を削除 (`.logo`, `.container`, `.row`, `#greet-input` 等)
- [ ] グローバルCSSの `.modal`, `.modal-overlay`, `.modal-actions` 重複を解消 (`contextsPane.css` と `preferencesPage.css`)
- [ ] `@keyframes spin` と `.loading-spinner` の重複定義を解消 (`layout.css` と `ClusterInfoPane.css`)
- [ ] `.context-actions` の同一ファイル内重複を解消 (`contextsPane.css`)
- [ ] `.resize-handle-vertical` の矛盾する定義を解消 (`resizable.css` と `ClusterInfoPane.css`)
- [ ] `contextsPane.css` の `.tags-filter-container` で `margin-bottom` が2回定義されている問題を修正

## Medium (型安全性 / コード品質)

- [ ] `commands.ts` の `greet` 関数 (テンプレート残骸) を削除
- [ ] `ClusterOverview.tsx` のコピーアイコンSVG 6箇所重複を共通コンポーネントに抽出
- [ ] `console.log` デバッグ出力の削除 (`ClusterInfoPane.tsx:25`)
- [ ] `alert()` を Toast 通知に置換 (`ContextsPane.tsx:280`)
- [ ] `PreferencesContext.tsx` の `loadPrefs` にエラーハンドリングを追加
- [ ] `ContextsPane.tsx` のコンテキスト読み込み失敗時にUIエラー表示を追加

## Low (改善推奨)

- [ ] CI の release.yml に npm cache と Rust cache を追加
- [ ] CI にフロントエンドの format チェック (`prettier --check`) を追加
- [ ] `serde_yaml` → `serde_yml` への移行検討
- [ ] `.copy-icon:focus` で `opacity: 0` → 適切なフォーカススタイルに修正

## 要確認 (後回し)

- [ ] `ResourceDetailPane.tsx` の God Component 分割 (1888行)
- [ ] `ResourceList.tsx` の God Component 分割 (1472行)
- [ ] `ResourceDetailPane.tsx` の直接DOM操作を React 方式に書き換え
- [ ] `commands.ts` の `listResources`/`getResourceDetail` の戻り値型を `any` から適切な型に変更
- [ ] グローバルCSS → CSS Modules への移行
- [ ] K8s クライアントの接続プール/キャッシュ導入
- [ ] アクセシビリティ全般の改善 (ARIA属性, キーボードナビゲーション, focus-visible)
- [ ] ContextMenu.css / terminalPane.css のハードコード色をCSS変数化
