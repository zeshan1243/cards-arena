import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Keeps logged-in users away from login/register. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => (auth.isLoggedIn() ? router.createUrlTree(['/profile']) : true)),
  );
};
