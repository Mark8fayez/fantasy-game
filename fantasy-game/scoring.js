// =====================================================================
//  SCORING RULES — the heart of the game.
//  Change these numbers any time to re-balance your game.
// =====================================================================

const SCORING_RULES = {
  goal: 3,
  assist: 2,
  yellow_card: -1,
  red_card: -3,
  clean_sheet: 2,
};

// Friendly labels (used by the admin screen).
const EVENT_LABELS = {
  goal: "Goal (+3)",
  assist: "Assist (+2)",
  yellow_card: "Yellow card (-1)",
  red_card: "Red card (-3)",
  clean_sheet: "Clean sheet (+2)",
  manual: "Manual adjustment (custom)",
};

// Given an event type, return how many points it's worth.
// 'manual' uses whatever custom number the admin typed.
function pointsForEvent(eventType, customPoints = 0) {
  if (eventType === "manual") return Number(customPoints) || 0;
  return SCORING_RULES[eventType] ?? 0;
}

module.exports = { SCORING_RULES, EVENT_LABELS, pointsForEvent };
