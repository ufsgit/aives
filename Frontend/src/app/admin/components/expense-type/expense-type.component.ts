import { Component, inject } from '@angular/core';
import { ExpenseTypeService } from '../../services/expense-type.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { log } from 'console';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { SharedModule } from "../../../shared/shared.module";
import { NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
@Component({
  selector: 'app-expense-type',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './expense-type.component.html',
  styleUrl: './expense-type.component.scss'
})
export class ExpenseTypeComponent {

  saveExpType: any = ''
  getExpList: any = ''
  getExpCategory: any = ''
  save_status: boolean = false;
  selectedExpenseID: any = 0;
  dialogBox = inject(MatDialog);
  searchQuery:string=''
  filteredExpList: any[] = []; 
  noResults: boolean = false;
  isLoading: boolean;
  validButton: NgForm;
  selectedCategoryID: number | null = null;
    url=inject(ActivatedRoute)

    isEdit: boolean = false;
  isSave: boolean = false;
  isDelete: boolean = false;
  constructor(private expenseApi: ExpenseTypeService) { }

  ngOnInit() {
    this.getExpenseList();
    this.getExpenseCategory()


     this.url.queryParams.subscribe(params => {
    console.log("params",params);
    
    if (params['item']) {
    
      const receivedItem = JSON.parse(params['item']);
      console.log('Received Item:', receivedItem);


      this.isEdit = receivedItem?.IsEdit || false;
      this.isSave = receivedItem?.IsSave || false;
      this.isDelete = receivedItem?.IsDelete || false;

        console.log('Permissions:', this.isEdit, this.isSave, this.isDelete);
      
   
    }
  });
  }

  //Add Expense
  addexpense() {
    this.save_status = true;
  // Clear search input and reset the filtered list
  this.searchQuery = '';
  this.filteredExpList = this.getExpList;
  this.noResults = false;
  this.selectedCategoryID = null;
  }

  //Save Expense List
  Save_Expense_Type(validButton: NgForm) {

    if (!this.selectedCategoryID || !this.saveExpType.trim()) {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Please Select Expense Category', Type: '3' }
        });
    return;
  }

    const expList = {
      Expense_Type_Id: this.selectedExpenseID || 0,
      Expense_Type_Name: this.saveExpType,
      Expense_Category_Id: this.selectedCategoryID
    };

    this.expenseApi.Save_Expense_Type(expList).subscribe((result) => {
      console.log("result", result);
      this.getExpenseList();
      // Reset form field after save
      this.saveExpType = '';
      this.selectedExpenseID = null;
      this.selectedCategoryID = null;
      // Reset the form
      validButton?.resetForm();
    });
      
  }
cancelEdit() {
  this.saveExpType = '';
  this.selectedExpenseID = 0;
   this.selectedCategoryID = null;
  this.save_status = false;
}

  editExpense(list:any) {
    this.save_status = true;
    this.saveExpType = list.Expense_Type_Name;
    this.selectedExpenseID = list.Expense_Type_Id;
     this.selectedCategoryID = list.Expense_Category_Id;
  }
  deleteExpense(data: any) {
    const Expense_Type_Id = data.Expense_Type_Id
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
          this.expenseApi
            .Delete_Expense_Type(Expense_Type_Id)
            .subscribe((Res) => {
              console.log('Res: ', Res);
              this.getExpenseList();
            });
        }
      });
    }

  //Display Expense List
  getExpenseList() {
    this.isLoading=true
    this.expenseApi.Get_Expense_Type().subscribe((explist) => {
      this.getExpList = explist
      this.filteredExpList = explist
      console.log(explist);
    this.isLoading=false
    })
   
  }

  //Search Expense Type
  searchExpense(): void {
  const query = this.searchQuery.trim().toLowerCase();

  if (!query) {
    // If input is empty, reset to full list

    this.filteredExpList = this.getExpList;
    this.noResults = false;
    return;
  }

  // Filter based on query
     
  this.filteredExpList = this.getExpList.filter(item =>
    item.Expense_Type_Name.toLowerCase().includes(query)
  );

  // If no results match, show message
  this.noResults = this.filteredExpList.length === 0;
}

//Display Expense category
  getExpenseCategory() {
    this.isLoading=true
    this.expenseApi.Get_Expense_Category().subscribe((expCategory) => {
      this.getExpCategory = expCategory
      // this.filteredExpCategory = expCategory
      console.log(expCategory);
    this.isLoading=false
    })
   
  }

}

