import { SearchRequest, search } from './chess.engine';

/** Runs the computer's search off the main thread so the board stays responsive. */
const ctx = self as unknown as { onmessage: ((e: MessageEvent<SearchRequest & { id: number }>) => void) | null; postMessage(data: unknown): void };
ctx.onmessage = (e) => ctx.postMessage({ id: e.data.id, move: search(e.data) });
