

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