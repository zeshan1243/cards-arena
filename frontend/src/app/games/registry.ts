import { GameDefinition } from './core/table-game';

/**
 * Lazily loaded definitions for every game played on the shared table
 * (`/play/:slug`). Bhabhi Thulla has its own dedicated screen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_DEFINITIONS: Record<string, () => Promise<GameDefinition<any>>> = {
  'court-piece': () => import('./court-piece/court-piece.definition').then((m) => m.definition),
  'hokm': () => import('./hokm/hokm.definition').then((m) => m.definition),
  '29': () => import('./twenty-nine/twenty-nine.definition').then((m) => m.definition),
  'seep': () => import('./seep/seep.definition').then((m) => m.definition),
  'call-break': () => import('./call-break/call-break.definition').then((m) => m.definition),
  'tarneeb': () => import('./tarneeb/tarneeb.definition').then((m) => m.definition),
  'baloot': () => import('./baloot/baloot.definition').then((m) => m.definition),
  'spades': () => import('./spades/spades.definition').then((m) => m.definition),
  'hearts': () => import('./hearts/hearts.definition').then((m) => m.definition),
  'thirteen': () => import('./thirteen/thirteen.definition').then((m) => m.definition),
};
