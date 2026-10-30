import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ExamServiceService {
  private http = inject(HttpClient);
  constructor() {}

  createExam(result) {
    return this.http.post(
      environment.BasePath + 'exam/Save_Exam_Questions/',
      result
    );
  }
  Get_Exams_With_Course(courseId: number) {
    return this.http.get<any[]>(
      `${environment.BasePath}exam/Get_Exams_With_Course/${courseId}`
    );
  }
  Delete_Exam(Exam_ID) {
    const body = { Exam_ID}
    return this.http.post(environment.BasePath + 'exam/Delete_Exam/', body);
  }
  Get_questions(examId: number) {
  return this.http.get<any[]>(`${environment.BasePath}exam/Get_questions/${examId}`);
}

}
