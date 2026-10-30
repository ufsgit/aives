import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StudentFeesService {
  constructor(private http: HttpClient) {}
  
  Registration_Using_Student_Branch(Student_ID: number,
    isRegistered: boolean,User_ID :any) {
    const body = {
      Student_ID: Student_ID,
      Is_Registered: isRegistered,
      User_ID:User_ID
    };
    return this.http.post(
      environment.BasePath + 'student/Registration_Using_Student_Branch/',
      body
    );
  }
   Remove_Student_Registration(
    Student_ID: number,
    isRegistered: boolean,User_ID :any) {
    const body = {
      Student_ID: Student_ID,
      Is_Registered: isRegistered,
      User_ID:User_ID
    };
    return this.http.post(
      environment.BasePath + 'student/Remove_Student_Registration/',
      body
    );
  }
  Save_Student_Fees_Details(installmentEntries: any) {
    console.log(installmentEntries, 'installmentEntries');
    ;
    return this.http.post(
      environment.BasePath + 'Fees/Save_Student_Fees_Details/',
      installmentEntries
    );
  }
  Save_student(student_) {
    console.log(student_, 'student_');
    ;
    return this.http.post(
      environment.BasePath + 'student/Save_student/',
      student_
    );
  }

  Delete_FeesByReceipt_ID(Receipt_Id: number) {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Delete_FeesByReceipt_ID/${Receipt_Id}`
    );
  }

  Get_All_installment_information(Course_ID: number) {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Get_All_installment_information/${Course_ID}`
    );
  }

  // student-fees.service.ts
  Get_InstallmentsByCourseID(courseId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}course/Get_InstallmentsByCourseID/${courseId}`
    );
  }
  Get_InstallmentsByFee_Type(
    Fee_Type: any,
    courseId: number,
    Batch_ID:number
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}course/Get_InstallmentsByFee_Type/${courseId}/${Fee_Type}/${Batch_ID}`
    );
  }
  Get_FeesByStudentCourse(
    studentId: number,
    courseId: number
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Get_FeesByStudentCourse/${studentId}/${courseId}`
    );
  }
  Get_FeesByReceipt_ID(Receipt_id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Get_FeesByReceipt_ID/${Receipt_id}`
    );
  }
  // Get_FeesByStudentId
  Get_FeesByStudentId(studentId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Get_FeesByStudentId/${studentId}`
    );
  }
  get_student_fees_details(studentId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}student/get_student_fees_details/${studentId}`
    );
  }

  Get_Accounts(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.BasePath}fees/get_Accounts/`);
  }
  Get_All_PaymentMode(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.BasePath}fees/Get_All_PaymentMode/`);
  }

   gstalltaxtypes(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.BasePath}fees/gstalltaxtypes/`);
  }


  Get_FeesByStudent_Fees_ID(Student_Fees_ID: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Get_FeesByStudent_Fees_ID/${Student_Fees_ID}`
    );
  }

  Edit_FeesByReceipt_ID(Receipt_id: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${environment.BasePath}Fees/Edit_FeesByReceipt_ID/${Receipt_id}`
    );
  }
  Update_FeesByReceipt_ID(fees: any): Observable<any> {
    console.log('Fee test',fees);
    
    return this.http.post<any>(
      `${environment.BasePath}Fees/Update_FeesByReceipt_ID/`,
       { updatedData: fees }
    );
  }

  Get_Late_Fee_Amount(): Observable<any> {
    return this.http.get<any>(`${environment.BasePath}LateFee/Get_Late_Fee_Amount`);
  }
}
