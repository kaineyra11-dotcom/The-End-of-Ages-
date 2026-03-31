function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items, getWeight) {
  let total = 0;
  for (const it of items) total += Math.max(0, Number(getWeight(it) ?? 0));
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, Number(getWeight(it) ?? 0));
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

export const MODES = {
  REIGN: "reign",
  DYNASTY: "dynasty",
};

export const UPGRADE_DEFS = [
  {
    id: "fullGranaries",
    name: "Full Granaries",
    cost: 10,
    desc: "Start each run with +8 Populous.",
  },
  {
    id: "trustedSheriffs",
    name: "Trusted Sheriffs",
    cost: 10,
    desc: "Start each run with +8 Loyalty.",
  },
  {
    id: "warChest",
    name: "War Chest",
    cost: 10,
    desc: "Start each run with +8 Wealth.",
  },
  {
    id: "chaplains",
    name: "Royal Chaplains",
    cost: 10,
    desc: "Start each run with +8 Faith.",
  },
  {
    id: "standingGuard",
    name: "Standing Guard",
    cost: 10,
    desc: "Start each run with +8 Army.",
  },
  {
    id: "luckyCharms",
    name: "Lucky Charms",
    cost: 15,
    desc: "Luck is higher in every run (better odds on risky choices).",
  },
];

export function applyUpgradesToNewGame(state, meta) {
  const u = meta?.upgrades ?? {};
  const on = (id) => u[id] === true;

  if (on("fullGranaries")) state.stats.populous = clamp(state.stats.populous + 8, 0, 100);
  if (on("trustedSheriffs")) state.stats.loyalty = clamp(state.stats.loyalty + 8, 0, 100);
  if (on("warChest")) state.stats.wealth = clamp(state.stats.wealth + 8, 0, 100);
  if (on("chaplains")) state.stats.faith = clamp(state.stats.faith + 8, 0, 100);
  if (on("standingGuard")) state.stats.army = clamp(state.stats.army + 8, 0, 100);
  if (on("luckyCharms")) state.stats.luck = clamp(state.stats.luck + 12, 0, 100);
}

export function newGame(mode, meta = null) {
  const startYear = 1348;
  const endYear = mode === MODES.REIGN ? 1400 : 1558;
  const kingAge = randInt(18, 35);
  const heirAge = mode === MODES.DYNASTY ? randInt(0, 16) : null;

  const state = {
    version: 1,
    mode,
    year: startYear,
    seasonIndex: 1, // Summer 1348: plague arrives with trade routes
    startYear,
    endYear,
    crown: {
      monarchName: "The King",
      age: kingAge,
      reignYears: 0,
      heirAge,
      legacy: 0,
      deaths: 0,
    },
    tags: [],
    stats: {
      wealth: 55,
      populous: 55,
      loyalty: 55,
      faith: 55,
      army: 45,
      // hidden
      luck: randInt(35, 65),
    },
    history: [],
    lastEventId: null,
  };
  if (meta) applyUpgradesToNewGame(state, meta);
  return state;
}

export function normalizeState(state) {
  // Best-effort forward compatibility for saved games.
  if (!state || typeof state !== "object") return null;
  if (!state.stats || typeof state.stats !== "object") return null;
  state.tags ??= [];
  state.history ??= [];
  state.crown ??= { monarchName: "The King", age: 25, reignYears: 0, heirAge: null, legacy: 0, deaths: 0 };
  // Migrate old saves (best-effort).
  if (typeof state.stats.wealth !== "number") state.stats.wealth = Number(state.stats.gold ?? 55);
  if (typeof state.stats.populous !== "number") state.stats.populous = Number(state.stats.commons ?? 55);
  if (typeof state.stats.loyalty !== "number") state.stats.loyalty = Number(state.stats.nobles ?? 55);
  if (typeof state.stats.faith !== "number") state.stats.faith = Number(state.stats.clergy ?? 55);
  if (typeof state.stats.army !== "number") state.stats.army = 45;
  if (typeof state.stats.luck !== "number") state.stats.luck = randInt(35, 65);
  state.endYear ??= state.mode === MODES.REIGN ? 1400 : 1558;
  state.startYear ??= 1348;
  state.seasonIndex ??= 0;
  return state;
}

export function formatDate(state) {
  return `${SEASONS[state.seasonIndex]} ${state.year}`;
}

export function statDisplay() {
  return [
    { key: "wealth", label: "Wealth" },
    { key: "populous", label: "Populous" },
    { key: "loyalty", label: "Loyalty" },
    { key: "faith", label: "Faith" },
    { key: "army", label: "Army" },
  ];
}

