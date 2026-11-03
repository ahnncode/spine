/** Profile pictures: an icon on a color. Ten icons are free; ten unlock with badges. */

export interface AvatarColor {
  key: string;
  label: string;
  bg: string;
  fg: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { key: "ink", label: "Ink", bg: "#111111", fg: "#F7F7F5" },
  { key: "ember", label: "Ember", bg: "#FF5A1F", fg: "#111111" },
  { key: "cobalt", label: "Cobalt", bg: "#2D3FE0", fg: "#FFFFFF" },
  { key: "forest", label: "Forest", bg: "#3E6B48", fg: "#F4F0E6" },
  { key: "lagoon", label: "Lagoon", bg: "#0F5257", fg: "#E8F3F1" },
  { key: "plum", label: "Plum", bg: "#7A2E4D", fg: "#F7E7EE" },
  { key: "rust", label: "Rust", bg: "#B5452B", fg: "#FBEFE3" },
  { key: "honey", label: "Honey", bg: "#F2C14E", fg: "#111111" },
  { key: "navy", label: "Navy", bg: "#1F3A5F", fg: "#F2EBDD" },
  { key: "blush", label: "Blush", bg: "#F4C7C3", fg: "#4A1414" },
];

export interface AvatarIcon {
  key: string;
  label: string;
  /** Badge that unlocks it; free when absent. */
  unlock?: string;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { key: "book", label: "Open book" },
  { key: "moon", label: "Moon" },
  { key: "sun", label: "Sun" },
  { key: "leaf", label: "Leaf" },
  { key: "peaks", label: "Peaks" },
  { key: "wave", label: "Wave" },
  { key: "star", label: "Star" },
  { key: "mug", label: "Mug" },
  { key: "cat", label: "Cat" },
  { key: "specs", label: "Specs" },

  { key: "owl", label: "Owl", unlock: "shelf_starter" },
  { key: "fox", label: "Fox", unlock: "explorer" },
  { key: "flame", label: "Flame", unlock: "steady" },
  { key: "quill", label: "Quill", unlock: "critic" },
  { key: "lantern", label: "Lantern", unlock: "daily_pages" },
  { key: "whale", label: "Whale", unlock: "bookworm" },
  { key: "comet", label: "Comet", unlock: "decisive" },
  { key: "telescope", label: "Telescope", unlock: "time_traveler" },
  { key: "lighthouse", label: "Lighthouse", unlock: "connector" },
  { key: "crown", label: "Crown", unlock: "century" },
];

export const AVATAR_ICON: Record<string, AvatarIcon> = Object.fromEntries(AVATAR_ICONS.map((i) => [i.key, i]));
export const AVATAR_COLOR: Record<string, AvatarColor> = Object.fromEntries(AVATAR_COLORS.map((c) => [c.key, c]));

/** Whether an icon is available to someone with these badges. */
export function iconUnlocked(icon: string, earned: Set<string>): boolean {
  const def = AVATAR_ICON[icon];
  return Boolean(def) && (!def.unlock || earned.has(def.unlock));
}
