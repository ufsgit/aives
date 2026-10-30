import { Component, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { ExamServiceService } from '../../services/exam-service.service';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { course_Service } from '../../services/course.Service';
import * as FileSaver from 'file-saver';
// import { f } from "../../../../../node_modules/@angular/material/icon-module.d-COXCrhrh";
import { MatIconModule } from '@angular/material/icon';
// ...other Angular Material imports
@Component({
  selector: 'app-exam-import',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './exam-import.component.html',
  styleUrl: './exam-import.component.scss',
})
export class ExamImportComponent {
  examData: any = null;
  questionsPreview: any[] = [];
  fileLoaded: boolean = false;
  manualExam = {
    Course_Name: '',
    Course_ID: null,
    Main_Question: '',
    Time_Limit: null,
    Passing_Score: null,
  };
  allCourse: any = [];
  private course_Service_ = inject(course_Service);
displayedColumns: string[] = [
  'Student_ID',
  'First_Name',
  'Last_Name',
  'Email',
  'Phone_Number',
  'Roll_No',
  'Course_Name',
  'Batch_Name',
  'Admission_Date'
];

  constructor(
    private dialogBox: MatDialog,
    private ExamService: ExamServiceService
  ) {}
  ngOnInit() {
    this.Get_all_courses();
  }
  Get_all_courses() {
    this.course_Service_.Search_course('').subscribe((res) => {
      this.allCourse = res;
    });
  }
  onFileChange(event: any): void {
    const target: DataTransfer = <DataTransfer>event.target;
    if (target.files.length !== 1) {
      console.error('Cannot use multiple files');
      return;
    }

    const reader: FileReader = new FileReader();
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

      const questionSheet = wb.Sheets[wb.SheetNames[0]];
      const questionsRaw = XLSX.utils.sheet_to_json<any>(questionSheet);

      const questions = questionsRaw.map((q: any) => {
        const answerOptions: any = {};
        Object.keys(q).forEach((key) => {
          if (/^[A-Z]$/.test(key)) {
            answerOptions[key] = q[key];
          }
        });

        return {
          Question_ID: q.Question_ID || 0,
          Question_Text: q.Question_Text,
          Answer_Options: answerOptions,
          Correct_Answer: q.Correct_Answer,
          Answer_Media_Name: q.Answer_Media_Name || 'text',
        };
      });

      this.questionsPreview = questions;
      this.fileLoaded = true;
    };

    reader.readAsBinaryString(target.files[0]);
  }

  getOptionKeys(options: any): string[] {
    return Object.keys(options || {});
  }

  submitExam(): void {
    if (!this.questionsPreview.length) return;

    this.examData = {
      Exam_ID: 0, // Optional or generated at backend
      Course_ID: this.manualExam.Course_ID,
      Course_Name: this.manualExam.Course_Name,
      Time_Limit: this.manualExam.Time_Limit,
      Main_Question: this.manualExam.Main_Question,
      Passing_Score: this.manualExam.Passing_Score,
      Questions: this.questionsPreview,
    };

    if (
      !this.manualExam.Course_ID ||
      !this.manualExam.Main_Question ||
      !this.questionsPreview.length ||
      !this.manualExam.Time_Limit ||
      !this.manualExam.Passing_Score
    ) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please fill all required fields', Type: '2' },
      });
      return;
    }
    console.log('Exam Data to be submitted:', this.examData);

    this.ExamService.createExam(this.examData).subscribe((result) => {
      console.log('Exam created successfully', result);

      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Exam questions added successfully!', Type: 'false' },
      });
      this.resetImport();
    });
  }
  onCourseChange(): void {
    const selectedCourse = this.allCourse.find(
      (c) => c.Course_ID === this.manualExam.Course_ID
    );
    this.manualExam.Course_Name = selectedCourse?.Course_Name || '';
  }

  cancelImport(): void {
    this.resetImport();
  }

  resetImport(): void {
    this.examData = null;
    this.questionsPreview = [];
    this.fileLoaded = false;
    this.manualExam = {
      Course_Name: '',
      Course_ID: null,
      Main_Question: '',
      Time_Limit: null,
      Passing_Score: null,
    };
  }

    exportExcel(): void {
      
  const worksheetData: any[][] = [];

  // Optional: Add headers only (no data)
  const headers = this.displayedColumns.map(col => col.replace('_', ' '));
  worksheetData.push(headers);

  const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook: XLSX.WorkBook = { Sheets: { 'Exam Import': worksheet }, SheetNames: ['Exam Import'] };

  const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });

  FileSaver.saveAs(blob, 'Exam_Template.xlsx');
}
}
