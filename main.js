import { MODES, UPGRADE_DEFS, applyChoice, checkEnding, formatDate, newGame, normalizeState, pickNextEvent, statDisplay } from "./game.js";
import { exportSaveJson, importSaveJson, loadMeta, loadSave, writeMeta, writeSave } from "./storage.js";
import { advisorLineFor } from "./advisor.js";
import {
  musicEnabled,
  setMusicEnabled,
  setSoundEnabled,
  setSoundVolume,
  sfxBad,
  sfxChoice,
  sfxGood,
  sfxOpen,
  sfxSplashFail,
  soundEnabled,
  soundVolume,
  startMusic,
  stopMusic,
  unlockAudio,
} from "./sound.js";

const $ = (sel) => document.querySelector(sel);
const elDate = $("#date");
const elStats = $("#stats");
const elCardId = $("#cardId");
const elCardTags = $("#cardTags");
const elTitle = $("#cardTitle");
const elText = $("#cardText");
const elChoices = $("#choices");
const elLog = $("#log");
const elAdvisorLine = $("#advisorLine");
const elCardArtIcon = $("#cardArtIcon");
const elCardArtLabel = $("#cardArtLabel");

const dlgMenu = $("#menu");
const dlgEnding = $("#ending");
const dlgIntro = $("#intro");
const elEndingTitle = $("#endingTitle");
const elEndingBody = $("#endingBody");

const btnMenu = $("#btnMenu");
const btnNewGame = $("#btnNewGame");
const btnSound = $("#btnSound");
const btnMusic = $("#btnMusic");
const btnExport = $("#btnExport");
const fileImport = $("#fileImport");
const btnRestart = $("#btnRestart");
const btnBegin = $("#btnBegin");
const btnBeginDynasty = $("#btnBeginDynasty");
const elLegacyBank = $("#legacyBank");
const elUpgrades = $("#upgrades");
const elVol = $("#vol");
const elVolLabel = $("#volLabel");

const btnModeReign = $("#modeReign");
const btnModeDynasty = $("#modeDynasty");

let events = [];
let state = null;
let currentEvent = null;
let meta = loadMeta();

const STAT_LABELS = Object.fromEntries(statDisplay().map((s) => [s.key, s.label]));

function statColor(key, value) {
  return value <= 25 ? "danger" : value >= 75 ? "good" : "neutral";
}

function formatSigned(n) {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? `+${v}` : `${v}`;
}

function formatDeltaList(delta) {
  const order = ["wealth", "populous", "loyalty", "faith", "army"];
  const parts = [];
  for (const k of order) {
    const d = Number(delta?.[k] ?? 0);
    if (!d) continue;
    const label = STAT_LABELS[k] ?? k;
    parts.push(`${label} ${formatSigned(d)}`);
  }
  return parts.length ? parts.join(" · ") : "-";
}

function renderStats() {
  elStats.innerHTML = "";
  for (const { key, label } of statDisplay()) {
    const v = Number(state.stats[key] ?? 0);
    const c = statColor(key, v);
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.innerHTML = `
      <div class="stat__row">
        <div class="stat__left">
          <div class="stat__icon" data-stat="${escapeHtml(key)}" aria-hidden="true"></div>
          <div class="stat__name">${label}</div>
        </div>
        <div class="stat__value">${Math.round(v)}</div>
      </div>
      <div class="bar" aria-hidden="true">
        <div class="bar__fill ${c === "danger" ? "bar__fill--danger" : c === "good" ? "bar__fill--good" : ""}" style="width:${Math.max(0, Math.min(100, v))}%"></div>
      </div>
    `;
    elStats.appendChild(stat);
  }
}

