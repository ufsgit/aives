import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ReportsService {

 Search_Receipts_and_Expense(payload: any) {
    return this.http.post(environment.BasePath + 'Reports/Search_Receipts_and_Expense', payload);
  }

  constructor(private http: HttpClient) {}

  //Get_UserList
  Get_UserList() {
    return this.http.get<any[]>(`${environment.BasePath}Reports/Get_UserList`);
  }
}