function hasTags(state, required = []) {
  for (const t of required) if (!state.tags.includes(t)) return false;
  return true;
}

function hasAnyTag(state, any = []) {
  if (!any.length) return true;
  for (const t of any) if (state.tags.includes(t)) return true;
  return false;
}

function hasNoTags(state, forbidden = []) {
  for (const t of forbidden) if (state.tags.includes(t)) return false;
  return true;
}

function meetsStatReq(state, req) {
  if (!req) return true;
  for (const [k, v] of Object.entries(req)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (Number(state.stats[k] ?? 0) < n) return false;
  }
  return true;
}

function inYearRange(state, ev) {
  const minY = ev.minYear ?? state.startYear;
  const maxY = ev.maxYear ?? state.endYear;
  return state.year >= minY && state.year <= maxY;
}

function eligibleEvent(state, ev) {
  if (!ev || typeof ev !== "object") return false;
  if (ev.modes && Array.isArray(ev.modes) && !ev.modes.includes(state.mode)) return false;
  if (!inYearRange(state, ev)) return false;
  if (!hasTags(state, ev.requiresTags ?? [])) return false;
  if (!hasAnyTag(state, ev.anyTags ?? [])) return false;
  if (!hasNoTags(state, ev.forbidsTags ?? [])) return false;
  if (!meetsStatReq(state, ev.minStats ?? null)) return false;
  if (ev.unique && state.history.some((h) => h.eventId === ev.id)) return false;
  if (state.lastEventId && ev.noRepeatAfter && state.lastEventId === ev.id) return false;
  return true;
}

function eventWeight(state, ev) {
  let w = Number(ev.weight ?? 1);
  if (!Number.isFinite(w) || w <= 0) w = 1;

  // Make crises more likely when the realm is fragile.
  const pop = Number(state.stats.populous ?? 0);
  const loyal = Number(state.stats.loyalty ?? 0);
  if ((ev.tags ?? []).includes("crisis")) w *= 1 + clamp((55 - pop) / 90, 0, 0.8);
  if ((ev.tags ?? []).includes("plague")) w *= 1 + clamp((55 - pop) / 90, 0, 0.8);
  if ((ev.tags ?? []).includes("revolt")) w *= 1 + clamp((55 - loyal) / 90, 0, 0.9);

  // Slightly de-prioritize already-seen non-unique events.
  const seenCount = state.history.filter((h) => h.eventId === ev.id).length;
  if (seenCount > 0) w *= 1 / (1 + 0.35 * seenCount);

  return Math.max(0.01, w);
}

export function pickNextEvent(state, events) {
  const eligible = (events ?? []).filter((ev) => eligibleEvent(state, ev));
  if (!eligible.length) return null;
  return pickWeighted(eligible, (ev) => eventWeight(state, ev));
}

function applyStatDelta(state, delta) {
  if (!delta) return;
  for (const [k, v] of Object.entries(delta)) {
    const dv = Number(v);
    if (!Number.isFinite(dv)) continue;
    const cur = Number(state.stats[k] ?? 0);
    state.stats[k] = clamp(cur + dv, 0, 100);
  }
}

function addTags(state, tags = []) {
  for (const t of tags) {
    if (!state.tags.includes(t)) state.tags.push(t);
  }
}

function removeTags(state, tags = []) {
  if (!tags.length) return;
  state.tags = state.tags.filter((t) => !tags.includes(t));
}

function advanceTime(state) {
  state.seasonIndex += 1;
  if (state.seasonIndex >= SEASONS.length) {
    state.seasonIndex = 0;
    state.year += 1;
    state.crown.age += 1;
    state.crown.reignYears += 1;
    if (state.mode === MODES.DYNASTY && typeof state.crown.heirAge === "number") {
      state.crown.heirAge += 1;
    }
  }
}

