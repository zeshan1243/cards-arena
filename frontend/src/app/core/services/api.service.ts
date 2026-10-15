import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Backend envelope (spec §72). */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string | number>): Observable<T> {
    return this.unwrap(this.http.get<ApiEnvelope<T>>(this.url(path), { params: new HttpParams({ fromObject: params ?? {} }), withCredentials: true }));
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.put<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private unwrap<T>(req: Observable<ApiEnvelope<T>>): Observable<T> {
    return req.pipe(
      map((res) => {
        if (!res.success) throw new ApiError(res.message ?? 'Request failed', 200);
        return res.data;
      }),
      catchError((err: unknown) => {
        if (err instanceof ApiError) return throwError(() => err);
        const http = err as HttpErrorResponse;
        const message =
          http.status === 0
            ? 'Cannot reach the server. Check your connection.'
            : (http.error?.message ?? (typeof http.error?.detail === 'string' ? http.error.detail : null) ?? 'Something went wrong. Please try again.');
        return throwError(() => new ApiError(message, http.status ?? 0));
      }),
    );
  }
}
