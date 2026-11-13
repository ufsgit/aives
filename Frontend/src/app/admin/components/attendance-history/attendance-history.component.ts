import { Component, OnInit, inject, Pipe, PipeTransform } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule, MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Router } from '@angular/router';
import { course_Service } from '../../services/course.Service';
import { AttendanceService } from '../../services/attendance.service';
import Swal from 'sweetalert2';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeGb from '@angular/common/locales/en-GB';

import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';

registerLocaleData(localeGb);

@Pipe({
  name: 'minValue',
  standalone: true
})
export class MinValuePipe implements PipeTransform {
  transform(value: number, min: number): number {
    return Math.min(value, min);
  }
}

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'dd-MM-yyyy' },
  display: {
    dateInput: 'dd-MM-yyyy',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd-MM-yyyy',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatButtonModule, MatIconModule, MatSelectModule, MatNativeDateModule,
    MinValuePipe, NgChartsModule
  ],

  providers: [
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: 'en-GB' },
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ],
  templateUrl: './attendance-history.component.html',
  styleUrls: ['./attendance-history.component.scss'],
})
export class AttendanceHistoryComponent implements OnInit {
  private courseService = inject(course_Service);
  private attendanceService = inject(AttendanceService);
  private router = inject(Router);

  selectedCourse = new FormControl('');
  selectedBatch = new FormControl('');
  fromDate = new FormControl(new Date().toISOString().split('T')[0]);
  toDate = new FormControl(new Date().toISOString().split('T')[0]);

  courseList: any[] = [];
  batchList: any[] = [];
  historyList: any[] = [];
  isLoadingHistory: boolean = false;

  staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
  userType = localStorage.getItem('User_Type');
  isAdmin: boolean = false;

  // Graph Modal Properties
  showAttendanceGraphModal: boolean = false;
  isLoadingGraphData: boolean = false;
  graphSummary: any = {
    totalSessions: 0,
    totalMarked: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    leaveCount: 0,
    presentRate: 0
  };

