import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/** Attaches the access token and transparently refreshes it once on a 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isAuthCall = /\/auth\/(login|register|refresh|logout)$/.test(req.url);

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (isAuthCall || !(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.accessToken()) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap((token) => (token ? next(withToken(req, token)) : throwError(() => err))),
      );
    }),
  );
};
