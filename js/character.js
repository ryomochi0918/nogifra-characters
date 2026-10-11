// キャラ別ページ(c/…/index.html)の動き。ページは scripts/build-character-pages.js で生成している。
// 共通の処理は js/common.js にある。

const chara = JSON.parse(document.getElementById("charaData").textContent);

// フローチャート1つ分(ズーム・拡大表示・凡例)をセクションごとに独立して動かす
function setupDiagram(section) {
  const target = section.querySelector("[data-file]");
  const label = section.querySelector(".zoom-label");
  const expandToggle = section.querySelector("[data-expand]");
  const legendToggle = section.querySelector(".legend-toggle");
  const legendPanel = section.querySelector(".legend-panel");
  let pct = 100;

  function applyZoom() {
    const svg = target.querySelector("svg");
    if (!svg) return;
    svg.style.width = pct + "%";
    svg.style.height = "auto";
    label.textContent = pct + "%";
  }

  section.querySelectorAll("[data-zoom]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.zoom === "in") pct = Math.min(ZOOM_MAX, pct + ZOOM_STEP);
      else if (btn.dataset.zoom === "out") pct = Math.max(ZOOM_MIN, pct - ZOOM_STEP);
      else pct = 100;
      applyZoom();
    });
  });

  expandToggle.addEventListener("click", () => {
    const expanded = section.classList.toggle("expanded");
    expandToggle.classList.toggle("active", expanded);
    expandToggle.setAttribute("aria-label", expanded ? "縮小表示" : "拡大表示");
  });

  legendToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    legendPanel.style.display = legendPanel.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", (e) => {
    if (!legendPanel.contains(e.target) && e.target !== legendToggle) {
      legendPanel.style.display = "none";
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    legendPanel.style.display = "none";
    if (section.classList.contains("expanded")) expandToggle.click();
  });

  return async function render() {
    pct = 100;
    target.className = "loading";
    target.textContent = "読み込み中...";
    if (await renderMermaidInto(target, target.dataset.file)) applyZoom();
  };
}

const renderers = [...document.querySelectorAll(".diagram-section")].map(setupDiagram);
function renderAll() {
  renderers.forEach((render) => render());
}

setupThemeToggle(renderAll);
renderAll();

document.getElementById("charaCopyLink").addEventListener("click", (e) => {
  copyCharacterLink(chara, e.currentTarget);
});

// このキャラを選んだ状態で、一覧の比較モードを開く(一覧は sessionStorage の検索条件から復元する)
document.getElementById("charaCompare").addEventListener("click", () => {
  const state = loadSearchState();
  const selected = (state.compareSelected || []).filter((key) => key !== chara.key);
  selected.push(chara.key);
  state.compareMode = true;
  state.compareSelected = selected.slice(-MAX_COMPARE);
  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch (e) {}
  location.href = SITE_ROOT;
});

track("view_character", { member: chara.name, character: characterLabel(chara) });
