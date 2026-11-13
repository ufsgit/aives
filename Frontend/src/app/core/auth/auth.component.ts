import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DialogBox_Component } from '../../shared/components/DialogBox/DialogBox.component';
import { ObservablesService } from '../../shared/services/observables.service';
import { AuthService } from './auth.service';
import { SharedModule } from '../../shared/shared.module';
import { user_Service } from '../../admin/services/user.Service';

@Component({
    selector: 'app-auth',
    standalone: true,
    imports: [SharedModule],
    templateUrl: './auth.component.html',
    styleUrl: './auth.component.scss'
})
export class AuthComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  private authService_ = inject(AuthService);
  dialog = inject(MatDialog);
  private observable = inject(ObservablesService);
  private userService = inject(user_Service);

  
  loginForm: FormGroup;
  isLoading: boolean = false;
  forget_password_view: boolean = false;
  hidePassword: boolean = true;

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });

  }

  // Getter methods for easy access to form controls
  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }

  // New method to toggle password visibility
  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  async login() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      try {
        const usernameVal = (this.loginForm.value.username || '').trim();
        const passwordVal = (this.loginForm.value.password || '').trim();
        const payload = {
          username: usernameVal,
          Username: usernameVal,
          first_name: usernameVal,
          First_Name: usernameVal,
          email: usernameVal,
          Email: usernameVal,
          password: passwordVal,
          Password: passwordVal
        };
        const success = await this.authService_.login(payload);
        if (success) {
          const userObj = success[0] || {};
          const emailVal = userObj.Email || '';
          const nameVal = userObj.First_Name || '';
          const userIdVal = userObj.Id;
          const userTypeIdVal = userObj.User_Type_Id;

          localStorage.setItem("Email", emailVal);
          localStorage.setItem("Name", nameVal);
          localStorage.setItem("User_Id", userIdVal);
          this.observable.setData('Email', emailVal);
          this.observable.setData('Name', nameVal);
          localStorage.setItem("Access_Token", success['token']);
          localStorage.setItem("User_Type", userTypeIdVal);

          const isSuperAdmin = userIdVal == 1 || emailVal.toLowerCase() === 'admin_user@g.com' || emailVal.toLowerCase() === 'cs.mgr@testprepinenglish.com';

          // Dynamically route based on user's assigned permissions
          this.userService.Get_user_Menus(userIdVal).subscribe({
            next: (menuRes: any) => {
              const raw = Array.isArray(menuRes?.[0]) ? menuRes[0] : (Array.isArray(menuRes) ? menuRes : []);
              const allowedNames = raw.map((m: any) => m.Menu_Name?.trim());
              localStorage.setItem('Allowed_Menus', JSON.stringify(allowedNames));

              if (isSuperAdmin || allowedNames.includes('Dashboard')) {
                this.observable.setData('NavTitle', 'Dashboard');
                this.router.navigateByUrl('/admin/dash');
              } else if (raw.length > 0) {
                const firstItem = raw[0];
                let firstRoute = firstItem.Route || '';
                if (!firstRoute.startsWith('/')) {
                  firstRoute = `/admin/${firstRoute}`;
                }
                this.observable.setData('NavTitle', firstItem.Menu_Name);
                this.router.navigateByUrl(firstRoute);
              } else {
                this.observable.setData('NavTitle', 'Mark Attendance');
                this.router.navigateByUrl('/admin/Mark_Attendance');
              }
            },
            error: () => {
              if (isSuperAdmin) {
                this.observable.setData('NavTitle', 'Dashboard');
                this.router.navigateByUrl('/admin/dash');
              } else {
                this.router.navigateByUrl('/admin');
              }
            }
          });
        } else {
          this.showErrorDialog('Login failed. Please check your credentials.');
        }
      } catch (error) {
      } finally {
        this.isLoading = false;
      }
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  async Generate_forget_Password() {
    // if (this.email.valid) {
    //   let payload = {
    //     email: this.loginForm.value.email,
    //     userType: 1
    //   };
    //   this.isLoading = true;
    //   try {
    //     const success = await this.authService_.Generate_forget_Password(payload);
    //     if (success) {
    //       this.showSuccessDialog('Email Sent');
    //     } else {
    //       this.showErrorDialog('Failed to send email. Please try again.');
    //     }
    //   } catch (error) {
    //     this.showErrorDialog('An error occurred. Please try again.');
    //   } finally {
    //     this.isLoading = false;
    //   }
    // } else {
    //   this.showErrorDialog('Please enter a valid email address.');
    // }
  } 

  private showErrorDialog(message: string) {
    this.dialog.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: { Message: message, Type: "3" }
    });
  }

  private showSuccessDialog(message: string) {
    this.dialog.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: { Message: message, Type: "False" }
    });
  }
}