  public attendanceBarChartType: ChartType = 'bar';
  public attendanceBarChartData: ChartData<'bar'> = {
    labels: ['Present', 'Absent', 'Late', 'Leave'],
    datasets: [
      {
        data: [0, 0, 0, 0],
        label: 'Attendance Count',
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
        borderRadius: 6
      }
    ]
  };
  public attendanceBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  public attendancePieChartType: ChartType = 'doughnut';
  public attendancePieChartData: ChartData<'doughnut'> = {
    labels: ['Present', 'Absent', 'Late', 'Leave'],
    datasets: [
      {
        data: [0, 0, 0, 0],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']
      }
    ]
  };
  public attendancePieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' }
    }
  };

  openAttendanceGraphModal(): void {
    this.showAttendanceGraphModal = true;
    this.loadAttendanceGraphData();
  }

  closeAttendanceGraphModal(): void {
    this.showAttendanceGraphModal = false;
  }

  loadAttendanceGraphData(): void {
    this.isLoadingGraphData = true;
    let courseId = 0;
    let batchId = 0;
    
    if (this.selectedCourse.value) {
      const selectedCourseObj = this.courseList.find(c => c.Course_Name?.trim().toLowerCase() === this.selectedCourse.value?.trim().toLowerCase());
      if (selectedCourseObj) courseId = selectedCourseObj.Course_ID;
    }
    
    if (this.selectedBatch.value) {
      const selectedBatchObj = this.batchList.find(b => b.Batch_Name?.trim().toLowerCase() === this.selectedBatch.value?.trim().toLowerCase());
      if (selectedBatchObj) batchId = selectedBatchObj.Batch_ID;
    }

    const fromDateStr = this.fromDate.value ? new Date(this.fromDate.value).toISOString().split('T')[0] : '';
    const toDateStr = this.toDate.value ? new Date(this.toDate.value).toISOString().split('T')[0] : '';
    const targetStaffId = this.isAdmin ? 0 : this.staffId;

    this.attendanceService.getAttendanceHistory(courseId, batchId, fromDateStr, toDateStr, 1, 500, targetStaffId).subscribe({
      next: (res: any) => {
        const history = res?.data || [];
        let totalSessions = history.length;
        let present = 0;
        let absent = 0;
        let late = 0;
        let leave = 0;

        history.forEach((record: any) => {
          present += Number(record.Present_Count || record.Present || 0);
          absent += Number(record.Absent_Count || record.Absent || 0);
          late += Number(record.Late_Count || record.Late || 0);
          leave += Number(record.Leave_Count || record.Leave || 0);
        });

        const totalMarked = present + absent + late + leave;
        const presentRate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;

        this.graphSummary = {
          totalSessions,
          totalMarked,
          presentCount: present,
          absentCount: absent,
          lateCount: late,
          leaveCount: leave,
          presentRate
        };

        this.attendanceBarChartData = {
          labels: ['Present', 'Absent', 'Late', 'Leave'],
          datasets: [
            {
              data: [present, absent, late, leave],
              label: 'Students Count',
              backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
              borderRadius: 6
            }
          ]
        };

        this.attendancePieChartData = {
          labels: ['Present', 'Absent', 'Late', 'Leave'],
          datasets: [
            {
              data: [present, absent, late, leave],
              backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']
            }
          ]
        };

        this.isLoadingGraphData = false;
      },
      error: (err: any) => {
        console.error('Error loading graph data', err);
        this.isLoadingGraphData = false;
      }
    });
  }

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalRecords: number = 0;
  pageSizeOptions: number[] = [10, 25, 50, 100];


  ngOnInit() {
    this.staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
    const userEmail = String(localStorage.getItem('Email') || '').toLowerCase().trim();
    const userName = String(localStorage.getItem('Name') || '').toLowerCase().trim();
    const isTrainer = userName.includes('trainer') || userEmail.includes('trainer') || userEmail === 'ufsdev123@gmail.com';
    this.isAdmin = !isTrainer && (this.staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com');
    this.loadCourses();
    this.fetchHistory();
  }

  loadCourses() {
    const targetStaffId = this.isAdmin ? 0 : this.staffId;
    this.attendanceService.getAttendanceCourses(targetStaffId).subscribe({
      next: (res: any) => {
        this.courseList = res?.data || (Array.isArray(res) ? res : res?.[0]) || [];
      },
      error: (err) => console.error('Error loading courses', err)
    });
  }

  onCourseChange() {
    const selectedCourseName = this.selectedCourse.value;
    const selectedCourseObj = this.courseList.find(c =>
      c.Course_Name?.trim().toLowerCase() === selectedCourseName?.trim().toLowerCase()
    );

    if (selectedCourseObj) {
      const targetStaffId = this.isAdmin ? 0 : this.staffId;
      this.attendanceService.getAttendanceBatches(selectedCourseObj.Course_ID, targetStaffId).subscribe({
        next: (res: any) => {
          this.batchList = res?.data || (Array.isArray(res) ? res : []) || [];
          this.selectedBatch.setValue('');
          this.fetchHistory();
        },
        error: (err) => console.error('Error loading batches', err)
      });
    } else {
      this.batchList = [];
      this.selectedBatch.setValue('');
      this.fetchHistory();
    }
  }

  fetchHistory() {
    this.isLoadingHistory = true;
    
    let courseId = 0;
    let batchId = 0;
    
    if (this.selectedCourse.value) {
      const selectedCourseObj = this.courseList.find(c => c.Course_Name?.trim().toLowerCase() === this.selectedCourse.value?.trim().toLowerCase());
      if (selectedCourseObj) courseId = selectedCourseObj.Course_ID;
    }
    
    if (this.selectedBatch.value) {
      const selectedBatchObj = this.batchList.find(b => b.Batch_Name?.trim().toLowerCase() === this.selectedBatch.value?.trim().toLowerCase());
      if (selectedBatchObj) batchId = selectedBatchObj.Batch_ID;
    }

    const fromDateStr = this.fromDate.value ? new Date(this.fromDate.value).toISOString().split('T')[0] : '';
    const toDateStr = this.toDate.value ? new Date(this.toDate.value).toISOString().split('T')[0] : '';
    const targetStaffId = this.isAdmin ? 0 : this.staffId;

    this.attendanceService.getAttendanceHistory(courseId, batchId, fromDateStr, toDateStr, this.currentPage, this.pageSize, targetStaffId).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.historyList = res.data;
          this.totalRecords = res.totalRecords || 0;
        } else {
          this.historyList = [];
          this.totalRecords = 0;
        }
        this.isLoadingHistory = false;
      },
      error: (err) => {
        console.error('Error loading history', err);
        this.historyList = [];
        this.totalRecords = 0;
        this.isLoadingHistory = false;
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.fetchHistory();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.fetchHistory();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.fetchHistory();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.fetchHistory();
  }

  viewAttendanceDetails(record: any) {
    this.isLoadingHistory = true;
    // record.Attendance_Date is now a YYYY-MM-DD string from the DB
    const dateStr = record.Attendance_Date;
    const targetStaffId = this.isAdmin ? 0 : this.staffId;
    
    // Use the dedicated session details API with RBAC support
    this.attendanceService.getAttendanceDetailsBySession(
      record.Course_ID || 0,
      record.Batch_ID || 0,
      dateStr,
      targetStaffId
    ).subscribe({
      next: (res: any) => {
        this.isLoadingHistory = false;
        if (res.success && res.data && res.data.length > 0) {
          const studentRows = res.data.map((s: any, idx: number) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${idx + 1}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: left;">${s.Student_Name || s.Name || 'N/A'}</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; 
                  ${s.Status === 1 ? 'background: #dcfce7; color: #166534;' : 
                    s.Status === 0 ? 'background: #fee2e2; color: #991b1b;' : 
                    s.Status === 2 ? 'background: #fef3c7; color: #92400e;' : 
                    'background: #eef2ff; color: #3730a3;'}">
                  ${this.getStatusLabel(s.Status)}
                </span>
              </td>
            </tr>
          `).join('');

          Swal.fire({
            title: `Attendance Details`,
            html: `
              <div style="text-align: left; margin-bottom: 15px; font-size: 14px;">
                <p><strong>Course:</strong> ${record.Course_Name || 'N/A'}</p>
                <p><strong>Batch:</strong> ${record.Batch_Name || 'N/A'}</p>
                <p><strong>Date:</strong> ${dateStr}</p>
              </div>
              <div style="max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #f9fafb; text-align: left;">
                      <th style="padding: 8px; border-bottom: 2px solid #eee;">#</th>
                      <th style="padding: 8px; border-bottom: 2px solid #eee;">Student Name</th>
                      <th style="padding: 8px; border-bottom: 2px solid #eee;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${studentRows}
                  </tbody>
                </table>
              </div>
            `,
            width: '600px',
            confirmButtonText: 'Close',
            confirmButtonColor: '#4338ca'
          });
        } else {
          Swal.fire('No Data', 'No student details found for this record.', 'info');
        }
      },
      error: (err) => {
        this.isLoadingHistory = false;
        console.error('Error fetching attendance details', err);
        Swal.fire('Error', 'Failed to load attendance details.', 'error');
      }
    });
  }

  deleteAttendanceRecord(record: any) {
    const dateStr = new Date(record.Attendance_Date).toISOString().split('T')[0];
    
    Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete the attendance record for ${record.Batch_Name} on ${dateStr}. This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoadingHistory = true;
        const targetStaffId = this.isAdmin ? 0 : this.staffId;
        this.attendanceService.deleteAttendance(
          record.Course_ID || 0,
          record.Batch_ID || 0,
          dateStr,
          targetStaffId
        ).subscribe({
          next: (res: any) => {
            this.isLoadingHistory = false;
            Swal.fire(
              'Deleted!',
              'Attendance record has been deleted.',
              'success'
            );
            this.fetchHistory(); // Refresh the list
          },
          error: (err) => {
            this.isLoadingHistory = false;
            console.error('Error deleting attendance', err);
            Swal.fire('Error', 'Failed to delete attendance record.', 'error');
          }
        });
      }
    });
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 1: return 'Present';
      case 0: return 'Absent';
      case 2: return 'Leave';
      case 3: return 'Late';
      default: return 'Unknown';
    }
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/admin/My_Students']);
    }
  }
}
