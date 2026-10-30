import { Component, inject, OnInit } from '@angular/core';
import { ExpenseTypeService } from '../../services/expense-type.service';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { CommonModule } from '@angular/common';
import { StudentFeesService } from '../../services/student-fees.service';
import { Pipe, PipeTransform } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
@Pipe({ name: 'minValue' })
export class MinValuePipe implements PipeTransform {
  transform(value: number, min: number): number {
    return Math.min(value, min);
  }
}
@Component({
  selector: 'app-expenses',
  imports: [FormsModule, CommonModule],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit {
  showForm: boolean = false;
  isEditMode: boolean = false;
  ExpenseList: any[] = [];
  selectedExpenseType: string = '';
  uniqueExpenseTypes: string[] = ['Travel', 'Food', 'Supplies']; // Replace with real data
  amount: number = 0;
  description: string = '';
  dialogBox = inject(MatDialog);
  Expens_Type: any[];
  expenseId: number = 0;
  allAccounts: any = [];
  selectedAccount: any;
  isEdit: boolean = false;
  isSave: boolean = false;
  isDelete: boolean = false;
  url=inject(ActivatedRoute)
  totalRecords: number = 0;
  
  // Filter variables
  filterFromDate: string = '';
  filterToDate: string = '';
  filterAccountId: string = '';
  filterExpenseTypeId: string = '';

  constructor(
    private expenseApi: ExpenseTypeService,
    private feesService: StudentFeesService
  ) {}

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    this.filterFromDate = today;
    this.filterToDate = today;

    this.Get_ExpenseList();
    this.Get_Expense_Type();
    this.getAccounts();
    console.log('uniqueExpenseTypes', this.uniqueExpenseTypes);


        this.url.queryParams.subscribe(params => {
    console.log("params",params);
    
    if (params['item']) {
    
      const receivedItem = JSON.parse(params['item']);
      console.log('Received Item:', receivedItem);


      
        this.isSave = receivedItem?.IsSave || false;
        this.isEdit = receivedItem?.IsEdit || false;
        this.isDelete = receivedItem?.IsDelete || false;
        

       
      
   
    }
  });
  }
  getAccounts(): void {
    this.feesService.Get_Accounts().subscribe((res) => {
      this.allAccounts = res;
    });
  }
  Get_Expense_Type() {
    this.expenseApi.Get_Expense_Type().subscribe((explist) => {
      this.Expens_Type = explist;
    });
  }

  Get_ExpenseList() {
    const filters = {
      fromDate: this.filterFromDate,
      toDate: this.filterToDate,
      accountId: this.filterAccountId,
      expenseTypeId: this.filterExpenseTypeId
    };

    this.expenseApi.Get_ExpenseList(this.currentPage, this.pageSize, filters).subscribe((res: any) => {
      this.ExpenseList = res[1] || [];
      this.totalRecords = res[0]?.[0]?.total_count || 0;
      
      this.uniqueExpenseTypes = [
        ...new Set(this.ExpenseList.map((item) => item.Expense_Type_Name)),
      ];
    });
  }

  applyFilters() {
    this.currentPage = 1;
    this.Get_ExpenseList();
  }

  resetFilters() {
    const today = new Date().toISOString().split('T')[0];
    this.filterFromDate = today;
    this.filterToDate = today;
    this.filterAccountId = '';
    this.filterExpenseTypeId = '';
    this.applyFilters();
  }

  saveSelectedExpense() {
    console.log('selectedAccount_Id', this.selectedAccount);

    const expensePayload = {
      Expense_Id: this.expenseId || 0,
      Expense_Type_Id: this.selectedExpenseType,
      User_Id: this.getLoggedInUserId(),
      Entry_Date: new Date(),
      Amount: this.amount,
      Description: this.description,
      Account_Id: this.selectedAccount.Account_id || 0,
      Account_Name: this.selectedAccount.Account_Name || '',
    };

    this.expenseApi.saveExpense(expensePayload).subscribe((Save_status) => {
      if (Save_status) {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Expense saved successfully!', Type: 'false' },
        });

        this.resetForm()
        this.Get_ExpenseList()
  }})
  }

  resetForm() {
    this.expenseId = 0;
    this.selectedExpenseType = '';
    this.description = '';
    this.amount = 0;
    this.showForm = false;
    this.isEditMode = false;
  }

  getLoggedInUserId(): number {
    const User_Id = localStorage.getItem('User_Type');
    // Replace with real logic from auth service
    return User_Id ? Number(User_Id) : 1; // Example
  }

  toggleForm() {
  this.showForm = !this.showForm;
  if (!this.showForm) {
    this.resetForm();
  } else {
    this.isEditMode = false; // Add mode
  }
}

  editExpense(expense: any) {
    console.log('expense', expense);

    this.expenseId = expense.Expense_Id;
    this.selectedExpenseType = expense.Expense_Type_Id;
    this.amount = expense.Amount;
    this.description = expense.Description;

    // Match the existing account object from the allAccounts list
    this.selectedAccount = this.allAccounts.find(
      (acc) => acc.Account_id === expense.Account_Id
    );

    console.log('this.selectedAccount', this.selectedAccount);

    this.showForm = true;
    this.isEditMode = true;
  }

  deleteExpense(expenseId: number) {
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Do you want to delete ?',
        Type: true,
        Heading: 'Confirm',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result == 'Yes') {
        this.expenseApi.Delete_Expense(expenseId).subscribe((Res) => {
          console.log('Res: ', Res);
          this.Get_ExpenseList();
        });
      }
    });
  }

  pageSizeOptions: number[] = [10, 15, 20, 25];
  pageSize: number = 10;
  currentPage: number = 1;

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  getPagesArray(): number[] {
    return Array(this.totalPages).fill(0);
  }

  get paginatedExpenses() {
    return this.ExpenseList;
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.Get_ExpenseList();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.Get_ExpenseList();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.Get_ExpenseList();
  }
}
