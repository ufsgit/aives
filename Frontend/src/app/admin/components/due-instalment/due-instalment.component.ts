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
  selector: 'app-due-instalment',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatButtonModule, MatIconModule, StudentlistComponent],
  providers: [provideNativeDateAdapter()],
  templateUrl: './due-instalment.component.html',
  styleUrl: './due-instalment.component.scss'
})
export class DueInstalmentComponent   implements OnInit {
  readonly Course = viewChild.required<ElementRef<HTMLInputElement>>('Course');
  readonly Student = viewChild.required<ElementRef<HTMLInputElement>>('Student');
  readonly Batch = viewChild.required<ElementRef<HTMLInputElement>>('Batch');
  // Form Controls
  selectedCourse = new FormControl(null);
  selectedStudent = new FormControl(null);
  selectedBatch = new FormControl(null);
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
  // 'Due_Date',
  // 'Remaining_Amount'
  'Due_Amount' // Assuming this is the column for upcoming fees
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
  IsLoaded = false;
  tempBatchData: any[];
  student_edit: boolean = false;
 student_Details: any;
 Total_Recieved_Amount: any = 0;
  Expense_Amount: any = 0;
  Closing_Amount: any = 0;
  showMoreOptions = false;
  constructor() { }

  ngOnInit() {
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
      this.fetchReportData();
    });
  }

  fetchReportData() {
    this.currentPage = this.currentPage || 1; // fallback to page 1

    this.IsLoaded = false;
    const params = {
      Student_ID: (this.selectedStudent.value as any)?.Student_ID || 0,
      Batch_ID: (this.selectedBatch.value as any)?.Batch_ID || 0,
      Course_ID: (this.selectedCourse.value as any)?.Course_ID || 0,
      fromDate: typeof this.fromDate.value === 'string' ? this.fromDate.value : (this.fromDate.value as any)?.toLocaleDateString('en-CA') || '',
      toDate: typeof this.toDate.value === 'string' ? this.toDate.value : (this.toDate.value as any)?.toLocaleDateString('en-CA') || ''
    };
// Get_Report_Student
    this.user.Get_Due_installments(
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
        this.tableData = data || [];
        this.tableData = data.map(item => ({
  ...item,
  Name: `${item.First_Name} ${item.Last_Name}`
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
    this.fromDate.setValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    this.toDate.setValue(new Date().toISOString().split('T')[0]);
    // this.fromDate.setValue(new Date());
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

  downloadPDF(): void {
  const params = {
    Student_ID: (this.selectedStudent.value as any)?.Student_ID || 0,
    Batch_ID: (this.selectedBatch.value as any)?.Batch_ID || 0,
    Course_ID: (this.selectedCourse.value as any)?.Course_ID || 0,
    fromDate: typeof this.fromDate.value === 'string' ? this.fromDate.value : (this.fromDate.value as any)?.toLocaleDateString('en-CA') || '',
    toDate: typeof this.toDate.value === 'string' ? this.toDate.value : (this.toDate.value as any)?.toLocaleDateString('en-CA') || ''
  };

  // ⚠️ Fetch ALL data (no pagination)
  this.user.Get_Due_installments(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,           // currentPage = 1
    10000        // pageSize = high number to get all records
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, data] = res;

       this.loadImageAsBase64('assets/images/logo2.svg').then((base64Image: string) => {
      const allData = data.map((item: any, index: number) => ({
        No: index + 1,
        Student_ID: item.Student_ID,
        Name: `${item.First_Name} ${item.Last_Name}`,
        Email: item.Email || '',
        Batch: item.Batch_Name || '',
        DueAmount: item.Due_Amount || 0
      }));

      // 🧾 Create PDF
      const doc = new jsPDF();

       doc.addImage(base64Image, 'PNG', 10, 5, 20, 20);

      // 🔹 Title
      doc.setFontSize(14);
      doc.text('Due Installments Report', 35, 20);

      // 🔹 Filter Info
      // doc.setFontSize(11);
      // doc.text(`From Date: ${params.fromDate || 'N/A'}     To Date: ${params.toDate || 'N/A'}`, 14, 25);

      // // 🔹 Table
      autoTable(doc, {
        startY: 30,
        head: [['No.', 'Student ID', 'Name', 'Email', 'Batch', 'Due Amount']],
        body: allData.map(row => [
          row.No,
          row.Student_ID,
          row.Name,
          row.Email,
          row.Batch,
          row.DueAmount
        ]),
        styles: {
          fontSize: 8,
     
        }
      });

      doc.save('due-installments-report.pdf');
        }).catch(err => {
        console.error('Image loading failed:', err);
        alert('Failed to load logo image.');
      });
    },
    error: () => alert('Error generating PDF.')
  });
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

  this.user.Get_Due_installments(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,
    10000 // High value to get all data
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, data] = res;

      const allData = data.map((item: any, index: number) => ({
        No: index + 1,
        Student_ID: item.Student_ID,
        Name: `${item.First_Name} ${item.Last_Name}`,
        Email: item.Email || '',
        Batch: item.Batch_Name || '',
        Due_Amount: item.Due_Amount || 0
      }));

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(allData);
      const workbook: XLSX.WorkBook = {
        Sheets: { 'Due Installments': worksheet },
        SheetNames: ['Due Installments']
      };

      const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });

      FileSaver.saveAs(blob, `Due_Installments_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },
    error: () => {
      alert('Error exporting to Excel.');
    }
  });
}


}