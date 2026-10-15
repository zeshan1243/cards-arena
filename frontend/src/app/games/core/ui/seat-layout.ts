export type SeatPosition = 'bottom' | 'left' | 'top-left' | 'top' | 'top-right' | 'right';

const LAYOUTS: Record<number, SeatPosition[]> = {
  1: ['top'],
  2: ['top-left', 'top-right'],
  3: ['left', 'top', 'right'],
  4: ['left', 'top-left', 'top-right', 'right'],
  5: ['left', 'top-left', 'top', 'top-right', 'right'],
};

/** Opponents are seated clockwise from the human at the bottom. */
export function seatPositions(opponentCount: number): SeatPosition[] {
  return LAYOUTS[opponentCount] ?? LAYOUTS[3];
}

/** Where a played card sits on the table relative to centre, in % of the trick area. */
export const TRICK_OFFSET: Record<SeatPosition, { x: number; y: number; r: number }> = {
  bottom: { x: 0, y: 24, r: 0 },
  left: { x: -34, y: 2, r: -8 },
  'top-left': { x: -20, y: -18, r: -14 },
  top: { x: 0, y: -20, r: 4 },
  'top-right': { x: 20, y: -18, r: 12 },
  right: { x: 34, y: 2, r: 9 },
};

/** Direction collected cards fly towards when someone picks up. */
export const COLLECT_OFFSET: Record<SeatPosition, { x: number; y: number }> = {
  bottom: { x: 0, y: 260 },
  left: { x: -320, y: 0 },
  'top-left': { x: -240, y: -200 },
  top: { x: 0, y: -240 },
  'top-right': { x: 240, y: -200 },
  right: { x: 320, y: 0 },
};
