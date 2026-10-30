import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { student_Service } from '../../services/student.Service';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import * as FileSaver from 'file-saver';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';

interface InstallmentData {
  installment_date_1: Date | null;

  is_paid: number;
  amount: number;
  tax_applied: number;
  tax_amount: number;
  payment_mode: string;
  cheque_date: Date | null;
  payment_status: string;
  details: string;
  roll_no: string;
  course_id: number;
  course_name: string;
  batch_id: number;
  batch_name: string;

}


interface CourseData {
  course_id: number;
  course_name: string;
}
const courseList: CourseData[] = [
  { course_id: 1, course_name: "Mathematics" },
  { course_id: 2, course_name: "Physics" },
  { course_id: 3, course_name: "Chemistry" },
  // ... more courses
];
@Component({
  selector: 'app-payment_installment_file_import',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule],
  templateUrl: './payment_installment_file_import.component.html',
  styleUrls: ['./payment_installment_file_import.component.scss']
})
export class payment_installment_file_importComponent {
  dialogBox = inject(MatDialog);
  file: File | null = null;
  arrayBuffer: any;
  Installments_Import_Data: InstallmentData[] = [];
  isUploading: boolean = false;
  isSaving: boolean = false;
  Branch_Data: any[] = [];

  // Field mapping properties
  installment1DateField: string = 'installment date_1';
  isPaidField: string = 'is paid';
  amountField: string = 'amount';
  taxAppliedField: string = 'tax applied';
  taxAmountField: string = 'tax amount';
  paymentModeField: string = 'payment mode';
  chequeDateField: string = 'cheque date';
  paymentStatusField: string = 'payment status';
  detailsField: string = 'details';
  rollNoField: string = 'roll no';
  batchNameField: string = 'batch name';
  courseNameField: string = 'course name';

  Search_Branch_Data: any[] = [];
  Search_Course_Data: any[] = [];
  batchDropdownData: any[] = [];
  Search_Branch_Temp: any = {};
  displayedColumns: string[] = [
    'installment_date_1',
    'is_paid',
    'amount',
    'tax_applied',
    'tax_amount',
    'payment_mode',
    'cheque_date',
    'payment_status',
    'details',
    'roll_no',
    'course_name',
    'batch_name'
  ];

