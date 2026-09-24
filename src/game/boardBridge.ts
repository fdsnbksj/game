import type { Slot } from '../sim/planning';

// What the React screen and the board scene need from each other outside the run store:
// the store holds game state, and these are layout facts and hit tests that change every
// frame or belong to one side's DOM. Each side registers its half; nothing here renders.

type InsetListener = (px: number) => void;

let bottomInset = 0;
const insetListeners = new Set<InsetListener>();

/** How many CSS pixels of the canvas the dock covers at the bottom. */
export function setBottomInset(px: number) {
  if (px === bottomInset) return;
  bottomInset = px;
  for (const listener of insetListeners) listener(px);
}

export const getBottomInset = () => bottomInset;

export function onInsetChange(listener: InsetListener): () => void {
  insetListeners.add(listener);
  return () => insetListeners.delete(listener);
}

let slotAt: ((clientX: number, clientY: number) => Slot | null) | null = null;

/** The scene answers which occupied slot is under a point on the screen. */
export function registerSlotAt(fn: typeof slotAt): () => void {
  slotAt = fn;
  return () => {
    if (slotAt === fn) slotAt = null;
  };
}

export const unitSlotAtClient = (clientX: number, clientY: number): Slot | null => slotAt?.(clientX, clientY) ?? null;

let sellZone: HTMLElement | null = null;

/** Where a unit can be dropped to sell it: the shop, while planning. */
export function registerSellZone(element: HTMLElement | null) {
  sellZone = element;
}

export function isOverSellZone(clientX: number, clientY: number): boolean {
  if (!sellZone) return false;
  const rect = sellZone.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
