import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class ExpenseTypeService {

  constructor(private http: HttpClient) { }

  //Save Expense Type
  Save_Expense_Type(expenseList: any) {
    return this.http.post(environment.BasePath + 'Expense/Save_Expense_Type/', expenseList);
  }
  // Delete_Expense_Type
  Delete_Expense_Type(Expense_Type_Id: any) {
    return this.http.post(environment.BasePath + 'Expense/Delete_Expense_Type', { Expense_Type_Id });
  }

  //Get Expense Type
  Get_Expense_Type() {
    return this.http.get<any[]>(
      `${environment.BasePath}Expense/Get_Expense_Type`);
  }

  //Save Expense Category
  Save_Expense_Category(expenseList: any) {
    return this.http.post(environment.BasePath + 'Expense/Save_Expense_Category/', expenseList);
  }

  //Get Expense Category
  Get_Expense_Category() {
    return this.http.get<any[]>(
      `${environment.BasePath}Expense/Get_Expense_Category`);
  }

    // Delete_Expense_Category
  Delete_Expense_Category(Expense_Category_Id: any) {
    return this.http.post(environment.BasePath + 'Expense/Delete_Expense_Category', { Expense_Category_Id });
  }

Get_Tax_Reports(
  Student_Id: number,
  Branch: number,
  Account_Id: number,
  fromDate: string,
  toDate: string,
  pageNumber: number,
  pageSize: number
) {
  return this.http.get(environment.BasePath + 'Fees/Get_Tax_Reports', {
    params: {
      Student_Id: Student_Id.toString(),
      Branch: Branch.toString(),
      Account_Id: Account_Id.toString(),
      Start_Date: fromDate || '',
      End_Date: toDate || '',
      PageNumber: pageNumber.toString(),
      PageSize: pageSize.toString()
    }
  });
}

  // saveExpense
  saveExpense(expensePayload: any) {
    return this.http.post(environment.BasePath + 'Expense/Save_Expense/', expensePayload);
  }
  // Get_ExpenseList
  Get_ExpenseList(page: number = 1, pageSize: number = 10, filters: any = {}) {
    let params: any = { page: page.toString(), pageSize: pageSize.toString() };
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.accountId) params.accountId = filters.accountId;
    if (filters.expenseTypeId) params.expenseTypeId = filters.expenseTypeId;

    return this.http.get<any>(
      `${environment.BasePath}Expense/Get_ExpenseList`, {
        params: params
      });
  }
  // Get_Student ExpenseList
  Get_ExpenseList_Student_ID(Student_ID: number) {
    return this.http.get<any[]>(
      `${environment.BasePath}Expense/Get_ExpenseList_Student_ID/${Student_ID}`);
  }
  // Delete_Expense

  Delete_Expense(Expense_Id: number) {
    return this.http.post(environment.BasePath + 'Expense/Delete_Expense', { Expense_Id });
  }

}
