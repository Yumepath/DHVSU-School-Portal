import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { Role } from './core/database';

const requireRole: CanActivateFn = async route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  if (auth.recovery()) return router.createUrlTree(['/reset-password']);
  const profile = auth.profile();
  if (!profile) return router.createUrlTree(['/sign-in']);
  if (route.data['role'] && profile.role !== route.data['role']) {
    return router.createUrlTree(['/portal', profile.role, 'overview']);
  }
  return true;
};

const enter: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  const profile = auth.profile();
  return auth.recovery() ? router.createUrlTree(['/reset-password'])
    : profile ? router.createUrlTree(['/portal', profile.role, 'overview']) : true;
};

const roleRoute = (role: Role, loadComponent: NonNullable<Routes[number]['loadComponent']>): Routes[number] => ({
  path: role + '/:view', data: { role }, canActivate: [requireRole], loadComponent,
});

export const routes: Routes = [
  { path: 'sign-in', canActivate: [enter], loadComponent: () => import('./login/login.page').then(m => m.LoginPage) },
  { path: 'reset-password', loadComponent: () => import('./login/login.page').then(m => m.LoginPage) },
  {
    path: 'portal',
    canActivate: [requireRole],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      roleRoute('student', () => import('./student/student.page').then(m => m.StudentPage)),
      roleRoute('faculty', () => import('./faculty/faculty.page').then(m => m.FacultyPage)),
      roleRoute('admin', () => import('./admin/admin.page').then(m => m.AdminPage)),
      { path: '**', redirectTo: '/sign-in' },
    ],
  },
  { path: 'dashboard', redirectTo: 'sign-in' },
  { path: '**', redirectTo: 'sign-in' },
];
