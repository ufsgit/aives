

import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, RouterStateSnapshot, CanActivateFn, Router } from "@angular/router";

@Injectable({
  providedIn: 'root'
})
class PermissionsService {
  private router = inject(Router);


  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const url = state.url;

    if (url.includes('auth/forget-password')) {
     localStorage.clear()
      return true; 
    }
    if (localStorage['Access_Token']) {
      const userType = Number(localStorage['User_Type']);
      if (userType === 1 || userType === 2 || userType === 3) {
        const staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
        const userEmail = (localStorage.getItem('Email') || '').toLowerCase().trim();
        const isSuperAdmin = staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';

        const allowedMenus: string[] = JSON.parse(localStorage.getItem('Allowed_Menus') || '[]');

        if (isSuperAdmin || allowedMenus.includes('Dashboard')) {
          this.router.navigateByUrl('/admin/dash');
          return false;
        }
        if (allowedMenus.includes('Lead')) {
          this.router.navigateByUrl('/admin/Student_Lead');
          return false;
        }
        if (allowedMenus.includes('Student')) {
          this.router.navigateByUrl('/admin/student');
          return false;
        }
        if (allowedMenus.includes('Attendance') || allowedMenus.includes('Mark Attendance')) {
          this.router.navigateByUrl('/admin/Mark_Attendance');
          return false;
        }
        this.router.navigateByUrl('/admin');
        return false;
      } else {
        this.router.navigateByUrl('/auth');
        return false;
      }
    }
      
    
    else {
      return true;

    }
  }   
}

export const assignGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {

  return inject(PermissionsService).canActivate(next, state);
}