#!/usr/bin/env node
// data/characters.json から、キャラ別ページ(c/{メンバー}/{衣装スラッグ}/index.html)と sitemap.xml を生成する。
// GitHub Actions のデプロイ時に実行する(.github/workflows/deploy.yml)。生成物はコミットしない(.gitignore で除外)。
// ローカルで確認するときは site/ で `node scripts/build-character-pages.js` を実行する。

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  escapeHtml,
  characterLabel,
  characterPath,
  attrBadge,
  genBadge,
  passiveTableHtml,
} = require("../js/common.js");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://ryomochi0918.github.io/nogifra-characters/";
const SITE_NAME = "乃木フラ スキルフローチャート図鑑";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// 一覧(index.html)と同じものを使う部分は、index.html から切り出して二重管理を避ける
const indexHtml = read("index.html");
function extract(re, what) {
  const m = indexHtml.match(re);
  if (!m) throw new Error(`index.html から${what}を取り出せませんでした`);
  return m[0];
}
const gaScript = extract(/<script>\s*\/\/ Google アナリティクス[\s\S]*?<\/script>/, "GAのタグ");
const themeInitScript = extract(/<script>\s*\/\/ 描画前に保存済みテーマ[\s\S]*?<\/script>/, "テーマの初期化");
const fontLinks = extract(/<link rel="preconnect"[\s\S]*?rel="stylesheet"\s*\/>/, "フォントの読み込み");
const mermaidScript = extract(/<script src="https:\/\/cdnjs[^"]*mermaid[^"]*"><\/script>/, "mermaid の読み込み");
const footer = extract(/<footer>[\s\S]*?<\/footer>/, "フッター");
const themeToggle = extract(/<button\s+type="button"\s+class="theme-toggle"[\s\S]*?<\/button>/, "テーマ切り替えボタン");
const legendPanel = extract(/<div class="legend-panel"[\s\S]*?<span>実際のアピール・攻撃<\/span>\s*<\/div>\s*<\/div>/, "凡例");

// CSS・JS は中身のハッシュを版番号にする(変更すれば自動でキャッシュが切り替わる)
function versioned(rel) {
  const hash = crypto.createHash("sha1").update(read(rel)).digest("hex").slice(0, 10);
  return `${rel}?v=${hash}`;
}
const assets = {
  css: versioned("css/styles.css"),
  common: versioned("js/common.js"),
  character: versioned("js/character.js"),
};

function truncate(text, max) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

function diagramHtml(skill) {
  return `<div class="diagram-section">
          <div class="zoom-bar">
            <button type="button" class="zoom-btn" data-zoom="out" aria-label="縮小">−</button>
            <span class="zoom-label">100%</span>
            <button type="button" class="zoom-btn" data-zoom="in" aria-label="拡大">＋</button>
            <button type="button" class="zoom-btn zoom-reset" data-zoom="reset" aria-label="リセット">リセット</button>
            <button type="button" class="zoom-btn" data-expand aria-label="拡大表示">↕</button>
            <button type="button" class="zoom-btn legend-toggle" aria-label="凡例を表示">?</button>
            ${legendPanel}
          </div>
          <div class="diagram-wrap">
            <div class="loading" data-file="${escapeHtml(skill.file)}">読み込み中...</div>
          </div>
        </div>`;
}

function skillSectionHtml(skill) {
  const text = skill.text
    ? `
        <details class="original-text">
          <summary>原文を見る</summary>
          <div class="original-text-body">${escapeHtml(skill.text)}</div>
        </details>`
    : "";
  return `
      <section class="chara-section">
        <h2>${escapeHtml(skill.label)}</h2>
        ${diagramHtml(skill)}${text}
      </section>`;
}

function pageHtml(c, key, pagePath) {
  const costume = c.costume || c.title || "";
  const url = SITE_URL + pagePath;
  const title = `${c.name}「${costume}」のスキル | ${SITE_NAME}`;
  const firstSkill = (c.skills || [])[0] || {};
  const description = truncate(
    `乃木フラ ${c.tier || "LR"}「${costume}」${c.name}のスキルをフローチャートで図解。${firstSkill.text || ""}`,
    120,
  );
  const up = "../../../";
  const data = JSON.stringify({ name: c.name, costume: c.costume, title: c.title, skills: [{ file: firstSkill.file }], key })
    .replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(`${c.name}「${costume}」のスキル`)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}assets/ogp.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="乃木フラ スキルフローチャート" />
    <meta property="og:locale" content="ja_JP" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(`${c.name}「${costume}」のスキル`)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}assets/ogp.png" />
    ${gaScript}
    ${themeInitScript}
    <link rel="icon" type="image/svg+xml" href="${up}assets/logo.svg" />
    ${fontLinks}
    <link rel="stylesheet" href="${up}${assets.css}" />
  </head>

  <body>
    <nav class="chara-nav"><a href="${up}">← ${SITE_NAME}(キャラ一覧)</a></nav>

    <main class="chara-page">
      <div class="chara-head">
        <span class="tier">${escapeHtml(c.tier || "SKILL")}</span>${attrBadge(c.attribute)}
        <h1>${escapeHtml(c.name)}${genBadge(c.generation)}</h1>
        <p class="subtitle">${escapeHtml(c.title || costume)}</p>
        <div class="chara-actions">
          <button type="button" class="chara-action" id="charaCompare">⇄ 他のキャラと比較</button>
          <button type="button" class="chara-action" id="charaCopyLink">リンクをコピー</button>
        </div>
      </div>
${(c.skills || []).map(skillSectionHtml).join("\n")}

      <section class="chara-section">
        <h2>パッシブ</h2>
        ${passiveTableHtml(c.passive || [])}
      </section>
    </main>

    ${footer}

    ${themeToggle}

    <script type="application/json" id="charaData">${data}</script>
    ${mermaidScript}
    <script src="${up}${assets.common}"></script>
    <script src="${up}${assets.character}"></script>
  </body>
</html>
`;
}

function main() {
  const characters = JSON.parse(read("data/characters.json"));
  const outDir = path.join(ROOT, "c");
  fs.rmSync(outDir, { recursive: true, force: true });

  const seen = new Map();
  characters.forEach((c, i) => {
    const pagePath = characterPath(c);
    if (!pagePath) throw new Error(`ページのURLを作れません(スキル1の .mmd の名前を確認): ${characterLabel(c)}`);
    if (seen.has(pagePath)) {
      throw new Error(`URLが重複しています: ${pagePath}(${seen.get(pagePath)} と ${characterLabel(c)})`);
    }
    seen.set(pagePath, characterLabel(c));

    // 一覧(js/index.js)のキャラの識別子と同じ作り方にする(比較モードへの受け渡しに使う)
    const key = c.name + "__" + (c.costume || c.title || i);
    const file = path.join(ROOT, pagePath, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pageHtml(c, key, pagePath));
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
