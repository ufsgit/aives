import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-leave',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './leave.component.html',
  styleUrl: './leave.component.scss'
})
export class LeaveComponent implements OnInit {
  leaveList: any[] = [];
  leaveForm: FormGroup;
  view: string = 'list';
  isLoading: boolean = false;
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  constructor() {
    this.leaveForm = this.fb.group({
      Leave_Id: [0],
      User_Id: [localStorage.getItem('User_ID') || 0, Validators.required],
      From_Date: ['', Validators.required],
      To_Date: ['', Validators.required],
      Reason: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadLeaves();
  }

  loadLeaves(): void {
    this.isLoading = true;
    const userId = localStorage.getItem('User_ID') || 0;
    this.http.get(`${environment.BasePath}user/Get_Leaves/${userId}`).subscribe({
      next: (res: any) => {
        this.leaveList = res[0] || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  createNew(): void {
    this.leaveForm.reset({
      Leave_Id: 0,
      User_Id: localStorage.getItem('User_ID') || 0,
      From_Date: '',
      To_Date: '',
      Reason: ''
    });
    this.view = 'edit';
  }

  closeClick(): void {
    this.view = 'list';
  }

  saveLeave(): void {
    if (this.leaveForm.invalid) return;
    this.isLoading = true;
    this.http.post(`${environment.BasePath}user/Save_Leave`, this.leaveForm.value).subscribe({
      next: () => {
        this.loadLeaves();
        this.view = 'list';
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  deleteLeave(leaveId: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this leave application!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.http.get(`${environment.BasePath}user/Delete_Leave/${leaveId}`).subscribe({
          next: () => {
            this.loadLeaves();
            Swal.fire(
              'Deleted!',
              'Your leave application has been deleted.',
              'success'
            );
          },
          error: (err) => {
            console.error(err);
            this.isLoading = false;
            Swal.fire(
              'Error!',
              'Failed to delete leave application.',
              'error'
            );
          }
        });
      }
    });
  }
}
