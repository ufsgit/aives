import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { student_Service } from '../../services/student.Service';

@Component({
  selector: 'app-registration-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registration-summary.component.html',
  styleUrl: './registration-summary.component.scss'
})
export class RegistrationSummaryComponent implements OnInit {
  private studentService = inject(student_Service);
  private router = inject(Router);

  summaryRows: any[] = [];
  isLoading = false;

  fromDate = '';
  toDate = '';
  useCreatedDate = true;

  ngOnInit(): void {
    const today = this.getToday();
    this.fromDate = today;
    this.toDate = today;
    this.loadSummary();
  }

  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  loadSummary(): void {
    this.isLoading = true;
    const reqFrom = this.useCreatedDate ? this.fromDate : null;
    const reqTo = this.useCreatedDate ? this.toDate : null;
    this.studentService.Get_Registration_Summary(reqFrom, reqTo).subscribe({
      next: (rows: any[]) => {
        this.summaryRows = (rows || []).map((row, index) => ({
          ...row,
          rowNo: index + 1,
        }));
        this.isLoading = false;
      },
      error: () => {
        this.summaryRows = [];
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.loadSummary();
  }

  onDateRangeChanged(): void {
    if (this.toDate && this.fromDate && this.toDate < this.fromDate) {
      this.toDate = this.fromDate;
    }
    this.loadSummary();
  }

  viewDetails(row: any): void {
    this.router.navigate(['/admin/Registration_Report'], {
      queryParams: {
        fromDate: this.useCreatedDate ? this.fromDate : '',
        toDate: this.useCreatedDate ? this.toDate : '',
        enrolledById: row.Staff_ID
      }
    });
  }
}
