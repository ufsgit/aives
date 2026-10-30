import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewEncapsulation,
  inject,
  viewChild,
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormsModule,
} from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { student_Service } from '../../services/student.Service';
import { EmailTemplateService } from '../../services/email-template.service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { MatDialog } from '@angular/material/dialog';
import { student } from '../../../core/models/student';
import { student_course } from '../../../core/models/student_course';
import { CommonModule, DatePipe } from '@angular/common';
import { course_Service } from '../../services/course.Service';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute, Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  EMPTY,
  filter,
  finalize,
  forkJoin,
  from,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import html2canvas from 'html2canvas';
// import jsPDF from 'jspdf';
import { IConfig, ICountry } from 'ngx-countries-dropdown';
import { Debounce } from '../../../shared/services/debounce.decorator';
import { StudentFeesComponent } from '../student-fees/student-fees.component';
import { StudentFeesService } from '../../services/student-fees.service';
import { Inject, Input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';
import { ExpenseTypeService } from '../../services/expense-type.service';
import { StudentDocumentsComponent } from '../student-documents/student-documents.component';
import { StudentlistComponent } from '../studentlist/studentlist.component';

interface InstallmentEntry {
  Student_Fees_ID: any;
  Student_ID: any;
  Course_ID: any;
  Course_Name: any;
  Installment_information_ID: any;
  Total_Amount: number;
  Paid_Amount: number;
  Fee_Status: string;
  Payment_Date: Date | null;
  Due_Date: Date | null;
  Payment_Mode: any;
  Transaction_ID: string;
  Installment_Index: number;
  Receipt_Id: any;
  update_status: boolean;
}
@Component({
  selector: 'app-student',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    FormsModule,
    SharedModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatDialogModule,
    MatTableModule,
    MatTabsModule,
    StudentFeesComponent,
    StudentDocumentsComponent,
    StudentlistComponent,
  ],
  templateUrl: './student.component.html',
  styleUrl: './student.component.scss'
})
export class StudentComponent implements OnInit {
  preferredCountryCodes: string[] = ['in', 'ae'];
  activeStatus: string = 'all'; // 'all' | 'active' | 'deactivated'
  followUpForm: FormGroup;
  selectedCountryCode: string = 'IN'; // <-- Required for initial selection
  student_Service_ = inject(student_Service);
  StudentFees_Service_ = inject(StudentFeesService);
  private fb = inject(FormBuilder);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  dialogBox = inject(MatDialog);
  private emailTemplateService = inject(EmailTemplateService);
  private course_Service_ = inject(course_Service);
  router = inject(Router);
  url = inject(ActivatedRoute);
  private currentSubscription?: Subscription;
  private courseSubscription?: Subscription;
  selectedCountryConfig: IConfig = {
    hideCode: true,
    hideName: true,
  };
  countryListConfig: IConfig = {
    hideCode: true,
  };
  readonly certificateContainer = viewChild.required<ElementRef>(
    'certificateContainer'
  );
  enrollmentStatus: string = 'not_enrolled';
  Student_Exam_Name: string = '';
  currentStudent: any = null;
  isInitializing = false;
  resetTimeout: any = null;
  isGenerating: boolean = false;

  // Add these properties to your component class
  showFollowupHistory: boolean = false;
  followupHistoryList: any[] = [];
  loadingFollowupHistory: boolean = false;
  showHistoryBox: boolean = false;
  followUpHistory: any[] = [];
  isLoadingHistory: boolean = false;
  emailTemplates: any[] = [];
  selectedTemplateId: number | null = null;

  nextFollowUpDate: string = '';
  remark: string = '';

  showFollowUpSection: boolean = false;
  isFollowUpLoading: boolean = false;
  isNewStudent: boolean = false;
  Search_Branch: any = {};
  Search_staff: any = {};
  Search_status: any = {};
  Search_Department: any = {};
  Search_Branch_Data: any[] = [];
  Search_Department_Data: any[] = [];
  Search_Branch_Temp: any = {};
  branchData: any[] = [];
  departmentData: any[] = [];
  staffData: any[] = [];

  subscribedStatus: string = 'all';
  subscribedData: any[] = [
    { value: 'all', label: 'All' },
    { value: 'yes', label: 'Yes (Subscribed)' },
    { value: 'no', label: 'No (Not Subscribed)' }
  ];

  statusData: any[] = [];
  followUpStatusData: any[] = [];
  studentFollowUpHistory: any[] = [];

  Total_Entries: number = 0;
  currentPage: number = 1;
  pageSize: number = 10;
  view = 'list';
  searchTerm: string = '';
  searchRollNumber: string = '';
  searchTimeout: any;
  student_Form: FormGroup;
  student_Course: FormGroup;
  student_Name_Search: string;
  showOnlyFollowUpSection: boolean = false;
  isLoading: boolean;
  student_Data: student[];
  EditIndex: number;
  courseList;
  selectedCourseId: number | null = null;
  selectedBatchId: number | null = null;
  selectedStudent: any = null;
  followupPriority: string = '';
  fileToRemoveAws: any = [];
  previewUrl: any = null;
  allCourse: any = [];
  examResults: any = [];
  examsList: any = [];
  filepath = environment['FilePath'];
  newExamResult = {
    StudentExam_ID: 0,
    Exam_ID: null,
    Content_Name: null,
    Batch_Id: null,
    Batch_Name: null,
    Course_Id: null,
    Student_ID: null,
    Result_Date: null,
    Listening: '',
    Reading: '',
    Writing: '',
    Speaking: '',
    Overall_Score: '',
    CEFR_level: '',
    Exam_Name: '',
  };
  available_Time_Slots: any = [];
  Batch_List: any = [];
  studentName: string = '';
  batch_Data: any;
  selectedTime: any;
  selectedSlot: any;
  optedCourseId: any;
  slotDetails: any;
  batchDetails: any;
  selectedCountry: ICountry;
  selectedStudentForFollowup: any = null;
  currentFollowUpData: any = null;
  todayString: string;
  installments: any[] = [];
  Courses: any;
  feeTypes = ['OneTime', 'TwoTime', 'ThreeTime', 'FourTime'];
  feesForm: FormGroup;
  selectedTabIndex = 0;
  feesList: any[] = [];
  receipList: any[] = [];
  payFeeStatus: boolean = false;
  installment_label: any = '';
  fees_updated_status: boolean = false;
  Student_Fees_IDs: any[];
  selectedReceipt: any | null = null;
  // In your parent component
  isEditingFees: boolean = false;
  isSave:boolean=false;

  receiptForm: FormGroup;
  isEditingReceipt: boolean = false;
  studentList: any[];
  student_Details: any;

  compareBranch(o1: any, o2: any): boolean {
    return o1 && o2 ? (o1.Branch_Id || o1.Branch_ID) === (o2.Branch_Id || o2.Branch_ID) : o1 === o2;
  }
  compareDepartment(o1: any, o2: any): boolean {
    return o1 && o2 ? (o1.Department_Id || o1.Department_ID) === (o2.Department_Id || o2.Department_ID) : o1 === o2;
  }
  compareStaff(o1: any, o2: any): boolean {
    return o1 && o2 ? o1.User_ID === o2.User_ID : o1 === o2;
  }
  compareStatus(o1: any, o2: any): boolean {
    return o1 && o2 ? (o1.Status_Id || o1.Status_ID) === (o2.Status_Id || o2.Status_ID) : o1 === o2;
  }
  constructor(
    public dialog: MatDialog,
    private feesService: StudentFeesService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private expenseApi: ExpenseTypeService
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.student_Form = this.fb.group({
      Student_ID: [0],
      First_Name: ['', Validators.required],
      Last_Name: ['', Validators.required],
      Email: [''],
      Country_Code_Name: ['in'], // 🇮🇳 Default to India
      Country_Code: ['+91'],
      Profile_Photo_Path: [''],
      Profile_Photo_Name: [''],
      Phone_Number: [''],
      Delete_Status: [0],
      Social_Provider: [''],
      Social_ID: [''],
      Avatar: [''],
      Age: [''],
      Qualification: [''],
      Qualification_Description: [''],
      Alt_Phone_Number: [''],
      Address: [''],
      Guardian_Type: ['Father'], // Father | Mother | Other
      Guardian_Name: [''],
      Guardian_Phone: [''],
      Guardian_Alt_Phone: [''],
      Active_Status: ['Active'],
      Height_cm: [''],
      Weight_kg: [''],
      Admission_Date: [today],
      Roll_No:['']
    });
    this.student_Course = this.fb.group({
      Student_ID: [0, []],
      Course_ID: [0, []],
      //Course_ID: [0, [Validators.required, Validators.min(1)]],
      Enrollment_Date: [new Date().toISOString().substring(0, 10)], // today's date
      Expiry_Date: [''],
      Price: [''],
      Payment_Date: [new Date().toISOString().substring(0, 16)], // today's datetime
      Payment_Status: [''],
      LastAccessed_Content_ID: [0],
      Transaction_Id: [''],
      Delete_Status: [0], // default to 0
      StudentCourse_ID: [0], // default to 0
      Payment_Method: [''],
      Slot_Id: [0],
      Batch_ID: [0, [Validators.required, Validators.min(1)]],
    });
    this.receiptForm = this.fb.group({
      Entry_Date: ['', Validators.required],
      Amount: [0, [Validators.required, Validators.min(1)]],
      Payment_mode: ['', Validators.required],
      Account_Name: ['', Validators.required],
      Voucher_Number: ['', Validators.required],
    });
  }
  ngOnInit(): void {
    this.pageLoad();
    this.initForm();
    this.loadEmailTemplates();
    const today = new Date();
    this.todayString = today.toISOString().split('T')[0];
    this.feesForm.get('Total_Amount')?.valueChanges.subscribe((total) => {
      const selectedInstallmentId = this.feesForm.get(
        'Installment_information_ID'
      )?.value;

      const selectedInstallment = this.installments.find(
        (i) => i.Fee_Type === selectedInstallmentId
      );

      if (selectedInstallment) {
        const feeType = selectedInstallment.Fee_Type;
        const count = this.getInstallmentSplitCount(feeType);
        if (count && total > 0) {
          const newAmounts = this.getRoundedInstallments(total, count, 5000);
          // Update the Amount in each installment row
          this.installments = this.installments.map((inst, idx) => ({
            ...inst,
            Amount: newAmounts[idx].toFixed(2), // optional: keep as string
          }));
        }
      }
    });



    this.url.queryParams.subscribe(params => {
    console.log("params",params);
    
    if (params['item']) {
    
      const receivedItem = JSON.parse(params['item']);
      console.log('Received Item:', receivedItem);

      
     
        this.isSave = receivedItem?.IsSave || false;
      

        
      
   
    }
  });
  }




