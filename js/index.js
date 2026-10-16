      const GRAD_STORAGE_KEY = "nogifra-show-graduated";

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
      const viewerPanels = document.getElementById("viewerPanels");
      // 詳細を閉じたときに戻すタイトル(キャラ別ページでは生成スクリプトが data-index-title に入れている)
      const INDEX_TITLE = document.documentElement.dataset.indexTitle || document.title;

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

      let zoomPct = 100; // 100 = リセット(svg width:100%)

      function applyZoom() {
        const svg = diagramTarget.querySelector("svg");
        if (!svg) return;
        svg.style.width = zoomPct + "%";
        svg.style.height = "auto";
        zoomLabel.textContent = zoomPct + "%";
      }
      zoomIn.addEventListener("click", () => {
        zoomPct = Math.min(ZOOM_MAX, zoomPct + ZOOM_STEP);
        applyZoom();
      });
      zoomOut.addEventListener("click", () => {
        zoomPct = Math.max(ZOOM_MIN, zoomPct - ZOOM_STEP);
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

      async function renderDiagram(tab) {
        diagramTarget.className = "loading";
        diagramTarget.textContent = "読み込み中...";
        zoomPct = 100;
        collapseExpanded();
        if (await renderMermaidInto(diagramTarget, tab.file)) applyZoom();
      }

      // タブの切り替え。原文・パッシブ表は全タブ分がHTMLにあるので、表示するものを切り替えるだけ
      let viewerTabList = [];
      let currentTab = null;
      function showTab(index) {
        currentTab = viewerTabList[index];
        viewerTabs.querySelectorAll(".tab-btn").forEach((b) => {
          b.classList.toggle("active", Number(b.dataset.index) === index);
        });
        viewerPanels.querySelectorAll("[data-tab]").forEach((panel) => {
          panel.hidden = Number(panel.dataset.tab) !== index;
          if (panel.tagName === "DETAILS") panel.open = false;
        });
        const isPassive = currentTab.type === "passive";
        diagramSection.hidden = isPassive;
        if (isPassive) collapseExpanded();
        else renderDiagram(currentTab);
      }
      viewerTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (btn) showTab(Number(btn.dataset.index));
      });

      setupThemeToggle(() => {
        if (viewer.classList.contains("open") && currentTab && currentTab.type !== "passive") {
          renderDiagram(currentTab);
        }
        if (compareViewer.classList.contains("open")) renderCompareTab();
      });

      let viewerChara = null;
      function openViewer(chara) {
        viewerChara = chara;
        track("view_character", {
          member: chara.name,
          character: characterLabel(chara),
        });
        viewerTitle.textContent = chara.name;
        viewerSubtitle.textContent = chara.title || "";
        viewerTabList = viewerTabDefs(chara);
        viewerTabs.innerHTML = viewerTabsHtml(viewerTabList);
        viewerTabs.style.display = viewerTabList.length > 1 ? "flex" : "none";
        viewerPanels.innerHTML = viewerPanelsHtml(viewerTabList);
        document.title = characterPageTitle(chara);
        viewer.classList.add("open");
        if (viewerTabList.length > 0) showTab(0);
      }

      // 詳細を開いている間は、URLをそのキャラのページ(c/…/)にする。
      // 一覧から開いたときは履歴に積むので、ブラウザの「戻る」で閉じられる。
      // キャラのURLを直接開いたときは履歴に積まず、閉じたらURLを一覧に置き換える
      let viewerInHistory = false;

      function characterFromLocation() {
        const rel = location.href.split(/[?#]/)[0].slice(SITE_ROOT.length);
        if (!rel.startsWith("c/")) return null;
        return allCharacters.find((c) => characterPath(c) === rel) || null;
      }

      function openViewerFromList(chara) {
        openViewer(chara);
        const path = characterPath(chara);
        if (!path) return;
        history.pushState({ chara: chara._key }, "", new URL(path, SITE_ROOT));
        viewerInHistory = true;
      }

      function hideViewer() {
        viewer.classList.remove("open");
        collapseExpanded();
        document.title = INDEX_TITLE;
      }

      function closeViewer() {
        if (!viewer.classList.contains("open")) return;
        if (viewerInHistory) {
          viewerInHistory = false;
          history.back(); // popstate で閉じる
        } else {
          hideViewer();
          if (characterFromLocation()) history.replaceState(null, "", SITE_ROOT);
        }
      }

      window.addEventListener("popstate", () => {
        const c = characterFromLocation();
        if (c) {
          openViewer(c);
          viewerInHistory = Boolean(history.state && history.state.chara);
        } else {
          hideViewer();
          viewerInHistory = false;
        }

        const charas = compareFromLocation();
        if (charas) {
          selectForCompare(charas);
          openCompare({ fromHistory: true });
          compareInHistory = Boolean(history.state && history.state.compare);
        } else {
          hideCompare();
          compareInHistory = false;
        }
      });
      viewerClose.addEventListener("click", closeViewer);

      // 詳細画面から、このキャラを選んだ状態で比較モードに入る
      document.getElementById("viewerCompare").addEventListener("click", () => {
        if (!viewerChara) return;
        closeViewer();
        if (!compareMode) setCompareMode(true);
        if (!compareSelected.has(viewerChara._key)) {
          toggleCompareSelection(viewerChara._key);
        }
      });
      viewer.addEventListener("click", (e) => {
        if (e.target === viewer) closeViewer();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!compareList.hidden) {
          closeCompareList();
        } else if (compareViewer.classList.contains("open")) {
          closeCompare();
        } else if (diagramSection.classList.contains("expanded")) {
          collapseExpanded();
        } else {
          closeViewer();
        }
      });

      const searchInput = document.getElementById("searchInput");
      const memberCombo = document.getElementById("memberCombo");
      const memberInput = document.getElementById("memberInput");
      const memberList = document.getElementById("memberList");
      const memberClear = document.getElementById("memberClear");
      const genFilter = document.getElementById("genFilter");
      const gradFilter = document.getElementById("gradFilter");
      const attrButtons = document.querySelectorAll(".attr-btn");
      const activeAttrs = new Set();
      let allCharacters = [];
      let selectedMember = ""; // キャラの絞り込み(空ならすべて)

      // カタカナ・全角英数の違いを無視して比べる(「いけだ」「イケダ」どちらでも池田瑛紗に当たるように)
      function normalizeForMatch(s) {
        return String(s || "")
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
      }

      // 詳細絞り込みのタグ。スキル・パッシブの文面から機械的に拾う(characters.json には持たせない)。
      // 値は「e:状態名」(スキルでかける効果)・「p:能力名」(パッシブ)の形にする
      const GRANT_RE = /((?:「[^」]+」(?:状態)?(?:と|または|、))*「[^」]+」)状態に(?:し|する|変更)/g;
      const OTHER_EFFECTS = [
        ["HP回復", /HPを[^[\]]*?回復/],
        ["デバフ・サゲ効果の解除", /デバフ・サゲ効果を[^、[\]]{0,8}解除/],
        ["バフ・アゲ効果の解除", /(?:^|[^デ])バフ・アゲ効果(?:・特殊状態)?を[^、[\]]{0,8}解除/],
      ];
      const PASSIVE_SPECIALS = [
        ["アドバンススキル", /アドバンススキルが発動/],
        ["アンコールスキル", /アンコールスキルの発動条件/],
        ["リタイア時にHP回復", /リタイアした時に/],
        ["ライブ開始時に状態付与", /^ライブ開始時、.*状態に(?:し|する)/],
        ["状態のターン数延長", /ターン数を[+＋]\d/],
      ];
      const PASSIVE_STAT_RE =
        /^(?:自身の)?([^をが、「」+＋]+?)(?:を|が)?(?:C\.Rank×[\d.]+アップ|[+＋]?[\d.]+%?アップ|[+＋][\d.]+%?)$/;
      // パッシブの能力は主要なものを先に並べ、残りは該当数の多い順
      const MAIN_STATS = ["アピール力", "HP上限", "スマイル", "エフォート", "サンクス", "バイタリティ", "ディフェンス"];

      // 文字起こしで「力」が「カ」になっているものを揃える
      function fixOcr(s) {
        return s.replace(/アピールカ(?=ダウン|アップ|$)/g, "アピール力");
      }

      function passiveLines(c) {
        const lines = [];
        (c.passive || []).forEach((p) => lines.push(...[].concat(p.effect || [])));
        return lines;
      }

      // 状態名 → ライバルにかけた回数・自身/味方にかけた回数。
      // ライバルにかける効果は「100%の確率で」と書かれるので、その有無で見分ける
      function extractGrants(c) {
        const grants = new Map();
        const texts = (c.skills || []).map((s) => s.text || "").concat(passiveLines(c));
        texts.forEach((t) => {
          for (const m of t.matchAll(GRANT_RE)) {
            const rival = t.slice(Math.max(0, m.index - 30), m.index).includes("確率で");
            for (const [, raw] of m[1].matchAll(/「([^」]+)」/g)) {
              const name = fixOcr(raw);
              const g = grants.get(name) || { rival: 0, ally: 0 };
              g[rival ? "rival" : "ally"]++;
              grants.set(name, g);
            }
          }
        });
        return grants;
      }

      function extractPassiveTags(c) {
        const stats = new Set();
        const specials = new Set();
        passiveLines(c).forEach((line) => {
          PASSIVE_SPECIALS.forEach(([label, re]) => {
            if (re.test(line)) specials.add(label);
          });
          if (line.startsWith("※")) return;
          const m = line.match(PASSIVE_STAT_RE);
          if (!m) return;
          let name = fixOcr(m[1].replace(/^センターと自身の/, ""));
          // 「転倒&落胆&嫉妬耐性」は状態ごとの耐性に分ける
          if (name.includes("&")) {
            name
              .replace(/耐性$/, "")
              .split("&")
              .forEach((n) => stats.add(n + "耐性"));
          } else {
            stats.add(name);
          }
        });
        return { stats, specials };
      }

      // 各キャラに _tags を付け、詳細絞り込みの選択肢(グループ・並び順)を作る
      let effectOptions = [];
      let passiveOptions = [];
      function buildAdvancedTags(list) {
        const grantTotals = new Map();
        const otherCount = new Map();
        const statCount = new Map();
        const specialCount = new Map();
        const bump = (map, key, n = 1) => map.set(key, (map.get(key) || 0) + n);

        list.forEach((c) => {
          const tags = new Set();
          extractGrants(c).forEach((g, name) => {
            tags.add("e:" + name);
            const t = grantTotals.get(name) || { rival: 0, ally: 0, chars: 0 };
            t.rival += g.rival;
            t.ally += g.ally;
            t.chars++;
            grantTotals.set(name, t);
          });
          const skillText = (c.skills || []).map((s) => s.text || "").join("\n");
          OTHER_EFFECTS.forEach(([label, re]) => {
            if (re.test(skillText)) {
              tags.add("e:" + label);
              bump(otherCount, label);
            }
          });
          const { stats, specials } = extractPassiveTags(c);
          stats.forEach((s) => {
            tags.add("p:" + s);
            bump(statCount, s);
          });
          specials.forEach((s) => {
            tags.add("p:" + s);
            bump(specialCount, s);
          });
          c._tags = tags;
        });

        const byCount = (a, b) => b.total - a.total || a.label.localeCompare(b.label, "ja");
        const grantOpts = [...grantTotals].map(([name, t]) => ({
          value: "e:" + name,
          label: name,
          // かけた回数の多い方の相手に分類する
          group: t.rival > t.ally ? "ライバルにかける効果" : "自身・味方にかける効果",
          total: t.chars,
        }));
        effectOptions = [
          ...grantOpts.filter((o) => o.group === "自身・味方にかける効果").sort(byCount),
          ...grantOpts.filter((o) => o.group === "ライバルにかける効果").sort(byCount),
          ...OTHER_EFFECTS.filter(([label]) => otherCount.has(label)).map(([label]) => ({
            value: "e:" + label,
            label,
            group: "その他",
            total: otherCount.get(label),
          })),
        ];
        const mainRank = (label) => {
          const i = MAIN_STATS.indexOf(label);
          return i === -1 ? MAIN_STATS.length : i;
        };
        passiveOptions = [
          ...[...statCount]
            .map(([label, total]) => ({ value: "p:" + label, label, group: "上がる能力", total }))
            .sort((a, b) => mainRank(a.label) - mainRank(b.label) || byCount(a, b)),
          ...PASSIVE_SPECIALS.filter(([label]) => specialCount.has(label)).map(([label]) => ({
            value: "p:" + label,
            label,
            group: "特殊な効果",
            total: specialCount.get(label),
          })),
        ];
      }

      function buildSearchBlob(c) {
        // 期は「◯期」だけを検索対象にする(新4期生・春組/夏組などの括弧書きは含めない)
        const parts = [c.name, c.costume, c.title, normalizeGeneration(c.generation)];
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
      <a class="card${compareSelected.has(c._key) ? " selected" : ""}" href="${escapeHtml(characterPath(c) || "#")}" data-key="${escapeHtml(c._key)}">
        <span class="compare-check" aria-hidden="true"></span>
        <span class="tier">${escapeHtml(c.tier || "SKILL")}</span>${attrBadge(c.attribute)}
        <h2>${escapeHtml(c.name)}${genBadge(c.generation)}${graduatedBadge(c)}</h2>
        <p class="subtitle">${escapeHtml(c.title || "")}</p>
      </a>
    `,
          )
          .join("");

        stage.querySelectorAll(".card").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            // Ctrl/Shift+クリックなどはブラウザに任せて、キャラ別ページを新しいタブで開けるようにする
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (compareMode) {
              toggleCompareSelection(btn.dataset.key);
              return;
            }
            const c = allCharacters.find((x) => x._key === btn.dataset.key);
            if (c) openViewerFromList(c);
          });
        });
      }

      // 比較モード: カードをタップして選び、「比較する」で並べて表示する。
      // PCでは横並び、狭い画面では同じタブの内容を縦に積む
      const compareSelected = new Set();
      let compareMode = false;
      let compareCharas = [];
      let compareTabDefs = [];
      let compareTabIndex = 0;

      const compareToggle = document.getElementById("compareToggle");
      const compareTray = document.getElementById("compareTray");
      const compareList = document.getElementById("compareList");
      const compareListItems = document.getElementById("compareListItems");
      const compareTrayCount = document.getElementById("compareTrayCount");
      const compareGo = document.getElementById("compareGo");
      const compareClear = document.getElementById("compareClear");
      const compareViewer = document.getElementById("compareViewer");
      const compareClose = document.getElementById("compareClose");
      const compareSubtitle = document.getElementById("compareSubtitle");
      const compareTabs = document.getElementById("compareTabs");
      const comparePanes = document.getElementById("comparePanes");
      const compareNav = document.getElementById("compareNav");

      function findCharacter(key) {
        return allCharacters.find((x) => x._key === key);
      }

      // 同じメンバーの別衣装を選んだときに区別できるよう、名前が重なる場合だけ衣装名を添える
      function compareLabel(c, list) {
        const dup = list.filter((x) => x.name === c.name).length > 1;
        return dup ? `${c.name}(${c.title || c.costume || ""})` : c.name;
      }

      function setCompareMode(on) {
        if (!on) closeCompareList();
        compareMode = on;
        document.body.classList.toggle("compare-mode", on);
        compareToggle.classList.toggle("active", on);
        compareToggle.setAttribute("aria-pressed", String(on));
        compareTray.hidden = !on;
        if (!on) compareSelected.clear();
        syncCompareSelection();
      }

      function toggleCompareSelection(key) {
        if (compareSelected.has(key)) {
          compareSelected.delete(key);
        } else if (compareSelected.size >= MAX_COMPARE) {
          compareTray.classList.remove("shake");
          void compareTray.offsetWidth; // アニメーションを再生し直す
          compareTray.classList.add("shake");
          return;
        } else {
          compareSelected.add(key);
        }
        syncCompareSelection();
      }

      function syncCompareSelection() {
        stage.querySelectorAll(".card").forEach((card) => {
          card.classList.toggle("selected", compareSelected.has(card.dataset.key));
        });
        compareTrayCount.textContent =
          compareSelected.size === 0
            ? `比較するキャラを2〜${MAX_COMPARE}体タップ`
            : `選択中 ${compareSelected.size}/${MAX_COMPARE} ${compareList.hidden ? "▲" : "▼"}`;
        compareTrayCount.disabled = compareSelected.size === 0 && compareList.hidden;
        compareGo.disabled = compareSelected.size < 2;
        renderCompareList();
        saveSearchState();
      }

      // 選択中キャラの一覧(画面下のバーから開く)。
      // 検索で一覧に出ていないキャラも、ここから1体ずつ解除できる。
      // 開いている間は解除したキャラも薄く残して「戻す」を押せるようにし、閉じたときに消す
      let compareListKeys = [];

      function renderCompareList() {
        if (compareList.hidden) return;
        compareListKeys = [...new Set([...compareListKeys, ...compareSelected])];
        const listed = compareListKeys.map(findCharacter).filter(Boolean);
        compareListItems.innerHTML = listed
          .map((c) => {
            const on = compareSelected.has(c._key);
            return `
        <li class="compare-list-item${on ? "" : " removed"}">
          <span class="compare-list-text">
            <span class="compare-list-name">${escapeHtml(c.name)}</span>
            <span class="compare-list-title">${escapeHtml(c.title || "")}</span>
          </span>
          <button type="button" class="compare-list-btn" data-key="${escapeHtml(c._key)}" aria-label="${on ? "選択を解除" : "選択に戻す"}">${on ? "×" : "戻す"}</button>
        </li>`;
          })
          .join("");
      }

      function openCompareList() {
        compareList.hidden = false;
        compareListKeys = [...compareSelected];
        compareTrayCount.setAttribute("aria-expanded", "true");
        syncCompareSelection();
      }

      function closeCompareList() {
        if (compareList.hidden) return;
        compareList.hidden = true;
        compareListKeys = [];
        compareListItems.innerHTML = "";
        compareTrayCount.setAttribute("aria-expanded", "false");
        syncCompareSelection();
      }

      compareTrayCount.addEventListener("click", () => {
        if (compareList.hidden) openCompareList();
        else closeCompareList();
      });
      compareListItems.addEventListener("click", (e) => {
        const btn = e.target.closest(".compare-list-btn");
        if (btn) toggleCompareSelection(btn.dataset.key);
      });
      // 一覧の外を押したら閉じる(押したボタンは再描画で消えていることがあるので、押した時点の経路で判定する)
      document.addEventListener("click", (e) => {
        if (!compareList.hidden && !e.composedPath().includes(compareTray)) {
          closeCompareList();
        }
      });

      compareToggle.addEventListener("click", () => setCompareMode(!compareMode));
      compareClear.addEventListener("click", () => setCompareMode(false));
      compareGo.addEventListener("click", () => openCompare());

      // 比較画面のURL(一覧のURLに比較するキャラを付け足したもの)。更新・共有・「戻る」で閉じるために使う
      // 例: ?compare=ikeda_teresa/11thbasura5kisei,yoda_yuki/chancewabyoudou
      function compareUrl(charas) {
        const slugs = charas.map((c) => (characterPath(c) || "").slice(2, -1)).filter(Boolean);
        return new URL("?compare=" + slugs.join(","), SITE_ROOT).href;
      }

      function compareFromLocation() {
        const param = new URLSearchParams(location.search).get("compare");
        if (!param) return null;
        const charas = param
          .split(",")
          .map((slug) => allCharacters.find((c) => characterPath(c) === `c/${slug}/`))
          .filter(Boolean)
          .slice(0, MAX_COMPARE);
        return charas.length >= 2 ? charas : null;
      }

      // URLから開くときは、そのキャラを選んだ状態の比較モードにしてから開く
      function selectForCompare(charas) {
        if (!compareMode) setCompareMode(true);
        compareSelected.clear();
        charas.forEach((c) => compareSelected.add(c._key));
        syncCompareSelection();
      }

      // 一覧から開いたときは履歴に積むので、ブラウザの「戻る」で閉じられる。
      // URL(更新・共有・戻る/進む)から開いたときは fromHistory を true にして、履歴は触らない
      let compareInHistory = false;
      function openCompare({ fromHistory = false } = {}) {
        closeCompareList();
        compareCharas = [...compareSelected].map(findCharacter).filter(Boolean);
        if (compareCharas.length < 2) return;
        track("compare_characters", { character_count: compareCharas.length });

        const maxSkills = Math.max(
          ...compareCharas.map((c) => (c.skills || []).length),
        );
        compareTabDefs = [];
        for (let i = 0; i < maxSkills; i++) {
          compareTabDefs.push({ type: "active", index: i, label: "スキル" + (i + 1) });
        }
        if (compareCharas.some((c) => c.passive && c.passive.length > 0)) {
          compareTabDefs.push({ type: "passive", label: "パッシブ" });
        }
        compareTabIndex = 0;

        compareSubtitle.textContent = compareCharas
          .map((c) => c.title || c.name)
          .join(" / ");
        compareTabs.innerHTML = compareTabDefs
          .map(
            (t, i) =>
              `<button class="tab-btn${i === 0 ? " active" : ""}" data-index="${i}">${t.label}</button>`,
          )
          .join("");
        comparePanes.style.setProperty("--cols", compareCharas.length);
        compareNav.innerHTML = compareCharas
          .map(
            (c, i) =>
              `<button type="button" class="compare-nav-btn${i === 0 ? " active" : ""}" data-index="${i}">${escapeHtml(compareLabel(c, compareCharas))}</button>`,
          )
          .join("");

        compareViewer.classList.add("open");
        compareViewer.scrollTop = 0;
        comparePanes.scrollLeft = 0;
        renderCompareTab();

        if (!fromHistory) {
          history.pushState({ compare: true }, "", compareUrl(compareCharas));
          compareInHistory = true;
        }
      }

      // 狭い画面では列を横スクロールで切り替える。
      // 名前ボタンで列へ移動し、スクロール位置に合わせて今見ている列のボタンを光らせる
      function scrollToPane(index) {
        const pane = comparePanes.children[index];
        if (!pane) return;
        comparePanes.scrollTo({
          left: pane.offsetLeft - comparePanes.offsetLeft,
          behavior: "smooth",
        });
      }

      function updateCompareNav() {
        const panes = [...comparePanes.children];
        if (panes.length === 0) return;
        const left = comparePanes.scrollLeft;
        let current = 0;
        panes.forEach((p, i) => {
          if (p.offsetLeft - comparePanes.offsetLeft - p.offsetWidth / 2 <= left) {
            current = i;
          }
        });
        compareNav.querySelectorAll(".compare-nav-btn").forEach((b, i) => {
          if (i === current && !b.classList.contains("active")) {
            // 名前ボタンが横にはみ出しているときも、光らせたボタンが見えるようにする
            compareNav.scrollTo({
              left: b.offsetLeft - compareNav.offsetLeft - 8,
              behavior: "smooth",
            });
          }
          b.classList.toggle("active", i === current);
        });
      }

      compareNav.addEventListener("click", (e) => {
        const btn = e.target.closest(".compare-nav-btn");
        if (btn) scrollToPane(Number(btn.dataset.index));
      });
      comparePanes.addEventListener("scroll", updateCompareNav, { passive: true });

      compareTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (!btn) return;
        compareTabIndex = Number(btn.dataset.index);
        compareTabs
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        renderCompareTab();
      });

      function renderCompareTab() {
        const def = compareTabDefs[compareTabIndex];
        // タブを切り替えても、横スクロールで見ていたキャラの位置を保つ
        const keepLeft = comparePanes.scrollLeft;
        comparePanes.innerHTML = compareCharas
          .map(
            (c, i) => `
      <section class="compare-pane">
        <div class="compare-pane-head">
          ${attrBadge(c.attribute)}
          <h3>${escapeHtml(c.name)}${genBadge(c.generation)}${graduatedBadge(c)}</h3>
          <p class="subtitle">${escapeHtml(c.title || "")}</p>
        </div>
        <div class="compare-pane-body" data-index="${i}"></div>
      </section>
    `,
          )
          .join("");
        comparePanes.scrollLeft = keepLeft;

        comparePanes.querySelectorAll(".compare-pane-body").forEach((body) => {
          const c = compareCharas[Number(body.dataset.index)];
          if (def.type === "passive") {
            body.innerHTML = `<div class="diagram-wrap">${passiveTableHtml(c.passive || [])}</div>`;
            return;
          }
          const skill = (c.skills || [])[def.index];
          if (!skill) {
            body.innerHTML = '<p class="loading">このスキルはありません。</p>';
            return;
          }
          body.innerHTML = `
        <p class="compare-skill-label">${escapeHtml(skill.label)}</p>
        <div class="zoom-bar compare-zoom-bar">
          <button type="button" class="zoom-btn" data-zoom="out" aria-label="縮小">−</button>
          <span class="zoom-label">100%</span>
          <button type="button" class="zoom-btn" data-zoom="in" aria-label="拡大">＋</button>
          <button type="button" class="zoom-btn zoom-reset" data-zoom="reset">リセット</button>
        </div>
        <div class="diagram-wrap"><div class="loading">読み込み中...</div></div>
        ${skill.text ? '<details class="original-text"><summary>原文を見る</summary><div class="original-text-body"></div></details>' : ""}
      `;
          if (skill.text) {
            body.querySelector(".original-text-body").innerHTML = originalTextBodyHtml(skill.text);
          }
          const target = body.querySelector(".diagram-wrap > div");
          renderMermaidInto(target, skill.file).then((ok) => {
            // 読み込み中にズームされていた場合も倍率を反映する
            const svg = target.querySelector("svg");
            if (ok && svg && body.dataset.zoom) svg.style.width = body.dataset.zoom + "%";
          });
        });
      }

      // 比較ビューアのズームはキャラ(列)ごとに別々に効かせる
      comparePanes.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-zoom]");
        if (!btn) return;
        const body = btn.closest(".compare-pane-body");
        let pct = Number(body.dataset.zoom || 100);
        if (btn.dataset.zoom === "in") pct = Math.min(ZOOM_MAX, pct + ZOOM_STEP);
        else if (btn.dataset.zoom === "out") pct = Math.max(ZOOM_MIN, pct - ZOOM_STEP);
        else pct = 100;
        body.dataset.zoom = pct;
        body.querySelector(".zoom-label").textContent = pct + "%";
        const svg = body.querySelector(".diagram-wrap svg");
        if (svg) svg.style.width = pct + "%";
      });

      function hideCompare() {
        compareViewer.classList.remove("open");
      }

      function closeCompare() {
        if (!compareViewer.classList.contains("open")) return;
        if (compareInHistory) {
          compareInHistory = false;
          history.back(); // popstate で閉じる
        } else {
          hideCompare();
          if (compareFromLocation()) history.replaceState(null, "", SITE_ROOT);
        }
      }
      compareClose.addEventListener("click", closeCompare);
      compareViewer.addEventListener("click", (e) => {
        if (e.target === compareViewer) closeCompare();
      });

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
        const base = filterByMemberAndAttr(filtered);
        renderAdvancedOptions(base);
        renderCards(sortCharacters(filterByAdvanced(base)));
        saveSearchState();
      }

      // 検索語は入力途中の文字を送らないよう、入力が1.5秒止まってから送る
      let searchTrackTimer = null;
      let lastTrackedSearch = "";
      function trackSearch() {
        clearTimeout(searchTrackTimer);
        searchTrackTimer = setTimeout(() => {
          const term = searchInput.value.trim();
          if (term === "" || term === lastTrackedSearch) return;
          lastTrackedSearch = term;
          track("search", { search_term: term });
        }, 1500);
      }

      let searchStateRestored = false;
      function saveSearchState() {
        if (!searchStateRestored) return; // 復元前の初期状態で上書きしない
        try {
          sessionStorage.setItem(
            SEARCH_STATE_KEY,
            JSON.stringify({
              query: searchInput.value,
              member: selectedMember,
              gen: genFilter.value,
              attrs: [...activeAttrs],
              adv: [...advSelected],
              advMode,
              advOpen: !advPanel.hidden,
              compareMode,
              compareSelected: [...compareSelected],
            }),
          );
        } catch (e) {}
      }

      // 選択肢の生成後に呼ぶ(キャラ・期のプルダウンは読み込み後に作られるため)
      function restoreSearchState() {
        const state = loadSearchState();
        searchInput.value = state.query || "";
        const hasOption = (select, v) =>
          [...select.options].some((o) => o.value === v);
        if (state.member && memberOptions.some((o) => o.name === state.member)) {
          setMember(state.member);
        }
        const advValues = new Set([...effectOptions, ...passiveOptions].map((o) => o.value));
        (state.adv || []).filter((v) => advValues.has(v)).forEach((v) => advSelected.add(v));
        setAdvMode(state.advMode === "any" ? "any" : "all");
        setAdvOpen(Boolean(state.advOpen));
        if (state.gen && hasOption(genFilter, state.gen)) {
          genFilter.value = state.gen;
        }
        (state.attrs || []).forEach((attr) => activeAttrs.add(attr));
        attrButtons.forEach((btn) => {
          btn.classList.toggle("active", activeAttrs.has(btn.dataset.attr));
        });
        if (state.compareMode) {
          (state.compareSelected || [])
            .filter((key) => findCharacter(key))
            .slice(0, MAX_COMPARE)
            .forEach((key) => compareSelected.add(key));
          setCompareMode(true);
        }
        searchStateRestored = true;
      }

      function filterByMemberAndAttr(list) {
        let result = list;
        // キャラを名指しで選んだときは、卒業済みでも表示する
        if (!gradFilter.checked && !selectedMember) {
          result = result.filter((c) => !c._graduated);
        }
        if (selectedMember) {
          result = result.filter((c) => c.name === selectedMember);
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

      // 詳細絞り込み
      const advToggle = document.getElementById("advToggle");
      const advCount = document.getElementById("advCount");
      const advPanel = document.getElementById("advPanel");
      const advSelectedBox = document.getElementById("advSelected");
      const advModeButtons = document.querySelectorAll(".adv-mode-btn");
      const effectSearch = document.getElementById("effectSearch");
      const passiveSearch = document.getElementById("passiveSearch");
      const effectOptionsBox = document.getElementById("effectOptions");
      const passiveOptionsBox = document.getElementById("passiveOptions");
      const toolbar = document.querySelector(".toolbar");
      const advSelected = new Set();
      let advMode = "all"; // all: すべて満たす / any: どれか1つ

      function hasAdvanced(c, mode, values) {
        return mode === "any"
          ? values.some((v) => c._tags.has(v))
          : values.every((v) => c._tags.has(v));
      }

      function filterByAdvanced(list) {
        if (advSelected.size === 0) return list;
        const values = [...advSelected];
        return list.filter((c) => hasAdvanced(c, advMode, values));
      }

      function advLabel(value) {
        return value.slice(2);
      }

      // 選択肢の横の数字は、今の条件にその選択肢を足したときの件数
      // (「すべて満たす」なら選択中の条件との重なり、「どれか1つ」ならその選択肢単独の件数)
      function renderOptionList(box, options, query, base) {
        const q = normalizeForMatch(query.trim());
        const selectedValues = [...advSelected];
        const narrowed =
          advMode === "all" && selectedValues.length > 0
            ? base.filter((c) => hasAdvanced(c, "all", selectedValues))
            : base;
        let html = "";
        let group = null;
        let shown = 0;
        options.forEach((o) => {
          if (q && !normalizeForMatch(o.label).includes(q)) return;
          if (o.group !== group) {
            group = o.group;
            html += `<p class="adv-group">${escapeHtml(group)}</p>`;
          }
          const on = advSelected.has(o.value);
          const count = narrowed.filter((c) => c._tags.has(o.value)).length;
          html += `<button type="button" class="adv-option${on ? " active" : ""}${count === 0 && !on ? " empty" : ""}" data-value="${escapeHtml(o.value)}" aria-pressed="${on}">${escapeHtml(o.label)}<span class="adv-option-count">${count}</span></button>`;
          shown++;
        });
        box.innerHTML = shown > 0 ? html : '<p class="adv-none">該当する候補がありません。</p>';
      }

      let lastAdvBase = [];
      function renderAdvancedOptions(base) {
        lastAdvBase = base;
        advCount.hidden = advSelected.size === 0;
        advCount.textContent = advSelected.size;
        advToggle.classList.toggle("has-selection", advSelected.size > 0);
        advSelectedBox.innerHTML = [...advSelected]
          .map(
            (v) =>
              `<button type="button" class="adv-chip" data-value="${escapeHtml(v)}" aria-label="${escapeHtml(advLabel(v))}の条件を外す">${escapeHtml(advLabel(v))}<span aria-hidden="true">×</span></button>`,
          )
          .join("");
        advSelectedBox.hidden = advSelected.size === 0;
        if (advPanel.hidden) return; // 閉じている間は選択肢を描かない
        renderOptionList(effectOptionsBox, effectOptions, effectSearch.value, base);
        renderOptionList(passiveOptionsBox, passiveOptions, passiveSearch.value, base);
      }

      function toggleAdvanced(value) {
        if (advSelected.has(value)) {
          advSelected.delete(value);
        } else {
          advSelected.add(value);
          track("advanced_filter", { filter_value: advLabel(value) });
        }
        applyFilter();
      }

      function setAdvMode(mode) {
        advMode = mode;
        advModeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      }

      function setAdvOpen(open) {
        advPanel.hidden = !open;
        advToggle.setAttribute("aria-expanded", String(open));
        advToggle.classList.toggle("open", open);
        toolbar.classList.toggle("adv-open", open);
      }

      advToggle.addEventListener("click", () => {
        setAdvOpen(advPanel.hidden);
        applyFilter();
      });
      document.getElementById("advClose").addEventListener("click", () => {
        setAdvOpen(false);
        saveSearchState();
        advToggle.focus();
      });
      document.getElementById("advReset").addEventListener("click", () => {
        advSelected.clear();
        effectSearch.value = "";
        passiveSearch.value = "";
        applyFilter();
      });
      advModeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          setAdvMode(btn.dataset.mode);
          applyFilter();
        });
      });
      [effectOptionsBox, passiveOptionsBox, advSelectedBox].forEach((box) => {
        box.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-value]");
          if (btn) toggleAdvanced(btn.dataset.value);
        });
      });
      effectSearch.addEventListener("input", () =>
        renderOptionList(effectOptionsBox, effectOptions, effectSearch.value, lastAdvBase),
      );
      passiveSearch.addEventListener("input", () =>
        renderOptionList(passiveOptionsBox, passiveOptions, passiveSearch.value, lastAdvBase),
      );

      // キャラの絞り込み: 入力欄に名前(ひらがな・カタカナの読みでも可)を打つと候補が絞られるプルダウン
      let memberOptions = []; // { name, reading }
      let memberMatches = [];
      let memberActive = -1;

      function setMember(name) {
        selectedMember = name;
        memberInput.value = name;
        memberClear.hidden = !name;
        memberCombo.classList.toggle("has-value", Boolean(name));
      }

      function renderMemberList(query) {
        const q = normalizeForMatch(query.trim());
        memberMatches = [{ name: "", reading: "" }].concat(
          memberOptions.filter(
            (o) =>
              !q ||
              normalizeForMatch(o.name).includes(q) ||
              normalizeForMatch(o.reading).includes(q),
          ),
        );
        // 入力中は最初の候補(「すべて」の次)を選んだ状態にして、Enterで決められるようにする
        memberActive = q && memberMatches.length > 1 ? 1 : -1;
        paintMemberList();
      }

      function paintMemberList() {
        memberList.innerHTML =
          memberMatches
            .map((o, i) => {
              const label = o.name || "すべて";
              const selected = o.name === selectedMember;
              const grad = o.graduated ? '<span class="combo-note">卒業</span>' : "";
              return `<li class="combo-option${i === memberActive ? " active" : ""}${selected ? " selected" : ""}" id="memberOpt${i}" role="option" aria-selected="${selected}" data-index="${i}">${escapeHtml(label)}${grad}</li>`;
            })
            .join("") +
          (memberMatches.length === 1 ? '<li class="combo-empty">該当するキャラがいません</li>' : "");
        if (memberActive >= 0) {
          memberInput.setAttribute("aria-activedescendant", "memberOpt" + memberActive);
          const el = memberList.children[memberActive];
          if (el) el.scrollIntoView({ block: "nearest" });
        } else {
          memberInput.removeAttribute("aria-activedescendant");
        }
      }

      function openMemberList() {
        if (!memberList.hidden) return;
        memberList.hidden = false;
        memberInput.setAttribute("aria-expanded", "true");
        renderMemberList(""); // 開いた直後は全員を出す
      }

      function closeMemberList() {
        if (memberList.hidden) return;
        memberList.hidden = true;
        memberInput.setAttribute("aria-expanded", "false");
        memberInput.removeAttribute("aria-activedescendant");
        memberInput.value = selectedMember; // 決めずに離れたら、選択中の名前に戻す
      }

      function pickMember(index) {
        const o = memberMatches[index];
        if (!o) return;
        setMember(o.name);
        closeMemberList();
        applyFilter();
      }

      memberInput.addEventListener("focus", () => {
        openMemberList();
        memberInput.select();
      });
      memberInput.addEventListener("click", openMemberList);
      memberInput.addEventListener("input", () => {
        openMemberList();
        renderMemberList(memberInput.value);
      });
      memberInput.addEventListener("keydown", (e) => {
        if (e.isComposing || e.keyCode === 229) return; // 日本語入力の変換中のEnter等は無視する
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          openMemberList();
          const step = e.key === "ArrowDown" ? 1 : -1;
          memberActive = Math.max(0, Math.min(memberMatches.length - 1, memberActive + step));
          paintMemberList();
        } else if (e.key === "Enter") {
          if (memberList.hidden) return;
          e.preventDefault();
          if (memberActive >= 0) pickMember(memberActive);
        } else if (e.key === "Escape") {
          if (memberList.hidden) return;
          e.stopPropagation();
          closeMemberList();
        } else if (e.key === "Tab") {
          closeMemberList();
        }
      });
      // 候補を押したときに入力欄のフォーカスが外れて一覧が閉じないよう、mousedownでは何もしない
      memberList.addEventListener("mousedown", (e) => e.preventDefault());
      memberList.addEventListener("click", (e) => {
        const li = e.target.closest(".combo-option");
        if (li) pickMember(Number(li.dataset.index));
      });
      memberInput.addEventListener("blur", closeMemberList);
      memberClear.addEventListener("click", () => {
        setMember("");
        closeMemberList();
        applyFilter();
      });

      searchInput.addEventListener("input", applyFilter);
      searchInput.addEventListener("input", trackSearch);
      genFilter.addEventListener("change", applyFilter);
      gradFilter.checked = storageGet(GRAD_STORAGE_KEY) === "1";
      gradFilter.addEventListener("change", () => {
        storageSet(GRAD_STORAGE_KEY, gradFilter.checked ? "1" : "0");
        applyFilter();
      });
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
        memberOptions = [...seen.entries()]
          .sort((a, b) => a[1].localeCompare(b[1], "ja"))
          .map(([name, reading]) => ({
            name,
            reading,
            graduated: list.some((c) => c.name === name && c._graduated),
          }));
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

          buildAdvancedTags(allCharacters);
          populateMemberFilter(allCharacters);
          populateGenFilter(allCharacters);
          restoreSearchState();
          applyFilter();

          // キャラのURL(c/…/)で開かれたら、そのキャラの詳細を開いた状態にする
          const initial = characterFromLocation();
          if (initial) openViewer(initial);
          else if (viewer.classList.contains("open")) hideViewer();

          // 比較画面のURL(?compare=…)で開かれたら、そのキャラを選んで比較画面を開く
          const initialCompare = compareFromLocation();
          if (initialCompare) {
            selectForCompare(initialCompare);
            openCompare({ fromHistory: true });
          }
        } catch (e) {
          stage.innerHTML = `<p class="error" style="grid-column:1/-1;">
        キャラクター一覧の読み込みに失敗しました(${e.message})。
      </p>`;
        }
      }

      init();
