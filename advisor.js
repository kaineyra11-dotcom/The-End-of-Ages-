function randOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FALLBACK = [
  "Remember, the realm is a ladder. If any rung breaks, everything beneath it screams.",
  "If the people grow bold, you will grow short.",
  "Custom is older than coin. But coin has sharper teeth.",
];

const BY_TAG = {
  plague: [
    "The pestilence is a hungry guest. Feed it nothing you can’t afford to lose.",
    "A dead tenant pays no dues, but a living one demands wages. Choose which pain you prefer.",
    "Pray, sire, but also count the coffins.",
  ],
  revolt: [
    "They call it grievance; I call it rehearsal for treason.",
    "Mercy is cheaper than a civil war, until it is not.",
    "If you yield today, you will be asked to yield tomorrow, and the day after that.",
  ],
  war: [
    "Knights are loyal until their purse feels light.",
    "A levy is tradition. A paid army is… effective. Also expensive.",
  ],
  church: [
    "The faithful bless crowns and curse them. Try to stay on the blessed side.",
    "Faith binds oaths tighter than iron, until doubt spreads.",
  ],
  economy: [
    "Trade brings silver, and silver brings questions.",
    "Coin loosens obligations. Obligations keep the world in its place.",
  ],
  law: [
    "Order is written, sealed, and obeyed, or it is merely wished for.",
    "Royal justice is admired from afar and hated up close.",
  ],
};

export function advisorLineFor(event) {
  const tags = event?.tags ?? [];
  for (const t of tags) {
    const lines = BY_TAG[t];
    if (lines?.length) return randOf(lines);
  }
  return randOf(FALLBACK);
}

