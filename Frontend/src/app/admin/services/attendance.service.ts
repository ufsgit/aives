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

  getAttendanceCourses(staffId: number = 0): Observable<any> {
    const params: any = {};
    if (staffId > 0) {
      params.staffId = staffId.toString();
    }
    return this.http.get(this.baseUrl + 'Get_Attendance_Courses', { params });
  }

  getAttendanceBatches(courseId: number, staffId: number = 0): Observable<any> {
    const params: any = { courseId: courseId.toString() };
    if (staffId > 0) {
      params.staffId = staffId.toString();
    }
    return this.http.get(this.baseUrl + 'Get_Attendance_Batches', { params });
  }

  saveAttendance(payload: any): Observable<any> {
    return this.http.post(this.baseUrl + 'Save_Attendance', payload);
  }

  getAttendanceHistory(courseId: number, batchId: number, fromDate: string, toDate: string, page: number = 1, pageSize: number = 10, staffId: number = 0): Observable<any> {
    const params: any = {
      courseId: courseId.toString(),
      batchId: batchId.toString(),
      fromDate: fromDate || '',
      toDate: toDate || '',
      page: page.toString(),
      pageSize: pageSize.toString()
    };
    if (staffId > 0) {
      params.staffId = staffId.toString();
    }
    return this.http.get(this.baseUrl + 'Get_Attendance_History', { params });
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

  deleteAttendance(courseId: number, batchId: number, date: string, staffId: number = 0): Observable<any> {
    const payload: any = {
      courseId,
      batchId,
      date
    };
    if (staffId > 0) {
      payload.staffId = staffId;
    }
    return this.http.post(this.baseUrl + 'Delete_Attendance', payload);
  }

  getAttendanceDetailsBySession(courseId: number, batchId: number, date: string, staffId: number = 0): Observable<any> {
    const params: any = {
      courseId: courseId.toString(),
      batchId: batchId.toString(),
      date: date || ''
    };
    if (staffId > 0) {
      params.staffId = staffId.toString();
    }
    return this.http.get(this.baseUrl + 'Get_Attendance_Details_By_Session', { params });
  }
}
