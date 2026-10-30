import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { SharedModule } from '../shared.module';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../components/DialogBox/DialogBox.component';
import { user_Service } from '../../admin/services/user.Service';

@Component({
    selector: 'app-deactivate-account',
    standalone: true,
    imports: [SharedModule],
    animations: [
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('300ms', style({ opacity: 1 })),
            ]),
            transition(':leave', [
                animate('300ms', style({ opacity: 0 })),
            ]),
        ]),
    ],
    templateUrl: './deactivate-account.component.html',
    styleUrl: './deactivate-account.component.scss'
})
export class DeactivateAccountComponent {
  private fb = inject(FormBuilder);
  dialogBox = inject(MatDialog);
  user_Service_ = inject(user_Service);

  deactivationForm: FormGroup;
  constructor() {
    this.deactivationForm = this.fb.group({
      mobileNumber: ['', [Validators.required, Validators.pattern("^[0-9]{10}$")]],
      reason: ['', Validators.required],
      termsAccepted: [false, Validators.requiredTrue]
    });
  }

  onSubmit() {
    if (this.deactivationForm.valid) {
      console.log('Form submitted', this.deactivationForm.value);
      this.user_Service_.deactivate_Account(this.deactivationForm.value).subscribe(res=>{

        const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Delete Request Sent', Type: 'false' } });
        this.deactivationForm.reset()
      })

      } else {
      // Mark all fields as touched to trigger validation display
      Object.values(this.deactivationForm.controls).forEach(control => {
        control.markAsTouched();
      });
    }
  }
}
