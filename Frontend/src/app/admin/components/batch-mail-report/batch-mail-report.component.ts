import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { user_Service } from '../../services/user.Service';
import { course_Service } from '../../services/course.Service';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-batch-mail-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './batch-mail-report.component.html',
  styleUrls: ['./batch-mail-report.component.scss']
})
export class BatchMailReportComponent implements OnInit {
  private userService = inject(user_Service);
  private courseService = inject(course_Service);
  
  tableData: any[] = [];
  displayedColumns: string[] = ['date', 'course', 'batch', 'template', 'totalSent', 'successCount', 'failedCount'];
  isLoaded: boolean = false;

  // Filters
  fromDate: string = '';
  toDate: string = '';
  selectedCourseId: number = 0;
  selectedBatchId: number = 0;
  
  courseList: any[] = [];
  batchList: any[] = [];

  ngOnInit() {
    // Default: last 30 days so data is visible immediately
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    this.fromDate = this.formatDate(thirtyDaysAgo);
    this.toDate = this.formatDate(today);
    this.loadCourses();
    this.fetchReportData();
  }

  loadCourses() {
    this.courseService.get_course_names().subscribe({
      next: (res: any) => {
        this.courseList = res?.[0] || [];
      },
      error: (err) => console.error('Error loading courses', err)
    });
  }

  onCourseChange() {
    if (this.selectedCourseId) {
      this.courseService.get_course_Batches(this.selectedCourseId).subscribe({
        next: (res: any) => {
          this.batchList = res || [];
          this.selectedBatchId = 0;
          this.fetchReportData();
        },
        error: (err) => {
          console.error('Error loading batches', err);
          this.fetchReportData();
        }
      });
    } else {
      this.batchList = [];
      this.selectedBatchId = 0;
      this.fetchReportData();
    }
  }

  fetchReportData() {
    this.isLoaded = false;
    const formattedFrom = this.formatDate(this.fromDate);
    const formattedTo = this.formatDate(this.toDate);

    this.userService.getBatchMailReport(
      this.selectedCourseId,
      this.selectedBatchId,
      formattedFrom,
      formattedTo
    ).subscribe({
      next: (res: any) => {
        this.tableData = res?.data || [];
        this.isLoaded = true;
      },
      error: (err) => {
        console.error('Error fetching batch mail report:', err);
        this.tableData = [];
        this.isLoaded = true;
      }
    });
  }

  onSearch() {
    this.fetchReportData();
  }

  formatDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') return date;

    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }
}
