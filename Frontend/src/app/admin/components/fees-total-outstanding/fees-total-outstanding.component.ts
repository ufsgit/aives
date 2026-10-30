import { Component, inject, OnInit, ViewChild, ElementRef, viewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { course_Service } from '../../services/course.Service';
import { student_Service } from '../../services/student.Service';
import { provideNativeDateAdapter } from '@angular/material/core';
import { StudentlistComponent } from "../studentlist/studentlist.component";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';


@Component({
  selector: 'app-fees-total-outstanding',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatButtonModule, MatIconModule, StudentlistComponent],
  providers: [provideNativeDateAdapter()],
  templateUrl: './fees-total-outstanding.component.html',
  styleUrl: './fees-total-outstanding.component.scss'
})
export class FeesTotalOutstandingComponent implements OnInit {
  readonly Course = viewChild.required<ElementRef<HTMLInputElement>>('Course');
  readonly Student = viewChild.required<ElementRef<HTMLInputElement>>('Student');
  readonly Batch = viewChild.required<ElementRef<HTMLInputElement>>('Batch');
  // Form Controls
  selectedCourse = new FormControl(null);
  selectedStudent = new FormControl(null);
  selectedBatch = new FormControl(null);
  selectedAdmissionYear = new FormControl('');
  selectedStudentStatus = new FormControl('');
  fromDate = new FormControl(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  toDate = new FormControl(new Date().toISOString().split('T')[0]);
  private user = inject(user_Service);
  private course = inject(course_Service);
  private student_Service_ = inject(student_Service);

  // Table Data
 displayedColumns = [
  'Student_ID',
  'Name', // merged First_Name + Last_Name
  'Email',
  'Batch_Name',
  // 'Entry_Date',
  'Outstanding_Amount', // Assuming this is the column for outstanding fees
  'Active_Status'       // Student Status from student record
];

  totalDuration = '';
  tableData: any[] = [];
  // Pagination
  pageSize = 10;
  currentPage = 1;
  totalRecords = 0;
  Math = Math;

  // Filter Options
  courseDatas: any[] = [];
  studentDatas: any[] = [];
  BatchDatas: any[] = [];
  coursefilteredOptions: any[] = [];
  studentfilteredOptions: any[] = [];
  bacthfilteredOptions: any[] = [];
  admissionYearOptions: string[] = [];
  IsLoaded = false;
  tempBatchData: any[];
  student_edit: boolean = false;
 student_Details: any;
  Total_Recieved_Amount: any = 0;
  Expense_Amount: any = 0;
  Closing_Amount: any = 0;
  allTableData: any[] = [];
  rawTableData: any[] = [];
  studentAdmissionYearMap = new Map<number, string>();
  studentStatusMap = new Map<number, string>();
  showMoreOptions = false;
  constructor() { }

  getColumnLabel(column: string): string {
    if (column === 'Active_Status') return 'Status';
    return column.replace(/_/g, ' ');
  }

  formatDateOnly(dateValue: any): string {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue).split('T')[0] || '';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  ngOnInit() {
    this.selectedAdmissionYear.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.refreshFilteredData();
    });
    this.selectedStudentStatus.valueChanges.subscribe(() => {
      this.currentPage = 1;
      this.refreshFilteredData();
    });
    this.loadInitialData();
  }

  loadInitialData() {
    forkJoin({
      courseNames: this.course.get_course_names(),
      courseItems: this.course.Get_All_Course_Items(),
      students: this.student_Service_.Get_All_Students('')
    }).subscribe(({ courseNames, courseItems, students }) => {
      this.courseDatas = this.coursefilteredOptions = courseNames[0];
      this.studentDatas = this.studentfilteredOptions = students;
      this.BatchDatas = this.bacthfilteredOptions = courseItems[3];
      this.tempBatchData = [...this.BatchDatas]; // Initialize tempBatchData
      this.studentAdmissionYearMap = new Map(
        (students || []).map((student: any) => [
          Number(student.Student_ID),
          this.getAdmissionStartYear(student)
        ])
      );
      // Build Active_Status lookup map
      this.studentStatusMap = new Map(
        (students || []).map((student: any) => {
          let status = student.Active_Status || '';
          if (!status) {
            status = student.isActive ? 'Active' : 'Dropout';
          } else {
            const s = status.toString().toLowerCase();
            if (s === 'active') status = 'Active';
            else if (s === 'dropout' || s === 'deactivated') status = 'Dropout';
            else if (s === 'completed') status = 'Completed';
          }
          return [Number(student.Student_ID), status];
        })
      );
      // Build Admission Year options from Batch Start Dates
      const admissionYears: string[] = (this.BatchDatas || [])
        .map((batch: any) => this.extractYearFromDate(batch.Start_Date))
        .filter((year: string): year is string => !!year);
      this.admissionYearOptions = [...new Set<string>(admissionYears)].sort(
        (a, b) => Number(b) - Number(a)
      );
      this.fetchReportData();
    });
  }

  fetchReportData() {
    this.IsLoaded = false;
    const params = {
      Student_ID: (this.selectedStudent.value as any)?.Student_ID || 0,
      Batch_ID: (this.selectedBatch.value as any)?.Batch_ID || 0,
      Course_ID: (this.selectedCourse.value as any)?.Course_ID || 0,
      fromDate: this.fromDate.value && typeof this.fromDate.value === 'string' ? this.fromDate.value : (this.fromDate.value as any)?.toLocaleDateString('en-CA') || '',
      toDate: this.toDate.value && typeof this.toDate.value === 'string' ? this.toDate.value : (this.toDate.value as any)?.toLocaleDateString('en-CA') || ''
    };

    this.user.Get_Outstanding_Student(
      params.Student_ID,
      params.Batch_ID,
      params.Course_ID,
      params.fromDate,
      params.toDate,
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (res: any[]) => {
        const [countResult, data] = res;
        this.totalRecords = countResult?.[0]?.totalRecords || 0;
        this.Total_Recieved_Amount = countResult?.[0]?.Total_Amount || 0;
        this.Expense_Amount = countResult?.[0]?.Total_Paid_Amount || 0;
        this.Closing_Amount = countResult?.[0]?.Outstanding_Amount || 0;
        
        this.tableData = (data || []).map(item => ({
          ...item,
          Name: `${item.First_Name} ${item.Last_Name}`.trim(),
          Active_Status: item.Active_Status || this.studentStatusMap.get(Number(item.Student_ID)) || ''
        }));
      },
      complete: () => this.IsLoaded = true
    });
  }
  displayFn(item: any): string {
    return item ? item.Course_Name || item.First_Name || item.Batch_Name || '' : '';
  }

  onCancelEdit(): void {
  this.student_edit = false; // Set view back to list
}
 onSaveStudent(event: any): void {
  this.student_edit = false; 
}

  student_List_Update(item: any) {
    this.student_edit = true;
    this.student_Details = item;
    console.log('item', item);
  }
  
  filter(type: 'course' | 'student' | 'batch'): void {
    let filterValue: string;
    let dataSource: any[];
    let filteredArray: any[];
    let propertyName: string;

    switch (type) {
      case 'course':
        this.bacthfilteredOptions = []
        this.selectedBatch.setValue(null)
        filterValue = this.Course().nativeElement.value.toLowerCase();
        dataSource = this.courseDatas;
        filteredArray = this.coursefilteredOptions;
        console.log(' this.coursefilteredOptions: ', this.coursefilteredOptions);
        propertyName = 'Course_Name';

        // When course changes, filter the batch data based on selected course ID
        this.filterBatchData();
        break;
      case 'student':
        filterValue = this.Student().nativeElement.value.toLowerCase();
        dataSource = this.studentDatas;
        filteredArray = this.studentfilteredOptions;
        propertyName = 'First_Name';
        break;
      case 'batch':
        filterValue = this.Batch().nativeElement.value.toLowerCase();
        dataSource = this.tempBatchData; // Use temporary array
        filteredArray = this.bacthfilteredOptions;
        propertyName = 'Batch_Name';
        break;
    }
    console.log('filterValue: ', filterValue);

    filteredArray = dataSource.filter(o =>
      o[propertyName].toLowerCase().includes(filterValue)
    );

    // Update the appropriate filtered options array
    switch (type) {
      case 'course':
        this.coursefilteredOptions = filteredArray;
        break;
      case 'student':
        this.studentfilteredOptions = filteredArray;
        break;
      case 'batch':
        this.bacthfilteredOptions = filteredArray;
        break;
    }
  }
  filterBatchData(): void {
    console.log('his.selectedCourse: ', this.selectedCourse);
    const selectedCourseId = this.selectedCourse.value; // Adjust based on your form control value structure

    if (selectedCourseId) {
      this.tempBatchData = this.BatchDatas.filter(batch => batch.Course_ID == selectedCourseId['Course_ID']);
    } else {
      this.tempBatchData = [...this.BatchDatas];
    }
    console.log('Filtered batch data: ', this.tempBatchData);
  }

  clearFilters() {
    [this.selectedCourse, this.selectedStudent, this.selectedBatch].forEach(control => control.reset());
    this.selectedAdmissionYear.reset('');
    this.selectedStudentStatus.reset('');
    this.fromDate.setValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    this.toDate.setValue(new Date().toISOString().split('T')[0]);
    this.currentPage = 1;
    this.fetchReportData();
  }

  onPageChange(event: { pageIndex: number, pageSize: number }) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.fetchReportData();
  }
  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  private extractAdmissionStartYear(academicYear: string): string {
    if (!academicYear) {
      return '';
    }
    const match = academicYear.match(/\d{4}/);
    return match ? match[0] : '';
  }

  private extractYearFromDate(dateValue: any): string {
    if (!dateValue) {
      return '';
    }

    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return String(parsed.getFullYear());
    }

    const match = String(dateValue).match(/\d{4}/);
    return match ? match[0] : '';
  }

  private getAdmissionStartYear(student: any): string {
    return (
      this.extractAdmissionStartYear(student?.Academic_Year || '') ||
      this.extractYearFromDate(student?.Admission_Date)
    );
  }

  private applyAdmissionYearFilter(rows: any[]): any[] {
    const selectedYear = String(this.selectedAdmissionYear.value ?? '').trim();
    if (!selectedYear) {
      return rows;
    }
    return rows.filter((row) => String(row.Admission_Start_Year ?? '').trim() === selectedYear);
  }

  private applyStudentStatusFilter(rows: any[]): any[] {
    const selectedStatus = String(this.selectedStudentStatus.value ?? '').trim();
    if (!selectedStatus) {
      return rows;
    }
    return rows.filter((row) => String(row.Active_Status ?? '').trim() === selectedStatus);
  }

  private refreshFilteredData(): void {
    this.fetchReportData();
  }

  private updatePagedTableData(): void {
    this.fetchReportData();
  }

