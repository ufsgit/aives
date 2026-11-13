import { inject } from '@angular/core';
import { Routes, Router, CanActivateChildFn } from '@angular/router';
import { assignGuard } from './core/guards/assign.guard';
import { AuthGuard } from './core/guards/auth.guard';
import { AuthComponent } from './core/auth/auth.component';
import { DeactivateAccountComponent } from './shared/deactivate-account/deactivate-account.component';
import { ViewPermissionsComponent } from './admin/components/view-permissions/view-permissions.component';

export const permissionRouteGuard: CanActivateChildFn = (childRoute, state) => {
  const router = inject(Router);
  const staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
  const userEmail = (localStorage.getItem('Email') || '').toLowerCase().trim();
  const isSuperAdmin = staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';

  if (isSuperAdmin) {
    return true;
  }

  const allowedMenus: string[] = JSON.parse(localStorage.getItem('Allowed_Menus') || '[]');
  const url = state.url.toLowerCase();

  // If user has not loaded menus yet, allow navigation so components can load
  if (allowedMenus.length === 0) {
    return true;
  }

  // Check matching permission for common modules
  const isAttendance = url.includes('attendance');
  const isLead = url.includes('student_lead') || url.includes('/lead');
  const isStudent = (url.includes('/student') || url.includes('studentlist')) && !url.includes('student_lead');
  const isCourse = url.includes('course');
  const isExpenses = url.includes('expense');
  const isIncome = url.includes('income');
  const isStaff = url.includes('faculty') || url.includes('staff');
  const isDash = url.includes('dash');

  if (isAttendance && (allowedMenus.includes('Attendance') || allowedMenus.includes('Mark Attendance'))) {
    return true;
  }
  if (isLead && allowedMenus.includes('Lead')) {
    return true;
  }
  if (isStudent && allowedMenus.includes('Student')) {
    return true;
  }
  if (isCourse && allowedMenus.includes('Course')) {
    return true;
  }
  if (isExpenses && (allowedMenus.includes('Expenses') || allowedMenus.includes('Expense Category') || allowedMenus.includes('Expense Type'))) {
    return true;
  }
  if (isIncome && allowedMenus.includes('Income')) {
    return true;
  }
  if (isStaff && allowedMenus.includes('Staff')) {
    return true;
  }
  if (isDash && allowedMenus.includes('Dashboard')) {
    return true;
  }

  const hasMatchingPermission = allowedMenus.some(menu => {
    const cleanMenu = menu.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanMenu.length > 2 && url.replace(/[^a-z0-9]/g, '').includes(cleanMenu);
  });

  if (hasMatchingPermission) {
    return true;
  }

  // Redirect to first permitted route
  if (allowedMenus.includes('Lead')) {
    router.navigateByUrl('/admin/Student_Lead');
  } else if (allowedMenus.includes('Student')) {
    router.navigateByUrl('/admin/student');
  } else if (allowedMenus.includes('Attendance') || allowedMenus.includes('Mark Attendance')) {
    router.navigateByUrl('/admin/Mark_Attendance');
  } else {
    router.navigateByUrl('/admin/Mark_Attendance');
  }
  return false;
};

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
        canActivateChild: [permissionRouteGuard],
      },
      {
        path: 'teacher',
        loadChildren: () => import('./teacher/teacher.routes').then(m => m.TEACHER_ROUTES)
      }
]; 
