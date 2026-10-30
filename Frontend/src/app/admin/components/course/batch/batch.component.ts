
import { Component, Input, input, OnChanges, OnInit, signal, SimpleChanges, inject, output } from '@angular/core';
import { FormGroup, FormBuilder, Validators,ValidatorFn ,AbstractControl, FormArray} from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DialogBox_Component } from '../../../../shared/components/DialogBox/DialogBox.component';
import {MatDialog} from '@angular/material/dialog';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { BatchService } from '../../../services/batch.service';
import { SharedModule } from '../../../../shared/shared.module';
import { course_Service } from '../../../services/course.Service';
import { user_Service } from '../../../services/user.Service';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';

function atLeastOneTeacher(): ValidatorFn {
  return (control: AbstractControl): {[key: string]: any} | null => {
    const teachersArray = control as FormArray;
    return teachersArray.length >= 1 ? null : { 'noTeachers': true };
  };
}
@Component({
    selector: 'app-batch',
    standalone: true,
    imports: [SharedModule, CommonModule],
    templateUrl: './batch.component.html',
    styleUrl: './batch.component.scss'
})
export class BatchComponent implements OnInit {
  BatchService_ = inject(BatchService);
  private fb = inject(FormBuilder);
  dialogBox = inject(MatDialog);
  course_Service_ = inject(course_Service);
  user_Service_ = inject(user_Service);

  private _courseId: number=0;
  readonly closeClicked = output<void>();
  batchStudentsView: boolean =false;
  BatchStudentList: any=[];
  filepath: any;
  BatchName: any;
  oneOnone_teacherlist: never[];


  @Input() set Course_ID(value: number) {
    this._courseId = value;
    console.log('Course_ID changed:', value);
    this.onCourseIdChange(value);
  }  

  formErrors = {
    Course_ID: {
        required: 'Course is required.',
    },
    Batch_Name: {
        required: 'Batch Name is required.',
    },
    scheduledTeachers: {
        noTeachers: 'At least one teacher is required.',
    },
    Start_Date: {
        required: 'Start Date is required',
        invalidFormat: 'Invalid date format. Please use YYYY-MM-DD',
        invalidDate: 'Invalid date',
        minDate: 'Date cannot be before this year',
        maxDate: 'Date cannot be after 2100',
        exceedsMaxDate: 'Date cannot exceed year 2100'
    },
    End_Date: {
        // required: 'End Date is required',
        invalidFormat: 'Invalid date format. Please use YYYY-MM-DD',
        invalidDate: 'Invalid date',
        minDate: 'Date cannot be before start date',
        maxDate: 'Date cannot be after 2100',
        invalidRange: 'End date must be after start date',
        exceedsMaxDate: 'Date cannot exceed year 2100'
    }
};
  Entry_View = true;
  batch_Form: FormGroup;
  batch_Search: string;
  isLoading: boolean;Total_Entries: number;
  batch_Data:any[]=[]
  CourseList:any=[]
  EditIndex: number;submitted = false;
  teacherDatas=signal([]);
  minEndDate: string;
minStartDate = `2024-01-01`;
maxDate = '2100-12-31';