downloadPDF(): void {
  const params = {
    Student_ID: (this.selectedStudent.value as any)?.Student_ID || 0,
    Batch_ID: (this.selectedBatch.value as any)?.Batch_ID || 0,
    Course_ID: (this.selectedCourse.value as any)?.Course_ID || 0,
    fromDate: typeof this.fromDate.value === 'string' ? this.fromDate.value : (this.fromDate.value as any)?.toLocaleDateString('en-CA') || '',
    toDate: typeof this.toDate.value === 'string' ? this.toDate.value : (this.toDate.value as any)?.toLocaleDateString('en-CA') || ''
  };

  this.user.Get_Outstanding_Student(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,
    10000
  ).subscribe({
    next: (res: any[]) => {
      const data = res[1]; // Assuming response structure is [status, data]

      const allData = data.map((item: any, index: number) => [
        index + 1,                            // No.
        item.Student_ID || '',               // Student ID
        `${item.First_Name} ${item.Last_Name}`.trim(), // Name
        item.Email || '',                    // Email
        item.Batch_Name || '',               // Batch
        this.formatDateOnly(item.Entry_Date), // Entry Date (date only, no time)
        item.Outstanding_Amount || 0         // Outstanding Amount
      ]);

      this.loadImageAsBase64('assets/images/logo2.svg').then((base64Image: string) => {
        const doc = new jsPDF();

        // 🔹 Add Logo
        doc.addImage(base64Image, 'PNG', 10, 5, 20, 20);

        // 🔹 Title
        doc.setFontSize(14);
        doc.text('Total-outstanding Report', 35, 20);

        // 🔹 Table
        autoTable(doc, {
          startY: 30,
          head: [['No.', 'Student ID', 'Name', 'Email', 'Batch', 'Entry Date', 'Outstanding Amount']],
          body: allData,
          styles: { fontSize: 8 }
        });

        doc.save('outstanding-report.pdf');
      }).catch((err) => {
        console.error('Logo image failed to load:', err);
        alert('Failed to load logo image.');
      });
    },
    error: () => alert('Failed to generate PDF.')
  });
}


loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // allow CORS
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = (err) => reject(err);
  });
}


exportToExcel(): void {
  const params = {
    Student_ID: (this.selectedStudent.value as any)?.Student_ID || 0,
    Batch_ID: (this.selectedBatch.value as any)?.Batch_ID || 0,
    Course_ID: (this.selectedCourse.value as any)?.Course_ID || 0,
    fromDate: typeof this.fromDate.value === 'string' ? this.fromDate.value : (this.fromDate.value as any)?.toLocaleDateString('en-CA') || '',
    toDate: typeof this.toDate.value === 'string' ? this.toDate.value : (this.toDate.value as any)?.toLocaleDateString('en-CA') || ''
  };

  this.user.Get_Outstanding_Student(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,
    10000 // Fetch all
  ).subscribe({
    next: (res: any[]) => {
      const [_, data] = res;

      const allData = data.map((item: any, index: number) => ({
        No: index + 1,
        Student_ID: item.Student_ID,
        Name: `${item.First_Name} ${item.Last_Name}`,
        Email: item.Email || '',
        Batch: item.Batch_Name || '',
        Entry_Date: this.formatDateOnly(item.Entry_Date),
        Outstanding_Amount: item.Outstanding_Amount || 0
      }));

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(allData);
      const workbook: XLSX.WorkBook = {
        Sheets: { 'Outstanding Report': worksheet },
        SheetNames: ['Outstanding Report']
      };

      const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });

      FileSaver.saveAs(blob, `Total_Outstanding_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
    error: () => alert('Failed to export Excel.')
  });
}


}
