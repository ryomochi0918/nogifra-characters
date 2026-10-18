// 一覧(index.html とその複製のキャラ別ページ c/…/index.html)と、ページ生成スクリプト(scripts/build-character-pages.js)で共有する処理。
// ブラウザでは通常の<script>として読み込み、ここで定義した関数をグローバルに使う。
// Node.js からは require して文字列を作る関数だけを使う(DOM・mermaid に触る関数は呼ばない)。

const MERMAID_THEME_VARS = {
  dark: {
    background: "#100c1a",
    primaryColor: "#1c1630",
    primaryTextColor: "#efe9f7",
    primaryBorderColor: "#c77dff",
    lineColor: "#a99cc4",
    fontFamily: "Zen Kaku Gothic New, sans-serif",
    fontSize: "14px",
    clusterBkg: "#211a35",
    clusterBorder: "#3a2d55",
    titleColor: "#efe9f7",
  },
  light: {
    background: "#ffffff",
    primaryColor: "#f3edfb",
    primaryTextColor: "#2b2333",
    primaryBorderColor: "#8a4fd1",
    lineColor: "#6b6178",
    fontFamily: "Zen Kaku Gothic New, sans-serif",
    fontSize: "14px",
    clusterBkg: "#f7f3ec",
    clusterBorder: "#ddd2ee",
    titleColor: "#2b2333",
  },
};

// サイトのルート(index.html のある場所)。このファイルの場所から求める
const SITE_ROOT =
  typeof document !== "undefined" && document.currentScript
    ? new URL("../", document.currentScript.src).href
    : "";

// プライベートモード等でlocalStorageが使えない場合でも動くようにする
function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

// 検索条件・比較の選択はタブを閉じるまで残す(リロードでは消えない)
const SEARCH_STATE_KEY = "nogifra-search-state";
function loadSearchState() {
  try {
    return JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

// 比較モードで同時に選べるキャラ数
const MAX_COMPARE = 3;

const THEME_STORAGE_KEY = "nogifra-theme";
function getStoredTheme() {
  return storageGet(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: MERMAID_THEME_VARS[theme],
    flowchart: { curve: "basis" },
  });
}

let currentTheme =
  typeof document !== "undefined" ? getStoredTheme() : "dark";

// テーマ切り替えボタン。切り替え後にフローチャートを描き直すため onChange を呼ぶ
function setupThemeToggle(onChange) {
  applyTheme(currentTheme);
  document.getElementById("themeToggle").addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    storageSet(THEME_STORAGE_KEY, currentTheme);
    applyTheme(currentTheme);
    onChange();
  });
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m],
  );
}

// Google アナリティクスにイベントを送る(gtag は各ページの head で定義)
function track(name, params) {
  if (typeof gtag === "function") gtag("event", name, params);
}

function characterLabel(c) {
  return c.name + " / " + (c.costume || c.title || "");
}

// キャラ別ページのパス(サイトのルートからの相対)。
// 1つ目のスキルの .mmd(data/{メンバー}/{衣装スラッグ}_skill1.mmd)から作るので、公開後は .mmd の名前を変えないこと
function characterPath(c) {
  const file = (c.skills && c.skills[0] && c.skills[0].file) || "";
  const m = file.match(/^data\/([a-z0-9_]+)\/([A-Za-z0-9_-]+)_skill1\.mmd$/);
  return m ? `c/${m[1]}/${m[2]}/` : null;
}

const SITE_NAME = "乃木フラ スキルフローチャート図鑑";

// キャラ別ページ(詳細を開いた状態)のタイトル
function characterPageTitle(c) {
  return `${c.name}「${c.costume || c.title || ""}」のスキル | ${SITE_NAME}`;
}

// 詳細画面のタブ(アクティブスキル→パッシブ)
function viewerTabDefs(c) {
  const tabs = [...(c.skills || [])];
  if (c.passive && c.passive.length > 0) {
    tabs.push({ type: "passive", label: "パッシブ", data: c.passive });
  }
  return tabs;
}

function viewerTabsHtml(tabs) {
  if (tabs.length < 2) return "";
  return tabs
    .map(
      (t, i) =>
        `<button type="button" class="tab-btn${i === 0 ? " active" : ""}" data-index="${i}">${escapeHtml(t.label)}</button>`,
    )
    .join("");
}

