import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { AttendanceService } from '../../services/attendance.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { provideNativeDateAdapter } from '@angular/material/core';
import { StudentlistComponent } from "../studentlist/studentlist.component";
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { course_Service } from '../../services/course.Service';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import autoTable from 'jspdf-autotable';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';

import { LOCALE_ID } from '@angular/core';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { registerLocaleData } from '@angular/common';
import localeGb from '@angular/common/locales/en-GB';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { MatDialog } from '@angular/material/dialog';
import { EmailTemplateService } from '../../services/email-template.service';
import Swal from 'sweetalert2';

// Register 'en-GB' locale for dd-MM-yyyy support
registerLocaleData(localeGb);

// Custom format object
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'dd-MM-yyyy',
  },
  display: {
    dateInput: 'dd-MM-yyyy',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd-MM-yyyy',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

@Component({
  selector: 'app-my-students',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatButtonModule, MatIconModule, StudentlistComponent,
  MatCheckboxModule, MatNativeDateModule, MatSelectModule, NgChartsModule],
  providers: [provideNativeDateAdapter(), { provide: LOCALE_ID, useValue: 'en-GB' }, 
      { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
      { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }],
  templateUrl: './my-students.component.html',
  styleUrls: ['./my-students.component.scss'],
})

export class MyStudentsComponent implements OnInit {
  selectedCourse = new FormControl('');
  selectedStudent = new FormControl('');
  selectedBatch = new FormControl('');
  fromDate = new FormControl(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  toDate = new FormControl(new Date());
  private user = inject(user_Service);
  private courseService = inject(course_Service);
  private emailTemplateService = inject(EmailTemplateService);
  dialogBox = inject(MatDialog);
  private router = inject(Router);

  courseList: any[] = [];
  batchList: any[] = [];

  displayedColumns = [
    'Action',
    'Student_ID',
    'Name',
    'Course',
    'Batch',
    'Email',
    'Contact',
    'Branch_Name',
    'Entry_Date'
  ];
showMoreOptions: boolean = false;

  totalEntries = '';
  tableData: any[] = [];
  pageSize = 12;
  currentPage = 1;
  totalRecords = 0;
  Math = Math;
  IsLoaded = false;
  student_edit: boolean = false;
  student_Details: any;
  isFollowupOnly: boolean = false;
  branchName:string=""

  staffId = parseInt(localStorage.getItem('User_Id') || '0');

  selectedStudents: Set<any> = new Set();
  showEmailModal: boolean = false;
  emailTemplates: any[] = [];
  selectedTemplateId: number | null = null;
  emailSubject: string = '';
  emailBody: string = '';
  isSendingEmail: boolean = false;
  
  // Bulk WhatsApp Properties
  showWhatsAppModal: boolean = false;
  whatsappMessage: string = '';
  isSendingWhatsApp: boolean = false;
  
  // Attendance Properties
  isAttendanceMode: boolean = false;
  attendanceStatuses: Map<number, number> = new Map(); // Student_ID -> Status (1: Present, 0: Absent)
  isSavingAttendance: boolean = false;
  private attendanceService = inject(AttendanceService);

  constructor() { }

  ngOnInit() {
    this.loadInitialData();
    this.loadEmailTemplates();
  }

  loadEmailTemplates() {
    this.emailTemplateService.searchTemplates('').subscribe((res) => {
      this.emailTemplates = res || [];
    });
  }

  loadInitialData() {
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

  onCourseSelectionChange() {
    const selectedCourseName = this.selectedCourse.value;
    const selectedCourseObj = this.courseList.find(c => 
      c.Course_Name?.trim().toLowerCase() === selectedCourseName?.trim().toLowerCase()
    );
    
    if (selectedCourseObj) {
      this.courseService.get_course_Batches(selectedCourseObj.Course_ID).subscribe({
        next: (res: any) => {
          this.batchList = res || [];
          this.selectedBatch.setValue('');
          this.fetchReportData();
        },
        error: (err) => console.error('Error loading batches', err)
      });
    } else {
      this.batchList = [];
      this.selectedBatch.setValue('');
      this.fetchReportData();
    }
  }

  fetchReportData() {
    this.staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
    this.currentPage = this.currentPage || 1;
    this.IsLoaded = false;

  const hasValidDates = this.showMoreOptions &&
                       this.fromDate.value &&
                       this.toDate.value;

const params = {
  studentSearch: this.selectedStudent.value?.trim() || '',
  batchSearch: this.selectedBatch.value?.trim() || '',
  courseSearch: this.selectedCourse.value?.trim() || '',
  fromDate: hasValidDates ? this.fromDate.value?.toLocaleDateString('en-CA') ?? '' : '',
  toDate: hasValidDates ? this.toDate.value?.toLocaleDateString('en-CA') ?? '' : '',
};

  this.user
    .Get_My_Students_Report(
      params.studentSearch,
      params.batchSearch,
      params.courseSearch,
      params.fromDate,
      params.toDate,
      this.currentPage,
      this.pageSize,
      this.staffId
    )
    .subscribe({
      next: (res: any[]) => {
        const [countResult, data] = res;
        this.totalRecords = countResult?.[0]?.totalRecords || 0;
        this.tableData = data?.map((item) => ({
          ...item,
          Name: `${item.First_Name} ${item.Last_Name}`,
          Contact: item.Phone_Number,
          Course: item.Course_Name,
          Batch: item.Batch_Name,
        })) || [];
      },
      complete: () => {
        this.IsLoaded = true;
        if (this.isAttendanceMode) {
          this.initializeAttendanceStatuses();
        }
      },
    });
}

  toggleAttendanceMode() {
    console.log('Toggling Attendance Mode:', !this.isAttendanceMode);
    this.isAttendanceMode = !this.isAttendanceMode;
    if (this.isAttendanceMode) {
      this.initializeAttendanceStatuses();
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
    this.attendanceService.getAttendanceHistory(0, 0, '', '', 1, 500).subscribe({
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

  navigateToMarkAttendance() {
    this.router.navigate(['/admin/Mark_Attendance']);
  }

  navigateToAttendanceHistory() {
    this.router.navigate(['/admin/Attendance_History']);
  }


  initializeAttendanceStatuses() {
    this.tableData.forEach(student => {
      if (!this.attendanceStatuses.has(student.Student_ID)) {
        this.attendanceStatuses.set(student.Student_ID, 1); // Default to Present
      }
    });
  }

  setAttendanceStatus(studentId: number, status: number) {
    this.attendanceStatuses.set(studentId, status);
  }

  saveAttendance() {
    if (!this.selectedBatch.value) {
      Swal.fire('Error', 'Please select a batch first.', 'error');
      return;
    }

    const attendanceData = this.tableData.map(student => ({
      Student_ID: student.Student_ID,
      Course_ID: student.Course_ID, // Ensure Course_ID is available in tableData
      Batch_ID: student.Batch_ID,   // Ensure Batch_ID is available in tableData
      Attendance_Date: new Date().toISOString().split('T')[0],
      Status: this.attendanceStatuses.get(student.Student_ID),
      Course_Name: student.Course_Name,
      Batch_Name: student.Batch_Name
    }));

    Swal.fire({
      title: 'Confirm Attendance',
      text: `Are you sure you want to save attendance for ${attendanceData.length} students? Absent students will receive WhatsApp notifications.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Save'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSavingAttendance = true;
        this.attendanceService.saveAttendance({
          attendanceData,
          markedBy: this.staffId
        }).subscribe({
          next: (res) => {
            this.isSavingAttendance = false;
            Swal.fire('Success', 'Attendance saved successfully.', 'success');
            this.isAttendanceMode = false;
          },
          error: (err) => {
            this.isSavingAttendance = false;
            console.error('Save Attendance Error:', err);
            Swal.fire('Error', 'Failed to save attendance.', 'error');
          }
        });
      }
    });
  }

  get isAllSelected() {
    return this.tableData.length > 0 && this.selectedStudents.size === this.tableData.length;
  }

  toggleSelectAll(event: any) {
    if (event.checked) {
      this.tableData.forEach(row => this.selectedStudents.add(row));
    } else {
      this.selectedStudents.clear();
    }
  }

  toggleSelectStudent(row: any, event: any) {
    if (event.checked) {
      this.selectedStudents.add(row);
    } else {
      this.selectedStudents.delete(row);
    }
  }

  openBulkEmailModal() {
    if (this.selectedStudents.size === 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please select at least one student to send email.', Type: '3' },
      });
      return;
    }

    const noEmailStudents = Array.from(this.selectedStudents).filter(s => !s.Email);
    if (noEmailStudents.length > 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: `Warning: ${noEmailStudents.length} selected student(s) do not have an email address. They will be skipped.`, Type: '3' },
      });
    }

    this.showEmailModal = true;
    this.emailSubject = '';
    this.emailBody = '';
    this.selectedTemplateId = null;
  }

  openIndividualEmailModal(student: any) {
    this.selectedStudents.clear();
    this.selectedStudents.add(student);
    
    if (!student.Email) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'This student does not have an email address.', Type: '3' },
      });
      return;
    }

    this.showEmailModal = true;
    this.emailSubject = '';
    this.emailBody = '';
    this.selectedTemplateId = null;
  }

  closeEmailModal() {
    this.showEmailModal = false;
  }

  onTemplateChange() {
    if (this.selectedTemplateId) {
      const template = this.emailTemplates.find(t => t.Template_ID === this.selectedTemplateId);
      if (template) {
        this.emailSubject = template.Subject;
        this.emailBody = template.Body;
      }
    } else {
      this.emailSubject = '';
      this.emailBody = '';
    }
  }

  sendBulkEmail() {
    if (!this.emailSubject.trim() || !this.emailBody.trim()) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please enter Subject and Body for the email.', Type: '3' },
      });
      return;
    }

    Swal.fire({
      title: 'Confirm Sending',
      text: `Are you sure you want to send this email to ${this.selectedStudents.size} student(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, send it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.executeBulkEmailSend();
      }
    });
  }

  private executeBulkEmailSend() {
    this.isSendingEmail = true;
    const payload = {
      students: Array.from(this.selectedStudents),
      subject: this.emailSubject,
      body: this.emailBody,
      templateId: this.selectedTemplateId
    };

    this.user.Send_Bulk_Email(payload).subscribe({
      next: () => {
        this.isSendingEmail = false;
        this.closeEmailModal();
        this.selectedStudents.clear();
        Swal.fire({
          title: 'Sent!',
          text: 'Bulk emails sent successfully!',
          icon: 'success',
          confirmButtonColor: '#3085d6'
        });
      },
      error: (err) => {
        this.isSendingEmail = false;
        console.error('Bulk email error:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to send bulk emails.';
        const detailedError = err.error?.error ? `\nReason: ${err.error.error}` : '';
        Swal.fire({
          title: 'Error!',
          text: errorMessage + detailedError,
          icon: 'error',
          confirmButtonColor: '#3085d6'
        });
      }
    });
  }

  // Bulk WhatsApp Methods
  openBulkWhatsAppModal() {
    if (this.selectedStudents.size === 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please select at least one student to send WhatsApp.', Type: '3' },
      });
      return;
    }

    const noContactStudents = Array.from(this.selectedStudents).filter(s => !s.Contact);
    if (noContactStudents.length > 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: `Warning: ${noContactStudents.length} selected student(s) do not have a contact number. They will be skipped.`, Type: '3' },
      });
    }

    this.showWhatsAppModal = true;
    this.whatsappMessage = '';
  }

  openIndividualWhatsApp(student: any) {
    if (!student.Contact) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'This student does not have a contact number.', Type: '3' },
      });
      return;
    }

    const phone = student.Contact.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=${phone}`;
    window.open(url, '_blank');
  }

  closeWhatsAppModal() {
    this.showWhatsAppModal = false;
  }

  sendBulkWhatsApp() {
    if (!this.whatsappMessage.trim()) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please enter a message to send.', Type: '3' },
      });
      return;
    }

    const studentsWithContact = Array.from(this.selectedStudents).filter(s => !!s.Contact);
    
    if (studentsWithContact.length === 0) {
      Swal.fire('Error', 'No selected students have contact numbers.', 'error');
      return;
    }

    Swal.fire({
      title: 'Confirm Sending',
      text: `This will open WhatsApp Web for ${studentsWithContact.length} student(s). Are you sure?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, open WhatsApp!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.executeBulkWhatsAppSend(studentsWithContact);
      }
    });
  }

  private executeBulkWhatsAppSend(students: any[]) {
    this.isSendingWhatsApp = true;
    
    students.forEach((student, index) => {
      setTimeout(() => {
        const phone = student.Contact.replace(/\D/g, '');
        const text = encodeURIComponent(this.whatsappMessage.replace('[Student Name]', student.Name));
        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
        window.open(url, '_blank');
        
        if (index === students.length - 1) {
          this.isSendingWhatsApp = false;
          this.closeWhatsAppModal();
          this.selectedStudents.clear();
          Swal.fire('Success', 'WhatsApp links opened. Please send them in the opened tabs.', 'success');
        }
      }, index * 1000); 
    });
  }

  onSaveStudent(event: any): void {
  this.student_edit = false; 
}

  student_List_Update(row: any) {
    this.student_edit = true;
    this.student_Details = row;
    this.isFollowupOnly = false;
  }

  openFollowUp(student: any) {
    this.student_edit = true;
    this.student_Details = student;
    this.isFollowupOnly = true;
  }

  onCancelEdit() {
    this.student_edit = false;
    this.student_Details = null;
    this.isFollowupOnly = false;
    this.fetchReportData();
  }

  clearFilters() {
    [this.selectedCourse, this.selectedStudent, this.selectedBatch].forEach(control => control.reset());
    this.batchList = [];
    this.fromDate.setValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.toDate.setValue(new Date());
    this.showMoreOptions = false;
    this.currentPage = 1;
    this.selectedStudents.clear();
    this.fetchReportData();
  }

  onPageChange(event: { pageIndex: number, pageSize: number }) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.selectedStudents.clear();
    this.fetchReportData();
  }

  downloadPDF(): void {
    this.staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
    const hasValidDates = this.showMoreOptions &&
                      this.fromDate.value &&
                      this.toDate.value;

  const allDataParams = {
    studentSearch: this.selectedStudent.value?.trim() || '',
    batchSearch: this.selectedBatch.value?.trim() || '',
    courseSearch: this.selectedCourse.value?.trim() || '',
    fromDate: hasValidDates ? this.fromDate.value?.toLocaleDateString('en-CA') ?? '' : '',
    toDate: hasValidDates ? this.toDate.value?.toLocaleDateString('en-CA') ?? '' : '',
  };

  this.user.Get_My_Students_Report(
    allDataParams.studentSearch,
    allDataParams.batchSearch,
    allDataParams.courseSearch,
    allDataParams.fromDate,
    allDataParams.toDate,
    1,
    this.totalRecords || 99999,
    this.staffId
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, fullData] = res;
      if (!fullData?.length) {
        alert('No data to export.');
        return;
      }

      this.loadImageAsBase64('/assets/images/logo2.svg')
        .then((base64Image: string) => {
          this.generateStudentPDF(fullData, base64Image);
        })
        .catch(err => {
          console.warn('Logo load failed. Proceeding without logo.', err);
          this.generateStudentPDF(fullData);
        });
    },
    error: () => alert('Failed to download PDF')
  });
}

