#!/usr/bin/env node
// data/characters.json から、キャラ別ページ(c/{メンバー}/{衣装スラッグ}/index.html)と sitemap.xml を生成する。
// GitHub Actions のデプロイ時に実行する(.github/workflows/deploy.yml)。生成物はコミットしない(.gitignore で除外)。
// ローカルで確認するときは site/ で `node scripts/build-character-pages.js` を実行する。
//
// キャラ別ページは index.html の複製で、そのキャラの詳細を開いた状態にしたもの。
// 検索エンジン向けにタイトル・説明文・詳細の中身(原文・パッシブ表)をHTMLに書き込み、
// 動きは一覧と同じ js/index.js が担う(URLからキャラを判定して詳細を開く)。

const fs = require("fs");
const path = require("path");
const {
  SITE_NAME,
  escapeHtml,
  characterLabel,
  characterPath,
  characterPageTitle,
  viewerTabDefs,
  viewerTabsHtml,
  viewerPanelsHtml,
} = require("../js/common.js");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://ryomochi0918.github.io/nogifra-characters/";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const indexHtml = read("index.html");

function truncate(text, max) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

// index.html の該当箇所を1か所だけ置き換える。見つからない・複数あるときは止める
// (index.html の書き方を変えたら、ここの正規表現も直すこと)
function replaceOnce(html, re, replacement, what) {
  const matches = html.match(new RegExp(re.source, "g"));
  if (!matches || matches.length !== 1) {
    throw new Error(`index.html の「${what}」が1か所に特定できません(${matches ? matches.length : 0}か所)`);
  }
  return html.replace(re, () => replacement);
}

const indexTitle = indexHtml.match(/<title>([^<]*)<\/title>/)[1];

function pageHtml(c, pagePath) {
  const url = SITE_URL + pagePath;
  const title = characterPageTitle(c);
  const shareTitle = title.replace(` | ${SITE_NAME}`, "");
  const description = truncate(
    `乃木フラ ${c.tier || "LR"}「${c.costume || c.title || ""}」${c.name}のスキルをフローチャートで図解。${(c.skills || [])[0]?.text || ""}`,
    120,
  );
  const tabs = viewerTabDefs(c);
  const attr = (v) => escapeHtml(v);

  let html = indexHtml;
  const r = (re, rep, what) => (html = replaceOnce(html, re, rep, what));
  r(/<html lang="ja">/, `<html lang="ja" data-index-title="${attr(indexTitle)}">`, "html要素");
  r(/<base href="\.\/" \/>/, '<base href="../../../" />', "base要素");
  r(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, "title");
  r(/(?<=name="description"\s+content=")[^"]*/, attr(description), "meta description");
  r(/(?<=<link rel="canonical" href=")[^"]*/, url, "canonical");
  r(/(?<=property="og:title" content=")[^"]*/, attr(shareTitle), "og:title");
  r(/(?<=property="og:description"\s+content=")[^"]*/, attr(description), "og:description");
  r(/(?<=property="og:url" content=")[^"]*/, url, "og:url");
  r(/(?<=name="twitter:title" content=")[^"]*/, attr(shareTitle), "twitter:title");
  r(/(?<=name="twitter:description"\s+content=")[^"]*/, attr(description), "twitter:description");
  // 詳細を開いた状態にして、中身を書き込む(JSが動いたあとは js/index.js が同じものを描き直す)
  r(/<div class="viewer" id="viewer">/, '<div class="viewer open" id="viewer">', "詳細画面");
  r(/<h2 id="viewerTitle"><\/h2>/, `<h2 id="viewerTitle">${escapeHtml(c.name)}</h2>`, "詳細の名前");
  r(
    /<p class="subtitle" id="viewerSubtitle"><\/p>/,
    `<p class="subtitle" id="viewerSubtitle">${escapeHtml(c.title || "")}</p>`,
    "詳細の衣装名",
  );
  r(/<div class="tabs" id="viewerTabs"><\/div>/, `<div class="tabs" id="viewerTabs">${viewerTabsHtml(tabs)}</div>`, "詳細のタブ");
  r(/<div id="viewerPanels"><\/div>/, `<div id="viewerPanels">${viewerPanelsHtml(tabs)}</div>`, "詳細の原文・パッシブ");
  return html;
}

function main() {
  const characters = JSON.parse(read("data/characters.json"));
  const outDir = path.join(ROOT, "c");
  fs.rmSync(outDir, { recursive: true, force: true });

  const seen = new Map();
  characters.forEach((c) => {
    const pagePath = characterPath(c);
    if (!pagePath) throw new Error(`ページのURLを作れません(スキル1の .mmd の名前を確認): ${characterLabel(c)}`);
    if (seen.has(pagePath)) {
      throw new Error(`URLが重複しています: ${pagePath}(${seen.get(pagePath)} と ${characterLabel(c)})`);
    }
    seen.set(pagePath, characterLabel(c));

    const file = path.join(ROOT, pagePath, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pageHtml(c, pagePath));
  });

  const urls = [SITE_URL, ...[...seen.keys()].map((p) => SITE_URL + p)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

  console.log(`キャラ別ページ ${seen.size}件と sitemap.xml を生成しました`);
}

main();
