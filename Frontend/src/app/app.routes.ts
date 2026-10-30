import { Routes } from '@angular/router';
import { assignGuard } from './core/guards/assign.guard';
import { AuthGuard } from './core/guards/auth.guard';
import { AuthComponent } from './core/auth/auth.component';
import { DeactivateAccountComponent } from './shared/deactivate-account/deactivate-account.component';
import { ViewPermissionsComponent } from './admin/components/view-permissions/view-permissions.component';

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "auth",
  },
  {
    path: "auth",
  component:AuthComponent,
  canActivate:[assignGuard]
  },
  {
    path: "Deactivate_Account",
  component:DeactivateAccountComponent,
  },
  {
    path: "view_permissions",
   component:ViewPermissionsComponent,canActivate: [AuthGuard],

  },

 
    {
        path: 'admin',
        loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
        canActivate: [AuthGuard],
      },
      {
        path: 'teacher',
        loadChildren: () => import('./teacher/teacher.routes').then(m => m.TEACHER_ROUTES)
      }
]; 