  constructor() {
         this.filepath=environment['FilePath']
    this.batch_Form = this.fb.group(
      {
        Batch_ID: [0],
        Batch_Name: ['', Validators.required],
        Delete_Status: [0],
        Course_ID: [this.Course_ID, Validators.required],
        scheduledTeachers: this.fb.array([]),
        // scheduledTeachers: this.fb.array([], atLeastOneTeacher()),
        Start_Date: ['', [Validators.required, this.dateValidator()]],
        End_Date: ['', [this.dateValidator(true)]],
      },
      { validators: this.dateRangeValidator }
    );
    
    this.batch_Form.get('Start_Date')?.valueChanges.subscribe(() => {
      this.batch_Form.updateValueAndValidity();
    });
    this.batch_Form.get('End_Date')?.valueChanges.subscribe(() => {
      this.batch_Form.updateValueAndValidity();
    });
    this.batch_Form?.get('Start_Date')?.valueChanges.subscribe(() => {
      this.onStartDateChange();
    });
    // this.addTeacher()
  }
  onGroupCallChange(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked; // Get the checkbox state
    if (isChecked) {
        this.addTeacher(); // Add teacher if checkbox is checked
    } else {
        this.removeAllTeachers(); // Remove all teachers if checkbox is unchecked
    }
}
removeAllTeachers() {


  this.scheduledTeachers.controls.forEach((teacherGroup: FormGroup) => {
    // Ensure 'Delete_Status' exists in each teacherGroup
    if (teacherGroup.get('Delete_Status')) {
      teacherGroup.get('Delete_Status')?.patchValue(1);
      teacherGroup.get('Teacher_ID')?.setValue(0); // Reset value to ensure no conflicts

      teacherGroup.get('Teacher_ID')?.clearValidators();
      teacherGroup.get('Teacher_ID')?.updateValueAndValidity();
    }


    const timeSlots = teacherGroup.get('timeSlots') as FormArray;
    if (timeSlots) {
      for (let i = timeSlots.length - 1; i >= 0; i--) {
        const slot = timeSlots.at(i) as FormGroup;
        if (slot.get('Slot_Id')?.value) {
          slot.get('Delete_Status')?.patchValue(1);
          this.removeValidationFromSlot(slot); 
        } else {
          timeSlots.removeAt(i);
        }
      }
    }
  });
}

  dateRangeValidator(group: FormGroup) {
    const startDate = group.get('Start_Date')?.value;
    const endDate = group.get('End_Date')?.value;
    const endControl = group.get('End_Date');
  
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
  
      if (end < start) {
        endControl?.setErrors({ ...endControl?.errors, invalidRange: true });
        return { invalidRange: true };
      }
    }

    if (endControl?.hasError('invalidRange')) {
      const errors = { ...endControl.errors };
      delete errors['invalidRange'];
      endControl.setErrors(Object.keys(errors).length ? errors : null);
    }
  
