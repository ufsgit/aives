import { Component, OnInit, Input, Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AnimationKeyframesSequenceMetadata } from '@angular/animations';
import { environment } from '../../../environments/environment';
import { v4 as uuidv4 } from 'uuid';
import { S3 } from 'aws-sdk';

@Injectable({
    providedIn: 'root'
})
export class user_Service {
    private http = inject(HttpClient);

    Save_user(user) {
        return this.http.post(environment.BasePath + 'user/Save_user/', user);
    }

    Check_Uniqueness(data: { Email?: string, PhoneNumber?: string, User_ID?: number }) {
        return this.http.post(
            environment.BasePath + 'user/Check_Uniqueness/',
            data
        );
    }
  
    saveCourseFees(user) {
        return this.http.post(environment.BasePath + 'course/saveCourseFees/', user);
    }
    get_course_fees(user_Id) {
        return this.http.get(environment.BasePath + 'course/get_course_fees/' + user_Id);
    }

    deleteInstallmentInformation(id) {
        return this.http.post(environment.BasePath + 'course/deleteInstallmentInformation/', {
    Installment_information_ID: id
  });
    }

    deactivate_Account(details) {
        return this.http.post(environment.BasePath + 'deactivate_Account/', details);
    }
    uploadFile(file: File, userName: string): Promise<{ key: string, fileName: string }> {
        return new Promise((resolve, reject) => {
          const contentType = file.type;
          const randomString = uuidv4(); // Generate a random UUID
    
          const key = `Briffni/User/${userName}${randomString}`;
    
          const bucket = new S3({
            accessKeyId: environment.awsAccessKeyId,
            secretAccessKey: environment.awsSecretAccessKey,
            region: environment.awsRegion,
          });
    
          const params = {
            Bucket: environment.awsS3Bucket,
            Key: key,
            Body: file,
            ACL: "public-read",
            ContentType: contentType,
          };
    
          bucket.upload(params, function (err, data) {
            if (err) {
              console.log("There was an error uploading your file: ", err);
              reject(err);
            } else {
              console.log("Successfully uploaded file.", data);
              resolve({ key: key, fileName: file.name });
            }
          });
        });
      }
    private extractData(res: Response) {
        let body = res;
        return body || {};
    }
    Search_user(params): Observable<any> {
        return this.http.get(environment.BasePath + 'user/Search_user/', { params: params });
    }
    Delete_user(user_Id) {
        return this.http.get(environment.BasePath + 'user/Delete_user/' + user_Id);
    }
    Get_user(user_Id) {
        return this.http.get(environment.BasePath + 'user/Get_user/' + user_Id);
    }
    Search_User_Invoice(user_Id) {
        return this.http.get(environment.BasePath + 'user/Search_User_Invoice/' + user_Id);
    }
    Get_Report_LiveClasses_By_BatchAndTeacher(Teacher_ID,Batch_ID,Course_ID,Start_Date,End_Date) {
        var Search_Data = {  Teacher_ID,Batch_ID,Course_ID,Start_Date,End_Date }

        return this.http.get(environment.BasePath + 'user/Get_Report_LiveClasses_By_BatchAndTeacher/',{ params: Search_Data } );
    }
    Get_Work_Report_Summary(filters: {
        fromDate?: string;
        toDate?: string;
        useCreatedDate?: boolean;
    }): Observable<any> {
        let params = new HttpParams();
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);
        if (filters.useCreatedDate !== undefined) {
            params = params.set('useCreatedDate', filters.useCreatedDate ? '1' : '0');
        }