  studentRegistration(student: any, isRegistered: boolean) {
    ;
    console.log('Student ID:', student);
    console.log('Currently Registered:', isRegistered);
    const User_ID = localStorage.getItem('User_Type');
    console.log('User_ID', User_ID);
    ;
    // Registration_Using_Student_Branch
    this.feesService
      .Registration_Using_Student_Branch(
        student.Student_ID,
        isRegistered,
        User_ID
      )
      .subscribe(
        (res) => {
          console.log('Registration response:', res);
          this.pageLoad();
        },
        (err) => {
          console.error('Error loading fee list:', err);
        }
      );
  }
  getLoggedInUserId(): number {
    const User_Id = localStorage.getItem('User_Type');
    // Replace with real logic from auth service
    return User_Id ? Number(User_Id) : 1; // Example
  }
  openAddExpense(student: any): void {
    const userName = student.First_Name + student.Last_Name;
    const Student_ID = student.Student_ID;
    const dialogRef = this.dialogBox.open(AddExpenseDialogComponent, {
      width: '500px',
      panelClass: 'Dialogbox-Class',
      data: {
        student: student,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log('Expense Payload:', result);
        const expensePayload = {
          Expense_Id: 0,
          Expense_Type_Id: result.Expense_Type_Id,
          User_Id: this.getLoggedInUserId(),
          Entry_Date: new Date(),
          Amount: result.Amount,
          Description: result.Description,
          Account_id: result.Account_Id || 0,
          Account_Name: result.Account_Name || '',
          Student_ID: result.Student_ID,
          StudentName: result.StudentName,
        };

        this.expenseApi.saveExpense(expensePayload).subscribe((Save_status) => {
          if (Save_status) {
            this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: { Message: 'Expense saved successfully!', Type: 'false' },
            });

            // this.resetForm();
          }
        });
      }
    });
  }

  Edit_FeesByReceipt_ID(receipt: any) {
    this.selectedReceipt = receipt;
    console.log('receipt', receipt);

    // Convert dd-MM-yyyy ➡ yyyy-MM-dd for input[type="date"]
    const paymentDate =
      receipt.Payment_Date || receipt.Entry_Date || new Date().toISOString();

    const incoming = {
      Student_Fees_ID: 77,
      Installment_information_ID: receipt.Installment_information_ID || '',
      Total_Amount: parseFloat(receipt.Amount),
      Fee_Status: receipt.Fee_Status,
      Payment_Date: paymentDate,
      Due_Date: receipt.Due_Date ? new Date(receipt.Due_Date) : '',
      Paid_Amount: '',
      Payment_Mode: receipt.Payment_mode || 'ADMIN',
      Transaction_ID: receipt.Transaction_ID || '',
      Student_ID: receipt.Student_Id,
      Course_ID: receipt.Course_ID,
      Receipt_Id: receipt.Receipt_Id,
      update_status: true,
    };

    const formKeys = Object.keys(this.feesForm.controls);
    const missingKeys = Object.keys(incoming).filter(
      (k) => !formKeys.includes(k)
    );
    console.warn('❗Missing form controls:', missingKeys); // dev helper
    this.isEditingFees = true;
    this.feesForm.patchValue(incoming);

    // this.feesForm.patchValue({
    //   Entry_Date: formattedDate,
    //   Amount: receipt.Amount,
    //   Payment_mode: receipt.Payment_mode,
    //   Account_Name: receipt.Account_Name,
    //   Voucher_Number: receipt.Voucher_Number
    // });

    this.view = 'Add_Fees';
    // this.isEditingReceipt = true;
  }

  updateReceipt() {
    if (this.receiptForm.invalid || !this.selectedReceipt) return;

    const formValue = this.receiptForm.value;

    // Convert yyyy-MM-dd ➡ dd-MM-yyyy for storage/display
    const dateParts = formValue.Entry_Date.split('-');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    const updatedReceipt: any = {
      ...this.selectedReceipt,
      ...formValue,
      Entry_Date: formattedDate,
    };

    const index = this.receipList.findIndex((r) => r === this.selectedReceipt);
    if (index > -1) {
      this.receipList[index] = updatedReceipt;
    }

    this.receiptForm.reset();
    this.selectedReceipt = null;
    this.isEditingReceipt = false;
  }

  cancelEdit() {
    this.receiptForm.reset();
    this.selectedReceipt = null;
    this.isEditingReceipt = false;
  }

  onSaveStudent(event: any): void {
    console.log('Student saved:', event);
    if (event && event[0] && this.student_Details) {
      this.student_Details.Student_ID = event[0].Student_ID;
      if (event[0].RollNumber) {
        this.student_Details.Roll_No = event[0].RollNumber;
      }
    }
    this.Search_student(); // Refresh student list data in background without clearing current form
    // Stay on student creation page (do not set this.view = 'list' or call this.pageLoad())
  }

  loadFeesList(Student_ID): void {
    const studentId = Student_ID;

    if (studentId) {
      this.feesService.Get_FeesByStudentId(studentId).subscribe(
        (res) => {
          this.feesList = res;
        },
        (err) => {
          console.error('Error loading fee list:', err);
        }
      );
    }
  }
  get_student_fees_details(Student_ID): void {
    const studentId = Student_ID;
    console.log('Fetching fees for student ID:', studentId);

    if (studentId) {
      this.feesService.get_student_fees_details(studentId).subscribe(
        (res) => {
          console.log('res', res);

          this.receipList = res;
        },
        (err) => {
          console.error('Error loading fee list:', err);
        }
      );
    }
  }
  payFee(fee: any): void {
    console.log('fee', fee);

    this.payFeeStatus = true;
    this.feesForm.patchValue({
      Student_Fees_ID: fee.Student_Fees_ID,
      Installment_information_ID: fee.Installment_information_ID || '', // if available
      Total_Amount: parseFloat(fee.Total_Amount),
      Paid_Amount: fee.Remaining_Amount,
      Fee_Status: fee.Fee_Status,
      Payment_Date: new Date(), // default to today
      Due_Date: fee.Due_Date ? new Date(fee.Due_Date) : '',
      Payment_Mode: fee.Payment_Mode || 'ADMIN',
      Transaction_ID: fee.Transaction_ID || '',
      Course_ID: fee.Course_ID,
      Student_ID: fee.Student_ID,
      update_status: false,
    });
    this.selectedTabIndex = 1;
    // Optional: scroll to form or switch to "Fee Entry" tab
    const tabGroup = document.querySelector('mat-tab-group');
    if (tabGroup) {
      (tabGroup as any).selectedIndex = 1; // Switch to Fee Entry tab
    }
    this.isEditingFees = false;
    this.view = 'Add_Fees';
  }
  get isEditMode(): boolean {
    return this.feesForm.get('update_status')?.value === true;
  }

  student_List_Update(item: any) {
    this.view = 'student_list';
    this.student_Details = item;
    console.log('item', item);
  }
