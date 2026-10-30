import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Inject,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { StudentFeesService } from '../../services/student-fees.service';
import { ExpenseTypeService } from '../../services/expense-type.service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-add-expense-dialog',
  standalone: true,
  imports: [MatDialogModule, FormsModule, CommonModule, SharedModule],
  templateUrl: './add-expense-dialog.component.html',
  styleUrl: './add-expense-dialog.component.scss',
})
export class AddExpenseDialogComponent {
  selectedExpenseType: number | null = null;
  amount: number | null = null;
  description: string = '';
  selectedAccount: any;
  @Output() save = new EventEmitter<any>();
  @Input() student: any;
  @Output() cancel = new EventEmitter<any>();
  showForm: boolean = false;
  isEditMode: boolean = false;
  ExpenseList: any[] = [];
  expenseId: number = 0;
  dialogBox = inject(MatDialog);
  uniqueExpenseTypes: string[] = ['Travel', 'Food', 'Supplies']; // Replace with real data
  isLoading: boolean = false;

  constructor(
    // public dialogRef: MatDialogRef<AddExpenseDialogComponent>,
    // @Inject(MAT_DIALOG_DATA) public data: any,
    private expenseApi: ExpenseTypeService,
    private feesService: StudentFeesService
  ) {}

  data: any = [];
  Expens_Type = this.data.expenseTypes;
  allAccounts = this.data.accounts;

  // student = this.data.student;

  ngOnInit() {
    const studentID = this.student?.Student_ID; // Replace with your actual path to the Student ID

    if (studentID) {
      // Call Get_StudentExpenseList with the Student_ID
      this.Get_StudentExpenseList(studentID);
    } else {
      console.error('Student ID is not available.');
    }

    this.Get_Expense_Type();
    this.getAccounts();
  }
  saveSelectedExpense(): void {
    this.isLoading = true;
    const User_Id =localStorage.getItem('User_Type')
    const payload = {
      Expense_Id: this.expenseId,
      Student_ID: this.student.Student_ID,
      User_Id: User_Id,
      StudentName: this.student.First_Name + ' ' + this.student.Last_Name,
      Expense_Type_Id: this.selectedExpenseType,
      Amount: this.amount,
      Description: this.description,
      Account_Id: this.selectedAccount?.Account_id,
      Account_Name: this.selectedAccount?.Account_Name,
    };
    console.log('payload', payload);
    this.expenseApi.saveExpense(payload).subscribe((Save_status) => {
      this.isLoading = false;
      if (Save_status) {
        this.showForm = false;
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Expense saved successfully!', Type: 'false' },
        });
            // this.save.emit(payload);
    this.resetform();
    this.Get_StudentExpenseList(this.student?.Student_ID);
      }
    });



    // this.dialogRef.close(payload); // pass result back
  }
  resetform() {
    this.selectedExpenseType = null;
    this.amount = 0;
    this.description = '';
    this.selectedAccount = null;
    this.isEditMode = false;
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

  Get_StudentExpenseList(Student_ID: number) {
    this.expenseApi
      .Get_ExpenseList_Student_ID(Student_ID)
      .subscribe((explist: any[]) => {
        this.ExpenseList = explist;
        console.log('Full List:', explist);
        this.uniqueExpenseTypes = [
          ...new Set(explist.map((item) => item.Expense_Type_Name)),
        ];
        console.log('Unique Expense Types:', this.uniqueExpenseTypes);
      });
  }

  toggleForm() {
  this.showForm = !this.showForm;
  if (!this.showForm) {
    this.resetform();
  } else {
    this.isEditMode = false; // Add mode
  }
}

compareAccounts(account1: any, account2: any): boolean {
  return account1 && account2 && account1.Account_id === account2.Account_id;
}

  editExpense(expense: any) {

    this.expenseId = expense.Expense_Id;
    this.selectedExpenseType = expense.Expense_Type_Id;
    this.amount = expense.Amount;
    this.description = expense.Description;

    // Match the existing account object from the allAccounts list
    this.selectedAccount = this.allAccounts.find(
      (acc) => acc.Account_id === expense.Account_Id
    );
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
          this.Get_StudentExpenseList(this.student?.Student_ID);
        });
      }
    });
  }

  pageSizeOptions: number[] = [10, 15, 20, 25];
  pageSize: number = 10;
  currentPage: number = 1;

  get totalPages(): number {
    return Math.ceil(this.ExpenseList.length / this.pageSize) || 1;
  }

  getPagesArray(): number[] {
    return Array(this.totalPages).fill(0);
  }

  get paginatedExpenses() {
    if (!this.ExpenseList) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return this.ExpenseList.slice(start, start + this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  onPageSizeChange(): void {
    this.currentPage = 1; // Reset to first page when size changes
  }
}
