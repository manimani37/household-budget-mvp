# 使い切り家計簿 MVP

銀行連携なしで、支出・収入・食材期限・レシピ提案をブラウザ上だけで確認できるNext.jsアプリです。

## できること

- 支出登録
- 収入登録
- 食材登録
- 食材の期限表示
- 月ごとの収入・支出・残高表示
- 登録食材から簡単なレシピ提案
- ブラウザ内へのローカル保存

## VS Codeで開くフォルダ

次のフォルダをVS Codeで開いてください。

```txt
C:\Users\ayama\Documents\Codex\2026-06-22\mvp-web-next-js-typescript-tailwind
```

## 初回だけ必要な準備

Node.jsのLTS版をインストールしてください。

インストール後、VS Codeのターミナルで次を実行します。

```bash
npm install
```

## ローカル実行

VS Codeのターミナルで次を実行します。

```bash
npm run dev
```

表示されたURL、または次のURLをブラウザで開きます。

```txt
http://localhost:3000
```

終了するときは、ターミナルで `Ctrl + C` を押してください。

## 補足

データはSupabaseではなく、今はブラウザのlocalStorageに保存しています。
Supabaseへ移行しやすいように、保存処理は `src/lib/repository.ts` に分けています。
