import { Component, inject, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ExamServiceService } from '../../services/exam-service.service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';

@Component({
  selector: 'app-create-exam-dialog-component',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './create-exam-dialog-component.component.html',
  styleUrl: './create-exam-dialog-component.component.scss',
})
export class CreateExamDialogComponentComponent {
  examForm: FormGroup;
  questions: any[] = [];
  dialogBox = inject(MatDialog);
  ExamService = inject(ExamServiceService);
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateExamDialogComponentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    const isEdit = data?.isEdit;
    const exam = data?.existingExam || {};

    this.examForm = this.fb.group({
      Exam_ID: data?.Exam_ID || 0,
      Course_ID: [
        exam.Course_ID || data?.examcourseId || '',
        Validators.required,
      ],
      Course_Name: [
        exam.Course_Name || data?.examcourseName || '',
        Validators.required,
      ],
      Main_Question: [exam.Main_Question || '', Validators.required],
      Time_Limit: [exam.Time_Limit || '', Validators.required],
      Passing_Score: [exam.Passing_Score || '', Validators.required],
    });

    if (isEdit && exam.Exam_ID) {
      this.fetchExamQuestions(exam.Exam_ID);
    }
  }
  ngOnInit() {}

  fetchExamQuestions(examId: number) {
    this.ExamService.Get_questions(examId).subscribe((questions) => {
      this.questions = questions.map((q: any) => ({
        ...q,
        Answer_Options:
          typeof q.Answer_Options === 'string'
            ? JSON.parse(q.Answer_Options)
            : q.Answer_Options,
      }));
    });
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  onSave(): void {
    if (this.examForm.valid && this.questions.length > 0) {
      const examInfo = this.examForm.value;

      const payload = {
        Exam_ID: examInfo.Exam_ID,
        Course_ID: examInfo.Course_ID,
        Course_Name: this.data.examcourseName,
        Time_Limit: examInfo.Time_Limit,
        Main_Question: examInfo.Main_Question,
        Passing_Score: examInfo.Passing_Score,
        Questions: this.questions.map((q) => ({
          Question_ID: q.Question_ID || 0,
          Question_Text: q.Question_Text,
          Answer_Options: q.Answer_Options,
          Correct_Answer: q.Correct_Answer,
          Answer_Media_Name: q.Answer_Media_Name || 'text',
        })),
      };

      // Submit only the question payload (or wrap with exam info if needed)
      this.dialogRef.close(payload); // or send to API
    } else {
      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: `Please fill all required fields and add at least one question.`,
          Type: 'false', // shows Yes/No buttons
          Heading: 'Alert',
        },
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  generateAnswerOptions(count: number): any {
    const options: any = {};
    for (let i = 0; i < count; i++) {
      const label = String.fromCharCode(65 + i); 
      options[label] = '';
    }
    return options;
  }

  addOptionToQuestion(index: number): void {
  const question = this.questions[index];
  const existingKeys = Object.keys(question.Answer_Options || {});
  const nextCharCode = 65 + existingKeys.length; // ASCII for next option (E, F, etc.)

  if (nextCharCode <= 90) { // up to 'Z'
    const newKey = String.fromCharCode(nextCharCode);
    question.Answer_Options[newKey] = '';
  } else {
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: `Maximum 26 options allowed (A to Z).`,
        Type: 'false',
        Heading: 'Limit Reached',
      },
    });
  }
}

  addQuestion(): void {
    this.questions.push({
      Question_ID: 0,
      Question_Text: '',
      Answer_Options: this.generateAnswerOptions(4), // Change 4 to any default count
      Correct_Answer: '',
      Answer_Media_Name: 'text',
    });
  }
  getOptionKeys(options: any): string[] {
    return Object.keys(options || {});
  }

  getFilledOptions(options: any): string[] {
    return Object.entries(options || {})
      .filter(([_, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([key]) => key);
  }
}
