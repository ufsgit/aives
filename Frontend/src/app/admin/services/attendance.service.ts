import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  private baseUrl = environment.BasePath + 'Attendance/';

  saveAttendance(payload: any): Observable<any> {
    return this.http.post(this.baseUrl + 'Save_Attendance', payload);
  }

  getAttendanceHistory(courseId: number, batchId: number, fromDate: string, toDate: string, page: number = 1, pageSize: number = 10): Observable<any> {
    return this.http.get(this.baseUrl + 'Get_Attendance_History', {
      params: {
        courseId: courseId.toString(),
        batchId: batchId.toString(),
        fromDate: fromDate || '',
        toDate: toDate || '',
        page: page.toString(),
        pageSize: pageSize.toString()
      }
    });
  }

  getAttendanceSummaryReport(studentId: number, courseId: number, batchId: number, fromDate: string, toDate: string, teacherId: number, status: number): Observable<any> {
    return this.http.get(this.baseUrl + 'Get_Attendance_Summary_Report', {
      params: {
        studentId: studentId.toString(),
        courseId: courseId.toString(),
        batchId: batchId.toString(),
        fromDate: fromDate || '',
        toDate: toDate || '',
        teacherId: teacherId.toString(),
        status: status.toString()
      }
    });
  }

  deleteAttendance(courseId: number, batchId: number, date: string): Observable<any> {
    return this.http.post(this.baseUrl + 'Delete_Attendance', {
      courseId,
      batchId,
      date
    });
  }

  getAttendanceDetailsBySession(courseId: number, batchId: number, date: string): Observable<any> {
    return this.http.get(this.baseUrl + 'Get_Attendance_Details_By_Session', {
      params: {
        courseId: courseId.toString(),
        batchId: batchId.toString(),
        date: date || ''
      }
    });
  }
}