private generateStudentPDF(fullData: any[], base64Image?: string): void {
  this.branchName = [...new Set(fullData.map(item => item.Branch_Name).filter(name => !!name))].join(', ');
  const formattedData = fullData.map((item: any, index: number) => [
    index + 1,
    item.Student_ID,
    `${item.First_Name} ${item.Last_Name}`,
    item.Course_Name,
    item.Batch_Name,
    item.Email,
    item.Phone_Number,
    new Date(item.Entry_Date).toLocaleDateString('en-GB'),
  ]);

  const doc = new jsPDF();

  const courseName = this.selectedCourse?.value?.trim() || 'All Courses';
  const batchName = this.selectedBatch?.value?.trim() || 'All Batches';
  const branchName = this.branchName || 'All Branches';
  const fromDateStr = this.showMoreOptions && this.fromDate.value ? new Date(this.fromDate.value).toLocaleDateString('en-GB') : 'N/A';
  const toDateStr = this.showMoreOptions && this.toDate.value ? new Date(this.toDate.value).toLocaleDateString('en-GB') : 'N/A';
  const totalEntries = this.totalRecords || 0;

  let currentY = 10;
  doc.setFontSize(14);
  doc.text('My Students Report', 105, currentY , { align: 'center' });
  currentY += 1;
  if (base64Image) {
    doc.addImage(base64Image, 'PNG', 10, currentY, 20,20);
    doc.text(`${branchName || 'N/A'}`, 35, currentY + 10 );
  } {
    currentY += 20;
  }
  const pageCenter = 105;
  doc.setFontSize(10);
  doc.text(`Course: ${courseName}`, pageCenter - 70, currentY);
  doc.text(`Batch: ${batchName}`, pageCenter + 20, currentY);
  currentY += 6;
  doc.text(`From: ${fromDateStr}`, pageCenter - 70, currentY);
  doc.text(`To: ${toDateStr}`, pageCenter + 20, currentY);
  currentY += 6;
  doc.text(`Total Entries: ${totalEntries}`, pageCenter - 70, currentY);
  currentY += 5;
  autoTable(doc, {
    head: [['#', 'Student ID', 'Name', 'Course', 'Batch', 'Email', 'Contact', 'Entry Date']],
    body: formattedData,
    startY: currentY,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save('My_Students_Report.pdf');
}

loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject('Canvas context not available');
      }
    };
    img.onerror = reject;
  });
}

