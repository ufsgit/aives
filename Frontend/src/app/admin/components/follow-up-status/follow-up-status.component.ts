import { Component, OnInit, inject } from '@angular/core';
import { student_Service } from '../../services/student.Service';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { SharedModule } from '../../../shared/shared.module';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';

@Component({
  selector: 'app-follow-up-status',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './follow-up-status.component.html',
  styleUrl: './follow-up-status.component.scss'
})
export class FollowUpStatusComponent implements OnInit {
  private studentService = inject(student_Service);
  private dialogBox = inject(MatDialog);
  private route = inject(ActivatedRoute);

  statusList: any[] = [];
  filteredStatusList: any[] = [];
  isLoading: boolean = false;
  save_status_form: boolean = false;
  selectedStatusID: number = 0;
  searchQuery: string = '';
  noResults: boolean = false;

  // Form Fields
  statusName: string = '';
  statusColor: string = '#6B7280';
  description: string = '';
  displayOrder: number = 0;
  isActive: boolean = true;

  // Permissions
  isEdit: boolean = true;
  isSave: boolean = true;
  isDelete: boolean = true;

  ngOnInit() {
    this.getStatusList();

    this.route.queryParams.subscribe(params => {
      if (params['item']) {
        const receivedItem = JSON.parse(params['item']);
        this.isEdit = receivedItem?.IsEdit ?? true;
        this.isSave = receivedItem?.IsSave ?? true;
        this.isDelete = receivedItem?.IsDelete ?? true;
      }
    });
  }

  getStatusList() {
    this.isLoading = true;
    this.studentService.Get_Followup_Status().subscribe({
      next: (res) => {
        this.statusList = res;
        this.filteredStatusList = res;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching status list:', err);
        this.isLoading = false;
      }
    });
  }

  addStatus() {
    this.save_status_form = true;
    this.resetForm();
  }

  editStatus(status: any) {
    this.save_status_form = true;
    this.selectedStatusID = status.Status_Id;
    this.statusName = status.Status_Name;
    this.description = status.Description;
    this.isActive = !!status.Is_Active;
    // Keep internal values for API if needed, or use defaults
    this.statusColor = status.Status_Color || '#6B7280';
    this.displayOrder = status.Display_Order || 0;
  }

  saveStatus(form: NgForm) {
    const payload = {
      Status_Id: this.selectedStatusID,
      Status_Name: this.statusName,
      Status_Color: this.statusColor,
      Description: this.description,
      Display_Order: this.displayOrder,
      Is_Active: this.isActive ? 1 : 0
    };

    this.studentService.Save_Followup_Status(payload).subscribe({
      next: (res) => {
        this.getStatusList();
        this.cancelEdit();
        form.resetForm();
      },
      error: (err) => {
        console.error('Error saving status:', err);
      }
    });
  }

  deleteStatus(status: any) {
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Do you want to delete this status?',
        Type: true,
        Heading: 'Confirm Deletion',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'Yes') {
        this.studentService.Delete_Followup_Status(status.Status_Id).subscribe({
          next: () => {
            this.getStatusList();
          },
          error: (err) => {
            console.error('Error deleting status:', err);
          }
        });
      }
    });
  }

  cancelEdit() {
    this.save_status_form = false;
    this.selectedStatusID = 0;
    this.resetForm();
  }

  resetForm() {
    this.statusName = '';
    this.statusColor = '#6B7280';
    this.description = '';
    this.displayOrder = 0;
    this.isActive = true;
  }

  filterStatus() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredStatusList = this.statusList;
      this.noResults = false;
      return;
    }
    this.filteredStatusList = this.statusList.filter(item =>
      item.Status_Name.toLowerCase().includes(query) ||
      (item.Description && item.Description.toLowerCase().includes(query))
    );
    this.noResults = this.filteredStatusList.length === 0;
  }
}
