import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IncomeService {

  constructor(private http: HttpClient) { }





  saveIncome(incomePayload: any): Observable<any> {
    return this.http.post(environment.BasePath + 'Income/Save_Income/', incomePayload);
  }

  Get_IncomeList(page: number = 1, pageSize: number = 10, filters: any = {}): Observable<any> {
    let params: any = { page: page.toString(), pageSize: pageSize.toString() };
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.accountId) params.accountId = filters.accountId;
    if (filters.expenseTypeId) params.expenseTypeId = filters.expenseTypeId;

    return this.http.get(`${environment.BasePath}Income/Get_IncomeList`, { params });
  }

  Delete_Income(Income_Id: number): Observable<any> {
    return this.http.post(environment.BasePath + 'Income/Delete_Income', { Income_Id });
  }
}