function mortalityCheck(state) {
  if (state.mode !== MODES.DYNASTY) return null;
  const age = state.crown.age;
  const plague = state.tags.includes("plague_active") ? 1 : 0;

  // Only check once per year (after Winter advances to Spring).
  if (state.seasonIndex !== 0) return null;

  let risk = 0;
  if (age >= 40) risk += (age - 38) * 0.35;
  if (age >= 55) risk += (age - 54) * 0.7;
  // Low populous implies more disease/famine/instability risk.
  risk += clamp((55 - Number(state.stats.populous ?? 0)) / 3.0, 0, 18);
  risk += plague ? 6 : 0;
  risk = clamp(risk, 0, 35); // percent

  if (Math.random() * 100 > risk) return null;

  // death -> succession
  state.crown.deaths += 1;
  const heirAge = state.crown.heirAge;
  if (typeof heirAge === "number") {
    if (heirAge < 16) addTags(state, ["regency"]);
    state.crown.age = Math.max(16, heirAge);
    state.crown.reignYears = 0;
    state.crown.heirAge = randInt(0, 12); // next generation exists, not guaranteed adult
    return {
      type: "succession",
      title: "Succession",
      body:
        heirAge < 16
          ? "Your monarch dies. A child inherits; a regency council now rules in the Crown’s name."
          : "Your monarch dies. The heir takes the crown and swears to keep the realm intact.",
    };
  }

  return {
    type: "gameover",
    title: "Succession Crisis",
    body: "Your monarch dies without a clear heir. The great lords split the realm and the crown falls.",
  };
}

export function applyChoice(state, event, choiceIndex) {
  const choice = (event?.choices ?? [])[choiceIndex];
  if (!choice) return { ok: false, message: "Invalid choice." };

  const before = JSON.parse(JSON.stringify(state.stats));

  applyStatDelta(state, choice.delta ?? null);
  // Optional luck roll for risky choices.
  let luckResult = null;
  if (choice.luckRoll && typeof choice.luckRoll === "object") {
    const luck = clamp(Number(state.stats.luck ?? 50), 0, 100);
    const difficulty = clamp(Number(choice.luckRoll.difficulty ?? 50), 0, 100);
    const roll = randInt(1, 100);
    const bonus = Math.round((luck - 50) / 5); // -10..+10-ish
    const total = clamp(roll + bonus, 1, 100);
    const success = total >= difficulty;
    applyStatDelta(state, success ? choice.luckRoll.successDelta : choice.luckRoll.failDelta);
    luckResult = { roll, bonus, total, difficulty, success };
  }
  if (typeof choice.legacy === "number") state.crown.legacy += choice.legacy;
  addTags(state, choice.addTags ?? []);
  removeTags(state, choice.removeTags ?? []);

  const logDelta = {};
  for (const k of Object.keys(before)) {
    const d = Number(state.stats[k]) - Number(before[k]);
    if (Math.abs(d) >= 1e-9) logDelta[k] = d;
  }

  state.history.unshift({
    at: { year: state.year, seasonIndex: state.seasonIndex },
    eventId: event.id,
    choiceIndex,
    delta: logDelta,
    luck: luckResult,
  });
  state.history = state.history.slice(0, 18);
  state.lastEventId = event.id;

  advanceTime(state);

  const succession = mortalityCheck(state);
  return { ok: true, choice, succession, luckResult };
}

export function checkEnding(state) {
  const s = state.stats;
  const loseIfZero = [
    { key: "wealth", title: "Bankruptcy", body: "The treasury collapses. Credit dries up, garrisons go unpaid, and the crown is overthrown." },
    { key: "loyalty", title: "Betrayal", body: "Those who once swore fealty no longer obey. Factions rise, and the crown is cast down." },
    { key: "faith", title: "Spiritual Crisis", body: "Pulpits turn against you. Oaths fray, legitimacy cracks, and rivals move openly." },
    { key: "populous", title: "Collapse of the People", body: "Death, flight, and hunger empty the land. Without hands to work and mouths to support the realm, the crown fails." },
    { key: "army", title: "Defenseless Realm", body: "Your forces cannot hold the roads or the borders. Enemies and brigands carve the realm apart." },
  ];
  for (const it of loseIfZero) {
    if (Number(s[it.key] ?? 0) <= 0) return { type: "lose", ...it };
  }

  if (state.year > state.endYear || (state.year === state.endYear && state.seasonIndex === 3)) {
    const legacy = Number(state.crown.legacy ?? 0);
    const title = legacy >= 40 ? "A Great King" : legacy >= 10 ? "A Surviving Crown" : "A Narrow Escape";
    const body =
      legacy >= 40
        ? "Against plague, faction, and the long erosion of custom, you kept the realm standing to the edge of a new age. Chroniclers call you great."
        : legacy >= 10
          ? "You kept the realm intact long enough for history to turn. You may not be loved, but you endured."
          : "You lasted to the end of the era, but only just. The kingdom survives, scarred, resentful, and changed.";
    return { type: "win", title, body };
  }

  if (state.mode === MODES.REIGN) {
    // Keep the single-reign mode grounded: death ends the run.
    const age = Number(state.crown.age ?? 0);
    if (age >= 70) {
      return { type: "lose", title: "Death of the King", body: "Time takes its due. Your reign ends before the age turns." };
    }
  }

  return null;
}

