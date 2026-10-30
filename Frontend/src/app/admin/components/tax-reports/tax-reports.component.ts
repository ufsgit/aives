import { Component, inject, OnInit, ViewChild, ElementRef, viewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { course_Service } from '../../services/course.Service';
import { student_Service } from '../../services/student.Service';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ExpenseTypeService } from '../../services/expense-type.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { LOCALE_ID } from '@angular/core';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { registerLocaleData } from '@angular/common';
import localeGb from '@angular/common/locales/en-GB';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';


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
  selector: 'app-tax-reports',
  standalone: true,
 imports: [CommonModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatAutocompleteModule, MatDatepickerModule, MatButtonModule, MatIconModule, MatNativeDateModule, ],
  providers: [provideNativeDateAdapter(), { provide: LOCALE_ID, useValue: 'en-GB' }, // for dd-MM-yyyy support
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }],
  templateUrl: './tax-reports.component.html',
  styleUrl: './tax-reports.component.scss'
})
export class TaxReportsComponent implements OnInit {
  readonly Course = viewChild.required<ElementRef<HTMLInputElement>>('Course');
  readonly Student = viewChild.required<ElementRef<HTMLInputElement>>('Student');
  readonly Batch = viewChild.required<ElementRef<HTMLInputElement>>('Batch');
  // Form Controls
  selectedCourse = new FormControl();
  selectedStudent = new FormControl();
  selectedBatch = new FormControl();
  fromDate = new FormControl(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  // fromDate = new FormControl(new Date());
  toDate = new FormControl(new Date());
  private user = inject(user_Service);
  private course = inject(course_Service);
  private student_Service_ = inject(student_Service);
   branchName:string="";
   totalEntries = '';

  // Table Data
displayedColumns = [
  'Receipt_Id',
  // 'First_Name',
  'Student_Id',
  'Course_Name',
  // 'Branch',
  // 'Account_Id',
  'Amount',
  'Netvalue',
  'Gst',
  'Cgst',
  'Sgst',
  // 'Payment_mode',
  // 'Transaction_ID',
  'Payment_Date'
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

  constructor(private expenseApi: ExpenseTypeService,) { }

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
      this.fetchReportData();
    });
  }

  fetchReportData() {
    this.currentPage = this.currentPage || 1; // fallback to page 1

    this.IsLoaded = false;
    const params = {
      Student_ID: this.selectedStudent.value?.Student_ID || 0,
      Batch_ID: this.selectedBatch.value?.Batch_ID || 0,
      Course_ID: this.selectedCourse.value?.Course_ID || 0,
      fromDate: this.fromDate.value?.toLocaleDateString('en-CA') || '',
      toDate: this.toDate.value?.toLocaleDateString('en-CA') || ''
    };
    this.expenseApi.Get_Tax_Reports(
      params.Student_ID,
      params.Batch_ID,
      params.Course_ID,
      params.fromDate,
      params.toDate,
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (res: any[]) => {
        console.log("res",res);
        
        const [countResult, data] = res;
        this.totalRecords = countResult?.[0]?.totalRecords || 0;
        this.tableData = data || [];
      },
      complete: () => this.IsLoaded = true
    });
  }
  displayFn(item: any): string {
    return item ? item.Course_Name || item.First_Name || item.Batch_Name || '' : '';
  }
  filter(type: 'course' | 'student' | 'batch'): void {
    let filterValue: string;
    let dataSource: any[];
    let filteredArray: any[];
    let propertyName: string;

    switch (type) {
      case 'course':
        this.bacthfilteredOptions = []
        this.selectedBatch.setValue('')
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
    this.fromDate.setValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.toDate.setValue(new Date());
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
    Student_ID: this.selectedStudent.value?.Student_ID || 0,
    Batch_ID: this.selectedBatch.value?.Batch_ID || 0,
    Course_ID: this.selectedCourse.value?.Course_ID || 0,
    fromDate: this.fromDate.value?.toLocaleDateString('en-CA') || '',
    toDate: this.toDate.value?.toLocaleDateString('en-CA') || ''
  };

  this.expenseApi.Get_Tax_Reports(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,
    this.totalRecords || 99999
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, fullData] = res;
      if (!fullData?.length) {
        alert('No data available to download.');
        return;
      }

      // Step 1: Load image and generate PDF
      this.loadImageAsBase64('assets/images/logo2.svg').then((base64Image: string) => {
        const formattedData = fullData.map((row: any, index: number) => [
          index + 1,
          row.Receipt_Id,
          row.Student_Id,
          row.Course_Name,
          row.Amount,
          row.Netvalue,
          row.Gst,
          row.Cgst,
          row.Sgst,
          new Date(row.Payment_Date).toLocaleDateString('en-GB')
        ]);

 this.branchName = [...new Set(fullData.map(item => item.Branch_Name).filter(name => !!name))].join(', ');
   console.log('this.branchName>',fullData[0].Branch_Name
);


        const doc = new jsPDF();

  const courseName = this.selectedCourse?.value?.Course_Name || 'All Courses';
  const batchName = this.selectedBatch?.value?.Batch_Name || 'All Batches';
  const branchName = this.branchName || 'All Branches'; // assuming `selectedBranch`
  const fromDateStr = this.fromDate.value ? new Date(this.fromDate.value).toLocaleDateString('en-GB') : 'N/A';
  const toDateStr = this.toDate.value ? new Date(this.toDate.value).toLocaleDateString('en-GB') : 'N/A';
  const totalEntries = this.totalRecords || 0;

    // Step 3: Add title
    let currentY = 10;
    doc.setFontSize(14);
  doc.text('Tax Report', 105, currentY , { align: 'center' });
 currentY += 1;
        // Step 2: Add logo image
        doc.addImage(base64Image, 'PNG', 10, 10, 20, 20);
        // Branch Name to right of logo
    doc.text(`${branchName || 'N/A'}`, 35, currentY + 10 );
  currentY += 20;
        // // Step 3: Add title
        // doc.setFontSize(14);
        // doc.text('Tax Report', 35, 20);

        // Step 4: Add table
          // --- Filter Info Section ---
const pageCenter = 105; // A4 center in mm

doc.setFontSize(10);

// Line 1: Course | Batch
doc.text(`Course: ${courseName}`, pageCenter - 70, currentY);
doc.text(`Batch: ${batchName}`, pageCenter + 20, currentY);
currentY += 6;

// Line 2: From | To
doc.text(`From: ${fromDateStr}`, pageCenter - 70, currentY);
doc.text(`To: ${toDateStr}`, pageCenter + 20, currentY);
currentY += 6;

// Line 3: Total Entries (you can center it or align with left side)
doc.text(`Total Entries: ${totalEntries}`, pageCenter - 70, currentY);
currentY += 5;
        autoTable(doc, {
          head: [['#', 'Receipt ID', 'Student ID', 'Course', 'Amount', 'Net Value', 'GST', 'CGST', 'SGST', 'Payment Date']],
          body: formattedData,
          startY: currentY,
          styles: { fontSize: 8 }
        });

        // Step 5: Save the PDF
        doc.save('Tax_Report.pdf');
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
    Student_ID: this.selectedStudent.value?.Student_ID || 0,
    Batch_ID: this.selectedBatch.value?.Batch_ID || 0,
    Course_ID: this.selectedCourse.value?.Course_ID || 0,
    fromDate: this.fromDate.value?.toLocaleDateString('en-CA') || '',
    toDate: this.toDate.value?.toLocaleDateString('en-CA') || ''
  };

  this.expenseApi.Get_Tax_Reports(
    params.Student_ID,
    params.Batch_ID,
    params.Course_ID,
    params.fromDate,
    params.toDate,
    1,
    this.totalRecords || 99999
  ).subscribe({
    next: (res: any[]) => {
      const [countResult, fullData] = res;
      if (!fullData?.length) {
        alert('No data available to export.');
        return;
      }

      // Format the data for Excel
      const exportData = fullData.map((item: any) => ({
        'Receipt ID': item.Receipt_Id,
        'Student ID': item.Student_Id,
        'Course': item.Course_Name,
        'Amount': item.Amount,
        'Net Value': item.Netvalue,
        'GST': item.Gst,
        'CGST': item.Cgst,
        'SGST': item.Sgst,
        'Payment Date': new Date(item.Payment_Date).toLocaleDateString('en-GB')
      }));

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      const workbook: XLSX.WorkBook = {
        Sheets: { 'Tax Report': worksheet },
        SheetNames: ['Tax Report']
      };

      const excelBuffer: any = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array'
      });

      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      FileSaver.saveAs(blob, 'Tax_Report.xlsx');
    },
    error: () => alert('Failed to export Excel.')
  });
}


}
