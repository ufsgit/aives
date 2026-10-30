import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
  FormArray,
} from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { MatDialog } from '@angular/material/dialog';
import { user } from '../../../core/models/user';
import { CommonModule, DatePipe, ViewportScroller } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { course_Service } from '../../services/course.Service';
import { BatchService } from '../../services/batch.service';
import { SharedModule } from '../../../shared/shared.module';
import { student_Service } from '../../services/student.Service';
import { ViewPermissionsComponent } from '../view-permissions/view-permissions.component';
import { ActivatedRoute } from '@angular/router';
import { ViewTeamAssignmentComponent } from '../view-team-assignment/view-team-assignment.component';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, SharedModule, CommonModule, ViewPermissionsComponent, ViewTeamAssignmentComponent],
  templateUrl: './teacher.component.html',
  styleUrl: './teacher.component.scss',
})
export class TeacherComponent implements OnInit {
  private viewportScroller = inject(ViewportScroller);
  private el = inject(ElementRef);
  user_Service_ = inject(user_Service);
  private fb = inject(FormBuilder);
  dialogBox = inject(MatDialog);
  private course_Service_ = inject(course_Service);
  private BatchService_ = inject(BatchService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private url=inject(ActivatedRoute)
  isInitializing = false;
  resetTimeout: any = null;

  
  isEdit: boolean = false;
  isSave: boolean = false;
  isDelete: boolean = false;

  showPassword = false;
  view = 'list';
  user_Form: FormGroup;
  invoiceForm: FormGroup;
  user_Name_Search: string;
  searchTerm: string = '';
  readonly invoiceContainer =
    viewChild.required<ElementRef>('invoiceContainer');
  BatchList: any = [];

  isLoading: boolean;
  Total_Entries: number;
  user_Data: user[];
  EditIndex: number;
  courseList;
  fileToRemoveAws: any = [];
  teacherStudentList: any = [];
  showFilters: boolean = false;
  selectedCourseId: number = 0;

  invoiceData: any = [];
  previewUrl: null;
  submitted: boolean = false;

  CourseList: any = [];
  searchTimeout: any;
  currentInvoice: any;
  printInvoice_view: boolean = false;
  groupedCourses: any[] = [];
  Search_Branch_Data: any[] = [];
  private nextTempId = -1;
  filters = {
    slotWise: false,
    batchWise: false,
    courseId: 0, // Changed from null to 0
    hodOnly: false,
  };
  Search_User_Type = [
    { User_Type_Id: 1, User_Name: 'Staff' },
    { User_Type_Id: 2, User_Name: 'Faculty' },
  ];
  Search_Branch: any = {};
  isHodCourse: boolean;
  teacher_Id: number;
  User_Type_Id_status: any;
  selectedTeamLeadId: number = 0;
  selectedTeamLeadName: string = '';
  constructor(private student_Service_: student_Service) {
    this.user_Form = this.fb.group({
      User_ID: [0],
      First_Name: ['', Validators.required],
      Last_Name: ['', Validators.required],
      Email: ['', [Validators.required, Validators.email]],
      PhoneNumber: ['', Validators.required],
      password: ['', Validators.required],
      Delete_Status: [0],
      User_Type_Id: [2],
      User_Role_Id: [null],
      User_Status: [null],
      Device_ID: [''],
      Profile_Photo_Path: [''],
      Profile_Photo_Name: [''],
      Course_ID: [[]], // Multi-select initialized as an array,
      teacherCourses: this.fb.array([]),
      Branch_Id: [''],
      Basic_Pay: [null],
    });
    this.invoiceForm = this.fb.group({
      Invoice_Id: [0, Validators.required],
      invoice_date: ['', Validators.required],
      name: ['', Validators.required],
      position: ['', Validators.required],
      course_name: ['', Validators.required],
      payment_period: ['', Validators.required],
      class_hours: ['', Validators.required],
      total_amount: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      approved_by: ['', Validators.required],
      user_Id: [0, Validators.required],
      Course_Id: [0],
    });
  }

  ngOnInit(): void {
    this.pageLoad();

      
  this.url.queryParams.subscribe(params => {
    console.log("params",params['item']);
    
    if (params['item']) {
    
       var receivedItem = JSON.parse(params['item']);

 console.log('Received Item:4', receivedItem['IsEdit']);

       this.isEdit =  receivedItem['IsEdit'] || false;
        this.isSave = receivedItem['IsSave'] || false;
        this.isDelete = receivedItem['IsDelete'] || false;

        console.log('Permissions:', this.isEdit, this.isSave, this.isDelete);
      
   
    }
  });
  }

  pageLoad() {
    this.Clr_user();

    this.Search_user();
    this.getAllCourse();
    this.Branch_Dropdown();
    this.view = 'list';
  }

  Branch_Dropdown() {
    this.student_Service_.Branch_Dropdown().subscribe(
      (Rows) => {
        console.log('Rows', Rows);
        this.Search_Branch_Data = Rows;
        // const defaultOption = { Branch_Id: 0, Branch_Name: 'Select Branch' };

        // if (Rows && Array.isArray(Rows[0])) {
        //   this.Search_Branch_Data = [defaultOption, ...Rows[0]];
        // } else if (Array.isArray(Rows)) {
        //   this.Search_Branch_Data = [defaultOption, ...Rows];
        // } else {
        //   this.Search_Branch_Data = [defaultOption];
        // }

        // this.Search_Branch = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }

  Save_user() {
    // this.resetFormValidation();

    console.log('this.user_Form:>>>>>>>>>>>>>>>>>>>>> ', this.user_Form.value);

    this.submitted = true;

    console.log('this.validateForm(): ', this.validateForm());
    if (!this.validateForm() || this.user_Form.invalid) {
      this.scrollToFirstInvalidElement();
      return;
    }
    const validateTimeSlot = this.transformData(
      this.user_Form.get('teacherCourses')?.value
    );
    console.log('validateTimeSlot: ', validateTimeSlot);
    this.Validate_Course_Section(validateTimeSlot)
      .then(() => {
        console.log('this.user_Form?.value.Hod: ', this.user_Form?.value.Hod);
        // if (this.user_Form?.value.Hod == true) {
        //   this.user_Form?.get('User_Type_Id')?.setValue(3);
        // } else {
        //   this.user_Form?.get('User_Type_Id')?.setValue(2);
        // }
        this.user_Form
          .get('Email')
          ?.patchValue(String(this.user_Form.get('Email')?.value || '').trim());
        this.user_Form
          .get('password')
          ?.patchValue(
            String(this.user_Form.get('password')?.value || '').trim()
          );

        console.log('this.user_Form.value: ', this.user_Form.value);

        const formData = this.user_Form.value;
        const timeData = this.getChanges();
        const payload = {
          ...formData,
          coursesToAdd: timeData.coursesToAdd || [],
          coursesToDelete: timeData.coursesToDelete || [],
          coursesToUpdate: timeData.coursesToUpdate || [],
          timeSlotsToAdd: timeData.timeSlotsToAdd || [],
          timeSlotsToDelete: timeData.timeSlotsToDelete || [],
          timeSlotsToUpdate: timeData.timeSlotsToUpdate || [],
        };

        const email = this.user_Form.get('Email')?.value;
        console.log('this.user_Form.value: ', this.user_Form.value);
        const phone = this.user_Form.get('PhoneNumber')?.value;
        // Check if 'Hod' is true and 'Course_ID' is either empty, null, or contains only a default value
        if (
          this.user_Form.value.Hod === true &&
          (!this.user_Form.value.Course_ID ||
            this.user_Form.value.Course_ID.length === 0)
        ) {
          // Return or handle the validation error (e.g., show an error message)
          return;
        }

        if (email && !this.isValidEmail(email)) {
          const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: 'Please provide a valid Email address',
              Type: '3',
            },
          });
          return;
        }

        if (phone && !this.isValidPhone(phone)) {
          const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: 'Please provide a valid 10-digit Phone Number',
              Type: '3',
            },
          });
          return;
        }
        this.isLoading = true;

        if (
          this.user_Form?.value.Profile_Photo_Path &&
          this.user_Form?.value.Profile_Photo_Path instanceof File
        ) {
          try {
            const removepromise = this.fileToRemoveAws.map(async (key) => {
              try {
                const result = await this.course_Service_.fileToRemoveAws(key);
              } catch (err) {
                console.error(`Error removing file with key ${key}:`, err);
                throw err; // Rethrow to propagate the error to Promise.all
              }
            });

            Promise.all(removepromise)
              .then(() => {
                this.user_Service_
                  .uploadFile(
                    this.user_Form?.value.Profile_Photo_Path,
                    this.user_Form?.value.First_Name
                  )
                  .then((res) => {
                    this.user_Form
                      .get('Profile_Photo_Path')
                      ?.patchValue(res.key);
                    payload['Profile_Photo_Path'] = res.key;

                    this.user_Service_.Save_user(payload).subscribe(
                      (Save_status) => {
                        if (Number(Save_status[0].User_ID) > 0) {
                          const dialogRef = this.dialogBox.open(
                            DialogBox_Component,
                            {
                              panelClass: 'Dialogbox-Class',
                              data: { Message: 'Saved', Type: 'false' },
                            }
                          );
                          this.pageLoad();
                        } else if (Number(Save_status[0].User_ID) < 0) {
                          console.log('Teacher already assigned to course');
                          const dialogRef = this.dialogBox.open(
                            DialogBox_Component,
                            {
                              panelClass: 'Dialogbox-Class',
                              data: {
                                Message: 'Teacher already assigned to course',
                                Type: '2',
                              },
                            }
                          );
                        } else {
                          const dialogRef = this.dialogBox.open(
                            DialogBox_Component,
                            {
                              panelClass: 'Dialogbox-Class',
                              data: { Message: 'Error Occurred', Type: '2' },
                            }
                          );
                        }
                        this.isLoading = false;
                      },
                      (error) => {
                        this.isLoading = false;
                        const dialogRef = this.dialogBox.open(
                          DialogBox_Component,
                          {
                            panelClass: 'Dialogbox-Class',
                            data: { Message: error.error, Type: '2' },
                          }
                        );
                      }
                    );
                  })
                  .catch((err) => {
                    console.error('Error uploading file:', err);
                    const dialogRef = this.dialogBox.open(DialogBox_Component, {
                      panelClass: 'Dialogbox-Class',
                      data: { Message: 'Error uploading file', Type: '2' },
                    });
                    this.isLoading = false;
                  });
              })
              .catch((err) => {
                console.error('Error during file removal:', err);
                const dialogRef = this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: { Message: 'Error during file removal', Type: '2' },
                });
                this.isLoading = false;
              });
          } catch (err) {
            console.log('err:', err);
            const dialogRef = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: { Message: 'Unexpected error occurred', Type: '2' },
            });
            this.isLoading = false;
          }
        } else {
          console.log("payload",payload);
          
          this.user_Service_.Save_user(payload).subscribe(
            (Save_status) => {
              // Save_status = Save_status[0];
              if (Number(Save_status[0].User_ID) > 0) {
                const dialogRef = this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: { Message: 'Saved', Type: 'false' },
                });
                this.pageLoad();
              } else if (Number(Save_status[0].User_ID) < 0) {
                const dialogRef = this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: {
                    Message: 'Teacher already assigned to course',
                    Type: '2',
                  },
                });
              } else {
                const dialogRef = this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: { Message: 'Error Occured', Type: '2' },
                });
              }
              this.isLoading = false;
            },
            (Rows) => {
              console.log('Rows: ', Rows);
              this.isLoading = false;
              const dialogRef = this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: { Message: Rows.error.error, Type: '2' },
              });
            }
          );
        }
      })
      .catch((error) => {
        console.log('Validation failed:', error);
      });
  }

  closeClick() {
    this.courseList = [];

    this.view = 'list';
  }

  Create_New() {
    this.view = 'edit';
    this.getAllCourse();
    this.Clr_user();
  }
  Create_Invoice() {
    const currentUserId = this.invoiceForm.get('user_Id')?.value;
    this.view = 'Create_Invoice';
    console.log(this.invoiceForm);
    this.Clr_Invoice();
    this.invoiceForm.get('user_Id')?.patchValue(currentUserId);
  }
  Clr_user() {
    this.user_Form.reset({
      User_ID: 0,
      First_Name: '',
      Last_Name: '',
      Email: '',
      PhoneNumber: '',
      password: '',
      Device_ID: '',
      Delete_Status: 0,
      User_Type_Id: 2,
      User_Role_Id: null,
      User_Status: null,
      Hod: false,
      Course_ID: [[]],
      Basic_Pay: null,
    });
    while (this.teacherCourses.length !== 0) {
      this.teacherCourses.removeAt(0);
    }
    this.courseList = [];

    console.log('  this.teacherCourses: ', this.teacherCourses);
    this.previewUrl = null;
    this.submitted = false;
  }
  Clr_Invoice() {
    // Store the current user_Id before resetting
    const currentUserId = this.invoiceForm.get('user_Id')?.value;

    this.invoiceForm.reset({
      invoice_date: '',
      name: '',
      position: '',
      course_name: '',
      payment_period: '',
      class_hours: '',
      total_amount: '',
      approved_by: '',
      Invoice_Id: 0,
      Course_Id: 0,
      user_Id: currentUserId, // Preserve the user_Id
    });
  }
  onSearchChange() {
    // Clear the previous timeout if it exists
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Set a new timeout
    this.searchTimeout = setTimeout(() => {
      this.Search_user();
    }, 300); // Wait for 300ms after the user stops typing
  }
  onFilterChange() {
    this.Search_user();
  }
  toggleFilters() {
    this.showFilters = !this.showFilters;
  }
  Search_user() {
    this.isLoading = true;
    this.isLoading = true;
    const params = {
      user_Name: this.searchTerm || '',
      slot_wise: this.filters.slotWise ? true : null,
      batch_wise: this.filters.batchWise ? true : null,
      course_id: this.filters.courseId || 0, // Use 0 if null/undefined
      hod_only: this.filters.hodOnly ? true : null,
    };

    this.user_Service_.Search_user(params).subscribe(
      (Rows) => {
        this.user_Data = Rows;
        this.Total_Entries = this.user_Data.length;
        if (this.user_Data.length == 0) {
          this.isLoading = false;
          const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'No Details Found', Type: '3' },
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

  Edit_user(user_e: user) {
    console.log('user_e: ', user_e);
    this.isLoading = true;
    this.view = 'edit';

    this.user_Form.patchValue(user_e);
    this.loadExistingData(this.user_Form.get('User_ID')?.value);
    

    console.log('this.user_Form: ', this.user_Form);

    if (user_e.User_Type_Id == 3) {
      this.user_Form.get('Hod')?.setValue(true);
    } else {
      this.user_Form.get('Hod')?.setValue(false);
    }
  }
  View_Invoice(user_Id) {
    this.view = 'invoices';
    this.printInvoice_view = false;

    this.invoiceData = [];
    this.isLoading = true;
    this.user_Service_.Search_User_Invoice(user_Id).subscribe(
      (invoice) => {
        console.log('invoice: ', invoice);
        this.invoiceForm.get('user_Id')?.patchValue(user_Id);
        console.log('  this.invoiceForm: ', this.invoiceForm);
        this.invoiceData = invoice;
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

  Delete_user(user_Id, index) {
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
        this.user_Service_.Delete_user(user_Id).subscribe(
          (Delete_status) => {
            if (Delete_status[0].user_Id_ > 0) {
              this.pageLoad();
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
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  Save_Invoice() {
    console.log('this.invoiceForm: ', this.invoiceForm);
    if (this.invoiceForm.invalid) {
      this.markFormGroupTouched(this.invoiceForm);
      return;
    }
    this.isLoading = true;
    const invoiceData = this.invoiceForm.value;
    // Call your API to save the invoice
    this.user_Service_.Save_User_Invoice(invoiceData).subscribe(
      (data) => {
        console.log('data: ', data);

        this.isLoading = false;
        this.View_Invoice(invoiceData['user_Id']);
      },
      (Rows) => {
        this.isLoading = false;
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occured', Type: '2' },
        });
      }
    );
    console.log('Invoice Data:', invoiceData);
  }

  View_permissions(teacher_Id, User_Type_Id) {
    this.User_Type_Id_status = teacher_Id;
    console.log("teacher_Id, User_Type_Id",teacher_Id, User_Type_Id);
    this.view = 'View_permissions';
    // this.isLoading = true;
  }
  View_team(teamLeadId: number, firstName: string, lastName: string) {
    this.selectedTeamLeadId = teamLeadId;
    this.selectedTeamLeadName = `${firstName || ''} ${lastName || ''}`.trim();
    this.view = 'View_team';
  }

  View_courses(teacher_Id, User_Type_Id) {
    this.view = 'courses';
    this.isLoading = true;
    this.isHodCourse = false;
    if (User_Type_Id == 2) {
      this.user_Service_
        .Get_Teacher_courses_With_Batch(teacher_Id)
        .subscribe((result) => {
          this.courseList = result;
          this.isLoading = false;
        });
    } else {
      this.isHodCourse = true;

      this.user_Service_.Get_Hod_Course(teacher_Id).subscribe((result) => {
        this.courseList = result;
        this.isLoading = false;
      });
    }
  }

  onUserIdChange(newUserId: number) {
     this.view = 'list';
    console.log("onUserIdChange called with newUserId:", newUserId);
    this.User_Type_Id_status = newUserId;
  }
  onTeamAssignmentClose() {
    this.selectedTeamLeadId = 0;
    this.selectedTeamLeadName = '';
    this.view = 'list';
    this.Search_user();
  }

  // Course filter change handler
  onCourseFilterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const courseId = parseInt(select.value);
    this.Get_Teacher_Students(this.teacher_Id, courseId);
  }

  Get_Teacher_Students(teacher_Id: number, courseId: number = 0) {
    this.isLoading = true;
    this.teacher_Id = teacher_Id;
    this.view = 'TeacherStudents';

    this.user_Service_
      .Get_Teacher_Students(teacher_Id, courseId)
      .subscribe((result) => {
        this.isLoading = false;
        this.teacherStudentList = result;
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  getImage(imagepath) {
    return environment['FilePath'] + imagepath;
  }
  shouldShowExistingImage(): boolean {
    const profilePhotoPath = this.user_Form.value.Profile_Photo_Path;
    return profilePhotoPath && !(profilePhotoPath instanceof File);
  }
  onFileSelected(event) {
    const file = event.target.files[0];
    const minSize = 4 * 1024 * 1024; // 4 MB in bytes

    if (file) {
      if (file.size > minSize) {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'File size should be below 4mb.',
            Type: '3',
            Heading: 'File size',
          },
        });
        return;
      }

      if (
        !(this.user_Form.get('Profile_Photo_Path')?.value instanceof File) &&
        this.user_Form.get('Profile_Photo_Path')?.value != null &&
        this.user_Form.get('Profile_Photo_Path')?.value != ''
      ) {
        this.fileToRemoveAws.push(
          this.user_Form.get('Profile_Photo_Path')?.value
        );
      }

      this.user_Form.get('Profile_Photo_Path')?.setValue(file);
      this.user_Form.get('Profile_Photo_Name')?.setValue(file.name);

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      this.previewUrl = null;
    }

    console.log('event: ', event);
  }
  getAllCourse() {
    this.BatchService_.GetAllCourses('').subscribe(
      (Rows: any) => {
        this.CourseList = Rows;
        console.log('this.CourseList : ', this.CourseList);
        this.course_Service_.Get_all_Batch().subscribe((result: any) => {
          this.BatchList = result[0];
        });
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

  Edit_Invoice(invoice: any) {
    this.invoiceForm.patchValue({
      Invoice_Id: invoice.Invoice_Id,
      invoice_date: invoice.invoice_date,
      name: invoice.name,
      position: invoice.position,
      course_name: invoice.course_name,
      payment_period: invoice.payment_period,
      class_hours: invoice.class_hours,
      total_amount: invoice.total_amount,
      approved_by: invoice.approved_by,
      user_Id: invoice.user_Id,
      Course_Id: invoice.Course_Id,
    });
    this.view = 'Create_Invoice';
  }
  isValidEmail(email: string): boolean {
    return Validators.email(new FormControl(email)) === null;
  }

  isValidPhone(phone: string): boolean {
    return /^\d{10}$/.test(phone);
  }
  Delete_Invoice(Invoice_Id: number, index: number) {
    console.log('Invoice_Id: ', Invoice_Id);

    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Are you sure you want to delete this invoice ?',
        Type: true,
        Heading: 'Confirm',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result == 'Yes') {
        this.isLoading = true;
        this.user_Service_.Delete_Invoice(Invoice_Id).subscribe(
          (Delete_status) => {
            if (Delete_status[0].Invoice_Id > 0) {
              this.pageLoad();
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
  async printInvoice(data: any) {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    if (this.isInitializing) {
      this.resetTimeout = setTimeout(() => {
        this.isInitializing = false;
        this.printInvoice(data);
      }, 500);
      return;
    }

    this.isInitializing = true;
    let printWindow: Window | null = null;
    let cleanupComplete = false;

    try {
      this.currentInvoice = data;
      await this.forceViewRefresh();

      printWindow = window.open('', '_blank', 'width=1000,height=1200');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }

      // Define inline styles
      const invoiceStyles = `
      .invoice-container {
        padding: 40px;
        max-width: 1000px;
        margin: 0 auto;
        background-color: white;
        font-family: Arial, sans-serif;
      }
      .header {
        margin-bottom: 40px;
      }
      .header h1 {
        font-size: 32px;
        color: #1a365d;
        margin-bottom: 20px;
      }
      .header-content {
        display: flex;
        justify-content: space-between;
      }
      .billing-info {
        margin-bottom: 40px;
        display: flex;
        justify-content: space-between;
      }
      .invoice-details {
        margin-bottom: 40px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 10px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .detail-label {
        color: #4a5568;
        font-size: 18px;
      }
      .detail-value {
        color: #1a365d;
        font-size: 18px;
        font-weight: 500;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
        padding: 15px 0;
        border-bottom: 2px solid #1a365d;
      }
      .total-label {
        color: #1a365d;
        font-size: 20px;
        font-weight: 600;
      }
      .approval-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 40px;
      }
      .terms-section {
        margin-top: 40px;
      }
      .terms-section h3 {
        color: #1a365d;
        font-size: 18px;
        margin-bottom: 15px;
      }
      .terms-list {
        color: #4a5568;
        font-size: 16px;
        list-style-type: disc;
        padding-left: 20px;
      }
      .terms-list li {
        margin-bottom: 5px;
      }
    `;

      const printStyles = `
      @page {
        size: portrait;
        margin: 0mm;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .print-container {
        width: 100%;
        min-height: 100vh;
        background: white;
        padding: 20px;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    `;

      // Write content to print window
      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Invoice</title>
          <style>
            ${printStyles}
            ${invoiceStyles}
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="invoice-container">
              <div class="header">
                 <div style="display: flex; justify-content: space-between;align-items: center;">
        <h1 style="font-size: 32px; color: #1a365d; margin-bottom: 20px;">Invoice</h1>
        <div style="text-align: right;">
          <img src="assets/images/logo2.svg" alt="Trackbox Logo" style="width: 50px; height: auto;">
      </div>
      </div>
                <div class="header-content">
                  <div>
                    <p class="detail-label">Invoice no : #${
                      this.currentInvoice.Invoice_Id
                    }</p>
                    <p class="detail-label">Date : ${new Date(
                      this.currentInvoice.invoice_date
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}</p>
                  </div>
                
                </div>
              </div>

              <div class="billing-info">
                <div>
                  <p class="detail-label">Bill to : ${
                    this.currentInvoice.name
                  }</p>
                  <p class="detail-label">Position : ${
                    this.currentInvoice.position
                  }</p>
                  <p class="detail-label">Course : ${
                    this.currentInvoice.course_name
                  }</p>
                </div>
                <div style="text-align: right;">
                  <p class="detail-label">Trackbox Tower, 176/10, Vazhappally west,</p>
                  <p class="detail-label">Thuruthy p.o, Changanassery,</p>
                  <p class="detail-label">Kottayam - 686535</p>
                  <p class="detail-label">8891505777</p>
                  <p class="detail-label">info@trackbox.in</p>
                </div>
              </div>

              <div class="invoice-details">
                <div class="detail-row">
                  <span class="detail-label">Course Name</span>
                  <span class="detail-value">${
                    this.currentInvoice.course_name
                  }</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment period</span>
                  <span class="detail-value">${
                    this.currentInvoice.payment_period
                  }</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Hours</span>
                  <span class="detail-value">${
                    this.currentInvoice.class_hours
                  }</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Rate</span>
                  <span class="detail-value">${
                    this.currentInvoice.total_amount /
                    this.currentInvoice.class_hours
                  }</span>
                </div>
                <div class="total-row">
                  <span class="total-label">Total Amount</span>
                  <span class="total-label">₹${
                    this.currentInvoice.total_amount
                  }</span>
                </div>
              </div>

              <div class="approval-section">
                <div>
                  <p class="detail-label">Approved By :</p>
                  <p class="detail-value">${this.currentInvoice.approved_by}</p>
                </div>
                <div style="text-align: right;">
                  <p class="detail-label">Authorized Signature :</p>
                  <p class="detail-value"></p>
                </div>
              </div>

              <div class="terms-section">
                <h3>Terms & Conditions:</h3>
                <ul class="terms-list">
                  <li>Payment is due within 30 days</li>
                  <li>Please include invoice number on your payment</li>
                  <li>Make all checks payable to company name</li>
                </ul>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
      printWindow.document.close();

      const cleanup = () => {
        if (cleanupComplete) return;
        cleanupComplete = true;

        if (printWindow) {
          printWindow.close();
        }

        if (this.resetTimeout) {
          clearTimeout(this.resetTimeout);
          this.resetTimeout = null;
        }

        this.ngZone.run(() => {
          this.isInitializing = false;
          this.cdr.detectChanges();
        });
      };

      // Handle print completion
      if (printWindow.matchMedia) {
        const mediaQueryList = printWindow.matchMedia('print');
        mediaQueryList.addEventListener('change', (mql) => {
          if (!mql.matches) {
            cleanup();
          }
        });
      }

      printWindow.addEventListener('beforeunload', cleanup);

      // Wait for images and trigger print
      await this.waitForImages(printWindow);

      printWindow.print();

      // Fallback cleanup
      this.resetTimeout = setTimeout(cleanup, 2000);
    } catch (error) {
      console.error('Error printing invoice:', error);
      if (printWindow) {
        printWindow.close();
      }
      this.handleError();
    }
  }

  // You can reuse these helper methods from your certificate code
  private async waitForImages(printWindow: Window): Promise<void> {
    return new Promise((resolve) => {
      const images = Array.from(
        printWindow.document.getElementsByTagName('img')
      );
      if (images.length === 0) {
        setTimeout(resolve, 500);
        return;
      }

      let loadedImages = 0;
      const totalImages = images.length;

      const imageLoaded = () => {
        loadedImages++;
        if (loadedImages === totalImages) {
          setTimeout(resolve, 200);
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          imageLoaded();
        } else {
          img.onload = imageLoaded;
          img.onerror = imageLoaded;
        }
      });

      // Fallback timeout
      setTimeout(resolve, 3000);
    });
  }

  private handleError(): void {
    this.isInitializing = false;
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
  }

  private async forceViewRefresh(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.ngZone.run(() => {
        this.cdr.detectChanges();
        setTimeout(resolve, 100);
      });
    });
  }

  // In your component, add this method
  getTimeSlots(courseGroup: AbstractControl): AbstractControl[] {
    return (courseGroup.get('timeSlots') as FormArray).controls;
  }
  // Method in your component
  getTimeSlotLength(courseGroup: AbstractControl): number {
    return (courseGroup.get('timeSlots') as FormArray).controls.length;
  }
  loadExistingData(teacher_Id: string): void {
    this.isLoading = true;

    this.user_Service_.Get_Teacher_courses_With_Batch(teacher_Id).subscribe({
      next: (result: any[]) => {
        // Group by CourseTeacher_ID
        const grouped = result.reduce((acc, current) => {
          let existingGroup = acc.find(
            (group) => group.CourseTeacher_ID == current.CourseTeacher_ID
          );

          if (!existingGroup) {
            existingGroup = {
              CourseTeacher_ID: current.CourseTeacher_ID,
              Course_ID: current.Course_ID,
              Course_Name: current.Course_Name,
              Delete_Status: 0,
              timeSlots: [],
            };
            acc.push(existingGroup);
          }

          existingGroup.timeSlots.push({
            Delete_Status: 0,
            Batch_ID: current.Batch_ID,
            Batch_Name: current.Batch_Name,
            Slot_Id: current.Slot_Id,
            start_time: current.start_time,
            end_time: current.end_time,
          });

          return acc;
        }, []);

        // Clear existing courses
        while (this.teacherCourses.length !== 0) {
          this.teacherCourses.removeAt(0);
        }

        // Rebuild form

        grouped.forEach((courseGroup) => {
          if (courseGroup.Course_ID) {
            this.filterBatchesForCourse(courseGroup.Course_ID);
          }
          const formGroup = this.fb.group({
            CourseTeacher_ID: [courseGroup.CourseTeacher_ID],
            Delete_Status: [0],
            Course_ID: [
              courseGroup.Course_ID ? courseGroup.Course_ID : '',
              [Validators.required],
            ],
            timeSlots: this.fb.array(
              courseGroup.timeSlots.map((slot) =>
                this.createTimeSlotFormGroup(slot)
              )
            ),
          });

          this.teacherCourses.push(formGroup);
        });

        // Ensure at least one course exists
        if (this.teacherCourses.length == 0) {
          // this.addCourse();
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading teacher courses:', error);
        this.isLoading = false;
        this.addCourse();
      },
    });
  }
  get teacherCourses(): FormArray {
    return this.user_Form.get('teacherCourses') as FormArray;
  }

  createCourseFormGroup(): FormGroup {
    return this.fb.group(
      {
        CourseTeacher_ID: [0],
        Course_ID: ['', Validators.required],
        timeSlots: this.fb.array([this.createTimeSlotFormGroup()]),
        Delete_Status: [0],
      },
      {
        validators: this.atLeastOneTimeSlotValidator(),
      }
    );
  }

  // Create a time slot form group
  createTimeSlotFormGroup(slot?: any): FormGroup {
    console.log('slot: ', slot);
    const batchId = slot?.Batch_ID ? slot?.Batch_ID : 0;
    console.log('batchId: ', batchId);
    return this.fb.group({
      Batch_ID: [batchId, Validators.required],
      isLive: [true], // Default to true since Batch is now always required and shown
      Slot_Id: [slot ? slot.Slot_Id : this.generateTempId()],
      start_time: [
        slot ? this.convertTo24Hour(slot.start_time) : '09:00'
      ],
      end_time: [
        slot ? this.convertTo24Hour(slot.end_time) : '18:00'
      ],
      Delete_Status: [0],
    });
  }

  // Generate a temporary negative ID for new slots
  private generateTempId(): number {
    return -Math.floor(Math.random() * 1000);
  }

  addCourse(): void {
    const newCourseGroup = this.createCourseFormGroup();
    this.teacherCourses.push(newCourseGroup);

    this.cdr.detectChanges();
    newCourseGroup.markAllAsTouched();
  }

  // Add a time slot to a specific course
  addTimeSlot(courseIndex: number): void {
    const timeSlots = this.teacherCourses
      .at(courseIndex)
      .get('timeSlots') as FormArray;
    timeSlots.push(this.createTimeSlotFormGroup());
  }

  // Handle live class toggle
  onLiveChange(courseIndex: number, slotIndex: number): void {
    const courseGroup = this.teacherCourses.at(courseIndex);
    const timeSlots = courseGroup.get('timeSlots') as FormArray;
    const timeSlot = timeSlots.at(slotIndex);

    const isLive = timeSlot.get('isLive')?.value;
    const batchControl = timeSlot.get('Batch_ID');

    if (isLive) {
      batchControl?.setValidators([Validators.required]);
    } else {
      batchControl?.clearValidators();
      batchControl?.setValue(0);
    }
    batchControl?.updateValueAndValidity();
  }

  // Utility methods for time conversion
  convertTo24Hour(time12h: string): string {
    if (!time12h) return '';

    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    let hoursNum = parseInt(hours, 10);

    if (modifier === 'PM' && hoursNum < 12) {
      hoursNum += 12;
    }
    if (modifier === 'AM' && hoursNum === 12) {
      hoursNum = 0;
    }

    return `${hoursNum.toString().padStart(2, '0')}:${minutes}`;
  }
  getChanges() {
    const formValue = this.teacherCourses.value;

    // Define the structure of `changes`
    const changes: {
      coursesToDelete: any[];
      coursesToAdd: any[];
      coursesToUpdate: any[];
      timeSlotsToDelete: any[];
      timeSlotsToAdd: any[];
      timeSlotsToUpdate: any[];
    } = {
      coursesToDelete: [],
      coursesToAdd: [],
      coursesToUpdate: [],
      timeSlotsToDelete: [],
      timeSlotsToAdd: [],
      timeSlotsToUpdate: [],
    };

    formValue.forEach((courseGroup: any) => {
      // Handle Course Deletion/Update
      if (courseGroup.CourseTeacher_ID > 0 && courseGroup.Delete_Status === 1) {
        // Course to be deleted
        changes.coursesToDelete.push({
          CourseTeacher_ID: courseGroup.CourseTeacher_ID,
          Course_ID: courseGroup.Course_ID,
        });
      } else if (
        courseGroup.CourseTeacher_ID <= 0 &&
        courseGroup.Delete_Status === 0
      ) {
        // New course to be added
        changes.coursesToAdd.push({
          Course_ID: courseGroup.Course_ID,
        });
      } else if (
        courseGroup.CourseTeacher_ID > 0 &&
        courseGroup.Delete_Status === 0
      ) {
        // Existing course to be updated
        changes.coursesToUpdate.push({
          CourseTeacher_ID: courseGroup.CourseTeacher_ID,
          Course_ID: courseGroup.Course_ID,
        });
      }

      // Handle Time Slots
      const timeSlots: any[] = courseGroup.timeSlots || [];

      // Deleted time slots
      const deletedTimeSlots = timeSlots
        .filter((slot) => slot.Slot_Id > 0 && slot.Delete_Status === 1)
        .map((slot) => ({
          ...slot,
          Course_ID: courseGroup.Course_ID,
          CourseTeacher_ID: courseGroup.CourseTeacher_ID,
        }));
      changes.timeSlotsToDelete.push(...deletedTimeSlots);

      // New time slots
      const newTimeSlots = timeSlots
        .filter((slot) => slot.Slot_Id < 0 && slot.Delete_Status === 0)
        .map((slot) => ({
          ...slot,
          Course_ID: courseGroup.Course_ID,
          CourseTeacher_ID: courseGroup.CourseTeacher_ID,
        }));
      changes.timeSlotsToAdd.push(...newTimeSlots);

      // Updated time slots
      const updatedTimeSlots = timeSlots
        .filter((slot) => slot.Slot_Id > 0 && slot.Delete_Status === 0)
        .map((slot) => ({
          ...slot,
          Course_ID: courseGroup.Course_ID,
          CourseTeacher_ID: courseGroup.CourseTeacher_ID,
        }));
      changes.timeSlotsToUpdate.push(...updatedTimeSlots);
    });

    return changes;
  }
  markCourseForDeletion(courseIndex: number): void {
    const courseGroup = this.teacherCourses.at(courseIndex);

    // If the course has an existing CourseTeacher_ID, set Delete_Status to 1
    if (courseGroup.get('CourseTeacher_ID')?.value) {
      courseGroup.get('Delete_Status')?.setValue(1);
      // courseGroup.get('Course_ID')?.disable();

      // Also mark all time slots in this course for deletion
      const timeSlots = courseGroup.get('timeSlots') as FormArray;
      timeSlots.controls.forEach((timeSlot) => {
        timeSlot.get('Delete_Status')?.setValue(1);
      });
    } else {
      // If it's a new course, simply remove it from the form array
      this.teacherCourses.removeAt(courseIndex);
    }

    this.cdr.detectChanges();
  }

  // Method to mark a time slot for deletion
  markTimeSlotForDeletion(courseIndex: number, slotIndex: number): void {
    const courseGroup = this.teacherCourses.at(courseIndex);
    const timeSlots = courseGroup.get('timeSlots') as FormArray;
    const timeSlot = timeSlots.at(slotIndex);
    // timeSlot.get('start_time')?.disable();
    // timeSlot.get('end_time')?.disable();
    // timeSlot.get('Batch_ID')?.disable();
    // timeSlot.get('isLive')?.disable();
    // If the time slot has an existing Slot_Id, set Delete_Status to 1
    if (timeSlot.get('Slot_Id')?.value > 0) {
      timeSlot.get('Delete_Status')?.setValue(1);
    } else {
      // If it's a new time slot, simply remove it from the form array
      timeSlots.removeAt(slotIndex);
    }

    this.cdr.detectChanges();
  }

  // Modify existing removeTimeSlot method to use markTimeSlotForDeletion
  removeTimeSlot(courseIndex: number, slotIndex: number): void {
    const timeSlots = this.teacherCourses
      .at(courseIndex)
      .get('timeSlots') as FormArray;

    if (timeSlots.length > 1) {
      this.markTimeSlotForDeletion(courseIndex, slotIndex);
    }
  }

  // Modify existing removeCourse method to use markCourseForDeletion
  removeCourse(index: number): void {
    this.markCourseForDeletion(index);
    // if (this.teacherCourses.length > 1) {
    // }
  }

  undoCourseDelection(courseIndex: number): void {
    const courseGroup = this.teacherCourses.at(courseIndex);

    // Reset Delete_Status to 0
    courseGroup.get('Delete_Status')?.setValue(0);

    // Reset delete status for all time slots in this course
    const timeSlots = courseGroup.get('timeSlots') as FormArray;
    timeSlots.controls.forEach((timeSlot) => {
      // Only reset time slots that were previously marked for deletion
      if (timeSlot.get('Slot_Id')?.value > 0) {
        timeSlot.get('Delete_Status')?.setValue(0);
      }
    });

    this.cdr.detectChanges();
  }

  private validateForm(): boolean {
    let isValid = true;
    const teacherCourses = this.user_Form.get('teacherCourses') as FormArray;

    teacherCourses.controls.forEach(
      (courseGroup: FormGroup, courseIndex: number) => {
        // Skip deleted courses
        if (courseGroup.get('Delete_Status')?.value === 1) return;

        // Validate Course Selection
        const courseIdControl = courseGroup.get('Course_ID');
        if (!courseIdControl?.valid) {
          courseIdControl?.setErrors({ required: true });
          isValid = false;
        }

        // Validate Time Slots
        const timeSlotsArray = courseGroup.get('timeSlots') as FormArray;

        // Check if there's at least one active time slot
        const activeTimeSlots = timeSlotsArray.controls.filter(
          (slot) => slot.get('Delete_Status')?.value !== 1
        );

        if (activeTimeSlots.length === 0) {
          courseGroup.setErrors({ noTimeSlots: true });
          isValid = false;
        }

        activeTimeSlots.forEach((timeSlot: FormGroup, slotIndex: number) => {
          const startTimeControl = timeSlot.get('start_time');
          if (!startTimeControl?.valid) {
            startTimeControl?.setErrors({ required: true });
            isValid = false;
          }

          const endTimeControl = timeSlot.get('end_time');
          if (!endTimeControl?.valid) {
            endTimeControl?.setErrors({ required: true });
            isValid = false;
          }

          const isLive = timeSlot.get('isLive')?.value;
          const batchControl = timeSlot.get('Batch_ID');
          if (isLive) {
            if (!batchControl?.value) {
              batchControl?.setErrors({ required: true });
              isValid = false;
            }
          }
        });
      }
    );

    return isValid;
  }
  atLeastOneTimeSlotValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control) {
        return { noTimeSlots: true };
      }

      const timeSlotsControl = control.get('timeSlots');

      if (!timeSlotsControl) {
        return { noTimeSlots: true };
      }

      if (!(timeSlotsControl instanceof FormArray)) {
        return { noTimeSlots: true };
      }

      const activeTimeSlots = timeSlotsControl.controls.filter(
        (slot) => slot.get('Delete_Status')?.value !== 1
      );

      return activeTimeSlots.length > 0 ? null : { noTimeSlots: true };
    };
  }
  scrollToFirstInvalidElement() {
    // Find the first invalid form control
    const invalidControl = this.el.nativeElement.querySelector(
      '.ng-invalid:not(form):not([ngClass])'
    );

    if (invalidControl) {
      // Scroll to the element
      invalidControl.focus();
      invalidControl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }

  transformData(input) {
    if (input.length) {
      const payload = {
        Course_ID: input[0].Course_ID,
        SchduledTeacher: input
          .filter((teacher) => teacher.Delete_Status == 0)
          .map((teacher, index) => ({
            CourseTeacher_ID: teacher.CourseTeacher_ID,
            Teacher_ID: this.user_Form.get('User_ID')?.value,
            Delete_Status: teacher.Delete_Status,
            timeSlots: teacher.timeSlots
              .filter((slot) => slot.Delete_Status == 0)
              .map((slot) => ({
                startTime: slot.start_time,
                endTime: slot.end_time,
                Delete_Status: slot.Delete_Status,
                Slot_Id: slot.Slot_Id <= 0 ? 0 : slot.Slot_Id,
              })),
          })),
      };
      return payload;
    } else {
      return [];
    }
  }

  Validate_Course_Section(payload) {
    return new Promise<void>((resolve, reject) => {
      this.course_Service_.ValidateTimeSlots(payload).subscribe((res) => {
        if (res['success']) {
          resolve(); // Validation succeeded
        } else {
          const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message:
                res['error'] + '.  Please select a time outside these hours.',
              Type: '3',
              Heading: 'Choose Another Time',
            },
          });
          reject('Time slot validation failed');
        }
      });
    });
  }

  checkUniqueness(type: 'Email' | 'PhoneNumber') {
    const control = this.user_Form.get(type);
    if (!control || !control.value) return;

    const payload = {
      [type]: control.value,
      User_ID: this.user_Form.get('User_ID')?.value || 0
    };

    this.user_Service_.Check_Uniqueness(payload).subscribe((res: any) => {
      if (type === 'Email' && res.emailCount > 0) {
        control.setErrors({ serverError: 'Email already exists' });
      } else if (type === 'PhoneNumber' && res.phoneCount > 0) {
        control.setErrors({ serverError: 'Phone number already exists' });
      } else {
        if (control.hasError('serverError')) {
          const errors = { ...control.errors };
          delete errors['serverError'];
          control.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
    });
  }

  onHodChange(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      // Perform your desired action here
      this.user_Form.get('Hod')?.setValue(1);
      console.log('HOD checkbox is checked.');
      // while (this.teacherCourses.length !== 0) {
      //   this.teacherCourses.removeAt(0);
      // }
    } else {
      console.log('HOD checkbox is unchecked.');
    }
  }
  filteredBatchLists: { [courseId: number]: any[] } = {};

  // Method to filter batches based on selected course
  filterBatchesForCourse(courseId: number): void {
    console.log('courseId: ', courseId);
    console.log('this.BatchList: ', this.BatchList);
    this.filteredBatchLists[courseId] = this.BatchList.filter(
      (batch) => batch.Course_ID == courseId
    );
  }

  // Modify your course selection change handler
  onCourseChange(courseIndex: number): void {
    const courseGroup = this.teacherCourses.at(courseIndex);
    const courseId = courseGroup.get('Course_ID')?.value;

    // Filter batches for this course
    if (courseId) {
      this.filterBatchesForCourse(courseId);
    }

    // Reset time slots and batch selections
    const timeSlotsArray = courseGroup.get('timeSlots') as FormArray;
    timeSlotsArray.controls.forEach((timeSlot: FormGroup) => {
      // Reset live class and batch selections
      timeSlot.get('isLive')?.setValue(false);
      timeSlot.get('Batch_ID')?.setValue(0);
      timeSlot.get('Batch_ID')?.clearValidators();
      timeSlot.get('Batch_ID')?.updateValueAndValidity();
    });
  }
}
