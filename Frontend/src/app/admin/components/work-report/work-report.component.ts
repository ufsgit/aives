import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { student_Service } from '../../services/student.Service';

@Component({
  selector: 'app-work-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-report.component.html',
  styleUrl: './work-report.component.scss',
})
export class WorkReportComponent implements OnInit {
  private userService = inject(user_Service);
  private studentService = inject(student_Service);

  summaryRows: any[] = [];
  detailRows: any[] = [];
  departments: any[] = [];

  fromDate = '';
  toDate = '';
  useCreatedDate = true;
  useEntryDate = true;

  searchBy = 'name';
  searchTerm = '';
  selectedDepartmentId: number | null = null;

  isLoadingSummary = false;
  isLoadingDetails = false;
  selectedStaff: { User_ID: number; Staff_Name: string } | null = null;

  ngOnInit(): void {
    const today = this.getToday();
    this.fromDate = today;
    this.toDate = today;
    this.loadDepartments();
    this.loadSummary();
  }

  get isDetailView(): boolean {
    return !!this.selectedStaff;
  }

  loadDepartments(): void {
    this.studentService.Department_Dropdown().subscribe({
      next: (response: any) => {
        this.departments = Array.isArray(response?.[0]) ? response[0] : response || [];
      },
      error: () => {
        this.departments = [];
      },
    });
  }

  loadSummary(): void {
    this.isLoadingSummary = true;
    this.userService
      .Get_Work_Report_Summary({
        fromDate: this.useCreatedDate ? this.fromDate : '',
        toDate: this.useCreatedDate ? this.toDate : '',
        useCreatedDate: this.useCreatedDate,
      })
      .subscribe({
        next: (rows: any[]) => {
          this.summaryRows = (rows || []).map((row, index) => ({
            ...row,
            rowNo: index + 1,
          }));
          this.isLoadingSummary = false;
        },
        error: () => {
          this.summaryRows = [];
          this.isLoadingSummary = false;
        },
      });
  }

  openDetails(staff: any): void {
    this.selectedStaff = {
      User_ID: staff.User_ID,
      Staff_Name: staff.Staff_Name,
    };
    this.loadDetails();
  }

  loadDetails(): void {
    if (!this.selectedStaff) {
      return;
    }

    this.isLoadingDetails = true;
    this.userService
      .Get_Work_Report_Details({
        staffId: this.selectedStaff.User_ID,
        fromDate: this.useEntryDate ? this.fromDate : '',
        toDate: this.useEntryDate ? this.toDate : '',
        useCreatedDate: this.useEntryDate,
        departmentId: this.selectedDepartmentId,
        searchBy: this.searchBy,
        searchTerm: this.searchTerm,
      })
      .subscribe({
        next: (rows: any[]) => {
          this.detailRows = (rows || []).map((row, index) => ({
            ...row,
            rowNo: index + 1,
          }));
          this.isLoadingDetails = false;
        },
        error: () => {
          this.detailRows = [];
          this.isLoadingDetails = false;
        },
      });
  }

  backToSummary(): void {
    this.selectedStaff = null;
    this.detailRows = [];
    this.searchBy = 'name';
    this.searchTerm = '';
    this.selectedDepartmentId = null;
    this.useEntryDate = true;
  }

  applySummaryFilters(): void {
    this.loadSummary();
  }

  applyDetailFilters(): void {
    this.loadDetails();
  }

  onDateRangeChanged(): void {
    if (this.toDate && this.fromDate && this.toDate < this.fromDate) {
      this.toDate = this.fromDate;
    }

    if (this.isDetailView) {
      this.loadDetails();
    } else {
      this.loadSummary();
    }
  }

  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  formatDate(dateValue: string | null | undefined, withTime = false): string {
    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    const datePart = date.toLocaleDateString('en-GB').replace(/\//g, '-');
    if (!withTime) {
      return datePart;
    }

    const timePart = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return `${datePart} ${timePart}`;
  }
}