// 原文は [①][②]… の番号ごと、および改行ごとに段落を分けて表示する
function originalTextBodyHtml(text) {
  return String(text)
    .split(/\n|(?=\[[①-⑳]\])/)
    .filter((line) => line.trim() !== "")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

// タブごとの原文・パッシブ表。表示するのは選んだタブの分だけだが、
// 検索エンジンに全文が読まれるよう、全タブの分をHTMLに置いておく
function viewerPanelsHtml(tabs) {
  return tabs
    .map((t, i) => {
      const hidden = i === 0 ? "" : " hidden";
      if (t.type === "passive") {
        return `<div class="diagram-wrap" data-tab="${i}"${hidden}>${passiveTableHtml(t.data || [])}</div>`;
      }
      if (!t.text) return `<div data-tab="${i}"${hidden}></div>`;
      return `<details class="original-text" data-tab="${i}"${hidden}><summary>原文を見る</summary><div class="original-text-body">${originalTextBodyHtml(t.text)}</div></details>`;
    })
    .join("");
}

// 4期と新4期生、6期の春組・夏組はそれぞれ同一の期として扱う(括弧書きの補足を無視)
function normalizeGeneration(g) {
  if (!g) return "";
  return g.split("(")[0].trim();
}

const TYPE_ATTR_CLASS = {
  努力: "attr-doryoku",
  感謝: "attr-kansha",
  笑顔: "attr-egao",
};

function attrBadge(attribute) {
  const cls = TYPE_ATTR_CLASS[attribute];
  if (!cls) return "";
  return `<span class="attr-badge ${cls}">${escapeHtml(attribute)}</span>`;
}

const GENERATION_ATTR_CLASS = {
  "3期": "attr-3rd",
  "4期": "attr-4th",
  "5期": "attr-5th",
  "6期": "attr-6th",
};

function genBadge(generation) {
  const g = normalizeGeneration(generation);
  if (!g) return "";
  const cls = GENERATION_ATTR_CLASS[g];
  return `<span class="gen-badge ${cls}">${escapeHtml(g)}</span>`;
}

// ペンライトカラーの色名→表示色(一覧カードのアイコンに使う)
const PENLIGHT_HEX = {
  白: "#ffffff",
  黄: "#ffe14a",
  黄緑: "#a6e22e",
  緑: "#2ecc71",
  ターコイズ: "#1fc8b4",
  水色: "#7fd6f5",
  青: "#2f6fe0",
  紫: "#9b4dde",
  ピンク: "#ff7fbf",
  赤: "#e8333a",
  オレンジ: "#ff8c1a",
};

// ペンライトカラー2色を斜めに塗り分けた丸アイコン。色が分からないメンバーは何も出さない
function penlightIcon(colors) {
  if (!Array.isArray(colors) || colors.length !== 2) return "";
  const [a, b] = colors.map((c) => PENLIGHT_HEX[c]);
  if (!a || !b) return "";
  const label = "ペンライトカラー: " + colors.join("×");
  return `<span class="penlight-icon" style="--pl-1:${a};--pl-2:${b}" title="${escapeHtml(label)}" aria-hidden="true"></span>`;
}

// フローチャートのズーム範囲(詳細画面・比較画面共通)
const ZOOM_MIN = 50;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;

let renderCount = 0;

// .mmdを読み込んでtargetにSVGを描画する。成功したらtrueを返す
async function renderMermaidInto(target, file) {
  try {
    const res = await fetch(new URL(file, SITE_ROOT));
    if (!res.ok) throw new Error("file not found");
    const mmdText = await res.text();
    const id = "mmd-" + renderCount++;
    const { svg } = await mermaid.render(id, mmdText);
    target.className = "";
    target.innerHTML = svg;
    return true;
  } catch (e) {
    target.className = "error";
    target.textContent = "フローチャートの読み込みに失敗しました: " + e.message;
    return false;
  }
}

// パッシブの効果1項目を描画する。
// 「※」で始まる注記(バフ状態の定義・アドバンス/アンコールスキル)は
// 本文と役割が違うので視覚的に分け、見出し(※◯◯:)をラベルとして切り出す。
// アドバンス/アンコールスキルの [①][②] は段落として改行する。
function renderEffectItem(text) {
  if (!text.startsWith("※")) {
    return `<li>${escapeHtml(text)}</li>`;
  }
  const m = text.match(/^※([^:：]{1,24})[:：]([\s\S]*)$/);
  const label = m ? m[1] : "";
  const body = m ? m[2] : text.slice(1);
  const steps = body.split(/(?=\[[①-⑳]\])/).filter(Boolean);
  const html =
    steps.length > 1
      ? steps
          .map((s) => `<span class="note-step">${escapeHtml(s)}</span>`)
          .join("")
      : escapeHtml(body);
  return `<li class="note">${
    label ? `<b class="note-label">${escapeHtml(label)}</b>` : ""
  }${html}</li>`;
}

function passiveTableHtml(rows) {
  if (rows.length === 0) {
    return '<p class="loading">パッシブスキルの情報はまだありません。</p>';
  }
  return `
      <table class="passive-table">
        <thead>
          <tr><th>タイトル</th><th>効果内容</th></tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const items = Array.isArray(r.effect) ? r.effect : [r.effect];
              return `
            <tr>
              <td class="cond">${escapeHtml(r.condition || "")}</td>
              <td><ul class="effect-list">${items
                .filter(Boolean)
                .map(renderEffectItem)
                .join("")}</ul></td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
      </table>
    `;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SITE_NAME,
    escapeHtml,
    characterLabel,
    characterPath,
    characterPageTitle,
    viewerTabDefs,
    viewerTabsHtml,
    viewerPanelsHtml,
    originalTextBodyHtml,
    normalizeGeneration,
    attrBadge,
    genBadge,
    passiveTableHtml,
  };
}
