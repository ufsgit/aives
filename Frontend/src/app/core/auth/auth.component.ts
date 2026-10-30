import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DialogBox_Component } from '../../shared/components/DialogBox/DialogBox.component';
import { ObservablesService } from '../../shared/services/observables.service';
import { AuthService } from './auth.service';
import { SharedModule } from '../../shared/shared.module';

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
          localStorage.setItem("Email", success[0].Email || '');
          localStorage.setItem("Name", success[0].First_Name || '');
          localStorage.setItem("User_Id", success[0].Id);
          this.observable.setData('NavTitle', 'Student');
          this.observable.setData('Email', localStorage.getItem('Email'));
          this.observable.setData('Name', localStorage.getItem('Name'));
          localStorage.setItem("Access_Token", success['token']);
          localStorage.setItem("User_Type", success[0].User_Type_Id);
          this.router.navigateByUrl("/admin");
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
