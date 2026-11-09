import { Component, OnInit, inject } from '@angular/core';
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
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeGb from '@angular/common/locales/en-GB';

registerLocaleData(localeGb);

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
  selector: 'app-mark-attendance',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatButtonModule, MatIconModule, MatSelectModule, MatNativeDateModule,
    NgChartsModule
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: 'en-GB' },
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ],
  templateUrl: './mark-attendance.component.html',
  styleUrls: ['./mark-attendance.component.scss'],
})
export class MarkAttendanceComponent implements OnInit {
  private courseService = inject(course_Service);
  private attendanceService = inject(AttendanceService);
  private router = inject(Router);

  selectedCourse = new FormControl('');
  selectedBatch = new FormControl('');
  attendanceDate = new FormControl(new Date().toISOString().split('T')[0]);

  courseList: any[] = [];
  batchList: any[] = [];
  studentList: any[] = [];

  // Status: 1 = Present, 0 = Absent, 2 = Leave, 3 = Late
  attendanceStatuses: Map<number, number> = new Map();
  isSavingAttendance: boolean = false;
  isLoadingStudents: boolean = false;

  staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
  userType = localStorage.getItem('User_Type');
  isAdmin: boolean = false;

  ngOnInit() {
    this.staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
    const userEmail = String(localStorage.getItem('Email') || '').toLowerCase();
    this.isAdmin = this.staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';
    this.loadCourses();
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
          this.studentList = [];
          this.attendanceStatuses.clear();
        },
        error: (err) => console.error('Error loading batches', err)
      });
    } else {
      this.batchList = [];
      this.selectedBatch.setValue('');
      this.studentList = [];
      this.attendanceStatuses.clear();
    }
  }

  onBatchChange() {
    const selectedBatchName = this.selectedBatch.value;
    const selectedBatchObj = this.batchList.find(b =>
      b.Batch_Name?.trim().toLowerCase() === selectedBatchName?.trim().toLowerCase()
    );

    if (selectedBatchObj) {
      this.loadStudentsByBatch(selectedBatchObj.Batch_ID);
    } else {
      this.studentList = [];
      this.attendanceStatuses.clear();
    }
  }

  loadStudentsByBatch(batchId: number) {
    this.isLoadingStudents = true;
    this.courseService.Get_Student_List_By_Batch(batchId).subscribe({
      next: (res: any) => {
        this.studentList = res || [];
        this.initializeAttendanceStatuses();
        this.isLoadingStudents = false;
      },
      error: (err) => {
        console.error('Error loading students', err);
        this.isLoadingStudents = false;
      }
    });
  }

  initializeAttendanceStatuses() {
    this.attendanceStatuses.clear();
    this.studentList.forEach(student => {
      this.attendanceStatuses.set(student.Student_ID, 1); // Default: Present
    });
  }

  setAttendanceStatus(studentId: number, status: number) {
    this.attendanceStatuses.set(studentId, status);
  }

  markAllPresent() {
    this.studentList.forEach(student => {
      this.attendanceStatuses.set(student.Student_ID, 1);
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

  saveAttendance() {
    if (!this.selectedCourse.value) {
      Swal.fire('Error', 'Please select a course.', 'error');
      return;
    }
    if (!this.selectedBatch.value) {
      Swal.fire('Error', 'Please select a batch.', 'error');
      return;
    }
    if (this.studentList.length === 0) {
      Swal.fire('Error', 'No students found for this batch.', 'error');
      return;
    }

    const selectedBatchObj = this.batchList.find(b =>
      b.Batch_Name?.trim().toLowerCase() === this.selectedBatch.value?.trim().toLowerCase()
    );
    const selectedCourseObj = this.courseList.find(c =>
      c.Course_Name?.trim().toLowerCase() === this.selectedCourse.value?.trim().toLowerCase()
    );

    if (!this.isAdmin && selectedCourseObj) {
      const isAllowed = this.courseList.some(c => c.Course_ID === selectedCourseObj.Course_ID);
      if (!isAllowed) {
        Swal.fire('Error', 'You are not assigned to mark attendance for this course.', 'error');
        return;
      }
    }

    const rawDate: any = this.attendanceDate.value;
    let dateStr: string;
    if (rawDate instanceof Date) {
      const year = rawDate.getFullYear();
      const month = String(rawDate.getMonth() + 1).padStart(2, '0');
      const day = String(rawDate.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else if (typeof rawDate === 'string' && rawDate.trim().length > 0) {
      dateStr = rawDate.split('T')[0];
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    const absentCount = this.studentList.filter(s => this.attendanceStatuses.get(s.Student_ID) === 0).length;
    const presentCount = this.studentList.filter(s => this.attendanceStatuses.get(s.Student_ID) === 1).length;
    const leaveCount = this.studentList.filter(s => this.attendanceStatuses.get(s.Student_ID) === 2).length;
    const lateCount = this.studentList.filter(s => this.attendanceStatuses.get(s.Student_ID) === 3).length;

    const attendanceData = this.studentList.map(student => ({
      Student_ID: student.Student_ID,
      Course_ID: selectedCourseObj?.Course_ID,
      Batch_ID: selectedBatchObj?.Batch_ID,
      Attendance_Date: dateStr,
      Status: this.attendanceStatuses.get(student.Student_ID),
      Course_Name: this.selectedCourse.value,
      Batch_Name: this.selectedBatch.value
    }));

    Swal.fire({
      title: 'Confirm Attendance',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Date:</strong> ${dateStr}</p>
          <p style="color: green;"><strong>Present:</strong> ${presentCount}</p>
          <p style="color: red;"><strong>Absent:</strong> ${absentCount}</p>
          <p style="color: orange;"><strong>Leave:</strong> ${leaveCount}</p>
          <p style="color: #6366f1;"><strong>Late:</strong> ${lateCount}</p>
        </div>
        <p class="mt-2 text-sm text-gray-500">Absent students will receive WhatsApp notifications.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Save',
      confirmButtonColor: '#4338ca'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSavingAttendance = true;
        this.attendanceService.saveAttendance({
          attendanceData,
          markedBy: this.staffId
        }).subscribe({
          next: () => {
            this.isSavingAttendance = false;
            Swal.fire({
              title: 'Success!',
              text: 'Attendance saved successfully.',
              icon: 'success',
              confirmButtonColor: '#4338ca'
            }).then(() => {
              this.selectedCourse.setValue('');
              this.selectedBatch.setValue('');
              this.batchList = [];
              this.studentList = [];
              this.attendanceStatuses.clear();
              this.router.navigate(['/admin/Mark_Attendance']);
            });
          },
          error: (err) => {
            this.isSavingAttendance = false;
            console.error('Save Attendance Error:', err);
            const msg = err.error?.message || 'Failed to save attendance.';
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/admin/Mark_Attendance']);
    }
  }

  // Attendance Graph Modal Properties
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
        label: 'Students Count',
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

    // Check if course or batch is currently selected
    const selectedCourseObj = this.courseList.find(c =>
      c.Course_Name?.trim().toLowerCase() === this.selectedCourse.value?.trim().toLowerCase()
    );
    const selectedBatchObj = this.batchList.find(b =>
      b.Batch_Name?.trim().toLowerCase() === this.selectedBatch.value?.trim().toLowerCase()
    );

    const courseId = selectedCourseObj ? selectedCourseObj.Course_ID : 0;
    const batchId = selectedBatchObj ? selectedBatchObj.Batch_ID : 0;
    const targetStaffId = this.isAdmin ? 0 : this.staffId;

    this.attendanceService.getAttendanceHistory(courseId, batchId, '', '', 1, 500, targetStaffId).subscribe({
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
        console.error('Error loading attendance graph data:', err);
        this.isLoadingGraphData = false;
      }
    });
  }

  navigateToAttendanceHistory(): void {
    this.router.navigate(['/admin/Attendance_History']);
  }
}