    return null;
  }
  

  dateValidator(isEndDate: boolean = false) {
    return (control: AbstractControl) => {
      if (!control.value) {
        return isEndDate ? null : { required: true };
      }
  
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(control.value)) {
        return { invalidFormat: true };
      }
  
      const inputDate = new Date(control.value);
      const minDate = isEndDate ? new Date(this.minStartDate) : new Date('2024-01-01'); // Adjust minDate for Start_Date vs End_Date
      const maxDate = new Date('2100-12-31');
  
      if (isNaN(inputDate.getTime())) {
        return { invalidDate: true };
      }
  
      if (inputDate < minDate) {
        return { minDate: true };
      }
  
      if (inputDate > maxDate) {
        return { maxDate: true };
      }
  
      return null;
    };
  }
  


  onStartDateChange() {
    const startDate = this.batch_Form.get('Start_Date')?.value;
    if (startDate) {
      this.minEndDate = startDate;
      const endDate = this.batch_Form.get('End_Date')?.value;
      if (endDate && new Date(endDate) < new Date(startDate)) {
        this.batch_Form.patchValue({ End_Date: startDate });
      }
    }
  }
  countActiveTeachers(): number {
    return this.scheduledTeachers.controls.filter(teacher => teacher.get('Delete_Status')?.value !== 1).length;
  }


  get scheduledTeachers() {
    return this.batch_Form.get('scheduledTeachers') as FormArray;
}

  ngOnInit(): void {
  }
  onSelectChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const numericValue = Number(value);
    console.log('Course_ID changed:', numericValue);
    this.Clr_Batch();
    this.batch_Form.patchValue({ Course_ID: numericValue });
  }
  onCourseIdChange(newCourseId: number) {
    this.Clr_Batch();
    console.log('Course_ID changed to:', newCourseId);
    this.batch_Form.patchValue({ Course_ID: newCourseId });
    console.log('  this.batch_Form: ',   this.batch_Form);
    this.pageLoad();
    }

  pageLoad() {
  
    this.Search_course_category();
    this.Search_Batch();
    this.Entry_View = false;
    this.batchStudentsView = false;
  }

  Save_Batch() {
    

    console.log('this.batch_Form: ', this.batch_Form);

    if (this.batch_Form.valid) {
      let formValue = { ...this.batch_Form?.value };
      if (!formValue.End_Date) {
        formValue.End_Date = null;
      }
      if (formValue.scheduledTeachers) {
         formValue.scheduledTeachers.forEach((teacher: any) => {
            if (teacher.timeSlots) {
                teacher.timeSlots.forEach((slot: any) => {
                    if (!slot.startTime) slot.startTime = '00:00:00';
                    if (!slot.endTime) slot.endTime = '00:00:00';
                });
            }
         });
      }

      this.isLoading = true;
      this.BatchService_.Save_Batch(formValue).subscribe(Save_status => {
        // Save_status = Save_status[0];
        if (Number(Save_status[0].Batch_ID) > 0) {
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Saved', Type: "false" } });
          this.batch_Form.patchValue({ Course_ID:  this._courseId  });

          this.pageLoad();
        }
        else {
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Error Occured', Type: "2" } });
        }
        this.isLoading = false;
      },
        Rows => {
          this.isLoading = false;
          const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: Rows.error?.error || 'Error Occurred', Type: "2" } });
        });

    }else{
      
      const dialogRef = this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Please fill all required fields', Type: "2" } });
    }
 
    
  }

  getErrorMessage(controlName: string): string {
    const control = this.batch_Form.get(controlName);
 
    if (control && control.errors && this.submitted) {
      for (const errorName in control.errors) {
        if (control.errors.hasOwnProperty(errorName)) {
          if (errorName === 'noTeachers') {
            return this.formErrors['scheduledTeachers']['noTeachers'];
          }
          
          // Handle form-level date range error
          if (errorName === 'invalidRange' && controlName === 'End_Date' && this.batch_Form.errors?.['invalidRange']) {
            console.log('errorName: ', errorName);
            return this.formErrors['End_Date']['invalidRange'];
          }
      
          return this.formErrors[controlName][errorName] || 'Invalid input';
        }
      }
    }
    return '';
  }

  getCourseName(courseId: number): string {
    const id = courseId || this._courseId;
    const course = this.CourseList?.find((c: any) => c.Course_ID == id);
    return course ? course.Course_Name : '';
  }

  closeClick() {
    this.Entry_View = false;
    this.batchStudentsView = false;
  }

  Create_New() {
      this.Clr_Batch();
  
      this.submitted=false
      console.log(' this.batch_Form: ',  this.batch_Form);
    this.Entry_View = true;
    this.batchStudentsView = false;


  }

  Clr_Batch() {
    this.batch_Form.reset({
      Batch_ID: 0,
      Batch_Name: "",
      Delete_Status: 0,
      Course_ID: this._courseId,
      End_Date:"",
      Start_Date:"",
      scheduledTeachers:[]
    })
    this.scheduledTeachers.clear();
    // this.addTeacher()
  }

  Search_Batch() {
    this.isLoading = true;
    console.log('this.batch_Form.ge: ', this.batch_Form.get('Course_ID')?.value);
    this.course_Service_.get_course_Batches( this.batch_Form.get('Course_ID')?.value).subscribe((Rows:any) => {
      this.batch_Data = Rows.map(batch => ({
        ...batch,
        statusClass: batch.is_expired ? 'text-red-500' : 'text-green-500',
        statusText: batch.is_expired ? 'Expired' : 'Active'
      }));
      console.log('   this.batch_Data : ',    this.batch_Data );
      this.Total_Entries = this.batch_Data.length;
      if (this.batch_Data.length == 0) {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open
          (DialogBox_Component, {
            panelClass: 'Dialogbox-Class'
            , data: { Message: 'No Details Found', Type: "3" }
          });
      }
      this.BatchService_.GetAllCourses('').subscribe((Rows:any) => {
        this.CourseList = Rows;
        console.log('this.CourseList : ', this.CourseList );
    
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

  Edit_Batch(Batch_e: any) {
    this.Entry_View = true;
    this.batchStudentsView = false;
    this.oneOnone_teacherlist=[]

    this.batch_Form.patchValue(Batch_e);
    
    this.BatchService_.Get_Batch_Details(Batch_e.Batch_ID).subscribe(Rows => {

      this.patchScheduledTeachers(Rows[0][0][0].scheduledTeachers)
      this.oneOnone_teacherlist=Rows[0][1]
    })


  }
  Get_Batch_Students(batch){
    this.isLoading = true;
    this.Entry_View = true;
    
    this.BatchName=batch.Batch_Name
    this.BatchStudentList=[]
    this.batchStudentsView = true;
    this.course_Service_.Get_Student_List_By_Batch(batch.Batch_ID).subscribe(Rows => {
      console.log('Rows: ', Rows);
      this.isLoading = false;
      this.BatchStudentList=Rows

    })
  }
  getInitials(student: any): string {
    return (student.First_Name?.charAt(0) || '') + (student.Last_Name?.charAt(0) || '');
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
    event.target.nextElementSibling.style.display = 'flex';
  }
  Delete_Batch(Batch_ID, index) {
    const dialogRef = this.dialogBox.open
      (DialogBox_Component, {
        panelClass: 'Dialogbox-Class'
        , data: { Message: 'Do you want to delete ?', Type: true, Heading: 'Confirm' }
      });
    dialogRef.afterClosed().subscribe(result => {
      if (result == 'Yes') {
        this.isLoading = true;
        this.BatchService_.Delete_Batch(Batch_ID).subscribe(Delete_status => {
          if (Delete_status[0].Batch_ID > 0) {
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
      Batch_ID :  categoryId,
      categoryStatus: status 
    }
    this.BatchService_.ChangeCategoryStatus(input).subscribe(result=>{
      this.pageLoad();
    })
  }

  getTimeSlots(teacherGroup: AbstractControl): AbstractControl[] {
    return this.getTimeSlotArray(teacherGroup).controls;
  }
  getTimeSlotArray(teacherGroup: AbstractControl): FormArray {
    return teacherGroup.get('timeSlots') as FormArray;
  }

  removeTimeSlot(teacherIndex: number, slotIndex: number, slot: any) {
    const timeSlots = this.scheduledTeachers.at(teacherIndex).get('timeSlots') as FormArray;
  
    if (slot.get('Slot_Id')?.value) {
      slot.get('Delete_Status')?.patchValue(1);
      this.removeValidationFromSlot(slot);
    } else {
      timeSlots.removeAt(slotIndex);
    }
  }   
    removeValidationFromSlot(slot: FormGroup) {
    slot.get('startTime')?.clearValidators();
    slot.get('endTime')?.clearValidators();

    slot.get('startTime')?.updateValueAndValidity();
    slot.get('endTime')?.updateValueAndValidity();
  }
  countActiveTimeSlots(teacherGroup: any): number {
    const timeSlots = teacherGroup.get('timeSlots') as FormArray;
    return timeSlots.controls.filter(slot => slot.get('Delete_Status')?.value !== 1).length;
  }
  addTimeSlot(teacherIndex: number) {
    const timeSlots = this.scheduledTeachers.at(teacherIndex).get('timeSlots') as FormArray;
    timeSlots.push(this.createTimeSlotGroup());
  }  
   timeValidator(): ValidatorFn {
    return (control: AbstractControl): {[key: string]: any} | null => {
      const value = control.value;
      if (!value) {
        return { 'required': true };
      }
      // Add any additional time format validation here if needed
      return null;
    };
  }

  createTimeSlotGroup(startTime: string = '', endTime: string = '', Slot_Id = 0): FormGroup {
    return this.fb.group({
      startTime: [startTime],
      endTime: [endTime],
      Delete_Status: [0],
      Slot_Id: [Slot_Id],
    });
  }
   conditionalValidator(validator: () => ValidatorFn, dependentField: string): ValidatorFn {
    return (formControl: AbstractControl): {[key: string]: any} | null => {
      if (!formControl.parent) {
        return null;
      }
      const parentGroup = formControl.parent.parent as FormGroup;
      if (parentGroup && parentGroup.get('Delete_Status')?.value === 1) {
        return null;
      }
      const dependentControl = formControl.parent.get(dependentField);
      if (dependentControl && dependentControl.value === 0) {
        return validator()(formControl);
      }
      return null;
    };
  }
  removeTeacher(index: number, teacherGroup: any) {
    if (teacherGroup.get('CourseTeacher_ID')?.value) {
      teacherGroup.get('Delete_Status')?.patchValue(1);
      teacherGroup.get('Teacher_ID')?.clearValidators();
      teacherGroup.get('Teacher_ID')?.setValue(0); // Reset value to ensure no conflicts

      teacherGroup.get('Teacher_ID')?.updateValueAndValidity();
      this.removeValidationFromTimeSlots(teacherGroup);
    } else {
      this.scheduledTeachers.removeAt(index);
    }
  }
  
   removeValidationFromTimeSlots(teacherGroup: any) {
    const timeSlots = teacherGroup.get('timeSlots') as FormArray;
    timeSlots.controls.forEach((timeSlot: FormGroup) => {
      timeSlot.get('startTime')?.clearValidators();
      timeSlot.get('endTime')?.clearValidators();
 
      timeSlot.get('startTime')?.updateValueAndValidity();
      timeSlot.get('endTime')?.updateValueAndValidity();

      console.log(timeSlot); // Should log null after clearing
    });

  }

 
  addTeacher() {
    
    const teacherGroup = this.fb.group({
      CourseTeacher_ID: [0],
      Teacher_ID: [0, Validators.required],
      Delete_Status: [0],
      timeSlots: this.fb.array([this.createTimeSlotGroup()])

    });
    this.scheduledTeachers.push(teacherGroup);
  }

  Search_course_category() {
    this.isLoading = true;
    this.course_Service_.Get_All_Course_Items().subscribe(Rows => {
      // this.courseCategoryData.set(Rows[0]);
      // this.SectionsDatas.set(Rows[1]);
      this.teacherDatas.set(Rows[2]);
      // this.BatchDatas.set(Rows[3]);
    
      // this.Search_course()
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

  patchScheduledTeachers(data: any[]) {
    // Clear existing form array
    this.scheduledTeachers.clear();
    if(data){

  
    // Add new form groups based on the data
    console.log('data: ', data);
    data.forEach(item => {
      const timeSlotsFormArray = this.fb.array<FormGroup>([]);
  
      // Create form groups for each time slot
      if (item.timeSlots && item.timeSlots.length > 0) {
        item.timeSlots.forEach((slot: any) => {
          timeSlotsFormArray.push(this.createTimeSlotGroup(slot.startTime, slot.endTime,slot.Slot_Id));
        });
      } else {
        // If no time slots, add an empty one
        timeSlotsFormArray.push(this.createTimeSlotGroup());
      }
  
      const formGroup = this.fb.group({
        CourseTeacher_ID: [item.CourseTeacher_ID],
        Delete_Status: [item.Delete_Status],
        Teacher_ID: [item.Teacher_ID, Validators.required],
        timeSlots: timeSlotsFormArray
      });
  
      this.scheduledTeachers.push(formGroup);
    });
  }
  }     
  
  isScheduledTeachersEmptyOrDeleted(): boolean {
    const teachersArray = this.scheduledTeachers.controls; // Access the FormArray controls
    return !teachersArray.length || teachersArray.every(control => control.value.Delete_Status === 1);
  }
  // Mail History Modal State
  showMailHistoryModal: boolean = false;
  selectedBatchForMailHistory: any = null;
  mailHistoryList: any[] = [];
  loadingMailHistory: boolean = false;
  expandedRecordIndex: number | null = null;
  recipientsList: any[] = [];
  loadingRecipients: boolean = false;

  openMailHistory(batch: any) {
    this.selectedBatchForMailHistory = batch;
    this.showMailHistoryModal = true;
    this.expandedRecordIndex = null;
    this.recipientsList = [];
    this.loadMailHistoryData();
  }

  loadMailHistoryData() {
    if (!this.selectedBatchForMailHistory) return;
    this.loadingMailHistory = true;
    this.mailHistoryList = [];
    this.expandedRecordIndex = null;
    this.recipientsList = [];

    const courseId = this._courseId || 0;
    const batchId = this.selectedBatchForMailHistory.Batch_ID || 0;

    // Trigger Brevo sync to ensure delivery/open statuses are up-to-date
    this.user_Service_.Sync_Brevo_Opens().subscribe({
      next: () => {
        this.fetchBatchMailReportData(courseId, batchId);
      },
      error: (syncErr: any) => {
        console.warn('Brevo sync skipped/warning:', syncErr?.message || syncErr);
        this.fetchBatchMailReportData(courseId, batchId);
      }
    });
  }

  private fetchBatchMailReportData(courseId: number, batchId: number) {
    this.user_Service_.getBatchMailReport(courseId, batchId, '', '').subscribe({
      next: (res: any) => {
        this.mailHistoryList = res?.data || [];
        this.loadingMailHistory = false;
      },
      error: (err: any) => {
        console.error('Error fetching batch mail history:', err);
        this.mailHistoryList = [];
        this.loadingMailHistory = false;
      }
    });
  }

  toggleRecipientDetails(index: number, record: any) {
    if (this.expandedRecordIndex === index) {
      this.expandedRecordIndex = null;
      this.recipientsList = [];
      return;
    }

    this.expandedRecordIndex = index;
    this.loadingRecipients = true;
    this.recipientsList = [];

    const courseId = record.Course_ID || this._courseId || 0;
    const batchId = record.Batch_ID || this.selectedBatchForMailHistory?.Batch_ID || 0;
    const subject = record.Subject || '';
    const attDate = record.Attendance_Date ? record.Attendance_Date.substring(0, 10) : '';
    const sentDate = record.Sent_At ? record.Sent_At.substring(0, 10) : attDate;

    this.user_Service_.getBatchMailRecipients(courseId, batchId, subject, attDate, sentDate).subscribe({
      next: (res: any) => {
        this.recipientsList = res?.data || [];
        this.loadingRecipients = false;
      },
      error: (err: any) => {
        console.error('Error loading recipients:', err);
        this.recipientsList = [];
        this.loadingRecipients = false;
      }
    });
  }

  closeMailHistoryModal() {
    this.showMailHistoryModal = false;
    this.selectedBatchForMailHistory = null;
    this.mailHistoryList = [];
    this.expandedRecordIndex = null;
    this.recipientsList = [];
  }

  getMailHistoryTotalSent(): number {
    return this.mailHistoryList.reduce((acc, curr) => acc + (Number(curr.Total_Sent) || 0), 0);
  }

  getMailHistoryTotalDelivered(): number {
    return this.mailHistoryList.reduce((acc, curr) => acc + (Number(curr.Success_Count) || 0), 0);
  }

  getMailHistoryTotalFailed(): number {
    return this.mailHistoryList.reduce((acc, curr) => acc + (Number(curr.Failed_Count) || 0), 0);
  }

  getMailHistoryTotalOpened(): number {
    return this.mailHistoryList.reduce((acc, curr) => acc + (Number(curr.Opened_Count) || 0), 0);
  }

  onClose() {
    this.closeClicked.emit(); // Emit an event when the close button is clicked
  }

}


