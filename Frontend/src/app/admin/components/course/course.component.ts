import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  signal,
  ViewEncapsulation,
  inject,
  viewChild,
} from '@angular/core';
import { course } from '../../../core/models/course';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { course_Service } from '../../services/course.Service';
import { SharedModule } from '../../../shared/shared.module';
import { course_category_Service } from '../../services/course_category.Service';
import { user_Service } from '../../services/user.Service';
import { ExamServiceService } from '../../services/exam-service.service';
import { CommonModule } from '@angular/common';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { environment } from '../../../../environments/environment';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import {
  Observable,
  Subscription,
  catchError,
  filter,
  forkJoin,
  map,
} from 'rxjs';
import { MatSelectChange } from '@angular/material/select';
import { MatStepper } from '@angular/material/stepper';
import { BatchComponent } from './batch/batch.component';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { ContentFilterPipe } from '../../services/content-filter.pipe'; // Adjust the path as needed
import { ViewportScroller } from '@angular/common';
import * as moment from 'moment';
import { CreateExamDialogComponentComponent } from '../create-exam-dialog-component/create-exam-dialog-component.component'; // Adjust the path as needed
import { ActivatedRoute } from '@angular/router';

interface InvalidDetail {
  sectionIndex: number;
  sectionName: string;
  controlPath: string;
  errors: ValidationErrors | null;
}
function atLeastOneTeacher(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const teachersArray = control as FormArray;
    return teachersArray.length >= 1 ? null : { noTeachers: true };
  };
}
@Component({
  selector: 'app-course',
  standalone: true,
  imports: [
    SharedModule,
    CommonModule,
    NgxMaterialTimepickerModule,
    BatchComponent,
    ContentFilterPipe,
    NgxMaterialTimepickerModule,
  ],
  templateUrl: './course.component.html',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './course.component.scss',
})
export class CourseComponent implements OnInit, OnDestroy {
  private slotsByTeacher = new Map<number, any[]>();

  private viewportScroller = inject(ViewportScroller);
  private cdr = inject(ChangeDetectorRef);
  course_Service_ = inject(course_Service);
  user_Service_ = inject(user_Service);
  ExamService = inject(ExamServiceService);
  course_category_Service_ = inject(course_category_Service);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  dialogBox = inject(MatDialog);
  private url = inject(ActivatedRoute);

  course_Data: any;
  course_Form: FormGroup;
  exam_Form: FormGroup;
  contentForm: FormGroup;
  currentSection: number;
  searchTerm: string = '';



  isEdit: boolean = false;
  isSave: boolean = false;
  isDelete: boolean = false;

  course_Name_Search: string;
  course_student_view: boolean = false;
  EditIndex: number;
  courseContents: any[] = [];
  audioLoadingStates: { [key: string]: boolean } = {};

  Total_Entries: number;
  mode = 'indeterminate';
  isLoading: boolean;
  Permissions: any;
  selectedTab = new FormControl(0);
  sectionForms: FormGroup[] = [];
  fileToRemoveAws: any = [];
  course_students: any = [];
  free_Slots: any = [];
  course_Batches: any = [];
  batch_Sudents: any = [];
  course_Edit: boolean;
  course_Save: boolean;
  course_Delete: boolean;
  step = 0;
  availableTimes: string[] = []; // Array of available time options
  selectedTeachers: number[] = [];
  private formSubscriptions: Subscription[] = [];
  readonly stepper = viewChild.required<MatStepper>('stepper');
  readonly backgroundVideo =
    viewChild.required<ElementRef<HTMLVideoElement>>('backgroundVideo');
  isVideoPlaying: boolean = true;
  filterForm: FormGroup;

  courseCategoryData = signal([]);
  teacherDatas = signal([]);
  ModuleDatas = signal([]);
  daysDatas = signal([]);
  allDaysDatas = signal([]);
  SectionsDatas = signal([]);
  VisibilityDatas = signal([]);
  totalFiles: number = 0;
  filesUploaded: number = 0;
  uploadStatus: string;
  uploadProgress: number;
  filepath: string;
  searchTimeout: any;
  feeTypes: string[] = [];
  feeList: any[] = [];
  feesForm: FormGroup;
  view:
    | 'students'
    | 'list'
    | 'details'
    | 'exam_students'
    | 'exam_students_Details'
    | 'form'
    | 'Batch_Course'
    | 'course_content_details'
    | 'content_list'
    | 'fees'
    | 'fees_Details'
    | 'exams' = 'students';

  navigationItems: { view: string; label: string }[] = [];
  invalidDetails: InvalidDetail[] = [];
  getTotalContentItems: any;
  exam_students: any = [];
  exam_students_details: any = [];
  teacher_timmings: any = [];
  selectedExamId: any;
  Course_ID: any;
  slot_editMode: boolean[];
  teacherEditMode: boolean[];
  TempAudio: any = '';
  section: any = null;
  selectedStudentId: any;
  SelecetedCourse: any;
  isEditing: boolean = false;
  examcourseName: any;
  examcourseId: any;
  batch_Data:any[]=[];
   CourseList:any=[]
  SelecetedId: any;
  selectedCourseDetails: any;
  constructor(public dialog: MatDialog) {
    this.filterForm = this.fb.group({
      moduleId: [0],
      sectionId: [0],
      dayId: [0],
      filterName: [''],
      visibilityType: [1],
      Is_Exam_Test: [0],
    });

    this.course_Form = this.fb.group({
      Course_ID: [0],
      Course_Name: ['', Validators.required],
      Category_ID: [0],
      Validity: [0],
      Price: [0],
      Delete_Status: [0],
      Disable_Status: [0],
      Live_Class_Enabled: [''],
      Thumbnail_Name: [''],
      Thumbnail_Path: [''],
      ThumbnailVideo_Path: [''],
      ThumbnailVideo_Name: [''],
      Description: [''],
      Things_To_Learn: [''],
      Sections: [''],
      scheduledBatch: [''],
      scheduledTeachers: this.fb.array([]),
      created_at: [new Date().toISOString().substring(0, 10)],
    });
    this.contentForm = this.fb.group({
      Module_ID: [0],
      visibilities: [[]],
      Days_Id: [0],
      Is_Exam_Test: [false],
      contentName: [''],
      Content_ID: [0],
      Course_ID: [0],
      Section_ID: [''],
      externalLink: [''],
      contentThumbnail_Path: [''],
      contentThumbnail_name: [''],
      file: [''],
      file_name: [''],
      file_type: [''],
      Have_Main_Question: [true],
      Is_Main_Question_Text: [false],
      Have_Supporting_Document: [false],
      Have_Answer_Key: [false],
      exam: this.fb.group({
        Main_Question: [''],
        file_name: [''],
        file_type: [''],
        Supporting_Document_Path: [''],
        Supporting_Document_Name: [''],
        Answer_Key_Path: [''],
        Answer_Key_Name: [''],
      }),
    });
    // this.addTeacher();
    this.filepath = environment['FilePath'];
  }

  get scheduledTeachers() {
    return this.course_Form.get('scheduledTeachers') as FormArray;
  }
  get batchArray(): FormArray {
    return this.course_Form.get('scheduledBatch') as FormArray;
  }

  ngOnInit() {
    this.course_Service_.uploadProgress$.subscribe(
      ({ progress, status, totalFiles, filesUploaded }) => {
        this.uploadProgress = progress;
        this.uploadStatus = status;
        this.totalFiles = totalFiles;
        this.filesUploaded = filesUploaded;
      }
    );

    this.Page_Load();

    this.initializeFeesForm();
    this.loadFeeTypes();
    this.loadExistingFeeData();



    
  this.route.queryParams.subscribe(params => {
    console.log("params",params);
    
    if (params['item']) {
    
      const receivedItem = JSON.parse(params['item']);
      console.log('Received Item:', receivedItem);


       this.isEdit = receivedItem?.IsEdit 
        this.isSave = receivedItem?.IsSave 
        this.isDelete = receivedItem?.IsDelete 

        console.log('Permissions:', this.isEdit, this.isSave, this.isDelete);
      
   
    }
  });

  }

  initializeFeesForm() {
    this.feesForm = this.fb.group({
      fee_type: ['', Validators.required],
      duration: [null, [Validators.required, Validators.min(1)]],
      amount: [null, [Validators.required, Validators.min(0)]],
      course_id: [''],
      Installment_information_ID: [''],
      Batch_ID: ['', Validators.required],
    });
  }

  loadFeeTypes() {
    // Ideally from an API
    this.feeTypes = ['OneTime', 'TwoTime', 'ThreeTime', 'FourTime'];
  }

  examList: any[] = [];

