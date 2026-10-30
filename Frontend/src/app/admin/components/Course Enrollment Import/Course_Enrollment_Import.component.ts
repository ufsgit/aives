import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { student_Service } from '../../services/student.Service';
import { HttpClient } from '@angular/common/http';

interface EnrollmentData {
  //  StudentCourse_ID: number;
  // Student_ID: number;
  course_id: number;
  enrollmentDateField_1: string | null;
  expiryDateField_1: string | null;
  Price: number;
  Total_Amount: number;
  // Payment_Date: string | null;
  // Payment_Status: string;
  // LastAccessed_Content_ID?: string;
  // Transaction_Id: string;
  // Delete_Status: number;
  // Payment_Method: string;
  batch_id: number;
  // Slot_Id: number;
  // Additional fields for display
  roll_no: string;
  // student_name: string;
  course_name: string;
  batch_name: string;
  // slot_name: string;
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
  selector: 'app-Course_Enrollment_Import',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './Course_Enrollment_Import.component.html',
  // styleUrls: ['./Course_Enrollment_Import.component.scss']
})
export class Course_Enrollment_ImportComponent {
    file: File | null = null;
  arrayBuffer: any;
Enrollment_Import_Data: EnrollmentData[] = [];
  isUploading: boolean = false;
  isSaving: boolean = false;
  Branch_Data: any[] = [];

  // Field mapping properties
enrollmentDateField: string = 'Admission Date'; // better clarity



expiryDateField: string = 'Admission Expiry Date';
priceField: string = 'Paid Amount';
taxAppliedField: string = 'Tax Applied';

totalAmountField: string = 'Total Amount';
chequeDateField: string = 'Cheque Date';
paymentStatusField: string = 'Payment Status';
detailsField: string = 'Details';
rollNoField: string = 'Roll No'; // or whatever name is in your sheet
courseName: string = 'Course Name'; // or whatever name is in your sheet
batchNameField : string = 'Batches'; // <- Add field name for batch (e.g., "Batch" or "Batch_Name")

 Search_Branch_Data: any[] = [];
   Search_Course_Data: any[] = [];
   batchDropdownData: any[] = [];
Search_Branch_Temp: any = {};

Branch_Id: number = 0;
Search_Branch: any = {};
Search_Course : any = {};
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

  fieldUpload(): void {
    
    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      this.arrayBuffer = fileReader.result;
      const data = new Uint8Array(this.arrayBuffer);
      const arr: string[] = []; // Explicitly type as string array
      for (let i = 0; i !== data.length; ++i)
        arr[i] = String.fromCharCode(data[i]);
      const bstr = arr.join("");
      const workbook = XLSX.read(bstr, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true });
      
      // Map Excel data to match `student` table structure using dynamic field mapping
    this.Enrollment_Import_Data = rawData.map(row => {
  console.log('Processing row:', row);
  console.log('this.enrollmentDateField:', this.enrollmentDateField);

  console.log('Instalment 1 raw value:', row[this.enrollmentDateField]);

  const enrollmentDateField_1_raw = row[this.enrollmentDateField];
   const enrollmentDateField_1 = enrollmentDateField_1_raw ;
   
  const expiryDateField_1_raw = row[this.expiryDateField];
  const expiryDateField_1 = expiryDateField_1_raw ;

 


const courseNameFromExcel = row[this.courseName];
  const batchNameFromExcel = row[this.batchNameField]; // <- Add field name for batch (e.g., "Batch" or "Batch_Name")

  const matchedCourse = this.getCourseByName(courseNameFromExcel);
  const matchedBatch = this.getBatchByName(batchNameFromExcel);
  console.log('matchedCourse: ', matchedCourse);

  return {
    enrollmentDateField_1,
 expiryDateField_1 ,
   
    Price: parseFloat((row[this.priceField] || '0').toString().replace(/[^\d.-]/g, '')),
    Total_Amount: parseFloat((row[this.totalAmountField] || '0').toString().replace(/[^\d.-]/g, '')),
    roll_no: row[this.rollNoField] || '',
    course_id: matchedCourse?.Course_ID || null,
    course_name: matchedCourse?.Course_Name || '',

    batch_id: matchedBatch?.Batch_ID || null,
    batch_name: matchedBatch?.Batch_Name || ''
    // course_id: this.getCourseIdByName(row[this.course_name]) || null // Use the helper function to get course ID,

  };
  
});

      this.isUploading = false;
      console.log('Data imported successfully:', this.Enrollment_Import_Data);
    };

    fileReader.onerror = (error) => {
      console.error('Error reading file:', error);
      this.isUploading = false;
      alert('Error reading file. Please try again.');
    };

    fileReader.readAsArrayBuffer(this.file!);
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
  getValidRecordsCount(): number {
    return this.Enrollment_Import_Data.filter(enrollment => 
      // enrollment.Student_ID > 0 && 
      enrollment.course_id > 0 && 
      enrollment.batch_id > 0 
      // enrollment.Slot_Id > 0
    ).length;
  }
  isValidData(): boolean {
    return this.Enrollment_Import_Data.some(enrollment => 
      // enrollment.Student_ID > 0 && 
      enrollment.course_id > 0 && 
      enrollment.batch_id > 0 
      // enrollment.Slot_Id > 0
    );
  }

  getInvalidRecordsCount(): number {
    return this.Enrollment_Import_Data.length - this.getValidRecordsCount();
  }
removeEnrollment(index: number) {
    this.Enrollment_Import_Data.splice(index, 1);
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
        this.Search_Course_Data  = Rows[0];
      } else if (Array.isArray(Rows)) {
        this.Search_Course_Data  = Rows;
      } else {
        console.error('Unexpected Branch data format:', Rows);
        this.Search_Course_Data  = [];
        return;
      }

      // Add "Select Branch" on top
      const defaultOption = { Course_ID: 0, Course_Name: 'Select Course' };
      this.Search_Course_Data .unshift(defaultOption);
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
        this.batchDropdownData  = Rows[0];
      } else if (Array.isArray(Rows)) {
        this.batchDropdownData  = Rows;
      } else {
        console.error('Unexpected Branch data format:', Rows);
        this.batchDropdownData  = [];
        return;
      }

      // Add "Select Branch" on top
      const defaultOption = { Course_ID: 0, Course_Name: 'Select Course' };
      this.batchDropdownData .unshift(defaultOption);
      this.Search_Course = defaultOption;
    },
    (err) => {
      console.error('Failed to fetch branch data:', err);
    }
  );
}




  clearData(): void {
    this.Enrollment_Import_Data = [];
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
    this.Enrollment_Import_Data.splice(index, 1);
    console.log(`Student at index ${index} removed`);
  }
}