exportToExcel(): void {
  this.staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
  const hasValidDates = this.showMoreOptions &&
    this.fromDate.value &&
    this.toDate.value;

  const allDataParams = {
    studentSearch: this.selectedStudent.value?.trim() || '',
    batchSearch: this.selectedBatch.value?.trim() || '',
    courseSearch: this.selectedCourse.value?.trim() || '',
    fromDate: hasValidDates ? this.fromDate.value?.toLocaleDateString('en-CA') ?? '' : '',
    toDate: hasValidDates ? this.toDate.value?.toLocaleDateString('en-CA') ?? '' : ''
  };

  this.user.Get_My_Students_Report(
    allDataParams.studentSearch,
    allDataParams.batchSearch,
    allDataParams.courseSearch,
    allDataParams.fromDate,
    allDataParams.toDate,
    1,
    this.totalRecords || 99999,
    this.staffId
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, fullData] = res;
      if (!fullData || fullData.length === 0) {
        alert("No data available to export.");
        return;
      }

      const exportData = fullData.map((item: any) => ({
        'Student ID': item.Student_ID,
        Name: `${item.First_Name} ${item.Last_Name}`,
        Course: item.Course_Name,
        Batch: item.Batch_Name,
        Email: item.Email,
        Contact: item.Phone_Number,
        'Entry Date': new Date(item.Entry_Date).toLocaleDateString('en-GB')
      }));

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const workbook: XLSX.WorkBook = {
        Sheets: { 'Report': worksheet },
        SheetNames: ['Report']
      };

      const excelBuffer: any = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array'
      });

      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      FileSaver.saveAs(blob, 'My_Students_Report.xlsx');
    },
    error: () => alert('Failed to export Excel.')
  });
}

}
