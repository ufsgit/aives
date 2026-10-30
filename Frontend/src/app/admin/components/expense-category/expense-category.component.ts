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
  selector: 'app-expense-category',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './expense-category.component.html',
  styleUrl: './expense-category.component.scss'
})
export class ExpenseCategoryComponent {
  saveExpenseCategory: any = ''
  getExpCategory: any = ''
  save_status: boolean = false;
  selectedExpenseID: any = 0;
  dialogBox = inject(MatDialog);
  url=inject(ActivatedRoute)
  searchQuery:string=''
  filteredExpCategory: any[] = []; 
  noResults: boolean = false;
  isLoading: boolean;
  validButton: NgForm;

  isEdit: boolean = false;
  isSave: boolean = false;
  isDelete: boolean = false;

  constructor(private expenseApi: ExpenseTypeService) { }

  ngOnInit() {
    this.getExpenseCategory();


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
  addExpenseCategory() {
    this.save_status = true;
 // Clear search input and reset the filtered list
  this.searchQuery = '';
  this.filteredExpCategory = this.getExpCategory;
  this.noResults = false;

  }

  //Save Expense category
  Save_Expense_Category(validButton: NgForm) {
    const expCategory = {
      Expense_Category_Id: this.selectedExpenseID || 0,
      Expense_Category_Name: this.saveExpenseCategory
    };

    this.expenseApi.Save_Expense_Category(expCategory).subscribe((result) => {
      console.log("result", result);
      this.getExpenseCategory();
      // Reset form field after save
      this.saveExpenseCategory = '';
      this.selectedExpenseID = null;
      // Reset the form
      validButton?.resetForm();
    });
      
  }
cancelEdit() {
  this.saveExpenseCategory = '';
  this.selectedExpenseID = 0;
  this.save_status = false;
}

  editExpenseCategory(list:any) {
    this.save_status = true;
    this.saveExpenseCategory = list.Expense_Category_Name
    this.selectedExpenseID = list.Expense_Category_Id
  }
  deleteExpenseCategory(data: any) {
    const Expense_Category_Id = data.Expense_Category_Id
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
            .Delete_Expense_Category(Expense_Category_Id)
            .subscribe((Res) => {
              console.log('Res: ', Res);
              this.getExpenseCategory();
            });
        }
      });
    }

//Display Expense category
  getExpenseCategory() {
    this.isLoading=true
    this.expenseApi.Get_Expense_Category().subscribe((expCategory) => {
      this.getExpCategory = expCategory
      this.filteredExpCategory = expCategory
      console.log(expCategory);
    this.isLoading=false
    })
   
  }

  //Search Expense category
  searchExpenseCategory(): void {
  const query = this.searchQuery.trim().toLowerCase();

  if (!query) {
    // If input is empty, reset to full list

    this.filteredExpCategory = this.getExpCategory;
    this.noResults = false;
    return;
  }

  // Filter based on query
     
  this.filteredExpCategory = this.getExpCategory.filter(item =>
    item.Expense_Category_Name.toLowerCase().includes(query)
  );

  // If no results match, show message
  this.noResults = this.filteredExpCategory.length === 0;
}
}
