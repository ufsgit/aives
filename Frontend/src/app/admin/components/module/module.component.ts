import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import {MatDialog} from '@angular/material/dialog';
import { CoursemoduleService } from '../../services/coursemodule.service';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BehaviorSubject, debounceTime } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';

@Component({
    selector: 'app-module',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatSlideToggleModule, DragDropModule,SharedModule],
    templateUrl: './module.component.html',
    styleUrl: './module.component.scss'
})
export class ModuleComponent {
    course_module_Service = inject(CoursemoduleService);
    private fb = inject(FormBuilder);
    dialogBox = inject(MatDialog);

    Entry_View = false;
    course_module_Form: FormGroup;
    course_module_Name_Search: string;
    isLoading: boolean;
    Total_Entries: number;
    course_module_Data: any[]=[];
    EditIndex: number;
    submitted = false;
    private orderUpdateSubject = new BehaviorSubject<any>(null);

    constructor() {
      this.course_module_Form = this.fb.group({
        Module_ID: [0],
        Module_Name: ["", Validators.required],
        Delete_Status: [""],
        Enabled_Status: [""],
        View_Order: [0],
      });

      this.orderUpdateSubject
      .pipe(debounceTime(500))
      .subscribe(orderData => {
        if (orderData) {
          this.sendOrderUpdate(orderData);
        }
      });
    }
  
    ngOnInit(): void {
      this.pageLoad();
    }
  
    pageLoad() {
      this.Clr_course_module();
      this.Search_course_module();
      this.Entry_View = false;
    }
  
    Save_course_module() {
      if (this.course_module_Form.valid) {
        this.isLoading = true;
        this.course_module_Service.Save_course_module(this.course_module_Form?.value).subscribe(
          Save_status => {
            if (Number(Save_status[0].Module_ID) > 0) {
              const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Saved', Type: "false" } });
              this.pageLoad();
            } else  if(Number(Save_status[0].Module_ID) == -1){
              const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Duplicate module Name Found', Type: "2" } });
            
            } else {
              const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occurred', Type: "2" } });
            }
            this.isLoading = false;
          },
          Rows => {
            this.isLoading = false;
            const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: Rows.error.error, Type: "2" } });
          }
        );
      } else {
        const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Please fill all required fields', Type: "2" } });
      }
    }
  
    closeClick() {
      this.Entry_View = false;
    }
  
    Create_New() {
      this.Entry_View = true;
      this.Clr_course_module();
    }
  
    Clr_course_module() {
      this.course_module_Form.reset({
        Module_ID: 0,
        Module_Name: "",
        Delete_Status: "",
        Enabled_Status: "",
        View_Order: 0,
      });
    }
  
    Search_course_module() {
      this.isLoading = true;
      this.course_module_Service.Search_course_module('').subscribe(
        Rows => {
          this.course_module_Data = Rows;
          this.Total_Entries = this.course_module_Data.length;
          if (this.course_module_Data.length == 0) {
            this.isLoading = false;
            const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'No Details Found', Type: "3" } });
          }
          this.isLoading = false;
        },
        Rows => {
          this.isLoading = false;
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occurred', Type: "2" } });
        }
      );
    }
  
    Edit_course_module(course_module_e: any) {
      this.Entry_View = true;
      this.course_module_Form.patchValue(course_module_e);
    }
  
    Delete_course_module(Module_Id) {
      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Do you want to delete?', Type: true, Heading: 'Confirm' }
      });
      dialogRef.afterClosed().subscribe(result => {
        if (result == 'Yes') {
          this.isLoading = true;
          this.course_module_Service.Delete_course_module(Module_Id).subscribe(
            Delete_status => {
              if (Delete_status[0].Module_Id_ > 0) {
                this.pageLoad();
                const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Deleted', Type: "false" } });
              } else {
                this.isLoading = false;
                const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occurred', Type: "2" } });
              }
              this.isLoading = false;
            },
            Rows => {
              this.isLoading = false;
              const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occurred', Type: "2" } });
            }
          );
        }
      });
    }
  
    onToggleChange(event, moduleId) {
      let status = event.checked ? 1 : 0;
      let input = {
        Module_Id: moduleId,
        ModuleStatus: status 
      };
      this.course_module_Service.Change_Module_Status(input).subscribe(result => {
        this.pageLoad();
      });
    }



    drop(event: CdkDragDrop<string[]>) {
      moveItemInArray(this.course_module_Data, event.previousIndex, event.currentIndex);
      this.queueOrderUpdate(event);
    }
  
    private queueOrderUpdate(event: CdkDragDrop<string[]>) {
      const orderData = this.course_module_Data.map((item, index) => ({
        Module_ID: item.Module_ID,
        Order: index + 1
      }));
      this.orderUpdateSubject.next(orderData);
    }
  
    private sendOrderUpdate(orderData: any) {
      console.log('orderData: ', orderData);

      try {
        this.course_module_Service.Change_Module_Order(orderData).subscribe(result => {
          console.log('result: ', result);
        });
      } catch (error) {
        console.log('error: ', error);
        
      }

    }
  
  }
