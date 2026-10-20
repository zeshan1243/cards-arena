import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

// Backend-backed pages; redirected home while the site is bots-only.
const accountRoutes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage) },
  { path: 'statistics', canActivate: [authGuard], loadComponent: () => import('./pages/statistics/statistics').then((m) => m.StatisticsPage) },
  { path: 'history', canActivate: [authGuard], loadComponent: () => import('./pages/game-history/game-history').then((m) => m.GameHistoryPage) },
  { path: 'leaderboard', loadComponent: () => import('./pages/leaderboard/leaderboard').then((m) => m.LeaderboardPage) },
  { path: 'multiplayer', loadComponent: () => import('./pages/multiplayer/multiplayer').then((m) => m.MultiplayerPage) },
];

// Every page and game is lazy loaded (spec §101).
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
  { path: 'games', loadComponent: () => import('./pages/games/games').then((m) => m.GamesPage) },
  { path: 'games/:slug', loadComponent: () => import('./pages/game-detail/game-detail').then((m) => m.GameDetailPage) },
  {
    path: 'play/bhabhi-thulla',
    loadComponent: () => import('./games/bhabhi-thulla/bhabhi-thulla-game').then((m) => m.BhabhiThullaGame),
    title: 'Play Bhabhi Thulla – CardArena',
  },
  {
    path: 'play/solitaire',
    loadComponent: () => import('./games/solitaire/solitaire-game').then((m) => m.SolitaireGame),
    title: 'Play Solitaire – CardArena',
  },
  {
    path: 'play/:slug',
    loadComponent: () => import('./games/core/ui/table-game-page').then((m) => m.TableGamePage),
  },
  ...(environment.accountsEnabled ? accountRoutes : accountRoutes.map((r) => ({ path: r.path, redirectTo: '' }))),
  { path: 'settings', loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage) },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage) },
];
