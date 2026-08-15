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

      const THEME_STORAGE_KEY = "nogifra-theme";
      function getStoredTheme() {
        return localStorage.getItem(THEME_STORAGE_KEY) === "light"
          ? "light"
          : "dark";
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

      let currentTheme = getStoredTheme();
      applyTheme(currentTheme);

      const stage = document.getElementById("stage");
      const resultCount = document.getElementById("resultCount");
      const viewer = document.getElementById("viewer");
      const viewerTitle = document.getElementById("viewerTitle");
      const viewerSubtitle = document.getElementById("viewerSubtitle");
      const viewerTabs = document.getElementById("viewerTabs");
      const diagramTarget = document.getElementById("diagramTarget");
      const viewerClose = document.getElementById("viewerClose");

      const zoomBar = document.getElementById("zoomBar");
      const diagramSection = document.getElementById("diagramSection");
      const diagramWrap = document.getElementById("diagramWrap");
      const zoomIn = document.getElementById("zoomIn");
      const zoomOut = document.getElementById("zoomOut");
      const zoomReset = document.getElementById("zoomReset");
      const zoomLabel = document.getElementById("zoomLabel");
      const expandToggle = document.getElementById("expandToggle");
      const originalText = document.getElementById("originalText");
      const originalTextBody = document.getElementById("originalTextBody");

      function collapseExpanded() {
        diagramSection.classList.remove("expanded");
        expandToggle.classList.remove("active");
        expandToggle.setAttribute("aria-label", "拡大表示");
      }

      expandToggle.addEventListener("click", () => {
        const expanded = diagramSection.classList.toggle("expanded");
        expandToggle.classList.toggle("active", expanded);
        expandToggle.setAttribute(
          "aria-label",
          expanded ? "縮小表示" : "拡大表示",
        );
      });

      let renderCount = 0;
      let zoomPct = 100; // 100 = リセット(svg width:100%)

      function applyZoom() {
        const svg = diagramTarget.querySelector("svg");
        if (!svg) return;
        svg.style.width = zoomPct + "%";
        svg.style.height = "auto";
        zoomLabel.textContent = zoomPct + "%";
      }
      zoomIn.addEventListener("click", () => {
        zoomPct = Math.min(400, zoomPct + 25);
        applyZoom();
      });
      zoomOut.addEventListener("click", () => {
        zoomPct = Math.max(50, zoomPct - 25);
        applyZoom();
      });
      zoomReset.addEventListener("click", () => {
        zoomPct = 100;
        applyZoom();
      });

      const legendToggle = document.getElementById("legendToggle");
      const legendPanel = document.getElementById("legendPanel");
      legendToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        legendPanel.style.display =
          legendPanel.style.display === "none" ? "block" : "none";
      });
      document.addEventListener("click", (e) => {
        if (
          legendPanel.style.display !== "none" &&
          !legendPanel.contains(e.target) &&
          e.target !== legendToggle
        ) {
          legendPanel.style.display = "none";
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") legendPanel.style.display = "none";
      });

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

      async function renderActiveTab(tab) {
        diagramWrap.style.display = "";
        zoomBar.style.display = "flex";
        diagramTarget.className = "loading";
        diagramTarget.textContent = "読み込み中...";
        zoomPct = 100;
        collapseExpanded();

        if (tab.text) {
          originalText.style.display = "";
          originalTextBody.textContent = tab.text;
          originalText.open = false;
        } else {
          originalText.style.display = "none";
        }

        try {
          const res = await fetch(tab.file);
          if (!res.ok) throw new Error("file not found");
          const mmdText = await res.text();
          const id = "mmd-" + renderCount++;
          const { svg } = await mermaid.render(id, mmdText);
          diagramTarget.className = "";
          diagramTarget.innerHTML = svg;
          applyZoom();
        } catch (e) {
          diagramTarget.className = "error";
          diagramTarget.textContent =
            "フローチャートの読み込みに失敗しました: " + e.message;
        }
      }

      function renderPassiveTab(tab) {
        collapseExpanded();
        zoomBar.style.display = "none";
        originalText.style.display = "none";
        diagramWrap.style.display = "";
        diagramTarget.className = "";

        const rows = tab.data || [];
        if (rows.length === 0) {
          diagramTarget.innerHTML =
            '<p class="loading">パッシブスキルの情報はまだありません。</p>';
          return;
        }
        diagramTarget.innerHTML = `
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
                .map((i) => `<li>${escapeHtml(i)}</li>`)
                .join("")}</ul></td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
      </table>
    `;
      }

      let currentTab = null;
      function renderTab(tab) {
        currentTab = tab;
        if (tab.type === "passive") {
          renderPassiveTab(tab);
        } else {
          renderActiveTab(tab);
        }
      }

      const themeToggle = document.getElementById("themeToggle");
      themeToggle.addEventListener("click", () => {
        currentTheme = currentTheme === "light" ? "dark" : "light";
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
        applyTheme(currentTheme);
        if (viewer.classList.contains("open") && currentTab && currentTab.type !== "passive") {
          renderTab(currentTab);
        }
      });

      function openViewer(chara) {
        viewerTitle.textContent = chara.name;
        viewerSubtitle.textContent = chara.title || "";

        const tabs = [...(chara.skills || [])];
        if (chara.passive && chara.passive.length > 0) {
          tabs.push({
            type: "passive",
            label: "パッシブ",
            data: chara.passive,
          });
        }

        if (tabs.length > 1) {
          viewerTabs.style.display = "flex";
          viewerTabs.innerHTML = tabs
            .map(
              (t, i) =>
                `<button class="tab-btn${i === 0 ? " active" : ""}" data-index="${i}">${t.label}</button>`,
            )
            .join("");
          viewerTabs.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              viewerTabs
                .querySelectorAll(".tab-btn")
                .forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              renderTab(tabs[Number(btn.dataset.index)]);
            });
          });
        } else {
          viewerTabs.style.display = "none";
          viewerTabs.innerHTML = "";
        }

        viewer.classList.add("open");
        if (tabs[0]) renderTab(tabs[0]);
      }

      function closeViewer() {
        viewer.classList.remove("open");
        collapseExpanded();
      }
      viewerClose.addEventListener("click", closeViewer);
      viewer.addEventListener("click", (e) => {
        if (e.target === viewer) closeViewer();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (diagramSection.classList.contains("expanded")) {
          collapseExpanded();
        } else {
          closeViewer();
        }
      });

      const searchInput = document.getElementById("searchInput");
      const memberFilter = document.getElementById("memberFilter");
      const genFilter = document.getElementById("genFilter");
      const gradFilter = document.getElementById("gradFilter");
      const attrButtons = document.querySelectorAll(".attr-btn");
      const activeAttrs = new Set();
      let allCharacters = [];

      // 4期と新4期生、6期の春組・夏組はそれぞれ同一の期として扱う(括弧書きの補足を無視)
      function normalizeGeneration(g) {
        if (!g) return "";
        return g.split("(")[0].trim();
      }

      function buildSearchBlob(c) {
        const parts = [c.name, c.costume, c.title];
        (c.skills || []).forEach((s) => {
          parts.push(s.label);
          if (s.text) parts.push(s.text);
        });
        (c.passive || []).forEach((p) => {
          parts.push(p.condition);
          parts.push(...(Array.isArray(p.effect) ? p.effect : [p.effect]));
        });
        return parts.filter(Boolean).join(" ");
      }

      function sortCharacters(list) {
        return [...list].sort((a, b) => {
          const n = (a.nameReading || a.name).localeCompare(
            b.nameReading || b.name,
            "ja",
          );
          if (n !== 0) return n;
          return (a.costumeReading || a.costume || "").localeCompare(
            b.costumeReading || b.costume || "",
            "ja",
          );
        });
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
        "6期": "attr-6th"
      };

      function genBadge(generation) {
        const g = normalizeGeneration(generation);
        if (!g) return "";
        const cls = GENERATION_ATTR_CLASS[g];
        return `<span class="gen-badge ${cls}">${escapeHtml(g)}</span>`;
      }

      function graduatedBadge(c) {
        return c._graduated ? `<span class="graduated-badge">卒業済み</span>` : "";
      }

      function renderCards(list) {
        resultCount.textContent = list.length + "件";
        if (list.length === 0) {
          stage.innerHTML =
            '<p class="no-results">該当するキャラクターが見つかりませんでした。</p>';
          return;
        }
        stage.innerHTML = list
          .map(
            (c) => `
      <button class="card" data-key="${escapeHtml(c._key)}">
        <span class="tier">${escapeHtml(c.tier || "SKILL")}</span>${attrBadge(c.attribute)}
        <h2>${escapeHtml(c.name)}${genBadge(c.generation)}${graduatedBadge(c)}</h2>
        <p class="subtitle">${escapeHtml(c.title || "")}</p>
      </button>
    `,
          )
          .join("");

        stage.querySelectorAll(".card").forEach((btn) => {
          btn.addEventListener("click", () => {
            const c = allCharacters.find((x) => x._key === btn.dataset.key);
            if (c) openViewer(c);
          });
        });
      }

      function applyFilter() {
        const query = searchInput.value.trim();
        let filtered;
        if (query === "") {
          filtered = allCharacters;
        } else {
          let re;
          try {
            re = new RegExp(query, "i");
          } catch (e) {
            // 不正な正規表現(入力途中など)の場合は通常の部分一致にフォールバック
            re = null;
          }
          if (re) {
            filtered = allCharacters.filter((c) => re.test(c._blob));
          } else {
            const q = query.toLowerCase();
            filtered = allCharacters.filter((c) =>
              c._blob.toLowerCase().includes(q),
            );
          }
        }
        renderCards(sortCharacters(filterByMemberAndAttr(filtered)));
      }

      function filterByMemberAndAttr(list) {
        let result = list;
        if (!gradFilter.checked) {
          result = result.filter((c) => !c._graduated);
        }
        if (memberFilter.value) {
          result = result.filter((c) => c.name === memberFilter.value);
        }
        if (genFilter.value) {
          result = result.filter(
            (c) => normalizeGeneration(c.generation) === genFilter.value,
          );
        }
        if (activeAttrs.size > 0) {
          result = result.filter((c) => activeAttrs.has(c.attribute));
        }
        return result;
      }

      searchInput.addEventListener("input", applyFilter);
      memberFilter.addEventListener("change", applyFilter);
      genFilter.addEventListener("change", applyFilter);
      gradFilter.addEventListener("change", applyFilter);
      attrButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const attr = btn.dataset.attr;
          if (activeAttrs.has(attr)) {
            activeAttrs.delete(attr);
            btn.classList.remove("active");
          } else {
            activeAttrs.add(attr);
            btn.classList.add("active");
          }
          applyFilter();
        });
      });

      function populateMemberFilter(list) {
        const seen = new Map();
        list.forEach((c) => {
          if (!seen.has(c.name)) seen.set(c.name, c.nameReading || c.name);
        });
        const members = [...seen.entries()].sort((a, b) =>
          a[1].localeCompare(b[1], "ja"),
        );
        memberFilter.innerHTML =
          '<option value="">キャラ: すべて</option>' +
          members
            .map(
              ([name]) =>
                `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
            )
            .join("");
      }

      function populateGenFilter(list) {
        const gens = new Set();
        list.forEach((c) => {
          const g = normalizeGeneration(c.generation);
          if (g) gens.add(g);
        });
        const sorted = [...gens].sort((a, b) => {
          const na = parseInt(a, 10);
          const nb = parseInt(b, 10);
          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
          return a.localeCompare(b, "ja");
        });
        genFilter.innerHTML =
          '<option value="">期: すべて</option>' +
          sorted
            .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
            .join("");
      }

      async function init() {
        try {
          const [charRes, readingRes] = await Promise.all([
            fetch("data/characters.json"),
            fetch("data/nogizaka46_members_reading.json"),
          ]);
          if (!charRes.ok) throw new Error("HTTP " + charRes.status);
          const characters = await charRes.json();

          const graduatedNames = new Set();
          if (readingRes.ok) {
            const reading = await readingRes.json();
            (reading.members || []).forEach((m) => {
              if (m.status && m.status.startsWith("卒業")) {
                graduatedNames.add(m.name);
              }
            });
          }

          allCharacters = characters.map((c, i) => ({
            ...c,
            _key: c.name + "__" + (c.costume || c.title || i),
            _blob: buildSearchBlob(c),
            _graduated: graduatedNames.has(c.name),
          }));

          populateMemberFilter(allCharacters);
          populateGenFilter(allCharacters);
          renderCards(sortCharacters(allCharacters));
        } catch (e) {
          stage.innerHTML = `<p class="error" style="grid-column:1/-1;">
        キャラクター一覧の読み込みに失敗しました(${e.message})。
      </p>`;
        }
      }

      init();
