import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { course_category_Service } from '../../services/course_category.Service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import {MatDialog} from '@angular/material/dialog';
import { course_category } from '../../../core/models/course_category';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';


@Component({
    selector: 'app-category',
    imports: [CommonModule, ReactiveFormsModule, MatSlideToggleModule],
    templateUrl: './category.component.html',
    styleUrl: './category.component.scss'
})
export class CategoryComponent implements OnInit {
  course_category_Service_ = inject(course_category_Service);
  private fb = inject(FormBuilder);
  dialogBox = inject(MatDialog);


  Entry_View = true;
  course_category_Form: FormGroup;
  course_category_Name_Search: string;
  isLoading: boolean;Total_Entries: number;
  course_category_Data:course_category[]
  EditIndex: number;submitted = false;

  constructor() {
    this.course_category_Form = this.fb.group({
      Category_ID: [0],
      Category_Name: ["", Validators.required],
      Delete_Status: [""],
      Enabled_Status: [""]
    });
  }

  ngOnInit(): void {
    this.pageLoad();
  }

  pageLoad() {
    this.Clr_course_category();
    this.Search_course_category();
    this.Entry_View = false;
  }

  Save_course_category() {
    if (this.course_category_Form.valid) {
      this.isLoading = true;
      this.course_category_Service_.Save_course_category(this.course_category_Form?.value).subscribe(Save_status => {
        // Save_status = Save_status[0];
        if (Number(Save_status[0].Category_ID) > 0) {
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Saved', Type: "false" } });
          this.pageLoad();
        }
        else {
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occured', Type: "2" } });
        }
        this.isLoading = false;
      },
        Rows => {
          this.isLoading = false;
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: Rows.error.error, Type: "2" } });
        });
    }else{
      const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Please fill all required fields', Type: "2" } });
    }
    
  }

  closeClick() {
    this.Entry_View = false;
  }

  Create_New() {
    this.Entry_View = true;
    this.Clr_course_category();
  }

  Clr_course_category() {
    this.course_category_Form.reset({
      Category_ID: 0,
      Category_Name: "",
      Delete_Status: "",
      Enabled_Status:""
    })
  }

  Search_course_category() {
    this.isLoading = true;
    this.course_category_Service_.Search_course_category('').subscribe(Rows => {
      this.course_category_Data = Rows;
      this.Total_Entries = this.course_category_Data.length;
      if (this.course_category_Data.length == 0) {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open
          (DialogBox_Component, {
            panelClass: 'Dialogbox-Class'
            , data: { Message: 'No Details Found', Type: "3" }
          });
      }
      this.isLoading = false;
    },
      Rows => {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open
          (DialogBox_Component, {
            panelClass: 'Dialogbox-Class'
            , data: { Message: 'Error Occured', Type: "2" }
          });
      });
  }

  Edit_course_category(course_category_e: course_category) {
    this.Entry_View = true;
    this.course_category_Form.patchValue(course_category_e);
  }

  Delete_course_category(course_category_Id, index) {
    const dialogRef = this.dialogBox.open
      (DialogBox_Component, {
        panelClass: 'Dialogbox-Class'
        , data: { Message: 'Do you want to delete ?', Type: true, Heading: 'Confirm' }
      });
    dialogRef.afterClosed().subscribe(result => {
      if (result == 'Yes') {
        this.isLoading = true;
        this.course_category_Service_.Delete_course_category(course_category_Id).subscribe(Delete_status => {
          if (Delete_status[0].course_category_Id_ > 0) {
            this.pageLoad();
            const dialogRef = this.dialogBox.open
              (DialogBox_Component, {
                panelClass: 'Dialogbox-Class'
                , data: { Message: 'Deleted', Type: "false" }
              });
          }
          else {
            this.isLoading = false;
            const dialogRef = this.dialogBox.open
              (DialogBox_Component, {
                panelClass: 'Dialogbox-Class'
                , data: { Message: 'Error Occured', Type: "2" }
              });
          }
          this.isLoading = false;
        },
          Rows => {
            this.isLoading = false;
            const dialogRef = this.dialogBox.open
              (DialogBox_Component, {
                panelClass: 'Dialogbox-Class'
                , data: { Message: 'Error Occured', Type: "2" }
              });
          });
      }
    });
  }

  onToggleChange(event,categoryId){
    let status = event.checked ? 1 : 0;
    let input ={
      category_Id :  categoryId,
      categoryStatus: status 
    }
    this.course_category_Service_.ChangeCategoryStatus(input).subscribe(result=>{
      this.pageLoad();
    })
  }

}