function renderLog() {
  const items = state.history ?? [];
  if (!items.length) {
    elLog.innerHTML = `Make choices to survive. Dynasty mode includes successions; Reign mode is a single life.`;
    return;
  }
  const parts = items
    .slice(0, 8)
    .map((h) => {
      const t = `${["Spring", "Summer", "Autumn", "Winter"][h.at.seasonIndex]} ${h.at.year}`;
      const evTitle = events.find((e) => e.id === h.eventId)?.title ?? h.eventId;
      const deltas = formatDeltaList(h.delta ?? {});
      const luckNote = h.luck ? ` (Luck ${h.luck.total} vs ${h.luck.difficulty})` : "";
      return `<div class="log__item"><div class="log__time">${t}</div><div>${escapeHtml(evTitle)} - ${escapeHtml(deltas)}${escapeHtml(luckNote)}</div></div>`;
    })
    .join("");
  elLog.innerHTML = parts;
}

function renderCard() {
  if (!currentEvent) {
    elCardId.textContent = "";
    elCardTags.innerHTML = "";
    elTitle.textContent = "No eligible events";
    elText.textContent = "Your state excludes all events. Add more events or relax conditions.";
    elChoices.innerHTML = "";
    if (elAdvisorLine) elAdvisorLine.textContent = "-";
    return;
  }

  const scene = sceneForEvent(currentEvent);
  if (elCardArtIcon) elCardArtIcon.textContent = scene.icon;
  if (elCardArtLabel) elCardArtLabel.textContent = scene.label;

  elCardId.textContent = currentEvent.id ? `#${currentEvent.id}` : "";
  elCardTags.innerHTML = (currentEvent.tags ?? []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  elTitle.textContent = currentEvent.title ?? "An Event";
  elText.textContent = currentEvent.text ?? "";
  if (elAdvisorLine) elAdvisorLine.textContent = advisorLineFor(currentEvent);
  elChoices.innerHTML = "";

  (currentEvent.choices ?? []).forEach((ch, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.innerHTML = `
      <div class="choice__label">${escapeHtml(ch.label ?? `Choice ${idx + 1}`)}</div>
      <div class="choice__preview">${escapeHtml(previewDelta(ch.delta ?? {}))}</div>
    `;
    btn.addEventListener("click", () => onChoose(idx));
    elChoices.appendChild(btn);
  });
}

function sceneForEvent(ev) {
  const tags = ev?.tags ?? [];
  const has = (t) => tags.includes(t);
  if (has("plague")) return { icon: "☠", label: "Pestilence" };
  if (has("revolt")) return { icon: "⚑", label: "Unrest" };
  if (has("war")) return { icon: "⚔", label: "War" };
  if (has("church")) return { icon: "✠", label: "Faith" };
  if (has("economy")) return { icon: "⟠", label: "Trade" };
  if (has("law")) return { icon: "⚖", label: "Law" };
  return { icon: "♜", label: "Court" };
}

function previewDelta(delta) {
  return formatDeltaList(delta);
}

function showIntro() {
  if (!dlgIntro) return;
  if (!dlgIntro.open) dlgIntro.showModal();
  sfxOpen();
}

function maybeShowIntro() {
  if (!state.tags?.includes("intro_seen")) {
    state.tags ??= [];
    state.tags.push("intro_seen");
    writeSave(state);
    showIntro();
  }
}

function renderDate() {
  const modeLabel = state.mode === MODES.REIGN ? "Reign" : "Dynasty";
  elDate.textContent = `${formatDate(state)} · ${modeLabel} · Legacy ${Math.round(state.crown.legacy ?? 0)}`;
}

function showEnding(ending) {
  elEndingTitle.textContent = ending.title ?? "The End";
  elEndingBody.textContent = ending.body ?? "";
  if (!dlgEnding.open) dlgEnding.showModal();
  if (ending.type === "win") sfxGood();
  if (ending.type === "lose") sfxBad();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setActiveModeButtons() {
  btnModeReign.dataset.active = state.mode === MODES.REIGN ? "true" : "false";
  btnModeDynasty.dataset.active = state.mode === MODES.DYNASTY ? "true" : "false";
}

function step() {
  const ending = checkEnding(state);
  if (ending) {
    // Bank some Legacy for permanent upgrades.
    // Simple rule: half of earned Legacy is banked at end of run.
    try {
      meta = loadMeta();
      const earned = Math.max(0, Math.round(Number(state.crown.legacy ?? 0)));
      const add = Math.max(0, Math.floor(earned * 0.5));
      meta.legacyBank = Math.max(0, Math.round(Number(meta.legacyBank ?? 0))) + add;
      writeMeta(meta);
    } catch {
      // ignore
    }
    writeSave(state);
    showEnding(ending);
    return;
  }

  currentEvent = pickNextEvent(state, events);
  renderDate();
  renderStats();
  renderCard();
  renderLog();
  writeSave(state);
}

function onChoose(choiceIndex) {
  unlockAudio();
  sfxChoice();
  const res = applyChoice(state, currentEvent, choiceIndex);
  if (!res.ok) return;

  if (currentEvent?.id === "economy_ship_investment" && res.luckResult && res.luckResult.success === false) {
    sfxSplashFail();
  }

  if (res.succession?.type === "gameover") {
    sfxBad();
    showEnding({ type: "lose", title: res.succession.title, body: res.succession.body });
    return;
  }
  if (res.succession?.type === "succession") {
    // Keep play flowing; you can add a dedicated succession event later if desired.
  }

  step();
}

async function loadEvents() {
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H1',location:'src/main.js:loadEvents',message:'Loading events JSON',data:{url:'./data/events_england.json'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const res = await fetch("./data/events_england.json", { cache: "no-store" });
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H1',location:'src/main.js:loadEvents',message:'Events fetch response',data:{ok:res.ok,status:res.status,contentType:res.headers.get('content-type')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Events file must be an array.");
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H1',location:'src/main.js:loadEvents',message:'Events parsed',data:{count:data.length,firstId:data[0]?.id,lastId:data[data.length-1]?.id},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return data;
}

function startNew(mode) {
  state = newGame(mode, meta);
  setActiveModeButtons();
  if (dlgMenu.open) dlgMenu.close();
  // Show intro on a fresh run.
  showIntro();
  step();
}

function wireUi() {
  btnMenu.addEventListener("click", () => dlgMenu.showModal());
  btnNewGame.addEventListener("click", () => startNew(state.mode));
  btnRestart.addEventListener("click", () => {
    dlgEnding.close();
    startNew(state.mode);
  });

  btnModeReign.addEventListener("click", () => {
    state.mode = MODES.REIGN;
    state.endYear = 1400;
    setActiveModeButtons();
  });
  btnModeDynasty.addEventListener("click", () => {
    state.mode = MODES.DYNASTY;
    state.endYear = 1558;
    if (typeof state.crown.heirAge !== "number") state.crown.heirAge = 8;
    setActiveModeButtons();
  });

  function syncSoundBtn() {
    if (!btnSound) return;
    btnSound.textContent = `Sound: ${soundEnabled() ? "On" : "Off"}`;
  }
  syncSoundBtn();
  btnSound?.addEventListener("click", () => {
    unlockAudio();
    setSoundEnabled(!soundEnabled());
    syncSoundBtn();
    sfxOpen();
  });

  function syncMusicBtn() {
    if (!btnMusic) return;
    btnMusic.textContent = `Music: ${musicEnabled() ? "On" : "Off"}`;
  }
  syncMusicBtn();
  btnMusic?.addEventListener("click", () => {
    unlockAudio();
    setMusicEnabled(!musicEnabled());
    syncMusicBtn();
    if (musicEnabled()) startMusic();
    else stopMusic();
    sfxOpen();
  });

  function syncVolUi() {
    if (!elVol || !elVolLabel) return;
    const pct = Math.round(soundVolume() * 100);
    elVol.value = String(pct);
    elVolLabel.textContent = `${pct}%`;
  }
  syncVolUi();
  elVol?.addEventListener("input", () => {
    unlockAudio();
    const pct = Number(elVol.value ?? 60);
    setSoundVolume(Math.max(0, Math.min(1, pct / 100)));
    if (elVolLabel) elVolLabel.textContent = `${Math.round(soundVolume() * 100)}%`;
  });

  function renderUpgrades() {
    if (!elUpgrades || !elLegacyBank) return;
    elLegacyBank.textContent = String(meta.legacyBank ?? 0);
    elUpgrades.innerHTML = "";
    for (const u of UPGRADE_DEFS) {
      const owned = meta.upgrades?.[u.id] === true;
      const row = document.createElement("div");
      row.className = "upgrade";
      row.innerHTML = `
        <div class="upgrade__left">
          <div class="upgrade__name">${escapeHtml(u.name)}</div>
          <div class="upgrade__desc">${escapeHtml(u.desc)}</div>
          <div class="upgrade__meta">Cost ${u.cost} Legacy</div>
        </div>
        <div>
          <button class="button button--ghost upgrade__btn" type="button" ${owned ? "disabled" : ""}>
            ${owned ? "Owned" : "Buy"}
          </button>
        </div>
      `;
      const btn = row.querySelector("button");
      btn?.addEventListener("click", () => {
        unlockAudio();
        const bank = Number(meta.legacyBank ?? 0);
        if (bank < u.cost) {
          sfxBad();
          return;
        }
        meta.legacyBank = bank - u.cost;
        meta.upgrades ??= {};
        meta.upgrades[u.id] = true;
        writeMeta(meta);
        sfxGood();
        renderUpgrades();
      });
      elUpgrades.appendChild(row);
    }
  }
  renderUpgrades();

  btnExport.addEventListener("click", async () => {
    const text = exportSaveJson(state);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "kingdom-save.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  fileImport.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const imported = importSaveJson(text);
      const norm = normalizeState(imported);
      if (!norm) throw new Error("Invalid state.");
      state = norm;
      setActiveModeButtons();
      if (dlgMenu.open) dlgMenu.close();
      step();
    } catch (err) {
      showEnding({ type: "info", title: "Import failed", body: String(err?.message ?? err) });
    } finally {
      fileImport.value = "";
    }
  });

  btnBegin?.addEventListener("click", () => {
    unlockAudio();
    state = newGame(MODES.REIGN, meta);
    setActiveModeButtons();
    dlgIntro.close();
    step();
  });
  btnBeginDynasty?.addEventListener("click", () => {
    unlockAudio();
    state = newGame(MODES.DYNASTY, meta);
    setActiveModeButtons();
    dlgIntro.close();
    step();
  });
}

async function boot() {
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H2',location:'src/main.js:boot',message:'Boot start',data:{href:location.href},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  events = await loadEvents();
  meta = loadMeta();
  const saved = loadSave();
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H2',location:'src/main.js:boot',message:'Loaded save',data:{hasSaved:!!saved,mode:saved?.mode,year:saved?.year,seasonIndex:saved?.seasonIndex,statsKeys:Object.keys(saved?.stats||{})},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  state = saved ? normalizeState(saved) : null;
  if (!state) state = newGame(MODES.REIGN, meta);
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H3',location:'src/main.js:boot',message:'State ready',data:{mode:state.mode,year:state.year,seasonIndex:state.seasonIndex,statDisplay:statDisplay().map(s=>s.key),stats:state.stats},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  setActiveModeButtons();
  wireUi();
  maybeShowIntro();
  unlockAudio();
  if (musicEnabled() && soundEnabled()) startMusic();
  step();
}

boot().catch((err) => {
  // #region agent log
  fetch('http://127.0.0.1:7565/ingest/298c0227-b044-4508-839c-37f599eda128',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'42ef7a'},body:JSON.stringify({sessionId:'42ef7a',runId:'pre-fix',hypothesisId:'H4',location:'src/main.js:boot.catch',message:'Boot failed',data:{name:err?.name,message:String(err?.message??err),stack:String(err?.stack??'')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  elTitle.textContent = "Failed to start";
  elText.textContent =
    "If you opened the file directly, your browser may be blocking local JSON. Run the local server in README.md, then refresh. Error: " +
    String(err?.message ?? err);
  elChoices.innerHTML = "";
});