        return this.http.get(environment.BasePath + 'user/Get_Work_Report_Summary', { params });
    }
    Get_Work_Report_Details(filters: {
        staffId?: number | null;
        fromDate?: string;
        toDate?: string;
        useCreatedDate?: boolean;
        departmentId?: number | null;
        searchBy?: string;
        searchTerm?: string;
    }): Observable<any> {
        let params = new HttpParams();
        if (filters.staffId != null) params = params.set('staffId', String(filters.staffId));
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);
        if (filters.useCreatedDate !== undefined) {
            params = params.set('useCreatedDate', filters.useCreatedDate ? '1' : '0');
        }
        if (filters.departmentId != null) params = params.set('departmentId', String(filters.departmentId));
        if (filters.searchBy) params = params.set('searchBy', filters.searchBy);
        if (filters.searchTerm) params = params.set('searchTerm', filters.searchTerm);

        return this.http.get(environment.BasePath + 'user/Get_Work_Report_Details', { params });
    }
    Get_Report_Student(
        studentSearch: string,
        batchSearch: string,
        courseSearch: string,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_Report_Student/', {
            params: {
                Student_Search: studentSearch || '',
                Batch_Search: batchSearch || '',
                Course_Search: courseSearch || '',
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString()
            }
        });
    }

    Get_My_Students_Report(
        studentSearch: string,
        batchSearch: string,
        courseSearch: string,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number,
        staffId: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_My_Students_Report/', {
            params: {
                Student_Search: studentSearch || '',
                Batch_Search: batchSearch || '',
                Course_Search: courseSearch || '',
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString(),
                Staff_ID: staffId.toString()
            }
        });
    }
    Get_Outstanding_Student(
        Student_ID: number,
        Batch_ID: number,
        Course_ID: number,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_Outstanding_Student/', {
            params: {
                Student_ID: Student_ID.toString(),
                Batch_ID: Batch_ID.toString(),
                Course_ID: Course_ID.toString(),
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString()
            }
        });
    }
    Get_Report_StudentLiveClasses_By_BatchAndStudent(
        Student_ID: number,
        Batch_ID: number,
        Course_ID: number,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_Report_StudentLiveClasses_By_BatchAndStudent/', {
            params: {
                Student_ID: Student_ID.toString(),
                Batch_ID: Batch_ID.toString(),
                Course_ID: Course_ID.toString(),
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString()
            }
        });
    }
    // Get_upcomming_installments
    Get_upcomming_installments(
        Student_ID: number,
        Batch_ID: number,
        Course_ID: number,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_upcomming_installments/', {
            params: {
                Student_ID: Student_ID.toString(),
                Batch_ID: Batch_ID.toString(),
                Course_ID: Course_ID.toString(),
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString()
            }
        });
    }
    // Get_Due_installments
     Get_Due_installments(
        Student_ID: number,
        Batch_ID: number,
        Course_ID: number,
        fromDate: string,
        toDate: string,
        pageNumber: number,
        pageSize: number
    ) {
        return this.http.get(environment.BasePath + 'user/Get_Due_installments/', {
            params: {
                Student_ID: Student_ID.toString(),
                Batch_ID: Batch_ID.toString(),
                Course_ID: Course_ID.toString(),
                Start_Date: fromDate || '',
                End_Date: toDate || '',
                PageNumber: pageNumber.toString(),
                PageSize: pageSize.toString()
            }
        });
    }
    Get_Teacher_courses(userId):Observable<any>{
        return this.http.get(environment.BasePath + 'teacher/Get_Teacher_courses/' + userId);
    }
    Delete_Invoice(Invoice_Id):Observable<any>{
        return this.http.get(environment.BasePath + 'user/Delete_Invoice/' + Invoice_Id);
    }
    Get_Teacher_courses_With_Batch(userId):Observable<any>{
        return this.http.get(environment.BasePath + 'teacher/Get_Teacher_courses_With_Batch/' + userId);
    }
    Get_Hod_Course(userId):Observable<any>{
        return this.http.get(environment.BasePath + 'user/Get_Hod_Course?userId=' + userId);
    }
    Get_Teacher_Students(userId: number, courseId: number = 0): Observable<any> {
        return this.http.get(environment.BasePath + `teacher/Get_Teacher_Students/${userId}/${courseId}`);
    }
    Get_Staff_Team_Assignment(teamLeadId: number): Observable<any> {
        return this.http.get(environment.BasePath + `teacher/Get_Staff_Team_Assignment/${teamLeadId}`);
    }
    Save_Staff_Team_Assignment(payload: { teamLeadId: number; staffIds: number[] }): Observable<any> {
        return this.http.post(environment.BasePath + 'teacher/Save_Staff_Team_Assignment/', payload);
    }
    Get_Teacher_Timing(userId):Observable<any>{
        return this.http.get(environment.BasePath + 'teacher/Get_Teacher_Timing/' + userId);
    }

      Get_user_Menus(userId):Observable<any>{
        
        return this.http.get(environment.BasePath + 'user/Get_user_Menus/' );
    }

      Get_All_Menu_Permissions(userId):Observable<any>{
        return this.http.get(environment.BasePath + 'user/Get_All_Menu_Permissions/' + userId);
    }
    Get_Dashboard(){
        return this.http.get(environment.BasePath + 'user/Get_Dashboard/' );

    }
    Save_User_Invoice(invoice) {
        return this.http.post(environment.BasePath + 'user/Save_User_Invoice/', invoice);
    }
    Get_AppInfo_List(filters: any) {
        let params = new HttpParams()
            .set('isStudent', filters.isStudent.toString())
            .set('appVersion', filters.appVersion || '')
            .set('fromDate', filters.fromDate || '')
            .set('toDate', filters.toDate || '')
            .set('nameSearch', filters.nameSearch || '')
            .set('isBatteryOptimized', filters.isBatteryOptimized !== null ? filters.isBatteryOptimized.toString() : '')
            .set('page', filters.page.toString())
            .set('pageSize', filters.pageSize.toString());

        return this.http.get(environment.BasePath + 'student/Get_AppInfo_List/', { params });
    }
    
    Get_Report_TeacherLiveClasses_By_BatchAndTeacher(
    Teacher_ID: number,
    Batch_ID: number,
    Course_ID: number,
    fromDate: string,
    toDate: string,
    page: number,
    pageSize: number
    ) {
    return this.http.get(
        `${environment.BasePath}user/Get_Report_TeacherLiveClasses_By_BatchAndTeacher/`, 
        {
            params: {
                Teacher_ID: Teacher_ID.toString(),
                Batch_ID: Batch_ID.toString(),
                Course_ID: Course_ID.toString(),
                fromDate,
                toDate,
                page: page,
                pageSize: pageSize
            }
        }
    );
    }

     Save_User_Permission(payload) {
        return this.http.post(environment.BasePath + 'student/Save_User_Permission/', payload);
    }

    Get_Enquiry_Conversion_Summary(filters: {
        fromDate?: string;
        toDate?: string;
    }): Observable<any> {
        let params = new HttpParams();
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);

        return this.http.get(environment.BasePath + 'user/Get_Enquiry_Conversion_Summary', { params });
    }

    Get_Enquiry_Conversion_Details(filters: {
        sourceId: number;
        fromDate?: string;
        toDate?: string;
    }): Observable<any> {
        let params = new HttpParams();
        params = params.set('sourceId', filters.sourceId.toString());
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);

        return this.http.get(environment.BasePath + 'user/Get_Enquiry_Conversion_Details', { params });
    }
    
    Send_Bulk_Email(data: { students: any[], subject: string, body: string, templateId?: number | null }): Observable<any> {
        return this.http.post(environment.BasePath + 'student/Send_Bulk_Email', {
            ...data,
            Sender_Email: localStorage.getItem('Email'),
            Sender_Name: localStorage.getItem('Name')
        });
    }

    Get_Email_Logs_By_Student(student_Id: number): Observable<any> {
        return this.http.get(environment.BasePath + 'student/Get_Email_Logs_By_Student/' + student_Id);
    }

    Get_Mail_Report(filters: { fromDate?: string, toDate?: string, templateId?: number | null } = {}): Observable<any> {
        let params = new HttpParams();
        if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
        if (filters.toDate) params = params.set('toDate', filters.toDate);
        if (filters.templateId) params = params.set('templateId', filters.templateId.toString());

        return this.http.get(environment.BasePath + 'student/Get_Mail_Report', { params });
    }

    Sync_Brevo_Opens(): Observable<any> {
        return this.http.post(environment.BasePath + 'student/Sync_Brevo_Opens', {});
    }
    getBatchMailReport(courseId: number, batchId: number, fromDate: string, toDate: string): Observable<any> {
        let params = new HttpParams();
        if (courseId) params = params.set('courseId', String(courseId));
        if (batchId) params = params.set('batchId', String(batchId));
        if (fromDate) params = params.set('fromDate', fromDate);
        if (toDate) params = params.set('toDate', toDate);
        
        return this.http.get(environment.BasePath + 'student/Get_Batch_Mail_Report', { params });
    }

    getBatchMailRecipients(courseId: number, batchId: number, subject?: string, attendanceDate?: string, sentDate?: string): Observable<any> {
        let params = new HttpParams();
        if (courseId) params = params.set('courseId', String(courseId));
        if (batchId) params = params.set('batchId', String(batchId));
        if (subject) params = params.set('subject', subject);
        if (attendanceDate) params = params.set('attendanceDate', attendanceDate);
        if (sentDate) params = params.set('sentDate', sentDate);
        
        return this.http.get(environment.BasePath + 'student/Get_Batch_Mail_Recipients', { params });
    }
}
