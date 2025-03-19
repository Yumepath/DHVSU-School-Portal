import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./home/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'subjects',
    loadComponent: () => import('./home/subjects/subjects.page').then((m) => m.SubjectsPage),
  },
   {
    path: 'grades',
    loadComponent: () => import('./home/grades/grades.page').then( m => m.GradesPage)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
