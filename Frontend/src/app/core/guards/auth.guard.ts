import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, RouterStateSnapshot, CanActivateFn, Router } from "@angular/router";

@Injectable({
  providedIn: 'root'
})
class PermissionsService {
  private router = inject(Router);


  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const userType = Number(localStorage['User_Type']);
    if (localStorage['Access_Token'] && (userType === 1 || userType === 2 || userType === 3)) {
      return true;
    }
    else {
      this.router.navigateByUrl('/auth')
      return false;
    }
  }   
}

export const AuthGuard: CanActivateFn = (next: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean => {

  return inject(PermissionsService).canActivate(next, state);
}




