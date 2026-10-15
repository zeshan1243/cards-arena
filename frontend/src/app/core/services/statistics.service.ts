import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FinishSessionResponse, GameHistoryEntry, LeaderboardEntry, UserStatistics } from '../../shared/models/user.model';
import { ApiService } from './api.service';

/** The client reports what happened; the server replays it to decide results. */
export interface FinishSessionPayload {
  seed: number;
  seats: { id: string; name: string; isBot: boolean }[];
  selfSeatId: string;
  /** Bhabhi Thulla */
  variant?: string;
  moves?: { playerId: string; cardId: string }[];
  /** All other table games */
  settings?: Record<string, number | string>;
  actions?: { playerId: string; action: object }[];
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly api = inject(ApiService);

  startSession(gameSlug: string, mode: 'ai' | 'multiplayer', settings: object): Observable<{ id: string }> {
    return this.api.post<{ id: string }>('/sessions', { gameSlug, mode, settings });
  }

  finishSession(sessionId: string, payload: FinishSessionPayload): Observable<FinishSessionResponse> {
    return this.api.post<FinishSessionResponse>(`/sessions/${sessionId}/finish`, payload);
  }

  leaveSession(sessionId: string): Observable<unknown> {
    return this.api.post(`/sessions/${sessionId}/leave`);
  }

  myStatistics(): Observable<UserStatistics> {
    return this.api.get<UserStatistics>('/statistics/me');
  }

  userStatistics(username: string): Observable<UserStatistics> {
    return this.api.get<UserStatistics>(`/users/${encodeURIComponent(username)}/statistics`);
  }

  history(limit = 25): Observable<GameHistoryEntry[]> {
    return this.api.get<GameHistoryEntry[]>('/statistics/me/history', { limit });
  }

  leaderboard(period: 'daily' | 'weekly' | 'monthly' | 'all', game?: string): Observable<LeaderboardEntry[]> {
    return this.api.get<LeaderboardEntry[]>('/leaderboard', game ? { period, game } : { period });
  }
}