  courseList: any;
  openCreateExamModal(): void {
    const courseId = this.course_Form.get('Course_ID')?.value;
    const dialogRef = this.dialog.open(CreateExamDialogComponentComponent, {
      width: '60%',
      height: '70%',
      panelClass: 'Dialogbox-Class',
      data: {
        Exam_ID: 0,
        examcourseName: this.examcourseName,
        examcourseId: this.examcourseId,
        courseList: courseId, // make sure you load this before
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.isLoading = true;
      if (result) {
        this.ExamService.createExam(result).subscribe(() => {
          this.Get_Exams_With_Course(result.Course_ID);
          const successDialog = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: 'Exam upload successfully.',
              Type: 'false',
              Heading: 'Exam upload',
            },
          });
          
        });
      }
      this.isLoading = false;
    });
  }
  editExam(exam: any) {
    // open exam edit modal or form
    const dialogRef = this.dialog.open(CreateExamDialogComponentComponent, {
      width: '60%',
      height: '70%',
      data: {
        Exam_ID: exam.Exam_ID,
        examcourseId: exam.Course_ID,
        examcourseName: exam.Course_Name,
        isEdit: true,
        existingExam: exam, // pass entire exam object
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Call API to update exam here
        this.ExamService.createExam(result).subscribe(() => {
          this.Get_Exams_With_Course(result.Course_ID);
        });
      }
    });
  }

  deleteExam(exam: any) {
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: `Are you sure you want to delete Exam for?`,
        Type: 'true', // shows Yes/No buttons
        Heading: 'Confirm Delete',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'Yes') {
        // confirm and delete from backend
        const Exam_ID = exam.Exam_ID;
        this.ExamService.Delete_Exam(Exam_ID).subscribe(() => {
          const successDialog = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: 'Exam deleted successfully.',
              Type: 'false',
              Heading: 'Deleted',
            },
          });
          this.Get_Exams_With_Course(exam.Course_ID); // refresh your exam list
        });
      }
    });
  }

  manageQuestions(exam: any) {
    // navigate to question manager with Exam_ID
    this.router.navigate(['/exam/questions'], {
      queryParams: { examId: exam.Exam_ID, courseId: exam.Course_ID },
    });
  }

  loadExistingFeeData() {
    const courseId = this.course_Form.get('Course_ID')?.value;
    this.user_Service_.get_course_fees(courseId).subscribe((res) => {
      console.log('res', res);

      if (Array.isArray(res)) {
        this.feeList = res[0];
      }
    });
    console.log('this.feeList', this.feeList);
  }

  editFee(fee: any) {

     const durationInMonths = Math.round(fee.Duration / 30);
     this.Search_Batch();

    this.feesForm.patchValue({
      fee_type: fee.Fee_Type,
      duration: durationInMonths, // show months in form
      // duration: fee.Duration,
      amount: fee.Amount,
      course_id: fee.Course_ID,
      Course_ID: fee.Course_ID,
      Course_Name: fee.Course_Name,
      Installment_information_ID: fee.Installment_information_ID,
      Batch_ID: fee.Batch_ID,
      Batch_Name: fee.Batch_Name
    });
    this.isEditing = true;
    this.setView('fees');
  }

  deleteInstallmentInformation(fee: any) {
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: `Are you sure you want to delete fees for "${fee.Course_Name}"?`,
        Type: 'true', // shows Yes/No buttons
        Heading: 'Confirm Delete',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'Yes') {
        this.user_Service_
          .deleteInstallmentInformation(fee.Installment_information_ID)
          .subscribe(() => {
            const successDialog = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: {
                Message: 'Fee record deleted successfully.',
                Type: 'false',
                Heading: 'Deleted',
              },
            });

            this.loadExistingFeeData(); // Refresh the table
          });
      }
    });
  }
  View_Course_Exams(courseId: number, courseName: string) {
    console.log('View Exams for:', courseName, `(ID: ${courseId})`);
    // Navigate or open modal logic here
    this.SelecetedCourse = courseName;
    this.examcourseId = courseId;
    this.examcourseName = courseName;
    this.Get_Exams_With_Course(courseId);
    this.setView('exams', courseId);
  }

  Get_Exams_With_Course(courseId) {
    this.ExamService.Get_Exams_With_Course(courseId).subscribe({
      next: (exams) => {
        this.examList = exams; // populate your table or view
        console.log('Loaded Exams:', exams);
      },
      error: (err) => {
        console.error('Error loading exams:', err);
      },
    });
  }

  saveFees() {

    if (this.feesForm.valid) {
      console.log('this.feesForm', this.feesForm);

      const formValue = this.feesForm.value;
      console.log('formValue', formValue);

      // Convert duration from months to days (1 month ≈ 30 days)
    const durationInDays = formValue.duration ? formValue.duration * 30 : 0;

    console.log('formValue before conversion', this.course_Data);

      // Match course name string with object in course_Data
      const selectedCourse = this.course_Data.find(
        (course) => course.Course_Name === this.SelecetedCourse
      );
     // Find selected batch by Batch_ID and Name
      const selectedBatch = this.batch_Data.find(
       (batch) => batch.Batch_ID == formValue.Batch_ID
    );  
       const selectedBatchName = this.batch_Data.find(
      (batch) => batch.Batch_Name === formValue.Batch_Name
      
      
    );  
  
console.log('this.feesForm', this.batch_Data);
      if (!selectedCourse) {
        console.error('No matching course found for:', this.SelecetedCourse);
         this.isLoading = false; 
        return;
      }

      const coursePayload = {
        ...formValue,
        duration: durationInDays,
        Course_ID: selectedCourse.Course_ID,
        Course_Name: selectedCourse.Course_Name,
        Batch_ID: selectedBatch.Batch_ID,
        Batch_Name: selectedBatch.Batch_Name ||"",
      };

      console.log('Saving fees for course:', coursePayload);

      this.user_Service_.saveCourseFees(coursePayload).subscribe((res) => {
        console.log(`Fees saved for ${selectedCourse.Course_Name}`);
        this.isEditing = false;
        this.isLoading = false;
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Saved', Type: 'false' },
        });
        dialogRef.afterClosed().subscribe((result) => {
           this.setView('fees_Details');
        });
        
      });
    }    
  }

  addFees() {
     console.log("course",this.course_Form.value.Course_ID);
     console.log("course",this.SelecetedCourse);
     this.Search_Batch()
    this.isEditing = false;
    this.section = null;
    this.setView('fees');
    this.feesForm = this.fb.group({
      fee_type: ['OneTime'],
      duration: [''],
      amount: [''],
      course_id: [''],
      Course_ID: [''],
      Course_Name: [''],
      Installment_information_ID: ['0'],
      Batch_ID: [''],
    });
   
  }
  selectedCourse_Id(arg0: string, selectedCourse_Id: any) {
    throw new Error('Method not implemented.');
  }

  applyFees() {
    this.section = null;
    this.setView('fees_Details');
  }
  applyFeesdetails() {
    this.section = null;
    this.setView('list');
    this.Page_Load();
  }

  convertTimeToUTC(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const today = new Date();

    today.setHours(hours);
    today.setMinutes(minutes);

    const utcTimeString = today.toISOString().slice(11, 16);

    return utcTimeString;
  }

  convertUTCtoLocal(utcTime: string): string {
    // Split the time string into hours and minutes
    const [hours, minutes] = utcTime.split(':').map(Number);

    // Create a Date object with a dummy date (e.g., today's date)
    const today = new Date();

    // Set hours and minutes without affecting the date
    today.setUTCHours(hours);
    today.setUTCMinutes(minutes);

    // Get local time components
    const localHours = today.getHours();
    const localMinutes = today.getMinutes();

    // Format the local time string
    const localTimeString = `${localHours
      .toString()
      .padStart(2, '0')}:${localMinutes.toString().padStart(2, '0')}`;

    return localTimeString;
  }

  getTeacherName(teacherId: number): string {
    const teacher = this.teacherDatas().find((t) => t['User_ID'] === teacherId);
    return teacher ? teacher['First_Name'] : 'Not assigned';
  }

  getSelectedTeachers(): any[] {
    console.log(this.scheduledTeachers.controls?.values);
    return this.teacherDatas().filter((user) =>
      this.selectedTeachers.includes(user['User_ID'])
    );
  }

  examVisibility: { [key: string]: boolean } = {};

  toggleExamDetails(
    sectionIndex: number,
    contentIndex: number,
    examIndex: number
  ) {
    const key = `${sectionIndex}-${contentIndex}`;
    this.examVisibility[key] = !this.examVisibility[key];
  }

  isExamVisible(sectionIndex: number, contentIndex: number): boolean {
    const key = `${sectionIndex}-${contentIndex}`;
    return this.examVisibility[key] || false;
  }

  addTeacher() {
    const teacherGroup = this.fb.group({
      CourseTeacher_ID: [0],
      Teacher_ID: [0],
      Delete_Status: [0],
      timeSlots: this.fb.array([this.createTimeSlotGroup()]),
    });
    this.scheduledTeachers.push(teacherGroup);
  }

  removeTeacher(index: number, teacherGroup: any) {
    if (teacherGroup.get('CourseTeacher_ID')?.value) {
      teacherGroup.get('Delete_Status')?.patchValue(1);
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
    });
  }
  onTeacherSelect(event: MatSelectChange, teacherIndex: number) {
    const teacherId = event.value;
    console.log('teacherId: ', teacherId);
    this.user_Service_.Get_Teacher_Timing(teacherId).subscribe((res) => {
      console.log('res: ', res);
      this.teacher_timmings[teacherIndex] = res;
      console.log('his.teacher_timmings: ', this.teacher_timmings);
    });
  }

  getTimeSlotArray(teacherGroup: AbstractControl): FormArray {
    return teacherGroup.get('timeSlots') as FormArray;
  }

  getTimeSlots(teacherGroup: AbstractControl): AbstractControl[] {
    return this.getTimeSlotArray(teacherGroup).controls;
  }

  addTimeSlot(teacherIndex: number) {
    const timeSlots = this.scheduledTeachers
      .at(teacherIndex)
      .get('timeSlots') as FormArray;
    timeSlots.push(this.createTimeSlotGroup());
  }

  removeTimeSlot(teacherIndex: number, slotIndex: number, slot: any) {
    const timeSlots = this.scheduledTeachers
      .at(teacherIndex)
      .get('timeSlots') as FormArray;

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

  onBatchSelectionChange(event: MatSelectChange) {
    const selectedBatch_IDs = event.value;
    const currentBatch_IDs = this.scheduledTeachers.controls.map(
      (control) => control.get('Batch_ID')?.value
    );

    // Remove batch-teacher associations for unselected batches
    for (let i = this.scheduledTeachers.length - 1; i >= 0; i--) {
      if (
        !selectedBatch_IDs.includes(
          this.scheduledTeachers.at(i).get('Batch_ID')?.value
        )
      ) {
        this.scheduledTeachers.removeAt(i);
      }
    }

    // Add new batch-teacher associations for newly selected batches
    selectedBatch_IDs.forEach((Batch_ID) => {
      if (!currentBatch_IDs.includes(Batch_ID)) {
        this.addTeacher();
      }
    });
  }
  changeBatch(studentId: number, BatchId) {
    console.log('BatchId: ', BatchId);
    if (BatchId == 'null') {
      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Please select a Batch.',
          Type: '3',
          Heading: 'Invalid Batch Type',
        },
      });
      return;
    } else {
      this.isLoading = true;

      this.batch_Sudents = [];
      let payload = {
        studentId,
        BatchId,
        course_id: this.course_Form.get('Course_ID')?.value,
      };
      this.batch_Sudents[0] = payload;
      this.course_Service_
        .Student_Batch_Change(this.batch_Sudents)
        .subscribe((res) => {
          console.log('res: ', res);

          if (res[0][0]['result']) {
            this.View_Course_Students(this.course_Form.get('Course_ID')?.value);
            this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: { Message: 'Saved', Type: 'false' },
            });
          }
        });
      console.log(`Changing student ${studentId} to batch `);
    }
  }

  // ... (in your component class)

  patchScheduledTeachers(data: any[]) {
    // Clear existing form array
    this.scheduledTeachers.clear();
    if (data) {
      // Add new form groups based on the data
      console.log('data: ', data);
      data.forEach((item) => {
        const timeSlotsFormArray = this.fb.array<FormGroup>([]);

        // Create form groups for each time slot
        if (item.timeSlots && item.timeSlots.length > 0) {
          item.timeSlots.forEach((slot: any) => {
            timeSlotsFormArray.push(
              this.createTimeSlotGroup(
                slot.startTime,
                slot.endTime,
                slot.Slot_Id
              )
            );
          });
        } else {
          // If no time slots, add an empty one
          timeSlotsFormArray.push(this.createTimeSlotGroup());
        }

        const formGroup = this.fb.group({
          CourseTeacher_ID: [item.CourseTeacher_ID],
          Delete_Status: [item.Delete_Status],
          Teacher_ID: [item.Teacher_ID],
          timeSlots: timeSlotsFormArray,
        });

        this.scheduledTeachers.push(formGroup);
      });
    }
  }
  createTimeSlotGroup(
    startTime: string = '',
    endTime: string = '',
    Slot_Id = 0
  ): FormGroup {
    return this.fb.group({
      startTime: [
        startTime,
        this.conditionalValidator(() => this.timeValidator(), 'Delete_Status'),
      ],
      endTime: [
        endTime,
        this.conditionalValidator(() => this.timeValidator(), 'Delete_Status'),
      ],
      Delete_Status: [0],
      Slot_Id: [Slot_Id],
    });
  }
  private timeValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;
      return null;
    };
  }

  conditionalValidator(
    validator: () => ValidatorFn,
    dependentField: string
  ): ValidatorFn {
    return (formControl: AbstractControl): { [key: string]: any } | null => {
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
  onSelectionChange(sectionId: any): void {
    console.log('sectionId: ', sectionId);
    this.section = null;
    this.section = this.SectionsDatas().find(
      (ele) => ele['Section_ID'] == sectionId
    );
    console.log('     this.section: ', this.section);

    this.cdr.detectChanges();
  }

  isExamTest(content): boolean {
    return content.get('Is_Exam_Test')?.value || false;
  }

  onIsExamTestChange(event: any, content): void {
    content.patchValue({ Is_Exam_Test: event.checked ? 1 : 0 });
  }

  patchAnswerMediaName(Question: any, value: any) {
    Question.get('Answer_Media_Name')?.patchValue(value);
  }

  downloadFile(filePath: string) {
    // Logic to trigger download
    window.open(this.filepath + filePath, '_blank'); // Opens the file in a new tab for download
  }

  removeExam(contentFormGroup: any, examIndex: number): void {
    const examsArray = contentFormGroup.get('exams') as FormArray;
    examsArray.removeAt(examIndex);
  }

  getExamFormGroup(exam: AbstractControl, index: number): FormGroup {
    return exam as FormGroup;
  }
  examsArray(contentFormGroup: any): any {
    return contentFormGroup.get('exams') as FormArray;
  }

  getLabel(sectionId) {
    const selectedSection = this.SectionsDatas().find(
      (ele) => ele['Section_ID'] == sectionId
    );
    return (selectedSection && selectedSection['Section_Name']) ?? '';
  }

  onFileSelected(
    event: any,
    contentFormGroup: any,
    controlName: string,
    fileToRemove: any,
    fileName: string,
    filetype: boolean = false,
    allowedTypes: 'all' | 'pdf' | 'audio' | 'video' | 'image' = 'all'
  ) {
    this.TempAudio = null;

    const file = event.target.files[0];

    // File type validation
    if (!this.isFileTypeValid(file, allowedTypes)) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: `Invalid file type. Allowed types: ${this.getAllowedTypeString(
            allowedTypes
          )}`,
          Type: '3',
        },
      });
      event.target.value = ''; // Clear the file input
      return;
    }
    if (
      !(fileToRemove instanceof File) &&
      fileToRemove != null &&
      fileToRemove !== ''
    ) {
      this.fileToRemoveAws.push(fileToRemove);
    }

    contentFormGroup.get(controlName)?.setValue(file);
    contentFormGroup.get(fileName)?.setValue(file.name);

    if (filetype) {
      contentFormGroup.get('file_type')?.setValue(file.type);
    }
    if (controlName == 'Main_Question') {
      this.TempAudio = file;
    }
    console.log(
      ' contentFormGroup.get(controlName)?.: ',
      contentFormGroup.get(controlName)?.value
    );
  }

  // onFileSelected(event: any,contentFormGroup,controlName,fileToRemove,fileName,filetype=false) {
  //   if (!(fileToRemove instanceof File) && fileToRemove!=null && fileToRemove!='' ) {
  //     this.fileToRemoveAws.push(fileToRemove)

  //   }

  //   const file = event.target.files[0];
  //       contentFormGroup.get(controlName)?.setValue(file);

  //   contentFormGroup.get(fileName)?.setValue(file.name);
  //   if(filetype){

  //     contentFormGroup.get('file_type')?.setValue(file.type);
  //   }
  //   // this.course_Service_.upload(file)

  // }

  stepControl = new FormControl(false);

  findInvalidControls(
    group: FormGroup | FormArray,
    sectionName: string,
    path: string = ''
  ): InvalidDetail[] {
    let invalidControls: InvalidDetail[] = [];

    Object.keys(group.controls).forEach((key) => {
      const control = group.get(key);
      control?.markAsTouched();

      const currentPath = path ? `${sectionName}.${key}` : key;

      if (control instanceof FormGroup || control instanceof FormArray) {
        invalidControls = invalidControls.concat(
          this.findInvalidControls(control, sectionName, currentPath)
        );
      } else if (control && control.invalid) {
        invalidControls.push({
          sectionIndex: 0, // This will be set in the validateForm method
          sectionName,
          controlPath: currentPath,
          errors: control.errors,
        });
      }
    });

    return invalidControls;
  }

  onCourseThumbnailFileSelected(event: any) {
    const file = event.target.files[0];

    if (file) {
      // Check if the file is an image
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validImageTypes.includes(file.type)) {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Please select a valid image file (JPEG, PNG, GIF).',
            Type: '3',
            Heading: 'Invalid File Type',
          },
        });
        return;
      }

      // Check if the file size is below 500KB
      if (file.size > 500 * 1024) {
        // 500KB
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'File size should be below 500KB.',
            Type: '3',
            Heading: 'File size',
          },
        });
        return;
      }

      if (
        !(this.course_Form.get('Thumbnail_Path')?.value instanceof File) &&
        this.course_Form.get('Thumbnail_Path')?.value != null &&
        this.course_Form.get('Thumbnail_Path')?.value != ''
      ) {
        this.fileToRemoveAws.push(
          this.course_Form.get('Thumbnail_Path')?.value
        );
      }

      this.course_Form.get('Thumbnail_Path')?.setValue(file);
      console.log(
        '   this.course_Form',
        this.course_Form.get('Thumbnail_Path')
      );

      this.course_Form.get('Thumbnail_Name')?.setValue(file.name);
    }
  }

  playBackgroundVideo() {
    const video = this.backgroundVideo().nativeElement;
    if (video.src) {
      try {
        video.muted = true;
        video.play();
      } catch (error) {}

      video.style.opacity = '1';
      this.isVideoPlaying = true;
    }
  }

  stopBackgroundVideo() {
    const video = this.backgroundVideo().nativeElement;
    video.pause();
    video.style.opacity = '0';
    this.isVideoPlaying = false;
  }
  onCourseThumbnailVideoSelected(event: any) {
    const file = event.target.files[0];

    if (file) {
      // Check if the file is a video
      const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
      if (!validVideoTypes.includes(file.type)) {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Please select a valid video file (MP4, WebM, OGG).',
            Type: '3',
            Heading: 'Invalid File Type',
          },
        });
        return;
      }

      if (
        !(this.course_Form.get('ThumbnailVideo_Path')?.value instanceof File) &&
        this.course_Form.get('ThumbnailVideo_Path')?.value != null &&
        this.course_Form.get('ThumbnailVideo_Path')?.value != ''
      ) {
        this.fileToRemoveAws.push(
          this.course_Form.get('ThumbnailVideo_Path')?.value
        );
      }

      this.course_Form.get('ThumbnailVideo_Path')?.setValue(file);
      console.log(
        'this.course_Form',
        this.course_Form.get('ThumbnailVideo_Path')
      );

      this.course_Form.get('ThumbnailVideo_Name')?.setValue(file.name);

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.backgroundVideo().nativeElement.src = e.target.result;

        // Start playing the video immediately after selection
        this.playBackgroundVideo();
      };
      reader.readAsDataURL(file);
    }
  }
  removeCourseThumbnailVideo() {
    // If there's an existing video in the form
    if (this.course_Form.get('ThumbnailVideo_Path')?.value) {
      // If it's an existing AWS video, add to removal list
      if (
        !(this.course_Form.get('ThumbnailVideo_Path')?.value instanceof File) &&
        this.course_Form.get('ThumbnailVideo_Path')?.value != null &&
        this.course_Form.get('ThumbnailVideo_Path')?.value != ''
      ) {
        this.fileToRemoveAws.push(
          this.course_Form.get('ThumbnailVideo_Path')?.value
        );
      }

      // Clear the video source
      if (this.backgroundVideo()) {
        this.backgroundVideo().nativeElement.src = '';
      }

      // Reset form controls
      this.course_Form.get('ThumbnailVideo_Path')?.setValue(null);
      this.course_Form.get('ThumbnailVideo_Name')?.setValue(null);
    }
  }

  console(e) {
    console.log('e: ', e);
    console.log('e: ', this.sectionForms);

    const sectionPayloads: any[] = [];
  }
  changeXamName(event, form) {
    console.log('form: ', form['controls'].contentName);

    form.controls['contentName'].patchValue(event.target.value);
  }
  sectionContentsArray(section) {
    return section.get('sectionContents') as FormArray;
  }

  Page_Load() {
    this.Clr_course();

    this.Search_course_category();
    this.setView('list');

    this.route.queryParams
      .pipe(filter((params) => params['Course_Id']))
      .subscribe((params) => {
        console.log('params: ', params);
        const courseId = params['Course_Id'];
        this.selectedStudentId = params['student_id'];
        this.View_Course_Students(courseId);

        // Remove Course_Id from URL
      });
  }
  // Month Grouping State
  selectedMonth: any = null;
  monthGroups: any[] = [];

  groupCoursesByMonth() {
    if (!this.course_Data || !Array.isArray(this.course_Data)) {
      this.monthGroups = [];
      return;
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const groupsMap = new Map<string, any>();

    this.course_Data.forEach((course: any) => {
      const rawDate = course.created_at || course.Entry_Date || course.createdDate;
      const dateObj = rawDate ? new Date(rawDate) : new Date();
      
      const year = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();
      const monthIdx = isNaN(dateObj.getTime()) ? new Date().getMonth() : dateObj.getMonth();
      const monthName = monthNames[monthIdx];
      
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthLabel = `${monthName} ${year}`;

      if (!groupsMap.has(monthKey)) {
        groupsMap.set(monthKey, {
          monthKey,
          monthName,
          year,
          monthLabel,
          courses: []
        });
      }

      groupsMap.get(monthKey).courses.push(course);
    });

    // Sort descending by monthKey (most recent month first)
    this.monthGroups = Array.from(groupsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    if (this.selectedMonth) {
      const updatedSel = this.monthGroups.find(m => m.monthKey === this.selectedMonth.monthKey);
      this.selectedMonth = updatedSel || null;
    }
  }

  selectMonth(group: any) {
    this.selectedMonth = group;
  }

  backToMonths() {
    this.selectedMonth = null;
  }

  // Mail History Modal State
  showMailHistoryModal: boolean = false;
  selectedCourseForMailHistory: any = null;
  selectedBatchIdForHistory: number = 0;
  courseBatchesForHistory: any[] = [];
  mailHistoryList: any[] = [];
  loadingMailHistory: boolean = false;
  expandedRecordIndex: number | null = null;
  recipientsList: any[] = [];
  loadingRecipients: boolean = false;

  openMailHistory(course: any) {
    this.selectedCourseForMailHistory = course;
    this.selectedBatchIdForHistory = 0;
    this.showMailHistoryModal = true;
    this.expandedRecordIndex = null;
    this.recipientsList = [];
    this.courseBatchesForHistory = [];

    // Load batches of this course for the filter dropdown
    if (course && course.Course_ID) {
      this.course_Service_.get_course_Batches(course.Course_ID).subscribe({
        next: (batches: any) => {
          this.courseBatchesForHistory = batches || [];
        },
        error: (err: any) => console.error('Error fetching batches for mail history:', err)
      });
      this.loadMailHistoryData();
    }
  }

  loadMailHistoryData() {
    if (!this.selectedCourseForMailHistory) return;
    this.loadingMailHistory = true;
    this.mailHistoryList = [];
    this.expandedRecordIndex = null;
    this.recipientsList = [];

    const courseId = this.selectedCourseForMailHistory.Course_ID || 0;
    const batchId = this.selectedBatchIdForHistory || 0;

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

  onBatchFilterChange(batchId: any) {
    this.selectedBatchIdForHistory = Number(batchId) || 0;
    this.loadMailHistoryData();
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

    const courseId = record.Course_ID || this.selectedCourseForMailHistory?.Course_ID || 0;
    const batchId = record.Batch_ID || 0;
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
    this.selectedCourseForMailHistory = null;
    this.selectedBatchIdForHistory = 0;
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

  Search_course() {
    this.course_Service_.Search_all_course(this.searchTerm).subscribe(
      (Rows) => {
        this.course_Data = Rows;
        console.log(' this.course_Data: ', this.course_Data);
        this.groupCoursesByMonth();

        this.isLoading = false;
      },
      (Rows) => {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occured', Type: '2' },
        });
      }
    );
  }
  Create_New() {
    this.Clr_course();
    this.setView('form');
  }

  Close_Click() {
    this.url.queryParams
      .pipe(filter((params) => params['student_id']))
      .subscribe((params) => {
        this.selectedStudentId = null;
        console.log(' params ', params['student_id']);
        this.router.navigate(['admin/student'], {
          queryParams: { student_id: params['student_id'] },
        });
      });
    this.setView('list');
  }
  trackByFn(index, item) {
    return index;
  }

  Clr_course() {
    this.course_Service_.resetUploadProgress();
    this.selectedExamId = null;
    this.exam_students = [];
    this.sectionForms = [];
    this.teacher_timmings = [];

    this.exam_students_details = [];
    this.course_Form.reset({
      Course_ID: 0,
      Course_Name: '',
      Category_ID: 0,
      Validity: 0,
      Sections: [],
      Price: 0,
      Delete_Status: '',
      Disable_Status: '',
      Description: '',
      Things_To_Learn: '',
      scheduledBatch: '',
      // scheduledTeachers:"",
      Live_Class_Enabled: '',
      Step: 1,
      created_at: new Date().toISOString().substring(0, 10),
    });
    this.scheduledTeachers.clear();
    // this.addTeacher()
  }

  // Save_course() {

  //   this.isLoading=true

  //       console.log('this.course_Form: ', this.course_Form);
  //       const sectionPayloads: any[] = [];
  //       this.sectionForms.forEach((formGroup, index) => {
  //         sectionPayloads.push(...formGroup.get('sectionContents')?.value);
  //       });
  //       let payload = {
  //         course: this.course_Form.getRawValue(),
  //         contents: sectionPayloads
  //       };
  //       console.log('payload: ', payload);

  //       let totalFilesCount = sectionPayloads.reduce((count, section) => {
  //         // Count files directly in the section
  //         if (section.file instanceof File) count++;
  //         if (section.contentThumbnail_Path instanceof File) count++;

  //         // Count files in exams
  //         section.exams.forEach(exam => {
  //           if (exam.Main_Question instanceof File) count++;
  //           if (exam.Answer_Key_Path instanceof File) count++;
  //           if (exam.Supporting_Document_Path instanceof File) count++;
  //         });

  //         return count;
  //       }, 0);
  //         if (payload.course.Thumbnail_Path && payload.course.Thumbnail_Path instanceof File) {
  //           totalFilesCount++;
  //         }
  //         if (payload.course.ThumbnailVideo_Path && payload.course.ThumbnailVideo_Path instanceof File) {
  //           totalFilesCount++;
  //         }
  //         console.log('totalFilesCount: ', totalFilesCount);
  //         // Reusable function for uploading files
  //         const uploadFile = async (file, totalFilesCount, courseName, type = '') => {
  //           try {
  //             console.log('type: ', type);
  //             const { key, fileName } = await this.course_Service_.upload(file, totalFilesCount, courseName, type);
  //             console.log('fileName: ', fileName);
  //
  //             return { key, fileName };
  //           } catch (err) {
  //             console.log('Error uploading file:', err);
  //             throw err; // Rethrow to ensure Promise.all catches it
  //           }
  //         };

  //   const uploadPromises = sectionPayloads.map(async section => {
  //     const courseName = this.course_Form.get('Course_Name')?.value;

  //     if (section.file && section.file instanceof File) {
  //       const { key } = await uploadFile(section.file, totalFilesCount, courseName);
  //       section.file = key;
  //     }

  //     if (section.contentThumbnail_Path && section.contentThumbnail_Path instanceof File) {
  //       const { key } = await uploadFile(section.contentThumbnail_Path, totalFilesCount, courseName);
  //       section.contentThumbnail_Path = key;
  //     }

  //     if (section.exams?.length > 0) {
  //       const mainQuestion = section.exams[0].Main_Question;

  //       if (mainQuestion instanceof File) {
  //         const { key, fileName } = await uploadFile(mainQuestion, totalFilesCount, courseName);
  //         section.exams[0].Main_Question = key;
  //         section.exams[0].file_name = fileName;
  //       }
  //       if (section.exams[0].Answer_Key_Path && section.exams[0].Answer_Key_Path instanceof File) {
  //         const { key } = await uploadFile(section.exams[0].Answer_Key_Path, totalFilesCount, courseName);
  //         section.exams[0].Answer_Key_Path = key;
  //       }
  //       if (section.exams[0].Supporting_Document_Path && section.exams[0].Supporting_Document_Path instanceof File) {
  //         const { key } = await uploadFile(section.exams[0].Supporting_Document_Path, totalFilesCount, courseName);
  //         section.exams[0].Supporting_Document_Path = key;
  //       }
  //     }
  //   });

  //   const coursePayloads = [
  //     { path: 'Thumbnail_Path', type: 'Thumbnail' },
  //     { path: 'ThumbnailVideo_Path', type: 'ThumbnailVideo' }
  //   ];

  //   coursePayloads.forEach(({ path, type }) => {
  //     const file = payload.course[path];
  //     if (file && file instanceof File) {
  //       uploadPromises.push(
  //         (async () => {
  //           const { key } = await uploadFile(file, totalFilesCount, this.course_Form.get('Course_Name')?.value, type);
  //
  //           payload.course[path] = key;
  //           console.log(`${path}: `, payload.course[path]);
  //         })()
  //       );
  //     }
  //   });

  //   const removePromises = this.fileToRemoveAws.map(async key => {
  //     try {
  //       await this.course_Service_.fileToRemoveAws(key);
  //     } catch (err) {
  //       console.log('Error removing file from AWS:', err);
  //     }
  //   });

  //   console.log('payload: ', payload);
  //   Promise.all(removePromises)
  //     .then(() => Promise.all(uploadPromises))
  //     .then(() => this.course_Service_.Save_course(payload).subscribe(Rows => {
  //       this.isLoading=false

  //       this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Saved', Type: "false" } });
  //       this.Search_course()
  //       this.setView('list')
  //     }))
  //     .catch(error => {
  //       this.isLoading=false

  //       console.log('Error:', error);
  //     });

  //           this.course_Service_.Save_course(payload).subscribe(Rows => {
  //                 this.isLoading=false

  //                 this.dialogBox.open(DialogBox_Component, { panelClass: 'Dialogbox-Class', data: { Message: 'Saved', Type: "false" } });
  //                 this.Search_course()
  //                 this.setView('list')
  //               },error => {
  //                 this.isLoading=false

  //                 console.log('Error:', error);
  //               })

  //     }

  Save_course() {
    // First, run the validation
    this.Validate_Course_Section()
      .then(() => {
        // If validation succeeds, proceed with file uploads and saving course
        this.isLoading = true;
        this.course_Form.get('Price')?.value == null
          ? this.course_Form.get('Price')?.patchValue(0)
          : true;
        console.log('this.course_Form: ', this.course_Form);
        let payload = { course: this.course_Form.getRawValue() };

        // Sanitize payload — convert string booleans to integers and fix nulls
        const c = payload.course;
        c.Disable_Status = (c.Disable_Status === true || c.Disable_Status === 'true' || c.Disable_Status == 1) ? 1 : 0;
        c.Live_Class_Enabled = (c.Live_Class_Enabled === true || c.Live_Class_Enabled === 'true' || c.Live_Class_Enabled == 1) ? 1 : 0;
        c.Sections = Array.isArray(c.Sections) ? c.Sections : (c.Sections ? [c.Sections] : []);
        c.Thumbnail_Name = (c.Thumbnail_Name === 'null' || c.Thumbnail_Name == null) ? '' : c.Thumbnail_Name;
        c.Thumbnail_Path = (c.Thumbnail_Path === 'null' || c.Thumbnail_Path == null) ? '' : c.Thumbnail_Path;
        c.ThumbnailVideo_Path = (c.ThumbnailVideo_Path === 'null' || c.ThumbnailVideo_Path == null) ? '' : c.ThumbnailVideo_Path;
        c.ThumbnailVideo_Name = (c.ThumbnailVideo_Name === 'null' || c.ThumbnailVideo_Name == null) ? '' : c.ThumbnailVideo_Name;

        console.log('payload: ', payload);

        let totalFilesCount = 0;
        if (
          payload.course.Thumbnail_Path &&
          payload.course.Thumbnail_Path instanceof File
        ) {
          totalFilesCount++;
        }
        if (
          payload.course.ThumbnailVideo_Path &&
          payload.course.ThumbnailVideo_Path instanceof File
        ) {
          totalFilesCount++;
        }
        console.log('totalFilesCount: ', totalFilesCount);

        const uploadFile = async (
          file,
          totalFilesCount,
          courseName,
          type = ''
        ) => {
          try {
            console.log('type: ', type);
            const { key, fileName } = await this.course_Service_.upload(
              file,
              totalFilesCount,
              courseName,
              type
            );
            return { key, fileName };
          } catch (err) {
            console.log('Error uploading file:', err);
            throw err; // Rethrow to ensure Promise.all catches it
          }
        };

        const coursePayloads = [
          { path: 'Thumbnail_Path', type: 'Thumbnail' },
          { path: 'ThumbnailVideo_Path', type: 'ThumbnailVideo' },
        ];

        let uploadPromises: any[] = [];
        coursePayloads.forEach(({ path, type }) => {
          const file = payload.course[path];
          if (file && file instanceof File) {
            uploadPromises.push(
              (async () => {
                const { key } = await uploadFile(
                  file,
                  totalFilesCount,
                  this.course_Form.get('Course_Name')?.value,
                  type
                );
                payload.course[path] = key;
              })()
            );
          }
        });

        const removePromises = this.fileToRemoveAws.map(async (key) => {
          try {
            await this.course_Service_.fileToRemoveAws(key);
          } catch (err) {
            console.log('Error removing file from AWS:', err);
          }
        });

        Promise.all(removePromises)
          .then(() => Promise.all(uploadPromises))
          .then(() =>
            this.course_Service_.Save_course(payload).subscribe(
              (Rows) => {
                this.isLoading = false;
                this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: { Message: 'Saved', Type: 'false' },
                });
                this.Search_course();
                this.setView('list');
              },
              (error) => {
                this.isLoading = false;
                console.log('Error:', error);
              }
            )
          )
          .catch((error) => {
            this.isLoading = false;
            console.log('Error:', error);
          });
      })
      .catch((error) => {
        console.log('Validation failed:', error);
      });
  }

  Validate_Course_Section() {
    return new Promise<void>((resolve, reject) => {
      const form = this.course_Form;
      const payload = {
        Course_ID: this.course_Form.get('Course_ID')?.value,
        SchduledTeacher: this.scheduledTeachers?.value,
      };
      console.log(this.course_Form?.valid, this.scheduledTeachers);
      if (this.course_Form?.valid) {
        this.course_Service_.ValidateTimeSlots(payload).subscribe((res) => {
          if (res['success']) {
            if (form.invalid) {
              const dialogRef = this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: {
                  Message: 'Please fill in all required fields',
                  Type: '3',
                  Heading: 'Validation Error',
                },
              });
              Object.keys(form.controls).forEach((key) => {
                const control = form.get(key);
                control?.markAsTouched();
              });
              reject('Form validation failed');
            } else {
              resolve(); // Validation succeeded
            }
          } else {
            const dialogRef = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: {
                Message: res['error'],
                Type: '3',
                Heading: 'Choose Another Time',
              },
            });
            this.stepper().selectedIndex = 0;
            reject('Time slot validation failed');
          }
        });
      } else {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Please Fill All the Required Field',
            Type: '3',
            Heading: 'Choose Another Time',
          },
        });
      }
    });
  }
  handleMediaError(event: Event) {
    const mediaElement = event.target as HTMLElement;
    mediaElement.style.display = 'none';
  }

  preventSeek(event: Event) {
    const audioPlayer = event.target as HTMLAudioElement;
    audioPlayer.removeAttribute('controls');
  }
  View_Course_Students(id: number, coursename?): void {
    this.course_students = [];
    if (coursename) {
      this.SelecetedCourse = coursename;
    }
    this.isLoading = true;
    this.course_Batches = [];
    this.course_Form.get('Course_ID')?.patchValue(id);
    this.setView('students');

    forkJoin({
      batches: this.course_Service_.get_course_Batches(id).pipe(
        catchError((error) => {
          console.error('Error fetching course batches:', error);
          return [];
        })
      ),
      students: this.course_Service_.get_course_students(id).pipe(
        catchError((error) => {
          console.error('Error fetching course students:', error);
          return [];
        })
      ),
      freeSlots: this.course_Service_.Get_Free_Time_Slot(id).pipe(
        catchError((error) => {
          console.error('Error fetching free slots:', error);
          return [];
        })
      ),
    }).subscribe({
      next: ({ batches, students, freeSlots }) => {
        console.log('freeSlots: ', freeSlots);
        console.log('Batches:', batches);
        console.log('Students:', students);

        this.course_Batches = batches;
        this.course_students = students;
        this.free_Slots = freeSlots[0];
        this.slotsByTeacher.clear();
        for (const slot of this.free_Slots) {
          if (!this.slotsByTeacher.has(slot.User_ID)) {
            this.slotsByTeacher.set(slot.User_ID, []);
          }
          this.slotsByTeacher.get(slot.User_ID)!.push(slot);
        }
        console.log(' this.slotsByTeacher: ', this.slotsByTeacher);
        this.slot_editMode = [];
        this.teacherEditMode = [];
        for (let i = 0; i < this.course_students.length; i++) {
          this.slot_editMode.push(false);
          this.teacherEditMode.push(false);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;

        console.error('Error occurred:', error);
        // Handle the error appropriately (e.g., show an error message to the user)
      },
    });
  }
  View_Batch_Course(Course_Id, coursename) {
    this.SelecetedCourse = coursename;
    console.log('Course_Id: ', Course_Id);
    this.course_Form.get('Course_ID')?.patchValue(Course_Id);
    this.setView('Batch_Course');
  }
  View_Course_Fees(courseId: string, courseName: string): void {
    this.SelecetedCourse = courseName;
    this.course_Form.get('Course_ID')?.patchValue(courseId);
    this.setView('fees_Details', courseId);
  }

  view_course_content_list(Course_Id, coursename) {
    this.SelecetedCourse = coursename;

    this.filterForm.reset({
      moduleId: [0],
      sectionId: [0],
      dayId: [0],
      visibilityType: [1],
      Is_Exam_Test: [0],
      filterName: '',
    });
    console.log('Course_Id: ', Course_Id);
    this.course_Form.get('Course_ID')?.patchValue(Course_Id);
    this.contentForm.get('Course_ID')?.patchValue(Course_Id);
    this.applyFilters();
  }
  showmessage() {
    console.log(this.course_Form.value);
    console.log(' this.invalidDetails : ', this.invalidDetails);
    console.log(' this.invalidDetails : ', this.sectionForms);
  }
  Delete_Course(id, index) {
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
        this.isLoading = true;
        this.course_Service_.Delete_course(id).subscribe(
          (Delete_status) => {
            console.log('Delete_status: ', Delete_status);
            if (Delete_status[0][0].course_id > 0) {
              this.course_Data.splice(index, 1);
              const dialogRef = this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: { Message: 'Deleted', Type: 'false' },
              });
            } else {
              this.isLoading = false;
              const dialogRef = this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: { Message: 'Error Occured', Type: '2' },
              });
            }
            this.isLoading = false;
          },
          (Rows) => {
            this.isLoading = false;
            const dialogRef = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: { Message: 'Error Occured', Type: '2' },
            });
          }
        );
      }
    });
  }

  Edit_Course(id: number, coursename, view?: string) {
    this.isLoading = true;
    this.cdr.detectChanges(); // Trigger change detection
    this.SelecetedCourse = coursename;
    this.course_Form.get('Course_ID')?.patchValue(id);
    view ? this.setView(view) : 'form';
    this.sectionForms = [];

    this.course_Service_.Get_course(id).subscribe({
      next: (Rows) => {
        const courseData = Rows[0][0];
        if (courseData && courseData.created_at) {
          const date = new Date(courseData.created_at);
          const offset = date.getTimezoneOffset();
          const localDate = new Date(date.getTime() - (offset * 60 * 1000));
          courseData.created_at = localDate.toISOString().split('T')[0];
          }
          if (courseData && courseData.Disable_Status !== undefined) {
            courseData.Disable_Status = (courseData.Disable_Status === 'true' || courseData.Disable_Status === true || courseData.Disable_Status == 1) ? 1 : 0;
          }
          this.course_Form.patchValue(courseData);
        setTimeout(() => this.playBackgroundVideo(), 0);
        this.patchScheduledTeachers(courseData.scheduledTeachers);
      },
      error: (error) => {
        console.error('Error loading course:', error);
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occurred', Type: '2' },
        });
      },
      complete: () => {
        this.isLoading = false;
        this.cdr.detectChanges(); // Trigger change detection again
      },
    });
  }

  getImagePath(imgPath) {
    if (imgPath) return this.filepath + imgPath;
    else return '';
  }

  Search_course_category() {
    this.isLoading = true;
    this.course_Service_.Get_All_Course_Items().subscribe(
      (Rows) => {
        this.courseCategoryData.set(Rows[0]);
        this.SectionsDatas.set(Rows[1]);
        this.teacherDatas.set(Rows[2]);
        this.ModuleDatas.set(Rows[4]);
        this.VisibilityDatas.set(Rows[5]);
        this.allDaysDatas.set(Rows[6]);
        const isExamTest = this.contentForm.get('Is_Exam_Test')?.value;

        this.daysDatas.update((days) => {
          return this.allDaysDatas().filter((day) => {
            return isExamTest ? day['Is_Exam_Day'] === 1 : true;
          });
        });
        this.Search_course();
      },
      (Rows) => {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occured', Type: '2' },
        });
      }
    );
  }

  private unsubscribeFromFormChanges(): void {
    this.formSubscriptions.forEach((subscription) =>
      subscription.unsubscribe()
    );
  }
  ngOnDestroy() {
    this.unsubscribeFromFormChanges();
    if (this.TempAudio) {
      URL.revokeObjectURL(URL.createObjectURL(this.TempAudio));
    }
  }
  setView(newView: string, id?) {
    if (newView != 'CourseName') {
      this.view = newView as any;
      this.updateNavigationItems(id);
    }
  }

  updateNavigationItems(id) {
    console.log('id: ', id);
    this.viewportScroller.scrollToPosition([0, 0]);
    const CourseName = this.SelecetedCourse;
    console.log('this.course_Form.ge', this.course_Form.value);
    const viewOrder = [
      'list',
      'CourseName',
      'content_list',
      'Batch_Course',
      'students',
      'exam_students',
      'exam_students_Details',
      'form',
      'course_content_details',
      'fees',
      'fees_Details',
      'exams',
    ];
    const labels = {
      students: 'Students',
      list: '',
      CourseName: CourseName,
      content_list: 'Content Details',
      exam_students: 'Exam Students',
      exam_students_Details: 'Student Details',
      Batch_Course: 'Batch',
      form: this.course_Form.get('Course_ID')?.value
        ? 'Edit Course'
        : 'Create Course',
      course_content_details: 'course_content_details',
      fees: 'Fees',
    };
    console.log('labels: ', labels);

    const currentIndex = viewOrder.indexOf(this.view);

    if (this.view === 'form') {
      // For the form view, we only want to show 'List' and 'Create Course'
      this.navigationItems = [
        { view: 'list', label: labels['list'] },
        { view: 'form', label: labels['form'] },
      ];
    } else if (this.view === 'course_content_details') {
      this.fileToRemoveAws = [];

      this.navigationItems = [
        { view: 'list', label: labels['list'] },
        { view: 'content_list', label: labels['content_list'] },
      ];
    } else if (this.view === 'fees_Details') {
      this.loadExistingFeeData();
    } else {
      console.log('this.view : ', this.view);
      if (this.view == 'content_list') {
        this.loadCourseContent();
        // this.Edit_Course(id)
      }

      // For other views, use the slice method as before
      console.log('viewOrder: ', viewOrder);
      this.navigationItems = viewOrder
        .slice(0, currentIndex + 1)
        .map((view) => ({
          view,
          label: labels[view],
        }));
    }

    console.log('navigationItems: ', this.navigationItems);
  }
  selectedVisibilities: number[] = [];
  onVisibilityChange(
    event: MatCheckboxChange,
    visibilityId: number,
    contentForm: any
  ) {
    console.log('visibilityId: ', visibilityId);
    let visibilities = contentForm.get('visibilities')?.value || [];

    // Create a new array to avoid mutation of the original array
    visibilities = [...visibilities];

    if (event.checked) {
      if (!visibilities.includes(visibilityId)) {
        visibilities.push(visibilityId);
      }
    } else {
      visibilities = visibilities.filter((id) => id !== visibilityId);
      this.contentForm.get('Is_Exam_Test')?.setValue(false);
    }
    if (visibilities.includes(2)) {
      this.contentForm.get('Is_Exam_Test')?.setValue(false);

      this.contentForm.get('Module_ID')?.patchValue(0);
      this.contentForm.get('Days_Id')?.patchValue(0);
    }
    const isExamTest = this.contentForm.get('Is_Exam_Test')?.value;

    this.daysDatas.update((days) => {
      return this.allDaysDatas().filter((day) => {
        return isExamTest ? day['Is_Exam_Day'] === 1 : true;
      });
    });
    contentForm.get('visibilities')?.setValue(visibilities);
    console.log(
      '  this.contentFor ',
      this.contentForm.get('visibilities')?.value
    );
  }
  onExamTestCheckChange(event: MatCheckboxChange) {
    const isExamTest = this.contentForm.get('Is_Exam_Test')?.value;
    console.log('Exam Test value:', isExamTest);

    let visibilities = this.contentForm.get('visibilities')?.value || [];
    visibilities = [...visibilities]; // Create a new array to avoid mutating the original

    if (event.checked) {
      if (!visibilities.includes(1)) {
        visibilities.push(1);
      }
    } else {
      // visibilities = visibilities.filter(value => value !== 1);
    }

    this.contentForm.get('visibilities')?.setValue(visibilities);
    console.log(
      'Updated visibilities:',
      this.contentForm.get('visibilities')?.value
    );

    // Update the daysDatas based on Is_Exam_Test
    // this.updateDaysDatas(isExamTest);
  }

  updateDaysDatas(isExamTest: boolean) {
    this.daysDatas.update((days) => {
      return this.allDaysDatas().filter((day) => {
        return isExamTest ? day['Is_Exam_Day'] === 1 : true;
      });
    });
  }

  countActiveTimeSlots(teacherGroup: any): number {
    const timeSlots = teacherGroup.get('timeSlots') as FormArray;
    return timeSlots.controls.filter(
      (slot) => slot.get('Delete_Status')?.value !== 1
    ).length;
  }
  countActiveTeachers(): number {
    return this.scheduledTeachers.controls.filter(
      (teacher) => teacher.get('Delete_Status')?.value !== 1
    ).length;
  }
  // Call this method whenever you change the view
  changeView(newView: string) {
    this.setView(newView);
  }

  changeSlot(Student_ID, Course_ID, Slot_Id, index) {
    let payload = { Student_ID, Course_ID, Slot_Id };

    this.course_Service_.Update_Time_Slot(payload).subscribe((res) => {
      console.log('res: ', res);
      if (res['message']) {
        this.slot_editMode[index] = false;
        this.teacherEditMode[index] = false;
        this.View_Course_Students(Course_ID);
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Saved', Type: 'false' },
        });
      }
    });
  }

  loadCourseContent() {
    this.isLoading = true;
    console.log(
      ' this.filterForm. ',
      this.filterForm.get('Is_Exam_Test')?.value
    );
    const isLibrary =
      this.filterForm.get('visibilityType')?.value == 2 ? 'true' : 'false'; // Get the selected visibility type

    this.course_Service_
      .Get_course_content_By_Day(
        this.course_Form.get('Course_ID')?.value,
        isLibrary,
        this.filterForm.get('moduleId')?.value,
        this.filterForm.get('sectionId')?.value,
        this.filterForm.get('dayId')?.value,
        this.filterForm.get('Is_Exam_Test')?.value
      )
      .subscribe(
        (data) => {
          this.isLoading = false;
          this.courseContents = data['contents'];
          this.courseContents.forEach((content) => {
            if (content.exams) {
              content.exams.forEach((exam) => {
                if (exam.file_type?.startsWith('audio/')) {
                  this.audioLoadingStates[exam.Exam_ID] = true;
                }
              });
            }
          });
          console.log('this.courseContents: ', this.courseContents);
        },
        (error) => {
          console.error('Error fetching course content:', error);
        }
      );
  }

  applyFilters() {
    this.section = null;

    this.setView('content_list');
  }
  onSearchChange() {
    // Clear the previous timeout if it exists
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Set a new timeout
    this.searchTimeout = setTimeout(() => {
      this.Search_course();
    }, 300); // Wait for 300ms after the user stops typing
  }
  editContent(content: any) {
    this.isLoading = true;
    this.setView('course_content_details');
    this.contentForm.get('Content_ID')?.patchValue(content['Content_ID']);
    this.course_Service_
      .Get_course_content(
        this.contentForm.get('Course_ID')?.value,
        content['Content_ID']
      )
      .subscribe((res) => {
        this.contentForm.patchValue(res['contentDetails'][0]);
        this.onSelectionChange(this.contentForm.get('Section_ID')?.value);
        this.isLoading = false;
      });
  }
  addContent() {
    this.clearContentForm();

    this.setView('course_content_details');
  }
  deleteContent(contentId: number) {
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
        this.course_Service_
          .Delete_Course_Content(contentId)
          .subscribe((res) => {
            console.log('res: ', res);
            this.applyFilters();
          });
      }
    });
  }
  validate_Content_Form(): boolean {
    let isValid = true;
    const visibility = this.contentForm.get('visibilities')?.value;
    console.log('visibility: ', visibility);
    // Check Module_ID
    console.log('visibility.includes(2): ', visibility.includes(2));
    if (
      (!this.contentForm.get('Module_ID')?.value ||
        this.contentForm.get('Module_ID')?.value <= 0) &&
      !visibility.includes(2)
    ) {
      this.contentForm.get('Module_ID')?.setErrors({ required: true });
      isValid = false;
    } else if (visibility.includes(2)) {
      this.contentForm.get('Module_ID')?.setErrors(null);
    }

    // Check Section_ID
    if (
      !this.contentForm.get('Section_ID')?.value ||
      this.contentForm.get('Section_ID')?.value <= 0
    ) {
      this.contentForm.get('Section_ID')?.setErrors({ required: true });
      isValid = false;
    }

    // Check Days_Id
    if (
      (!this.contentForm.get('Days_Id')?.value ||
        this.contentForm.get('Days_Id')?.value <= 0) &&
      !visibility.includes(2)
    ) {
      this.contentForm.get('Days_Id')?.setErrors({ required: true });
      isValid = false;
    } else if (visibility.includes(2)) {
      this.contentForm.get('Days_Id')?.setErrors(null);
    }

    // Check visibilities
    const visibilities = this.contentForm.get('visibilities')?.value;
    if (!visibilities || visibilities.length === 0) {
      this.contentForm.get('visibilities')?.setErrors({ required: true });
      isValid = false;
    }

    // Check contentName
    if (!this.contentForm.get('contentName')?.value) {
      this.contentForm.get('contentName')?.setErrors({ required: true });
      isValid = false;
    }

    return isValid;
  }
  getErrorMessage(controlName: string): string {
    const control = this.contentForm.get(controlName);
    if (control?.hasError('required')) {
      switch (controlName) {
        case 'Module_ID':
          return 'Please select a module.';
        case 'Section_ID':
          return 'Please select a section.';
        case 'Days_Id':
          return 'Please select a day.';
        case 'visibilities':
          return 'Please select at least one visibility option.';
        case 'contentName':
          return 'Please enter a content name.';
        default:
          return 'This field is required.';
      }
    }
    return '';
  }
  async save_content() {
    this.viewportScroller.scrollToPosition([0, 0]);

    if (this.validate_Content_Form()) {
      console.log('this.course_F ', this.course_Form.get('Course_ID')?.value);
      let totalfile = 0;
      this.course_Form
        .get('Course_ID')
        ?.patchValue(this.course_Form.get('Course_ID')?.value);
      this.isLoading = true;
      const courseName = this.course_Form.get('Course_ID')?.value;
      console.log('courseName: ', courseName);
      let section = this.contentForm.value;

      try {
        // Step 1: Remove files
        const removePromises = this.fileToRemoveAws.map((key) =>
          this.course_Service_.fileToRemoveAws(key).catch((err) => {
            console.log('Error removing file from AWS:', err);
          })
        );
        await Promise.all(removePromises);

        // Step 2: Upload new files
        const uploadFile = async (
          file: File,
          courseName: string,
          type: string = ''
        ): Promise<{ key: string; fileName: string }> => {
          try {
            const { key, fileName } = await this.course_Service_.upload(
              file,
              totalfile,
              courseName,
              type
            );
            return { key, fileName };
          } catch (err) {
            console.log('Error uploading file:', err);
            throw err;
          }
        };

        const uploadPromises: Promise<void>[] = [];

        if (section.file && section.file instanceof File) {
          totalfile++;
          uploadPromises.push(
            uploadFile(section.file, courseName).then(({ key, fileName }) => {
              section.file = key;
            })
          );
        }

        if (
          section.contentThumbnail_Path &&
          section.contentThumbnail_Path instanceof File
        ) {
          totalfile++;

          uploadPromises.push(
            uploadFile(section.contentThumbnail_Path, courseName).then(
              ({ key, fileName }) => {
                section.contentThumbnail_Path = key;
              }
            )
          );
        }

        if (section.exam) {
          if (
            section.exam.Main_Question &&
            section.exam.Main_Question instanceof File
          ) {
            totalfile++;

            uploadPromises.push(
              uploadFile(section.exam.Main_Question, courseName).then(
                ({ key, fileName }) => {
                  section.exam.Main_Question = key;
                  section.exam.file_name = fileName;
                }
              )
            );
          }

          if (
            section.exam.Answer_Key_Path &&
            section.exam.Answer_Key_Path instanceof File
          ) {
            totalfile++;

            uploadPromises.push(
              uploadFile(section.exam.Answer_Key_Path, courseName).then(
                ({ key }) => {
                  section.exam.Answer_Key_Path = key;
                }
              )
            );
          }

          if (
            section.exam.Supporting_Document_Path &&
            section.exam.Supporting_Document_Path instanceof File
          ) {
            totalfile++;

            uploadPromises.push(
              uploadFile(
                section.exam.Supporting_Document_Path,
                courseName
              ).then(({ key }) => {
                section.exam.Supporting_Document_Path = key;
              })
            );
          }
        }

        console.log('uploadPromises: ', uploadPromises);
        await Promise.all(uploadPromises);
        console.log('All files uploaded');

        // Step 3: Save course content
        console.log(this.contentForm);
        let payload = {
          contents: section,
        };

        await new Promise<void>((resolve, reject) => {
          this.course_Service_.save_course_content(payload).subscribe({
            next: (res) => {
              this.isLoading = false;

              this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: { Message: 'Saved', Type: 'false' },
              });
              this.applyFilters();
              this.clearContentForm();
              resolve();
            },
            error: (err) => {
              this.isLoading = false;

              console.error('Error saving course content:', err);
              reject(err);
            },
          });
        });

        console.log('Course content saved');
      } catch (error) {
        console.log('Error during operation:', error);
      } finally {
        this.isLoading = false;
      }
    } else {
      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Please Fill Required Fields.',
          Type: '3',
          Heading: 'Fill all the fields',
        },
      });
      this.contentForm.markAllAsTouched();
      this.viewportScroller.scrollToPosition([0, 0]);
    }
  }
  clearRoute() {
    this.selectedStudentId = null;
    this.router.navigate([], {
      relativeTo: this.url,
      queryParams: { student_id: null, Course_Id: null },
      queryParamsHandling: 'merge',
    });
  }
  clearContentForm() {
    this.contentForm.reset({
      Module_ID: 0,
      visibilities: [],
      Days_Id: 0,
      Is_Exam_Test: false,
      contentName: '',
      Content_ID: 0,
      Course_ID: this.course_Form.get('Course_ID')?.value,
      Section_ID: '',
      externalLink: '',
      contentThumbnail_Path: '',
      contentThumbnail_name: '',
      file: '',
      file_name: '',
      file_type: '',
      Have_Main_Question: false,
      Is_Main_Question_Text: false,
      Have_Supporting_Document: false,
      Have_Answer_Key: false,
      exam: {
        Main_Question: '',
        file_name: '',
        file_type: '',
        Supporting_Document_Path: '',
        Supporting_Document_Name: '',
        Answer_Key_Path: '',
        Answer_Key_Name: '',
      },
    });
  }

  getUniqueTeachers(): any[] {
    const uniqueTeachers = new Map<number, any>();
    this.free_Slots.forEach((slot) => {
      if (!uniqueTeachers.has(slot.User_ID)) {
        uniqueTeachers.set(slot.User_ID, {
          User_ID: slot.User_ID,
          Teacher_Name: slot.Teacher_Name,
        });
      }
    });
    return Array.from(uniqueTeachers.values());
  }
  changeTeacher(
    studentId: number,
    courseId: number,
    userId: number,
    index: number
  ) {
    const selectedTeacher = this.free_Slots.find(
      (slot) => slot.User_ID == userId
    );
    if (selectedTeacher) {
      this.course_students[index].Teacher_Name_One_On_One =
        selectedTeacher.Teacher_Name;

      this.course_students[index].selectedTeacher = userId;
    }
    this.teacherEditMode[index] = false;
  }

  getFilteredSlots(userId: number) {
    console.log('userId: ', userId);

    console.log(
      'this.slotsByTeacher.get(userId): ',
      this.slotsByTeacher.get(userId)
    );
    return this.slotsByTeacher.get(Number(userId)) || [];
  }
  onExamTestChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.filterForm.get('Is_Exam_Test')?.setValue(inputElement.checked ? 1 : 0);
  }

  isFileTypeValid(
    file: File,
    allowedTypes: 'all' | 'pdf' | 'audio' | 'video' | 'image'
  ): boolean {
    switch (allowedTypes) {
      case 'all':
        return true;
      case 'pdf':
        return file.type === 'application/pdf';
      case 'audio':
        return file.type.startsWith('audio/');
      case 'video':
        return file.type.startsWith('video/');
      case 'image':
        return file.type.startsWith('image/');
      default:
        return false;
    }
  }

  getAllowedTypeString(
    allowedTypes: 'all' | 'pdf' | 'audio' | 'video' | 'image'
  ): string {
    switch (allowedTypes) {
      case 'all':
        return 'All file types';
      case 'pdf':
        return 'PDF files';
      case 'audio':
        return 'Audio files';
      case 'video':
        return 'Video files';
      case 'image':
        return 'Image files';
      default:
        return '';
    }
  }
  getAudioSource(): string {
    if (this.TempAudio) {
      // Create object URL for temporary preview
      return URL.createObjectURL(this.TempAudio);
    } else {
      // Return server path for stored audio
      return this.filepath + this.contentForm.get('exam.Main_Question')?.value;
    }
  }

  onAudioLoadStart(examId: string) {
    this.audioLoadingStates[examId] = true;
  }

  onAudioCanPlay(examId: string) {
    this.audioLoadingStates[examId] = false;
  }

  Search_Batch() {
  const selectedCourseId = this.course_Form.value.Course_ID; // Assuming you're storing it from elsewhere
  console.log('selectedCourseId', selectedCourseId);
  
  this.feesForm.get('Course_ID')?.setValue(selectedCourseId);

  this.isLoading = true;

  this.course_Service_.get_course_Batches(selectedCourseId).subscribe(
    (Rows: any) => {
      this.batch_Data = Rows.map(batch => ({
        ...batch,
        statusClass: batch.is_expired ? 'text-red-500' : 'text-green-500',
        statusText: batch.is_expired ? 'Expired' : 'Active'
      }));
      this.Total_Entries = this.batch_Data.length;

      if (this.batch_Data.length == 0) {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'No Details Found', Type: '3' }
        });
      }

      this.isLoading = false;
    },
    () => {
      this.isLoading = false;
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Error Occured', Type: '2' }
      });
    }
  );

}

}