onCancelEdit(): void {
  this.pageLoad();
  this.view = 'list'; // Set view back to list
}

  handleCancel(studentId: any): void {
    this.view = 'list';
    this.selectedTabIndex = 0;

    if (studentId > 0) {
      this.loadFeesList(studentId);
      if (this.isEditingFees) {
        this.selectedTabIndex = 1;
        this.get_student_fees_details(studentId);
      }
      this.isEditingFees = false; // Reset edit mode
    } else {
      console.warn('Invalid Student_ID on cancel');
    }
  }
  handleDocumentsCancel(studentId: any): void {
    this.view = 'Student_Fees';
    this.selectedTabIndex = 0;

    this.pageLoad();
  }
  test() {
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
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Deleted', Type: 'false' },
        });
      }
    });
  }

  Delete_Receipt(Receipt) {
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
        console.log('Receipt to delete:', Receipt);

        this.feesService.Delete_FeesByReceipt_ID(Receipt.Receipt_Id).subscribe(
          (Delete_status) => {
            if (Delete_status[0].Receipt_Id > 0) {
              this.selectedTabIndex = 1;
              this.get_student_fees_details(Receipt.Student_Id);
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

  printReceipt(fee: any): void {
    const includeTax = fee.Tax_Type_Id === 1;
    const name = localStorage.getItem('Name');
    
    // Assuming fee.Amount is a valid number
    const amount = Number(fee.Amount) || 0;
    const fineAmount = Number(fee.Fine_Amount) || 0;
    const totalPaidValue = amount + fineAmount;

    if (includeTax) {
      fee.CGST = +(amount * 0.09).toFixed(2);
      fee.SGST = +(amount * 0.09).toFixed(2);
      fee.Total_GST_18 = +(fee.CGST + fee.SGST).toFixed(2);
    } else {
      fee.CGST = 0;
      fee.SGST = 0;
      fee.Total_GST_18 = 0;
    }

    // Assuming you already have fee.FeeDetails_JSON as an array
    const pendingInstallment = fee.FeeDetails_JSON.find(
      (item: any) => item.Fee_Status === 'Pending'
    );

    if (pendingInstallment) {
      fee.Next_Instalment = pendingInstallment.Total_Amount;
      fee.Due_Date = pendingInstallment.Due_Date;
      fee.Balance = pendingInstallment.Total_Amount - fee.Amount;
    } else {
      fee.Next_Instalment = '0.00';
      fee.Due_Date = null;
    }

    const imageUrl =
      'https://ufsnabeelphotoalbum.s3.amazonaws.com/Trackbox/1751630158698';

    this.getImageBase64FromUrl(imageUrl).then((logoBase64) => {
      const printContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; border: 1px solid #000; }
            .header { text-align: center; border: 1px solid #000; padding: 10px; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .sub-header { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 10px; }
            .sub-header img { height: 60px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            td, th { padding: 6px 8px; font-size: 14px; vertical-align: top; }
            .footer { font-size: 12px; margin-top: 16px; border-top: 1px solid #000; padding-top: 8px; }
            .signature-row { margin-top: 40px; display: flex; justify-content: space-between; font-size: 14px; }
            .invoice-box { border: 2px solid #000; padding: 16px; width: 100%; box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">RECEIPT</div>
            <div class="sub-header">
              <img id="logoImg" src="${logoBase64}" alt="Logo" />
              <div style="text-align: left;">
                <strong>AIVES Australia Testprep</strong><br>
                Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3, NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032
              </div>
            </div>

            <table>
              <tr>
                <td><strong>Receipt No.</strong> : ${
                  fee.Voucher_Number || 'N/A'
                }</td>
                <td><strong>Payment Date</strong> : ${this.formatDate(
                  fee.Entry_Date
                )}</td>
              </tr>
              <tr>
                <td><strong>Roll No.</strong> : ${fee.Roll_No_Character || (fee.Roll_No ? 'TEP-' + fee.Roll_No : 'N/A')}</td>
                <td></td>
              </tr>
              ${
                includeTax
                  ? `
               <tr>
                <td>
                <strong>Received from</strong> : ${fee.First_Name || 'N/A'}
                </td>
                <td>
                <strong>Total GST 18%</strong> : Rs. ${fee.Total_GST_18.toFixed(
                  2
                )}
                </td>
              </tr>
              <tr>
                <td><strong>Amount</strong> : Rs. ${fee.Amount}</td>
                <td><strong>CGST (9.0%)</strong> : Rs. ${fee.CGST.toFixed(2)}
                </td>
              </tr>
              ${fineAmount > 0 ? `
              <tr>
                <td><strong>Fine Amount</strong> : Rs. ${fineAmount.toFixed(2)}</td>
                <td></td>
              </tr>
              ` : ''}
              <tr>
                <td><strong>Amount received</strong> : Rs. ${
                  totalPaidValue.toFixed(2)
                } (${this.amountToWords(totalPaidValue)})
                </td>
                <td><strong>SGST (9.0%)</strong> : Rs. ${fee.SGST.toFixed(
                  2
                )}</td>
              </tr>
              <tr>
                <td><strong>Course</strong> : ${
                  fee.FeeDetails_JSON[0]?.Course_Name || 'N/A'
                }</td>
                <td><strong>Google Pay</strong> : ${
                  fee.Transaction_ID || 'Reference number'
                }</td>
              </tr>`
                  : `<tr>
                <td><strong>Received from</strong> : ${
                  fee.First_Name || 'N/A'
                }</td>
                <td><strong>Google Pay</strong> : ${
                  fee.Transaction_ID || 'Reference number'
                }</td>
              </tr>
              <tr>
                <td><strong>Amount</strong> : Rs. ${fee.Amount}</td>
                <td></td>
              </tr>
              ${fineAmount > 0 ? `
              <tr>
                <td><strong>Fine Amount</strong> : Rs. ${fineAmount.toFixed(2)}</td>
                <td></td>
              </tr>
              ` : ''}
              <tr>
                <td><strong>Amount received</strong> : Rs. ${
                  totalPaidValue.toFixed(2)
                } (${this.amountToWords(totalPaidValue)})</td>
                <td></td>
              </tr>
              <tr>
                <td><strong>Course</strong> : ${
                  fee.FeeDetails_JSON[0]?.Course_Name || 'N/A'
                }</td>
                <td></td>
              </tr>`
              }
              <tr>
                <td><strong>Bank</strong> : ${
                  fee.Bank || 'HDFC Trackbox'
                }</td>
                <td></td>
              </tr>
              <tr style="height: 16px;"><td colspan="2"></td></tr>
            </table>

            <div class="footer">
              1. This receipt is subject to realisation of cheque.<br>
              2. This receipt should be carefully preserved and must be produced on demand.<br>
              3. Fees once paid are not refundable/transferable in any circumstances.<br>
              4. SAC Code: 999293 Service: Commercial Training & Coaching Services
            </div>

            <div style="text-align: center; margin-top: 25px; font-size: 11px;">
              This is a computer-generated payment receipt and does not require a signature.
            </div>
          </div>
        </body>
      </html>
    `;

      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for the image to load before printing
        printWindow.onload = () => {
          const logoImg = printWindow.document.getElementById(
            'logoImg'
          ) as HTMLImageElement;
          if (logoImg.complete) {
            printWindow.print();
          } else {
            logoImg.onload = () => printWindow.print();
            logoImg.onerror = () => {
              console.error('Logo image failed to load');
              printWindow.print(); // Fallback: still print without image
            };
          }
        };
      }
    });
  }

  getImageBase64FromUrl(url: string): Promise<string> {
    return fetch(url)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string); // ✅ Base64 string with prefix
            reader.onerror = () => reject('Failed to convert image');
            reader.readAsDataURL(blob);
          })
      );
  }

  // Utility: Convert Date ISO → dd MMM yyyy
  formatDate(date: any): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  amountToWords(amount: number): string {
    if (!amount) return '';
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
    return formatter.format(amount).replace('₹', '').trim() + ' (in rupees)';
  }
  getRoundedInstallments(
    total: number,
    count: number,
    base: number = 5000
  ): number[] {
    const rawAmount = total / count;
    const roundedAmount = Math.round(rawAmount / base) * base;
    const installments = new Array(count).fill(roundedAmount);

    const totalRounded = installments.reduce((sum, val) => sum + val, 0);
    const difference = total - totalRounded;

    // Correct the last installment
    installments[count - 1] += difference;

    return installments;
  }
  getInstallmentSplitCount(feeType: string): number {
    switch (feeType) {
      case 'TwoTime':
        return 2;
      case 'ThreeTime':
        return 3;
      case 'OneTime':
        return 1;
      case 'FourTime':
        return 4;
      default:
        return 1;
    }
  }
  initForm(): void {
    this.feesForm = this.fb.group({
      Installment_information_ID: ['', Validators.required],
      Total_Amount: [{ value: '', disabled: false }, Validators.required],
      Paid_Amount: ['', Validators.required],
      Fee_Status: ['Pending', Validators.required],
      Payment_Date: [new Date(), Validators.required],
      Due_Date: [''],
      Payment_Mode: ['ADMIN'],
      Transaction_ID: [''],
      Receipt_Id: 0,
      // Course_Name: [{ value: this.data.course.Course_Name, disabled: true }],
      // Course_ID: [this.data.course.Course_ID],
      // Student_ID: [this.data.course.Student_ID],
      Student_Fees_ID: [null],
    });
  }
  onInstallmentChange(selectedInstallment: any) {
    if (this.installments.length > 0) {
      const Fee_Type = this.installments[0].Fee_Type;
      if (Fee_Type != selectedInstallment) {
        this.fees_updated_status = false;
      }
    }
    if (!this.fees_updated_status) {
      this.installments = [];
      const feestype = selectedInstallment;
      const CourseID = this.student_Course.get('Course_ID')?.value;
      const Batch_ID = this.student_Course.get('Batch_ID')?.value;
      this.fetchInstallmentsWithType(feestype, CourseID, Batch_ID);
    }
  }

  fetchInstallments(courseId): void {
    if (courseId) {
      this.feesService.Get_InstallmentsByCourseID(courseId).subscribe(
        (res) => {
          this.installments = res;
        },
        (err) => console.error('Error fetching installments:', err)
      );
    }
  }

  fetchInstallmentsWithType(Fee_Type: string, courseId: number, Batch_ID:number): void {
    if (courseId && Fee_Type && this.batchDetails?.Start_Date) {
      this.feesService.Get_InstallmentsByFee_Type(Fee_Type, courseId, Batch_ID).subscribe(
        (res) => {
          // const courseStartDate = new Date(this.batchDetails.Start_Date);
          // this.installments = res.map((inst) => {
          //   const dueDate = new Date(courseStartDate); // Clone the start date
          //   dueDate.setDate(courseStartDate.getDate() + inst.Duration);
          const courseStartDate = new Date(this.batchDetails.Start_Date);
        let lastDueDate = new Date(courseStartDate); // Track the last due date

        this.installments = res.map((inst, index) => {
          if (index === 0) {
            // First installment due date is start date + its own duration
            lastDueDate = new Date(courseStartDate);
            lastDueDate.setDate(lastDueDate.getDate() + inst.Duration);
          } else {
            // Subsequent installments due date is last due date + current installment duration
            lastDueDate = new Date(lastDueDate);
            lastDueDate.setDate(lastDueDate.getDate() + inst.Duration);
          }
            return {
              ...inst,
              DueDate: lastDueDate.toISOString().split('T')[0], // format as yyyy-MM-dd for <input type="date">
            };
          });

          // Patch first total amount
          if (this.installments.length > 0) {
            console.log('this.installments', this.installments);

            this.feesForm.patchValue({
              Total_Amount: this.installments.reduce(
                (sum, inst) => sum + parseFloat(inst.Amount),
                0
              ),
            });
          }
        },
        (err) => console.error('Error fetching installments:', err)
      );
    }
  }

  onAmountChange(index: number, newValue: number): void {
    const totalAmount = +this.feesForm.value.Total_Amount;

    // Force current value to numeric
    this.installments[index].Amount = +newValue;

    // Calculate the current total
    let currentTotal = this.installments.reduce(
      (sum, inst) => sum + +inst.Amount,
      0
    );

    const difference = currentTotal - totalAmount;

    // No correction needed
    if (difference === 0) return;

    // Try to adjust the last (or another) installment to balance
    for (let i = this.installments.length - 1; i >= 0; i--) {
      if (i === index) continue; // skip the one currently being edited

      let currentVal = +this.installments[i].Amount;
      let newVal = currentVal - difference;

      if (newVal >= 0) {
        this.installments[i].Amount = newVal;
        break;
      }
    }
  }

  Student_Fees(course) {
    this.view = 'Student_Fees';
    const Student_ID = course.Student_ID;
    this.loadFeesList(Student_ID);
    this.get_student_fees_details(Student_ID);
  }

  pageLoad() {
    this.Clr_student();
    this.Clr_student_Course();
    ;
    this.Branch_Dropdown();
    this.Department_Dropdown();
    this.User_Dropdown();
    this.Followup_status_Dropdown();
    this.Search_student();
    ;
    //this.loadFollowupData();
    this.course_Service_.Search_course('').subscribe((res) => {
      this.allCourse = res;
    });
    this.courseSubscription?.unsubscribe();

    this.courseSubscription = this.student_Course
      .get('Course_ID')
      ?.valueChanges.subscribe((courseId) => {
        if (this.view == 'courses' || this.view == 'edit')
          this.updateCourseDetails(courseId);
        // this.fetchInstallments(courseId);
      });

    this.url.queryParams
      .pipe(filter((params) => params['student_id']))
      .subscribe((params) => {
        const student_id = params['student_id'];
        console.log('student_id: ', student_id);
        this.View_courses(student_id);
        this.router.navigate([], {
          relativeTo: this.url,
          queryParams: { student_id: null },
          queryParamsHandling: 'merge',
        });
      });
    this.view = 'list';
  }
  isValidEmail(email: string): boolean {
    return Validators.email(new FormControl(email)) === null;
  }

  isValidPhone(phone: string): boolean {
    return /^\d{10}$/.test(phone);
  }
  openFollowupModal(student: any) {
    this.selectedStudent = student;
    this.view = 'followup'; // Set view to 'followup' instead of opening a modal
    this.clearFollowupForm();
    // Load necessary data if needed
    this.loadFollowupData();
  }
  clearFollowupForm() {
    this.Search_Branch = '';
    this.Search_Department = '';
    this.Search_staff = '';
    this.Search_status =
      this.followUpStatusData.find(
        (status: any) => status.Status_Name?.toLowerCase() === 'pending'
      ) || '';
    this.nextFollowUpDate = this.getCurrentDate();
    this.remark = '';
    this.followupPriority = '';
  }

  loadEmailTemplates() {
    this.emailTemplateService.searchTemplates('').subscribe((res) => {
      this.emailTemplates = res || [];
    });
  }

  sendSelectedEmail(email: string, studentName: string) {
    if (this.selectedTemplateId && email) {
      // Find the selected template name to check if it's the PTE one
      const selectedTemplate = this.emailTemplates.find(t => t.Template_ID == this.selectedTemplateId);
      
      const placeholders: any = {
        'Student Name': studentName,
        'Lead Name': studentName
      };

      // If it's the PTE template, add specific placeholders from the student record
      if (selectedTemplate?.Template_Name === 'PTE course admission confirmation' && this.selectedStudent) {
        placeholders['Payment Amount'] = this.selectedStudent.Paid_Amount || '0.00';
        placeholders['Start Date'] = this.selectedStudent.Start_Date || '-';
        placeholders['Start Time'] = this.selectedStudent.Time_Slot || '-';
      }

      this.emailTemplateService.sendTemplateEmail(this.selectedTemplateId, email, placeholders).subscribe({
        next: (res) => {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Email sent successfully', Type: 'false' },
          });
        },
        error: (err) => {
          console.error('Error sending email:', err);
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Failed to send email', Type: 'false' },
          });
        }
      });
    }
  }

  // Add method to load follow-up related data
  loadFollowupData() {
    ;
    // Load branches, departments, staff, and status data if not already loaded
    // This method should call your existing data loading methods
    if (!this.Search_Branch_Data?.length) {
      this.Branch_Dropdown();
    }
    if (!this.Search_Department_Data?.length) {
      this.Department_Dropdown();
    }
    if (!this.staffData?.length) {
      this.User_Dropdown();
    }
    if (!this.followUpStatusData?.length) {
      this.Followup_status_Dropdown();
    }
  }

  Branch_Dropdown() {
    ;
    this.student_Service_.Branch_Dropdown().subscribe(
      (Rows) => {
        ;
        console.log('Raw Branch Response:', Rows);

        // If Rows is an object, try:
        if (Rows && Array.isArray(Rows[0])) {
          this.Search_Branch_Data = Rows[0];
        } else if (Array.isArray(Rows)) {
          this.Search_Branch_Data = Rows;
        } else {
          console.error('Unexpected Branch data format:', Rows);
          this.Search_Branch_Data = [];
          return;
        }

        // Add "Select Branch" on top
        const defaultOption = { Branch_ID: 0, Branch_Name: 'Select Branch' };
        this.Search_Branch_Data.unshift(defaultOption);
        this.Search_Branch = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }
  Followup_status_Dropdown() {
    this.student_Service_.Get_Followup_Status().subscribe(
      (res: any) => {
        let rows: any[] = [];
        if (res && Array.isArray(res[0])) {
          rows = res[0];
        } else if (Array.isArray(res)) {
          rows = res;
        }

        const defaultOption = { Status_Id: 0, Status_Name: 'Select Status' };
        this.followUpStatusData = [defaultOption, ...rows];

        this.followUpStatusData.forEach((item: any) => {
          if (item.Status_Id !== undefined && item.Status_ID === undefined) {
            item.Status_ID = item.Status_Id;
          }
        });

        const initialStatus = this.followUpStatusData.find(
          (status: any) => status.Status_Name?.toLowerCase() === 'initial'
        );

        if (this.view !== 'list') {
          if (!this.Search_status || this.Search_status.Status_Id === 0) {
            this.Search_status = initialStatus || defaultOption;
          }
        }

        console.log('Follow-up statuses loaded from DB (Student Dynamic):', this.followUpStatusData);
      },
      (err) => {
        console.error('Failed to fetch follow-up statuses:', err);
      }
    );
  }

  Department_Dropdown() {
    ;
    this.student_Service_.Department_Dropdown().subscribe(
      (Rows) => {
        ;
        console.log('Raw Departtment Response:', Rows);

        // If Rows is an object, try:
        if (Rows && Array.isArray(Rows[0])) {
          this.Search_Department_Data = Rows[0];
        } else if (Array.isArray(Rows)) {
          this.Search_Department_Data = Rows;
        } else {
          console.error('Unexpected Branch data format:', Rows);
          this.Search_Department_Data = [];
          return;
        }

        const defaultOption = {
          Department_ID: 0,
          Department_Name: 'Select Department',
        };
        this.Search_Department_Data.unshift(defaultOption);
        this.Search_Department = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }

  User_Dropdown() {
    ;
    this.student_Service_.User_Dropdown().subscribe(
      (Rows) => {
        ;
        console.log('Raw user Response:', Rows);

        // If Rows is an object, try:
        if (Rows && Array.isArray(Rows[0])) {
          this.staffData = Rows[0];
        } else if (Array.isArray(Rows)) {
          this.staffData = Rows;
        } else {
          console.error('Unexpected User data format:', Rows);
          this.staffData = [];
          return;
        }

        const defaultOption = { User_ID: 0, First_Name: 'Select Staff' };
        this.staffData.unshift(defaultOption);
        this.Search_staff = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }

  // Handle staff change
  onStaffChange(event: any) {
    const staffId = event.target.value;
    // Additional logic if needed when staff is selected
  }

  // Toggle follow-up section visibility
  toggleFollowUpSection() {
    ;
    
    
    this.showFollowUpSection = !this.showFollowUpSection;
    if (this.showFollowUpSection) {
      if (!this.nextFollowUpDate) {
        this.nextFollowUpDate = this.getCurrentDate();
      }
      // Set student ID if available
      const studentId = this.student_Form.get('Student_ID')?.value;
      if (studentId) {
        this.followUpForm.get('Student_Id')?.setValue(studentId);
        // this.loadStudentFollowUpHistory(studentId);
      }
    }
  }

  // Clear follow-up form
  clearFollowUpForm() {
    this.followUpForm.reset();
    this.followUpForm.get('Follow_Up_Id')?.setValue(0);
    // this.followUpForm.get('By_User_Id')?.setValue(this.currentUserId);
    this.followUpForm.get('Priority_Level')?.setValue('Medium');
  }

  // Get current date in YYYY-MM-DD format
  getCurrentDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Save follow-up
  saveFollowUp() {
    if (this.followUpForm.invalid) {
      this.followUpForm.markAllAsTouched();
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please fill all required fields', Type: '3' },
      });
      return;
    }

    this.isFollowUpLoading = true;
    const followUpData = this.followUpForm.value;
  }

  updateCourseDetails(courseId: number) {
    this.isLoading = true;
    const selectedCourse = this.allCourse.find(
      (course) => course.Course_ID == courseId
    );
    console.log('selectedCourse: ', selectedCourse);
    console.log('student_Course: ', this.student_Course);

    this.student_Course.get('Slot_Id')?.setValue(null);
    this.student_Course.get('Batch_ID')?.setValue(null);
    this.student_Course.get('Price')?.setValue(selectedCourse?.Price);

    if (selectedCourse) {
      const currentDate = new Date().toISOString().substring(0, 10);
      this.student_Course.patchValue({
        Enrollment_Date: currentDate,
        Payment_Date: currentDate,
        Delete_Status: 0,
        Batch_ID: null,
        Slot_Id: null,
      });

      // Store subscription to unsubscribe from previous call
      if (this.currentSubscription) {
        this.currentSubscription.unsubscribe();
      }

      this.currentSubscription = forkJoin({
        timeSlots: this.course_Service_.Get_Available_Time_Slot(courseId),
        batches: this.course_Service_.get_course_Batches(courseId),
      })
        .pipe(
          map(({ timeSlots, batches }) => ({
            timeSlots: timeSlots[0],
            batches: batches,
          })),
          tap(({ timeSlots, batches }) => {
            this.available_Time_Slots = timeSlots;
            console.log(
              'this.available_Time_Slots: ',
              this.available_Time_Slots
            );

            this.batch_Data = batches;
            const selectedBatchInfo = this.batch_Data.find(
              (batch) =>
                batch.Batch_ID.toString() ==
                this.student_Course.get('Batch_ID')?.value
            );

            if (selectedBatchInfo) {
              this.batchDetails = selectedBatchInfo;
            } else {
              this.batchDetails = '';
            }
            console.log('this.batch_Data: ', this.batch_Data);

            if (
              this.available_Time_Slots.length == 0 &&
              this.view == 'courses' &&
              this.courseList.length == 0
            ) {
              this.showNoTimeSlotsDialog();
            }
          }),
          catchError((error) => {
            console.error('Error fetching course details:', error);
            this.isLoading = false;
            return EMPTY;
          }),
          finalize(() => {
            this.isLoading = false;
          })
        )
        .subscribe();
    } else {
      this.isLoading = false;
    }
  }
  // Separate method for dialog to improve readability
  private showNoTimeSlotsDialog(): void {
    this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message:
          'No available time slots. All existing time slots have been assigned. Please create or edit time slots under Course -> Edit.',
        Type: '3',
      },
    });
  }
  onSearchChange() {
    // Clear the previous timeout if it exists
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Set a new timeout
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1; // Reset to first page when searching
      this.Search_student();
    }, 300); // Wait for 300ms after the user stops typing
  }
  @Debounce(300)
  viewFollowupHistory() {
    // Implement logic to show follow-up history for the selected student
    // This could open a modal or navigate to a history page
    console.log('View follow-up history for student:', this.selectedStudent);

    // Example: Load and display history
    this.loadFollowupHistory(this.selectedStudent.Student_ID);
  }
  enterFollowupView(studentData: any) {
    this.view = 'followup';
    this.selectedStudent = studentData;

    this.student_Form.patchValue({
      Student_ID: studentData?.Student_ID,
      First_Name: studentData?.First_Name,
      Last_Name: studentData?.Last_Name,
      Email: studentData?.Email,
      Phone_Number: studentData?.Phone_Number,
      // ... any other required fields to make form valid
    });
  }

  /**
   * Toggle follow-up history visibility and load data
   */
  toggleFollowupHistory(): void {
    this.showFollowupHistory = !this.showFollowupHistory;
    ;
    // Load history when showing for the first time
    if (this.showFollowupHistory) {
      this.loadFollowupHistoryList();
    }
  }

  loadFollowupHistory(studentId: number) {
    this.student_Service_.Get_student_followup_history(studentId).subscribe({
      next: (response: any) => {
        console.log('Follow-up history response:', response);

        // Based on your data structure: response[0] contains the actual data
        let historyData: any[] = [];

        if (
          Array.isArray(response) &&
          response.length > 0 &&
          Array.isArray(response[0])
        ) {
          // Your data structure: response[0] is the array with follow-up records
          historyData = response[0];
        } else if (Array.isArray(response)) {
          // Fallback: if response is directly an array
          historyData = response;
        } else {
          console.log('Unexpected response structure:', response);
          historyData = [];
        }

        console.log('Extracted history data:', historyData);
        this.followupHistoryList = historyData;

        // Sort by created date (newest first)
        if (this.followupHistoryList.length > 0) {
          this.followupHistoryList.sort((a: any, b: any) => {
            const dateA = new Date(a.Created_Date || a.created_date || '').getTime();
            const dateB = new Date(b.Created_Date || b.created_date || '').getTime();
            if (dateA !== dateB) {
              return dateB - dateA;
            }
            const idA = a.Follow_Up_ID || a.Followup_ID || a.Follow_up_ID || 0;
            const idB = b.Follow_Up_ID || b.Followup_ID || b.Follow_up_ID || 0;
            return idB - idA;
          });
        }

        this.loadingFollowupHistory = false;
        console.log(
          'Final processed follow-up history:',
          this.followupHistoryList
        );
      },
      error: (error: any) => {
        console.error('Error loading follow-up history:', error);
        this.loadingFollowupHistory = false;
        this.followupHistoryList = [];

        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Unable to load follow-up history. Please try again.',
            Type: '2',
          },
        });
      },
    });
  }

  /**
   * Refresh follow-up history after saving new follow-up
   * Call this after successfully saving a follow-up
   */
  refreshFollowupHistory(): void {
    if (this.showFollowupHistory) {
      this.followupHistoryList = []; // Clear existing data
      this.loadFollowupHistoryList(); // Reload fresh data
    }
  }

  /**
   * Update your existing save method to refresh history
   * Add this call after successful follow-up save
   */
  afterFollowupSaveSuccess(): void {
    // Your existing success logic...

    // Refresh history if it's currently visible
    this.refreshFollowupHistory();

    // Show success message
    this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Follow-up saved successfully!',
        Type: 'false',
      },
    });
  }
  private processStudentSave(Save_status: any): Observable<any> {
    this.student_Course.get('Student_ID')?.setValue(Save_status[0].Student_ID);
    return this.student_Service_.enroleCourse(this.student_Course?.value).pipe(
      tap(() => {
        ;
        if (Save_status[0].existingUser === 1) {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Student Already Exists', Type: '3' },
          });
        } else if (Number(Save_status[0].Student_ID) > 0) {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Saved', Type: 'false' },
          });
          this.pageLoad();
        } else {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Error Occurred', Type: '2' },
          });
        }
      })
    );
  }
  getImage(imagepath) {
    return environment['FilePath'] + imagepath;
  }
  shouldShowExistingImage(): boolean {
    const profilePhotoPath = this.student_Form.value.Profile_Photo_Path;
    return profilePhotoPath && !(profilePhotoPath instanceof File);
  }
  onFileSelected(event) {
    const fileSizeLimit = 1 * 1024 * 1024; // 4MB in bytes

    const file = (event.target as HTMLInputElement).files;
    if (file && file[0] && file[0].size > fileSizeLimit) {
      alert('File size exceeds the 1MB limit. Please select a smaller file.');
      return; // Exit if the file is too large
    }

    if (
      !(this.student_Form.get('Profile_Photo_Path')?.value instanceof File) &&
      this.student_Form.get('Profile_Photo_Path')?.value != null &&
      this.student_Form.get('Profile_Photo_Path')?.value != ''
    ) {
      this.fileToRemoveAws.push(
        this.student_Form.get('Profile_Photo_Path')?.value
      );
    }
    if (file && file[0]) {
      this.student_Form.get('Profile_Photo_Path')?.setValue(file[0]);
      this.student_Form.get('Profile_Photo_Name')?.setValue(file[0].name);

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewUrl = e.target.result;
      };
      reader.readAsDataURL(file[0]);
    } else {
      this.previewUrl = null;
    }
  }

  closeClick() {
    this.view = 'list';
    this.Clr_student_Course();
    this.resetForm();
  }

  Create_New() {
    this.view = 'edit';
    // For new students, no follow-up data
    this.currentFollowUpData = null;
    this.showFollowUpSection = true;
    this.Clr_student();
  }

  Clr_student() {
    this.student_Form.reset({
      Student_ID: 0,
      First_Name: '',
      Last_Name: '',
      Email: '',
      Phone_Number: '',
      Delete_Status: 0,
      Social_Provider: '',
      Social_ID: '',
      Avatar: '',
    });
    this.previewUrl = null;
  }
  Clr_student_Course() {
    this.previewUrl = null;
    this.student_Course.reset({
      Student_ID: 0,
      StudentCourse_ID: 0,
      Course_ID: 0,
      Enrollment_Date: new Date().toISOString().substring(0, 10), // today's date
      Expiry_Date: '',
      Price: '',
      Payment_Date: new Date().toISOString().substring(0, 16), // today's datetime
      Payment_Status: '',
      LastAccessed_Content_ID: 0,
      Transaction_Id: '',
      Delete_Status: 0, // default to 0
      Payment_Method: '',
      Slot_Id: null,
      Batch_ID: null,
    });
  }

  Search_student() {
    this.isLoading = true;
    console.log('--- Search_student Params ---', {
      searchTerm: this.searchTerm,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      enrollmentStatus: this.enrollmentStatus,
      activeStatus: this.activeStatus
    });
    const currentUserId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
    const currentUserTypeId = parseInt(localStorage.getItem('User_Type') || '0');
    this.student_Service_
      .Search_student(
        this.searchTerm,
        this.currentPage,
        this.pageSize,
        this.selectedCourseId,
        this.selectedBatchId,
        this.enrollmentStatus,
        'all', // Always request all to allow frontend filtering for status
        this.subscribedStatus,
        this.searchRollNumber,
        currentUserId || null,
        currentUserTypeId || null
      )
      .subscribe(
        (response: any) => {
          console.log('--- Search_student Response ---', response);
          let rawData = response[1] || [];
          
          // 1. Normalize mapping first
          this.student_Data = rawData.map((student: any) => {
            // Normalize Active_Status string if present, handle casing differences consistently
            // Normalize Active_Status string if present, handle casing differences consistently
            const currentStatus = (student.Active_Status || student.Status_Name || '').toString().toLowerCase();
            
            if (currentStatus === 'active') {
              student.Active_Status = 'Active';
            } else if (currentStatus === 'completed') {
              student.Active_Status = 'Completed';
            } else if (currentStatus === 'dropout' || currentStatus === 'deactivated') {
              student.Active_Status = 'Dropout';
            } else {
              // Fallback to isActive if no specific status string is matched
              student.Active_Status = student.isActive ? 'Active' : 'Dropout';
            }
            return student;
          });

          // 2. Apply frontend filter for Status
          if (this.activeStatus && this.activeStatus !== 'all') {
            this.student_Data = this.student_Data.filter(
              (student: any) => student.Active_Status === this.activeStatus
            );
          }

          this.Total_Entries = response[0][0].total_count;
          // if (this.student_Data.length == 0) {
          //   this.isLoading = false;
          //   const dialogRef = this.dialogBox.open(DialogBox_Component, {
          //     panelClass: 'Dialogbox-Class',
          //     data: { Message: 'No Details Found', Type: "3" }
          //   });
          // }
          this.isLoading = false;
        },
        (error) => {
          this.isLoading = false;
          const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Error Occurred', Type: '2' },
          });
        }
      );
  }
  // Update the getFollowUpData method to use existing data when editing
  getFollowUpData() {
    // If editing existing student and no new follow-up section is shown,
    // return the existing follow-up data
    if (
      this.view === 'edit' &&
      this.student_Form.get('Student_ID')?.value &&
      !this.showFollowUpSection
    ) {
      return this.getCurrentFollowUpDataForSave() || {};
    }
    const validation = this.validateFollowUpSection();
    if (!validation.isValid && this.showFollowUpSection) {
      return {};
    }
    // For new students or when follow-up section is shown, use form data
    return {
      Branch_Id: this.Search_Branch?.Branch_Id || null,
      Branch_Name: this.Search_Branch?.Branch_Name || '',
      Department_Id: this.Search_Department?.Department_Id || null,
      Department_Name: this.Search_Department?.Department_Name || '',
      Assigned_Staff_ID: this.Search_staff?.User_ID || null,
      Assigned_Staff_Name: this.Search_staff?.First_Name || '',
      Follow_Up_Status_ID: this.Search_status?.Status_Id || null,
      Follow_Up_Status_Name: this.Search_status?.Status_Name || '',
      Next_Follow_Up_Date: this.nextFollowUpDate || null,
      Remark: this.remark?.trim() || '',
      Created_Date: new Date().toISOString().split('T')[0],
      Delete_Status: 0,
    };
  }

  // New method to validate follow-up section mandatory fields
  validateFollowUpSection(): { isValid: boolean; message: string } {
    const validationErrors: string[] = [];

    console.log('Validating follow-up section...');
    console.log('this.Search_Branch:', this.Search_Branch);
    console.log('this.Search_Department:', this.Search_Department);

    // Check Branch selection - handle multiple scenarios
    if (
      !this.Search_Branch ||
      this.Search_Branch === '' ||
      !this.Search_Branch.Branch_Id ||
      this.Search_Branch.Branch_Id === 0 ||
      this.Search_Branch.Branch_Id === '0' ||
      this.Search_Branch.Branch_Id === undefined ||
      this.Search_Branch.Branch_Id === null
    ) {
      validationErrors.push('Branch is required in follow-up section');
    }

    // Check Department selection - handle multiple scenarios
    if (
      !this.Search_Department ||
      this.Search_Department === '' ||
      !this.Search_Department.Department_Id ||
      this.Search_Department.Department_Id === 0 ||
      this.Search_Department.Department_Id === '0' ||
      this.Search_Department.Department_Id === undefined ||
      this.Search_Department.Department_Id === null
    ) {
      validationErrors.push('Department is required in follow-up section');
    }

    // Optional: Add other follow-up field validations if needed
    // Example: Staff assignment validation
    // if (!this.Search_staff ||
    //     this.Search_staff === '' ||
    //     !this.Search_staff.Staff_ID ||
    //     this.Search_staff.Staff_ID === 0 ||
    //     this.Search_staff.Staff_ID === '0') {
    //   validationErrors.push('Staff assignment is required');
    // }

    // Optional: Follow-up status validation
    // if (!this.Search_status ||
    //     this.Search_status === '' ||
    //     !this.Search_status.Status_ID ||
    //     this.Search_status.Status_ID === 0 ||
    //     this.Search_status.Status_ID === '0') {
    //   validationErrors.push('Follow-up status is required');
    // }

    if (validationErrors.length > 0) {
      console.log('Validation failed:', validationErrors);
      return {
        isValid: false,
        message: validationErrors.join(', '),
      };
    }

    console.log('Validation passed');
    return { isValid: true, message: '' };
  }

  onPageChange(page: any) {
    this.currentPage = page;
    this.Search_student();
  }
  getTotalPages(): number {
    return Math.ceil(this.Total_Entries / this.pageSize);
  }
  getMaxDisplayed(): number {
    return Math.min(this.currentPage * this.pageSize, this.Total_Entries);
  }
  getPages(): number[] {
    const totalPages = this.getTotalPages();
    console.log(
      'Array.from({length: totalPages}, (_, i) => i + 1);: ',
      Array.from({ length: totalPages }, (_, i) => i + 1)
    );
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  getVisiblePages(): (number | string)[] {
    const totalPages = this.getTotalPages();
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (this.currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (this.currentPage >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      '...',
      this.currentPage - 1,
      this.currentPage,
      this.currentPage + 1,
      '...',
      totalPages,
    ];
  }
  Edit_student(student_e: student) {
    console.log('student_e: ', student_e);
    this.view = 'edit';
    this.nextFollowUpDate = this.getCurrentDate();
    // Preservation of Active_Status from database
    if (!student_e['Active_Status']) {
      const status = (student_e['Status_Name'] || '').toLowerCase();
      if (status === 'completed') {
        student_e['Active_Status'] = 'Completed';
      } else {
        student_e['Active_Status'] = student_e['isActive'] ? 'Active' : 'Dropout';
      }
    }
      // Fix Admission Date format
  if (student_e['Admission_Date']) {
    student_e['Admission_Date'] = student_e['Admission_Date'].split('T')[0];
  }
    // Always hide follow-up section when editing existing student
    this.showFollowUpSection = false;

    this.Clr_student_Course();
    this.isLoading = true;
    this.student_Form.patchValue(student_e);

    this.View_courses(student_e.Student_ID, false);

    // Load existing follow-up data silently (no UI, just store the data)
    this.loadExistingFollowUpData(student_e.Student_ID);
  }
  loadExistingFollowUpData(studentId: number): void {
    console.log(
      '=== Loading existing follow-up data silently for student:',
      studentId
    );

    if (!studentId) {
      console.log('No student ID provided, clearing follow-up data');
      this.currentFollowUpData = null;
      return;
    }

    // Get the latest follow-up record for this student
    this.student_Service_.Get_student_current_followup(studentId).subscribe({
      next: (response: any) => {
        console.log('Follow-up data response:', response);

        let followUpData: any = null;

        // Handle different response structures
        if (Array.isArray(response) && response.length > 0) {
          if (Array.isArray(response[0]) && response[0].length > 0) {
            followUpData = response[0][0]; // Your typical structure: response[0][0]
          } else if (response[0] && typeof response[0] === 'object') {
            followUpData = response[0]; // response[0] is the object
          }
        } else if (
          response &&
          typeof response === 'object' &&
          !Array.isArray(response)
        ) {
          followUpData = response; // Direct object response
        }

        // Just store the data, don't show any UI
        this.currentFollowUpData = followUpData;

        if (followUpData && Object.keys(followUpData).length > 0) {
          console.log('Follow-up data loaded silently:', {
            Branch_ID: followUpData.Branch_ID || followUpData.Branch_Id,
            Department_ID:
              followUpData.Department_ID || followUpData.Department_Id,
            Staff_ID: followUpData.Assigned_Staff_ID,
            Status_ID: followUpData.Follow_Up_Status_ID,
            Next_Date: followUpData.Next_Follow_Up_Date,
            Remark: followUpData.Remark,
          });
          this.nextFollowUpDate =
            followUpData.Next_Follow_Up_Date || this.getCurrentDate();
        } else {
          console.log('No existing follow-up data found');
          this.nextFollowUpDate = this.getCurrentDate();
        }
      },
      error: (error: any) => {
        console.error('Error loading follow-up data:', error);
        this.currentFollowUpData = null;
      },
    });
  }
  getCurrentFollowUpDataForSave(): any {
    if (!this.currentFollowUpData) {
      return null;
    }

    return {
      Branch_Id:
        this.currentFollowUpData.Branch_ID ||
        this.currentFollowUpData.Branch_Id ||
        null,
      Branch_Name: this.currentFollowUpData.Branch_Name || '',
      Department_Id:
        this.currentFollowUpData.Department_ID ||
        this.currentFollowUpData.Department_Id ||
        null,
      Department_Name: this.currentFollowUpData.Department_Name || '',
      Assigned_Staff_ID: this.currentFollowUpData.Assigned_Staff_ID || null,
      Assigned_Staff_Name: this.currentFollowUpData.Assigned_Staff_Name || '',
      Follow_Up_Status_ID: this.currentFollowUpData.Follow_Up_Status_ID || null,
      Follow_Up_Status_Name:
        this.currentFollowUpData.Follow_Up_Status_Name || '',
      Next_Follow_Up_Date: this.currentFollowUpData.Next_Follow_Up_Date || null,
      Remark: this.currentFollowUpData.Remark || '',
      Created_Date:
        this.currentFollowUpData.Created_Date ||
        new Date().toISOString().split('T')[0],
      Delete_Status: 0,
    };
  }

  // Method to populate follow-up form with existing data
  populateFollowUpForm(followUpData: any): void {
    console.log('=== Populating follow-up form with data:', followUpData);

    try {
      // Find and set Branch
      if (followUpData.Branch_ID || followUpData.Branch_Id) {
        const branchId = followUpData.Branch_ID || followUpData.Branch_Id;
        this.Search_Branch =
          this.Search_Branch_Data?.find(
            (branch) =>
              branch.Branch_ID === branchId || branch.Branch_Id === branchId
          ) || null;
        console.log('Set Search_Branch:', this.Search_Branch);
      }

      // Find and set Department
      if (followUpData.Department_ID || followUpData.Department_Id) {
        const deptId = followUpData.Department_ID || followUpData.Department_Id;
        this.Search_Department =
          this.Search_Department_Data?.find(
            (dept) =>
              dept.Department_ID === deptId || dept.Department_Id === deptId
          ) || null;
        console.log('Set Search_Department:', this.Search_Department);
      }

      // Find and set Staff
      if (followUpData.Assigned_Staff_ID) {
        this.Search_staff =
          this.staffData?.find(
            (staff) =>
              staff.User_ID === followUpData.Assigned_Staff_ID ||
              staff.Staff_ID === followUpData.Assigned_Staff_ID
          ) || null;
        console.log('Set Search_staff:', this.Search_staff);
      }

      // Find and set Status
      if (followUpData.Follow_Up_Status_ID) {
        this.Search_status =
          this.followUpStatusData?.find(
            (status) =>
              status.Status_ID === followUpData.Follow_Up_Status_ID ||
              status.Status_Id === followUpData.Follow_Up_Status_ID
          ) || null;
        console.log('Set Search_status:', this.Search_status);
      }

      // Set Next Follow-up Date
      if (followUpData.Next_Follow_Up_Date) {
        // Format date for input field (YYYY-MM-DD)
        const date = new Date(followUpData.Next_Follow_Up_Date);
        if (!isNaN(date.getTime())) {
          this.nextFollowUpDate = date.toISOString().split('T')[0];
        }
        console.log('Set nextFollowUpDate:', this.nextFollowUpDate);
      }

      // Set Remark
      if (followUpData.Remark) {
        this.remark = followUpData.Remark;
        console.log('Set remark:', this.remark);
      }

      console.log('Follow-up form populated successfully');
    } catch (error) {
      console.error('Error populating follow-up form:', error);
      this.resetFollowUpForm();
    }
  }

  Delete_student(student_Id, index) {
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
        this.student_Service_.Delete_student(student_Id).subscribe(
          (Delete_status) => {
            if (Delete_status[0].Student_ID > 0) {
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
  setStudentDetails(student) {
    const student_Id = student.Student_ID;
    if (student.First_Name && student.Last_Name) {
      this.studentName = student.First_Name + ' ' + student.Last_Name;
      this.View_courses(student_Id);
    } else {
      this.studentName = '';
      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Please Fill All The Student details Before Enrole',
          Type: '3',
        },
      });
    }
  }
  View_courses(Student_ID, viewChange = true) {
    this.selectedTime = '';
    this.selectedSlot = null;
    this.optedCourseId = null;
    this.isLoading = true;
    this.student_Service_
      .getCoursesByStudentId(Student_ID)
      .subscribe((result) => {
        this.courseList = result;
        if (viewChange) {
          this.view = 'courses';
        }
        if (result.length) {
          if (result[0]['start_time'] && result[0]['end_time']) {
            this.selectedTime =
              result[0]['start_time'] + ' - ' + result[0]['end_time'];
          }
          this.selectedSlot = result[0].Slot_Id;
          this.slotDetails = {
            Teacher_Name: result[0]['Teacher_Name_One_On_One'],
            start_time: result[0]['start_time'],
            end_time: result[0]['end_time'],
          };
          this.optedCourseId = result[0].Course_ID;
        }
        if (this.view != 'courses' && result.length) {
          this.student_Course.patchValue({
            Student_ID: Student_ID,
            Course_ID: result[0] ? result[0].Course_ID : 0,
            Batch_ID: result[0] ? result[0].Batch_ID : 0,
            Slot_Id: result[0] ? result[0].Slot_Id : 0,
            StudentCourse_ID: result[0] ? result[0].StudentCourse_ID : 0,
            Price: result[0] ? result[0].Price : 0,
            Payment_Method: 'admin',
          });
        } else {
          this.student_Course.patchValue({
            Student_ID: Student_ID,
          });
          this.isLoading = false;
        }

        if (result.length > 0) {
          this.StudentFees_Service_.Get_FeesByStudentCourse(
            Student_ID,
            this.courseList[0].Course_ID
          ).subscribe((result) => {
            if (result.length > 0) {
              this.fees_updated_status = true;
              const Fee_Type = result[0]?.Fee_Type;

              const totalRemainingAmount = result.reduce((sum, fee) => {
                return sum + parseFloat(fee.Remaining_Amount);
              }, 0);

              this.installment_label = Fee_Type;

              if (totalRemainingAmount > 0) {
                this.feesForm.get('Fee_Status')?.setValue('Pending');
              } else {
                this.feesForm.get('Fee_Status')?.setValue('Paid');
              }
              this.feesForm.get('Total_Amount')?.setValue(totalRemainingAmount);
              this.feesForm
                .get('Installment_information_ID')
                ?.setValue(Fee_Type);

              this.installments = result.map((fee) => ({
                ...fee,
                Amount: parseFloat(fee.Total_Amount), // <-- this is the key
                DueDate: fee.Due_Date ? fee.Due_Date.split('T')[0] : '', // trim time portion
                Duration: fee.Duration,
              }));
              this.Student_Fees_IDs = result.map((fee) => fee.Student_Fees_ID);
            }
          });
        }
      });
  }
  onSlotChange(event: any) {
    const selectedSlotId = event.target.value;
    const selectedSlotInfo = this.available_Time_Slots.find(
      (slot) => slot.Slot_Id.toString() == selectedSlotId
    );

    if (selectedSlotInfo) {
      this.slotDetails = selectedSlotInfo;
    } else {
      this.slotDetails = '';
    }
    console.log('   this.slotDetails: ', this.slotDetails);
  }
  onBatchChange(event: any) {
    const selectedBatchId = event.target.value;
    const selectedBatchInfo = this.batch_Data.find(
      (batch) => batch.Batch_ID.toString() == selectedBatchId
    );

    if (selectedBatchInfo) {
      this.batchDetails = selectedBatchInfo;
    } else {
      this.batchDetails = '';
    }
    console.log('this.batchDetails: ', this.batchDetails);
  }
  Enrole_Course(): void {
    console.log(' this.student_Course: ', this.student_Course);
    const formValue = this.student_Course.value;
    const courseId = Number(formValue.Course_ID);
    const Price = formValue.Price;
    const slotId = Number(formValue.Slot_Id);
    const StudentCourse_ID = Number(formValue.StudentCourse_ID);
    const Batch_ID = Number(formValue.Batch_ID);

  //  const Fee_Amount = Number(formValue.Fee_Amount);
  //   const Discount = Number(formValue.Discount);
  //   const Total_FeeAmount = Number(formValue.Total_Amount);
    
    this.student_Course.patchValue({
      Course_ID: courseId,
      StudentCourse_ID: StudentCourse_ID,
      Slot_Id: slotId,
      Batch_ID: Batch_ID,
      // Fee_Amount: Fee_Amount,
      // Discount: Discount,
      // Total_FeeAmount: Total_FeeAmount,

    });
    this.student_Course.get('Price')?.setValue(Price);
    console.log(this.student_Course);

    if (this.student_Course.valid) {
      this.student_Service_
        .enroleCourse(this.student_Course.value)
        .subscribe((res) => {
          console.log('res: ', res);
          if (res[0].Course_ID_) {
            const dialogRef = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: { Message: 'Saved', Type: 'false' },
            });
            this.pageLoad();
          }
        });
    }
  }

  onCourseChange() {
    this.currentPage = 1;
    this.selectedBatchId = null;
    this.Search_student();
    console.log('this.selectedCourseId: ', this.selectedCourseId);
    if (this.selectedCourseId) {
      this.course_Service_
        .get_course_Batches(this.selectedCourseId)
        .subscribe((res) => {
          this.Batch_List = res;
        });
    } else {
      this.Batch_List = [];
    }
  }

  openAddResultModal(item: any) {
    this.newExamResult.Course_Id = item.Course_ID;
    this.newExamResult.Batch_Id = item.Batch_ID ? item.Batch_ID : 0;
    this.newExamResult.Batch_Name = item.Batch_Name ? item.Batch_Name : 0;
    this.newExamResult.Student_ID = item.Student_ID ? item.Student_ID : 0;
    console.log('this.newExamResult: ', this.newExamResult);
    this.search_results();
  }
  search_results() {
    this.course_Service_
      .get_Examof_Course(this.newExamResult.Course_Id)
      .subscribe((res) => {
        this.student_Service_
          .Get_Student_Exam_Results(
            this.newExamResult.Student_ID,
            this.newExamResult.Course_Id
          )
          .subscribe((res) => {
            console.log('res: ', res);
            this.examResults = res;
          });
        this.examsList = res;
        this.view = 'Add_Result';
      });
  }
  addExamResult() {
    console.log('this.newExamResult: ', this.newExamResult);
    this.newExamResult.Exam_Name = this.Student_Exam_Name;
    if (this.newExamResult.Batch_Id) {
      // if (this.newExamResult.Exam_ID && this.newExamResult.Batch_Id ) {

      this.student_Service_
        .Insert_Student_Exam_Result(this.newExamResult)
        .subscribe((Res) => {
          console.log('Res: ', Res);
          this.search_results();

          this.resetForm();
        });
    }
  }
  Generate_certificate(student_data, value) {
    this.currentStudent = student_data;
    this.student_Service_
      .Generate_certificate(student_data.StudentCourse_ID, value)
      .subscribe((Res) => {
        console.log('Res: ', Res);
        this.View_courses(student_data.Student_ID);
      });
  }

  resetForm() {
    this.newExamResult = {
      StudentExam_ID: 0,
      Exam_ID: null,
      Batch_Id: this.newExamResult.Batch_Id,
      Content_Name: this.newExamResult.Content_Name,
      Batch_Name: this.newExamResult.Batch_Name,
      Student_ID: this.newExamResult.Student_ID,
      Course_Id: this.newExamResult.Course_Id,
      Listening: '',
      Result_Date: null,
      Reading: '',
      Writing: '',
      Speaking: '',
      Overall_Score: '',
      CEFR_level: '',
      Exam_Name: '',
    };
    this.Student_Exam_Name = '';
  }
  onExamChange(event: Event) {
    const selectedExamId = (event.target as HTMLSelectElement).value;
    const selectedExam = this.examsList.find(
      (exam) => exam.Exam_ID === +selectedExamId
    );
    console.log('selectedExam: ', selectedExam);
    if (selectedExam) {
      this.newExamResult.Content_Name = selectedExam.Content_Name;
    } else {
      this.newExamResult.Content_Name = null; // or any default value
    }
  }
  assignBatch(studentData) {
    console.log('studentData: ', studentData);
    this.router.navigate(['admin/course'], {
      queryParams: {
        Course_Id: studentData?.Course_ID,
        student_id: studentData?.Student_ID,
      },
    });
  }
  updateCertificateStatus(item: any, isChecked: boolean) {
    if (item) {
      item.Certificate_Issued = isChecked;
      this.Generate_certificate(item, isChecked ? 1 : 0);
    }
  }
  editResult(result) {
    this.newExamResult = result;
    this.Student_Exam_Name = result.Exam_Name;
    console.log(' this.newExamResult: ', this.newExamResult);
  }
  deleteResult(StudentExam_ID) {
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
        this.student_Service_
          .delete_Student_Exam_result(StudentExam_ID)
          .subscribe((Res) => {
            console.log('Res: ', Res);
            this.search_results();
          });
      }
    });
  }

  async viewCertificate(data: any) {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    if (this.isInitializing) {
      this.resetTimeout = setTimeout(() => {
        this.isInitializing = false;
        this.viewCertificate(data);
      }, 500);
      return;
    }

    this.isInitializing = true;
    let printWindow: Window | null = null;
    let cleanupComplete = false;

    try {
      this.currentStudent = data;
      await this.forceViewRefresh();

      printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }

      // Define inline styles as constants
      const certificateStyles = `
      .certificateContainer {
        width: 100%;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: white;
      }
      .certificate-template {
        width: 100%;
        height: 100%;
        position: relative;
      }
      .certificate-template img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .certificate-content {
        position: absolute;
        top: 58%;
        left: 68%;
        transform: translate(-50%, -50%);
        text-align: center;
        width: 60%;
      }
      .certificate-name {
        font-size: 38px;
        font-weight: bold;
        margin-bottom: 20px;
        color: #000;
      }
      .certificate-text {
        font-size: 18px;
        color: #000;
        line-height: 1.5;
      }
    `;

      const printStyles = `
      @page {
        size: landscape;
        margin: 0mm;
      }
      html, body {
        width: 100%;
        height: 100vh;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      #certificateContainer {
        page-break-inside: avoid;
      }
      .print-container {
        width: 100%;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    `;

      // Write content to print window with inline styles
      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Certificate</title>
          <style>
            ${printStyles}
            ${certificateStyles}
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="certificateContainer certificate-template">
              <img src="assets/images/certificate.jpg" alt="Certificate background" />
              <div class="certificate-content">
                <div class="certificate-name">
                  ${this.currentStudent.name}
                </div>
                <div class="certificate-text">
                  Has successfully completed the <b>${this.currentStudent.Course_Name}</b> at Trackbox, demonstrating proficiency and commitment to advancing their language and career skills.
                </div>
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
      console.error('Error printing certificate:', error);
      if (printWindow) {
        printWindow.close();
      }
      this.handleError();
    }
  }

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
  async downloadCertificate(data) {
    this.currentStudent = data;
    await this.forceViewRefresh();
    if (this.isGenerating) return;

    const element = document.getElementById('certificateContainer');
    if (!element) return;

    this.isGenerating = true;

    try {
      // Convert the HTML element to canvas with higher resolution
      const canvas = await html2canvas(element, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        windowWidth: 2480,
        windowHeight: 1754,
        onclone: (document) => {
          const style = document.createElement('style');
          style.innerHTML = `
          @font-face {
            font-family: 'Arial';
            font-weight: normal;
            font-style: normal;
          }
        `;
          document.head.appendChild(style);
        },
      });

      // const pdf = new jsPDF({
      //   orientation: 'landscape',
      //   unit: 'mm',
      //   format: 'a4',
      //   compress: true,
      //   hotfixes: ['px_scaling'],
      // });

      const pageWidth = 297;
      const pageHeight = 210;
      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      // pdf.addImage(
      //   imgData,
      //   'JPEG',
      //   0,
      //   0,
      //   pageWidth,
      //   pageHeight,
      //   undefined,
      //   'FAST'
      // );

      const fileName =
        `${this.currentStudent.name}_${this.currentStudent.Course_Name}_Certificate.pdf`
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_\.]/g, '');

      // pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      this.isGenerating = false;
    }
  }
  onCountryChange(country: ICountry) {
    // Update the form with the selected country code
    this.student_Form.patchValue({
      Country_Code: country.dialling_code,
      Country_Code_Name: country.code,
    });

    console.log('Selected Country:', country);
    console.log('Country Code:', country.dialling_code);
  }

  // Optional: Method to get the selected country code
  getSelectedCountryCode(): string {
    return this.student_Form.get('Country_Code')?.value;
  }
  ngOnDestroy() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
  }

  selectedStudentForDocuments: any = null;

  openStudentDocuments(student: any): void {
    this.selectedStudentForDocuments = student;
    this.view = 'Student_Documents';
  }

  // openStudentDocuments(student: any): void {
  //   this.view = 'Student_Documents';
  // this.dialog.open(StudentDocumentsComponent, {
  //   width: '600px',
  //   data: { student }
  // });
  // }

  Save_student() {
    console.log('feesForm', this.feesForm);
    console.log('installments', this.installments);
    console.log('this.student_Form', this.student_Form);
    ;
    // Check if this is a follow-up only save from list view
    if (this.view === 'followup' && this.selectedStudentForFollowup) {
      ;
      return this.saveFollowUpFromList();
    }

    // Original student form validation for edit view|| !this.student_Course.valid
    if (!this.student_Form.valid) {
      this.student_Form.markAllAsTouched();
      this.student_Course.markAllAsTouched();
      return;
    }

    const email = this.student_Form.get('Email')?.value;
    const phone = this.student_Form.get('Phone_Number')?.value;

    if (!email && !phone) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Please provide either an Email or a Phone Number',
          Type: '3',
        },
      });
      return;
    }

    if (email && !this.isValidEmail(email)) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please provide a valid Email address', Type: '3' },
      });
      return;
    }

    // Prepare follow-up data
    const followUpData = this.getFollowUpData();

    // Merge follow-up fields into student form value before saving
    const studentPayload = {
      ...this.student_Form.value,
      ...followUpData,
      Installments: this.installments,
      Student_Fees_IDs: this.Student_Fees_IDs,
      Sender_Email: localStorage.getItem('Email'),
      Sender_Name: localStorage.getItem('Name'),
    };

    if (
      this.showFollowUpSection &&
      !this.student_Form.get('Student_ID')?.value
    ) {
      const followUpValidationResult = this.validateFollowUpSection();
      if (!followUpValidationResult.isValid) {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: followUpValidationResult.message,
            Type: '3',
          },
        });
        return;
      }
    }
    this.isLoading = true;
    // Helper to process save with follow-up
    const saveStudentAndFollowUp$ = (payload: any) =>
      this.student_Service_.Save_student(payload).pipe(
        switchMap((saveStatus) =>
          this.processStudentSaveWithFollowup(saveStatus)
        ),
        catchError((error) => {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: error.error || 'Error occurred', Type: '2' },
          });
          return EMPTY;
        }),
        finalize(() => (this.isLoading = false))
      );

    if (studentPayload.Profile_Photo_Path instanceof File) {
      (this.fileToRemoveAws.length
        ? forkJoin(
            this.fileToRemoveAws.map((key) =>
              from(this.course_Service_.fileToRemoveAws(key))
            )
          )
        : of(null)
      )
        .pipe(
          switchMap(() =>
            from(
              this.student_Service_.uploadFile(
                studentPayload.Profile_Photo_Path,
                studentPayload.First_Name
              )
            )
          ),
          tap((res) => {
            studentPayload.Profile_Photo_Path = res.key;
          }),
          switchMap(() => saveStudentAndFollowUp$(studentPayload))
        )
        .subscribe();
    } else {
      saveStudentAndFollowUp$(studentPayload).subscribe();
    }
  }

  // New method to handle follow-up save from list view
  saveFollowUpFromList() {
    ;
    console.log(
      'this.selectedStudentForFollowup: ',
      this.selectedStudentForFollowup
    );
    if (!this.selectedStudentForFollowup?.Student_ID) {
      ;
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Invalid student selected', Type: '3' },
      });
      return;
    }
    // Validate follow-up mandatory fields
    const followUpValidationResult = this.validateFollowUpSection();
    if (!followUpValidationResult.isValid) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: followUpValidationResult.message,
          Type: '3',
        },
      });
      return;
    }

    this.isLoading = true;
    ;
    this.isLoading = true;
    ;
    // Create a payload that mimics the student save structure but only for follow-up
    const followUpPayload = {
      Student_ID: this.selectedStudentForFollowup.Student_ID,
      // Include existing student data to maintain the same API structure
      First_Name: this.selectedStudentForFollowup.First_Name,
      Last_Name: this.selectedStudentForFollowup.Last_Name,
      Email: this.selectedStudentForFollowup.Email,
      Phone_Number: this.selectedStudentForFollowup.Phone_Number,
      // Add follow-up data
      ...this.getFollowUpData(),
      // Flag to indicate this is follow-up only save
      isFollowUpOnly: true,
    };

    console.log('Follow-up only payload:', followUpPayload);

    // Use the same save structure as regular student save
    this.student_Service_
      .Save_student(followUpPayload)
      .pipe(
        switchMap((saveStatus) => {
          ; // Create a mock save status for follow-up processing
          const mockSaveStatus = [
            {
              Student_ID: this.selectedStudentForFollowup.Student_ID,
              success: true,
            },
          ];
          return this.processStudentSaveWithFollowup(mockSaveStatus);
        }),
        catchError((error) => {
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: error.error || 'Error saving follow-up',
              Type: '2',
            },
          });
          return EMPTY;
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (result) => {
          console.log('Follow-up saved successfully:', result);
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Follow-up saved successfully!', Type: 'false' },
          });

          // Reset form and go back to list
          this.resetFollowUpForm();
          this.view = 'list';
          this.selectedStudentForFollowup = null;
        },
      });
  }


  Status_Change(){

    

  }

  // Updated processStudentSaveWithFollowup to handle both scenarios
  processStudentSaveWithFollowup(Save_status: any) {
    console.log('Processing student save with follow-up:', Save_status);

    // Process student save first (or skip if follow-up only)
    const studentProcessing =
      this.view === 'followup'
        ? of(Save_status) // Skip student processing for follow-up only
        : this.processStudentSave(Save_status);

    return studentProcessing.pipe(
      switchMap(() => {
        // Check if follow-up data needs to be saved
        if (this.shouldSaveFollowUp()) {
          const followUpData = this.prepareFollowUpData(Save_status);
          console.log('Saving follow-up data:', followUpData);
          return this.student_Service_.Save_student_followup(followUpData);
        }
        return of(null);
      })
    );
  }

  // Updated shouldSaveFollowUp to check for both scenarios
  shouldSaveFollowUp(): boolean {
    // Check if any follow-up data is provided
    const hasFollowUpData = !!(
      this.Search_Branch ||
      this.Search_Department ||
      this.Search_staff ||
      this.Search_status ||
      this.nextFollowUpDate ||
      (this.remark && this.remark.trim())
    );

    // For follow-up view, always save if there's any data
    if (this.view === 'followup') {
      return hasFollowUpData;
    }

    // For edit view, save if follow-up section is shown and has data
    return this.showFollowUpSection && hasFollowUpData;
  }

  // Updated prepareFollowUpData to handle both scenarios
  prepareFollowUpData(Save_status: any) {
    const studentId =
      this.view === 'followup'
        ? this.selectedStudentForFollowup?.Student_ID
        : Save_status[0]?.Student_ID ||
          this.student_Form.get('Student_ID')?.value;

    return {
      Student_ID: studentId,
      Branch_ID: this.Search_Branch?.Branch_Id || null,
      Branch_Name: this.Search_Branch?.Branch_Name || '',
      Department_ID: this.Search_Department?.Department_Id || null,
      Department_Name: this.Search_Department?.Department_Name || '',
      Assigned_Staff_ID: this.Search_staff?.User_ID || null,
      Assigned_Staff_Name: this.Search_staff?.First_Name || '',
      Follow_Up_Status_ID: this.Search_status?.Status_Id || null,
      Follow_Up_Status_Name: this.Search_status?.Status_Name || '',
      Next_Follow_Up_Date: this.nextFollowUpDate || null,
      Remark: this.remark?.trim() || '',
      Created_Date: new Date().toISOString().split('T')[0],
      Delete_Status: 0,
    };
  }

  // Updated closeFollowUp method
  closeFollowUp(): void {
    this.view = 'list';
    this.selectedStudentForFollowup = null;
    this.resetFollowUpForm();
    this.showFollowupHistory = false;
    this.followupHistoryList = [];
  }

  resetFollowUpForm(): void {
    console.log('=== resetFollowUpForm called ===');
    this.Search_Branch = null;
    this.Search_Department = null;
    this.Search_staff = null;
    this.Search_status =
      this.followUpStatusData.find(
        (status: any) => status.Status_Name?.toLowerCase() === 'pending'
      ) || null;
    this.nextFollowUpDate = this.getCurrentDate();
    this.remark = '';

    // Also reset follow-up history display
    this.showFollowupHistory = false;
    this.followupHistoryList = [];
    this.loadingFollowupHistory = false;
  }

  openFollowUp(student: any): void {
    console.log('=== openFollowUp called ===');
    console.log('Student parameter received:', student);

    if (!student || !student.Student_ID) {
      console.error('Invalid student data:', student);
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Invalid student data', Type: '3' },
      });
      return;
    }

    // Clone selected student
    this.selectedStudentForFollowup = JSON.parse(JSON.stringify(student));
    console.log(
      'selectedStudentForFollowup set to:',
      this.selectedStudentForFollowup
    );

    // Change view
    this.view = 'followup';

    // Ensure dropdown data is loaded
    this.loadFollowupData();

    // Reset the form (optional if you're clearing previous session)
    this.resetFollowUpForm();

    // 🔽 Populate follow-up form fields if data is present
    const studentBranchId = student.Branch_Id || student.Branch_ID;
    this.Search_Branch = this.Search_Branch_Data.find(
      (b) => (b.Branch_Id || b.Branch_ID) === studentBranchId
    ) || this.Search_Branch_Data[0];

    const studentDeptId = student.Department_Id || student.Department_ID;
    this.Search_Department = this.Search_Department_Data.find(
      (d) => (d.Department_Id || d.Department_ID) === studentDeptId
    ) || this.Search_Department_Data[0];

    this.Search_staff = this.staffData.find(
      (s) => s.First_Name === student.To_User_Name || s.First_Name === student.Assigned_Staff_Name || s.User_ID === student.Assigned_Staff_ID
    ) || this.staffData[0];

    const studentStatusId = student.Status_Id || student.Status_ID || student.Followup_Status || student.Follow_Up_Status_ID;
    this.Search_status = this.followUpStatusData.find(
      (s) => (s.Status_Id || s.Status_ID) === studentStatusId
    ) || this.followUpStatusData[0];

    this.nextFollowUpDate = student.Follow_Up_Date
      ? this.formatDateForInput(student.Follow_Up_Date)
      : this.getCurrentDate(); // default to today

    this.remark = '';

    // Load history
    this.loadFollowupHistoryList();
    console.log('=== openFollowUp completed ===');
    
    
  }
  formatDateForInput(date: string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
  }

  // Updated loadFollowupHistoryList to work with selected student
  loadFollowupHistoryList(): void {
    const studentId =
      this.view === 'followup'
        ? this.selectedStudentForFollowup?.Student_ID
        : this.student_Form.get('Student_ID')?.value;

    if (!studentId) {
      console.log('No student ID found');
      return;
    }

    console.log('Loading follow-up history for student ID:', studentId);
    this.loadingFollowupHistory = true;
    this.followupHistoryList = [];

    this.student_Service_.Get_student_followup_history(studentId).subscribe({
      next: (response: any) => {
        console.log('Follow-up history response:', response);

        let historyData: any[] = [];

        if (
          Array.isArray(response) &&
          response.length > 0 &&
          Array.isArray(response[0])
        ) {
          historyData = response[0];
        } else if (Array.isArray(response)) {
          historyData = response;
        } else {
          console.log('Unexpected response structure:', response);
          historyData = [];
        }

        console.log('Extracted history data:', historyData);
        this.followupHistoryList = historyData;

        // Sort by created date (newest first)
        if (this.followupHistoryList.length > 0) {
          this.followupHistoryList.sort((a: any, b: any) => {
            const dateA = new Date(a.Created_Date || a.created_date || '').getTime();
            const dateB = new Date(b.Created_Date || b.created_date || '').getTime();
            if (dateA !== dateB) {
              return dateB - dateA;
            }
            const idA = a.Follow_Up_ID || a.Followup_ID || a.Follow_up_ID || 0;
            const idB = b.Follow_Up_ID || b.Followup_ID || b.Follow_up_ID || 0;
            return idB - idA;
          });
        }

        this.loadingFollowupHistory = false;
        console.log(
          'Final processed follow-up history:',
          this.followupHistoryList
        );
         const history = this.followupHistoryList[0];

          this.Search_Branch = this.Search_Branch_Data.find(b => (b.Branch_Id || b.Branch_ID) === (history.Branch_Id || history.Branch_ID)) || this.Search_Branch;
          this.Search_Department = this.Search_Department_Data.find(d => (d.Department_Id || d.Department_ID) === (history.Department_Id || history.Department_ID)) || this.Search_Department;
          this.Search_staff = this.staffData.find(s => s.First_Name === (history.Assigned_Staff_Name || history.To_User_Name)) || this.Search_staff;
          this.Search_status = this.followUpStatusData.find(s => (s.Status_Id || s.Status_ID) === (history.Follow_Up_Status_ID || history.Followup_Status || history.Status_Id)) || this.Search_status;

      },
      error: (error: any) => {
        console.error('Error loading follow-up history:', error);
        this.loadingFollowupHistory = false;
        this.followupHistoryList = [];

        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Unable to load follow-up history. Please try again.',
            Type: '2',
          },
        });
      },
    });
  }

  // Keep your existing formatFollowupDate method as is
  formatFollowupDate(dateString: string): string {
    if (!dateString) {
      return ' ';
    }

    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        return dateString;
      }

      return (
        date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }) +
        ' ' +
        date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      );
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  }

 
}