  Branch_Id: number = 0;
  Search_Branch: any = {};
  Search_Course: any = {};
  // branchNameField: string = 'Branch Name';
  // branchIdField: string = 'Branch Id';
  constructor(private http: HttpClient, private student_Service_: student_Service) {
    this.Course_Dropdown();
    this.loadBatches();
  }
  onFileSelected(event: any): void {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.file = selectedFile;

    }
  }

  uploadFile(): void {
    if (!this.file) {
      alert('Please select a file first!');
      return;
    }

    this.isUploading = true;
    this.fieldUpload();
  }

  // fieldUpload(): void {
  //   
  //   let fileReader = new FileReader();
  //   fileReader.onload = (e) => {
  //     this.arrayBuffer = fileReader.result;
  //     const data = new Uint8Array(this.arrayBuffer);
  //     const arr: string[] = []; // Explicitly type as string array
  //     for (let i = 0; i !== data.length; ++i)
  //       arr[i] = String.fromCharCode(data[i]);
  //     const bstr = arr.join("");
  //     const workbook = XLSX.read(bstr, { type: "binary" });
  //     const firstSheetName = workbook.SheetNames[0];
  //     const worksheet = workbook.Sheets[firstSheetName];
  //     const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true });
  //     
  //     // Map Excel data to match `student` table structure using dynamic field mapping
  //     this.Installments_Import_Data = rawData.map(row => {
  //       console.log('Processing row:', row);
  //       console.log('this.installment1DateField:', this.installment1DateField);

  //       console.log('Instalment 1 raw value:', row[this.installment1DateField]);

  //       const installment_date_1_raw = row[this.installment1DateField];


  //       const installment_date_1 = installment_date_1_raw;
  //       const courseNameFromExcel = row[this.courseName];
  //       const batchNameFromExcel = row[this.batchNameField]; // <- Add field name for batch (e.g., "Batch" or "Batch_Name")

  //       const matchedCourse = this.getCourseByName(courseNameFromExcel);
  //       const matchedBatch = this.getBatchByName(batchNameFromExcel);
  //       console.log('matchedCourse: ', matchedCourse);

  //       return {
  //         installment_date_1,

  //         is_paid: row[this.isPaidField]?.toString().toLowerCase() === 'paid' ? 1 : 0,
  //         amount: parseFloat((row[this.amountField] || '0').toString().replace(/[^\d.-]/g, '')),
  //         tax_applied: parseFloat((row[this.taxAppliedField] || '0').toString()),
  //         tax_amount: parseFloat((row[this.taxAmountField] || '0').toString().replace(/[^\d.-]/g, '')),
  //         payment_mode: row[this.paymentModeField] || '',
  //         cheque_date: row[this.chequeDateField] ? new Date(row[this.chequeDateField]) : null,
  //         payment_status: row[this.paymentStatusField] || '',
  //         details: row[this.detailsField] || '',
  //         roll_no: row[this.rollNoField] || '',
  //         course_id: matchedCourse?.Course_ID || null,
  //         course_name: matchedCourse?.Course_Name || '',

  //         batch_id: matchedBatch?.Batch_ID || null,
  //         batch_name: matchedBatch?.Batch_Name || ''
  //         // course_id: this.getCourseIdByName(row[this.course_name]) || null // Use the helper function to get course ID,

  //       };

  //     });

  //     this.isUploading = false;
  //     console.log('Data imported successfully:', this.Installments_Import_Data);
  //   };

  //   fileReader.onerror = (error) => {
  //     console.error('Error reading file:', error);
  //     this.isUploading = false;
  //     alert('Error reading file. Please try again.');
  //   };

  //   fileReader.readAsArrayBuffer(this.file!);
  // }
  fieldUpload(): void {
    if (!this.file) {
      alert('No file selected.');
      return;
    }

    const fileReader = new FileReader();
    this.isUploading = true;

    fileReader.onload = (e) => {
      this.arrayBuffer = fileReader.result;
      const data = new Uint8Array(this.arrayBuffer);
      const arr = Array.from(data, byte => String.fromCharCode(byte));
      const bstr = arr.join("");
      const workbook = XLSX.read(bstr, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true });

      console.log("rawData", rawData);

      this.Installments_Import_Data = rawData.map(row => {
        const installment_date_1_raw = row[this.installment1DateField];
        const courseNameFromExcel = row[this.courseNameField];
        const batchNameFromExcel = row[this.batchNameField];

        const matchedCourse = this.getCourseByName(courseNameFromExcel);
        const matchedBatch = this.getBatchByName(batchNameFromExcel);

        return {
          installment_date_1: installment_date_1_raw ? new Date(installment_date_1_raw) : null,
          is_paid: (row[this.isPaidField]?.toString().toLowerCase() === 'paid' || row[this.isPaidField] === '1') ? 1 : 0,
          amount: parseFloat((row[this.amountField] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0,
          tax_applied: parseFloat((row[this.taxAppliedField] ?? '0').toString()) || 0,
          tax_amount: parseFloat((row[this.taxAmountField] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0,
          payment_mode: row[this.paymentModeField]?.toString() || '',
          cheque_date: row[this.chequeDateField] ? new Date(row[this.chequeDateField]) : null,
          payment_status: row[this.paymentStatusField]?.toString() || '',
          details: row[this.detailsField]?.toString() || '',
          roll_no: row[this.rollNoField]?.toString() || '',
          course_id: matchedCourse?.Course_ID || null,
          course_name: matchedCourse?.Course_Name || '',
          batch_id: matchedBatch?.Batch_ID || null,
          batch_name: matchedBatch?.Batch_Name || ''
        };
      });

      this.isUploading = false;
      console.log('Data imported successfully:', this.Installments_Import_Data);

    };

    fileReader.onerror = (error) => {
      console.error('Error reading file:', error);
      this.isUploading = false;
      alert('Error reading file. Please try again.');
    };

    fileReader.readAsArrayBuffer(this.file);
  }


  getCourseIdByName(courseName: string): number | null {
    const course = this.Search_Course_Data.find(course =>
      course.course_name && course.course_name.toLowerCase() === courseName.toLowerCase()
    );
    return course ? course.course_id : null;
  }
  getBatchByName(batchName: string): any {
    if (!batchName) return null;

    return this.batchDropdownData.find(b =>
      b?.Batch_Name?.trim().toLowerCase() === batchName.trim().toLowerCase()
    );
  }

  exportExcel(): void {

    const worksheetData: any[][] = [];

    // Optional: Add headers only (no data)
    const headers = this.displayedColumns.map(col => col.replace('_', ' '));
    worksheetData.push(headers);

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook: XLSX.WorkBook = { Sheets: { 'Installments': worksheet }, SheetNames: ['Installments'] };

    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

    FileSaver.saveAs(blob, 'Installment_Template.xlsx');
  }
  getCourseByName(name: string): any {
    if (!name || typeof name !== 'string') return null;

    return this.Search_Course_Data.find(
      c => c.Course_Name && c.Course_Name.trim().toLowerCase() === name.trim().toLowerCase()
    );
  }


  Course_Dropdown() {
    this.student_Service_.Course_Dropdown().subscribe(
      (Rows) => {
        console.log('Raw Branch Response:', Rows);

        // If Rows is an object, try:
        if (Rows && Array.isArray(Rows[0])) {
          this.Search_Course_Data = Rows[0];
        } else if (Array.isArray(Rows)) {
          this.Search_Course_Data = Rows;
        } else {
          console.error('Unexpected Branch data format:', Rows);
          this.Search_Course_Data = [];
          return;
        }

        // Add "Select Branch" on top
        const defaultOption = { Course_ID: 0, Course_Name: 'Select Course' };
        this.Search_Course_Data.unshift(defaultOption);
        this.Search_Course = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }
  loadBatches() {
    this.student_Service_.loadBatches().subscribe(
      (Rows) => {
        console.log('Raw Branch Response:', Rows);

        // If Rows is an object, try:
        if (Rows && Array.isArray(Rows[0])) {
          this.batchDropdownData = Rows[0];
        } else if (Array.isArray(Rows)) {
          this.batchDropdownData = Rows;
        } else {
          console.error('Unexpected Branch data format:', Rows);
          this.batchDropdownData = [];
          return;
        }

        // Add "Select Branch" on top
        const defaultOption = { Course_ID: 0, Course_Name: 'Select Course' };
        this.batchDropdownData.unshift(defaultOption);
        this.Search_Course = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }
  saveAllInstallments(): void {
    if (this.Installments_Import_Data.length === 0) {
      this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'No data to save!', Type: '3' },
          });
      return;
    }

    const payload = {
      students: this.Installments_Import_Data
    };

    console.log('Saving students data with branch:', payload);
    ;

    this.isSaving = true;

    this.student_Service_.saveInstallmentsImport(payload).subscribe(
      response => {
        console.log('Students saved successfully:', response);
        this.isSaving = false;

        if (response && Array.isArray(response) && response.length > 0) {
          const res = response[0];
          const { status, message, summary, total_records, processed_count, skipped_count, error_count } = res;

          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: `✅ ${summary}
                  📦 Total Records: ${total_records}
                  ✔️ Processed: ${processed_count}
                  ⏭️ Skipped: ${skipped_count}
                  ❌ Errors: ${error_count}`, Type: 'false'
            },
          });


        } else {
          alert('⚠️ Import completed, but no summary returned from server.');
        }

        // Optionally reset form or state
        this.clearData();
      },
      error => {
        console.error('Error saving students:', error);
        this.isSaving = false;

        let errorMessage = '❌ Failed to save installments. Please try again.';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }

        alert(errorMessage);
      }
    );
  }



  clearData(): void {
    this.Installments_Import_Data = [];
    this.file = null;
    this.arrayBuffer = null;

    // Reset file input
    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    console.log('Data cleared');
  }

  removeStudent(index: number): void {
    this.Installments_Import_Data.splice(index, 1);
    console.log(`Student at index ${index} removed`);
  }
}