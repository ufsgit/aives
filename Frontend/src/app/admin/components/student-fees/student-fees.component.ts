import {
  Component,
  EventEmitter,
  inject,
  Inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StudentFeesService } from '../../services/student-fees.service';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { course_Service } from '../../services/course.Service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { log } from 'node:console';
import { SharedModule } from '../../../shared/shared.module';
import { student_Service } from '../../services/student.Service';
import { EmailTemplateService } from '../../services/email-template.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Account_Id: number;
  Receipt_Id: number;
  Tax_Type_Id: number;
  Netvalue: number;
  Gstpers: number;
  Cgstpers: number;
  Sgstpers: number;
  Gst: number;
  Cgst: number;
  Sgst: number;
  Fine_Amount: number;
  Fee_Type_Name?: string;
}

@Component({
  selector: 'app-student-fees',
  standalone: true,
  templateUrl: './student-fees.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatDialogModule,
    MatTableModule,
    MatTabsModule,
    SharedModule,
  ],
  styleUrls: ['./student-fees.component.scss'],
})
export class StudentFeesComponent {
  @Input() feesDetails: FormGroup;
  @Input() isEditMode: boolean = false;
  @Output() cancel = new EventEmitter<number | undefined>();

  constructor(
    private fb: FormBuilder,
    private feesService: StudentFeesService
  ) {
    this.initForm();
  }

  feeTypes = ['OneTime', 'TwoTime', 'ThreeTime', 'FourTime'];
  availableFeeTypes = ['Tuition Fee', 'Exam Fee', 'Registration Fee', 'Other Fee'];
  feesForm!: FormGroup;
  feesList: any[] = [];
  allAccounts: any = [];
  alltaxtypes: any = [];
  allPaymentMode: any = [];
  installments: any[] = [];
  course_Service_ = inject(course_Service);
  dialogBox = inject(MatDialog);
  isLoading: boolean = false;
  courseCategoryData = signal([]);
  teacherDatas = signal([]);
  ModuleDatas = signal([]);
  daysDatas = signal([]);
  allDaysDatas = signal([]);
  SectionsDatas = signal([]);
  VisibilityDatas = signal([]);
  searchTerm: string = '';
  course_Data: any;
  selectedTabIndex = 0;
  payFeeStatus: boolean = false;
  selectedAccount: any = {};
  selectedtaxtypes: any = {};
  finePerDay: number = 0;
  defaultFine: number = 0; // Will be set from DB
  emailTemplates: any[] = [];
  selectedTemplateId: number | null = null;
  studentService = inject(student_Service);
  emailTemplateService = inject(EmailTemplateService);


  Tax_type_Id: number = 1; // default value
  Tax_type_name: string = 'With Tax'; // default value
  areAllAccountsSelected(): boolean {
    return this.feesList.every((fee) => !!fee.Account_Id);
  }

  ngOnInit(): void {
    this.initForm();
    // this.getAccounts();
    this.gstalltaxtypes();
    this.Get_All_PaymentMode();
    console.log('isEditMode:', this.isEditMode);
    console.log('Loading fees for this.feesDetails:', this.feesDetails.value);
    if (!this.isEditMode) {
      this.loadFeesList();
    } else {
      this.loadReceiptFeesList();
    }
    this.fetchFineAmount();
    this.loadEmailTemplates();
  }

  loadEmailTemplates() {
    this.emailTemplateService.searchTemplates('').subscribe((res) => {
      this.emailTemplates = res || [];
      if (!this.selectedTemplateId && this.emailTemplates.length > 0) {
        const regTemplate = this.emailTemplates.find(
          (t: any) =>
            (t.Template_Name && t.Template_Name.trim().toLowerCase().includes('Welcome mail with receipt')) ||
            (t.Subject && t.Subject.trim().toLowerCase().includes('Welcome mail with receipt'))
        );
        if (regTemplate) {
          this.selectedTemplateId = regTemplate.Template_ID;
        }
      }
    });
  }

  sendSelectedEmail(studentId: number, studentName: string = '', courseName: string = '', feeData: any = null, onComplete?: () => void) {
    if (this.selectedTemplateId && studentId) {
      // We might need to fetch the student's email first if it's not available
      this.studentService.Get_student(studentId).subscribe({
        next: (studentData: any) => {
          const student = studentData?.[0]?.[0];
          if (student && student.Email) {
            const studentFullName = ((student.First_Name || studentName || '') + ' ' + (student.Last_Name || '')).trim();
            const placeholders = {
              'Student Name': studentFullName || student.First_Name || 'Student',
              'Student_Name': studentFullName || student.First_Name || 'Student',
              'First_Name': student.First_Name || studentName || 'Student',
              'Last_Name': student.Last_Name || '',
              'Lead Name': studentFullName || student.First_Name || 'Student',
              'Course Name': courseName || student.Course_Name || '',
              'Course_Name': courseName || student.Course_Name || '',
              'Roll Number': student.Roll_No || feeData?.RollNumber || '',
              'Roll_No': student.Roll_No || feeData?.RollNumber || '',
              'Payment Amount': `${this.getCurrencySymbol(feeData?.Currency || student?.Currency || this.feesForm?.get('Currency')?.value, true)} ${Number(feeData?.Paid_Amount || feeData?.tempPaidAmount || feeData?.Amount || 0).toFixed(2)}`,
              'Amount': `${this.getCurrencySymbol(feeData?.Currency || student?.Currency || this.feesForm?.get('Currency')?.value, true)} ${Number(feeData?.Paid_Amount || feeData?.tempPaidAmount || feeData?.Amount || 0).toFixed(2)}`,
              'Transaction ID': feeData?.Transaction_ID || feeData?.Transaction_Id || '-',
            };

            let attachments: any[] = [];
            if (feeData) {
              try {
                const base64Pdf = this.generateReceiptPDFBase64(student, feeData);
                if (base64Pdf) {
                  const fileName = `Payment_Receipt_${(student.First_Name || 'Student').replace(/\s+/g, '_')}.pdf`;
                  attachments.push({
                    name: fileName,
                    content: base64Pdf
                  });
                }
              } catch (err) {
                console.error('Error generating PDF receipt attachment:', err);
              }
            }

            this.emailTemplateService.sendTemplateEmail(this.selectedTemplateId!, student.Email, placeholders, attachments).subscribe({
              next: (res) => {
                console.log('Email sent successfully', res);
                this.dialogBox.open(DialogBox_Component, {
                  panelClass: 'Dialogbox-Class',
                  data: { Message: 'Email sent successfully with payment receipt attachment!', Type: 'false' },
                });
                if (onComplete) onComplete();
              },
              error: (err) => {
                console.error('Error sending email', err);
                if (onComplete) onComplete();
              }
            });
          } else {
            if (onComplete) onComplete();
          }
        },
        error: (err) => {
          console.error('Error fetching student for email', err);
          if (onComplete) onComplete();
        }
      });
    } else {
      if (onComplete) onComplete();
    }
  }

  getCurrencySymbol(currencyStr: string, forPdf: boolean = false): string {
    const currency = (currencyStr || 'INR').toUpperCase().trim();

    if (currency === 'AED') return 'AED';
    if (currency === 'INR') return forPdf ? 'Rs.' : '₹';
    if (currency === 'EUR' || currency === 'EURO') return forPdf ? 'EUR' : '€';
    if (currency === 'USD') return '$';
    if (currency === 'GBP') return '£';
    if (currency === 'AUD') return 'A$';
    return currency;
  }

  generateReceiptPDFBase64(student: any, feeData: any): string {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargin = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AIVES Australia Testprep', pageMargin, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(
      'Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3, NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032',
      pageWidth - 2 * pageMargin
    );
    doc.text(addressLines, pageMargin, 24);

    doc.setLineWidth(0.5);
    doc.line(pageMargin, 34, pageWidth - pageMargin, 34);

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 43, { align: 'center' });

    // Details Section
    const formattedPaymentDate = feeData?.Payment_Date
      ? new Date(feeData.Payment_Date).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB');

    const studentName = ((student?.First_Name || '') + ' ' + (student?.Last_Name || '')).trim() || 'Student';
    const phone = student?.Phone_Number || student?.MobileNo || '-';
    const course = feeData?.Course_Name || student?.Course_Name || '-';
    const transactionId = feeData?.Transaction_ID || feeData?.Transaction_Id || '-';
    const paymentMode = feeData?.Payment_Mode || feeData?.Payment_mode || '-';

    autoTable(doc, {
      startY: 48,
      margin: { left: pageMargin, right: pageMargin },
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      body: [
        [{ content: 'Student Name:', fontStyle: 'bold' }, studentName, { content: 'Payment Date:', fontStyle: 'bold' }, formattedPaymentDate],
        [{ content: 'Phone Number:', fontStyle: 'bold' }, phone, { content: 'Course:', fontStyle: 'bold' }, course]
      ]
    });

    const detailsFinalY = (doc as any).lastAutoTable?.finalY || 70;

    // Payment Breakdown Table
    const paidAmount = Number(feeData?.Paid_Amount || feeData?.tempPaidAmount || feeData?.Amount || feeData?.Total_Amount || 0);
    const fineAmount = Number(feeData?.Fine_Amount || 0);
    const totalAmount = paidAmount + fineAmount;

    const currencySymbol = this.getCurrencySymbol(feeData?.Currency || student?.Currency || this.feesForm?.get('Currency')?.value || 'INR', true);

    const tableBody: any[][] = [
      ['Fee Amount', `${currencySymbol} ${paidAmount.toFixed(2)}`]
    ];

    if (fineAmount > 0) {
      tableBody.push(['Late Fine Applied', `${currencySymbol} ${fineAmount.toFixed(2)}`]);
    }

    tableBody.push(['Total Amount Paid', `${currencySymbol} ${totalAmount.toFixed(2)}`]);

    autoTable(doc, {
      startY: detailsFinalY + 5,
      margin: { left: pageMargin, right: pageMargin },
      head: [['Description', 'Amount']],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [51, 122, 183], textColor: [255, 255, 255], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    const breakdownFinalY = (doc as any).lastAutoTable?.finalY || detailsFinalY + 40;

    // Terms & Conditions
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms and Conditions:', pageMargin, breakdownFinalY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('1. This receipt is subject to realisation of cheque.', pageMargin, breakdownFinalY + 18);
    doc.text('2. This receipt should be carefully preserved and produced on demand.', pageMargin, breakdownFinalY + 23);
    doc.text('3. Fees once paid are non-refundable/non-transferable under any circumstances.', pageMargin, breakdownFinalY + 28);

    // Bottom Statement (Computer-generated payment receipt)
    const statementY = breakdownFinalY + 40;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const statementText = 'This is a computer-generated payment receipt and does not require a signature.';
    const textWidth = doc.getTextWidth(statementText);
    const textX = (pageWidth - textWidth) / 2;
    doc.text(statementText, textX, statementY);

    return doc.output('datauristring').split(',')[1];
  }

  fetchFineAmount() {
    this.feesService.Get_Late_Fee_Amount().subscribe({
      next: (res: any) => {
        if (res.success) {
          this.defaultFine = res.amount;
        }
      },
      error: (err) => {
        console.error('Error fetching fine amount:', err);
        this.defaultFine = 200; // Fallback to ₹200 if DB call fails
      }
    });
  }


  initForm(): void {
    this.feesForm = this.fb.group({
      Installment_information_ID: ['', Validators.required],
      Total_Amount: ['', Validators.required],
      Paid_Amount: ['', Validators.required],
      Fee_Status: ['Pending', Validators.required],
      Payment_Date: [new Date(), Validators.required],
      Due_Date: [''],
      Payment_Mode: ['ADMIN'],
      Transaction_ID: [''],
      Course_Name: [''],
      Course_ID: [''], // ✅ missing - now added
      Student_ID: [''], // ✅ missing - now added
      Student_Fees_ID: [null],
      update_status: [false], // ✅ missing - now added
      Receipt_Id: [''], // ✅ missing - now added
    });
  }

  loadReceiptFeesList(): void {
    const Receipt_id = this.feesDetails?.get('Receipt_Id')?.value;
    if (!Receipt_id) {
      console.warn('Receipt_Id not available in feesDetails');
      return;
    }

    // Fetch payment modes first to ensure we can map them
    this.feesService.Get_All_PaymentMode().subscribe((paymentModes) => {
      this.allPaymentMode = paymentModes;
      
      this.feesService.Get_FeesByReceipt_ID(Receipt_id).subscribe(
        (res) => {
          console.log('Fees list response:', res);
          
          if (res.length > 0) {
            const selectedPaymentmode = res[0].Payment_mode;
            const paymentMode = this.allPaymentMode.find(
              (pm: any) =>
                pm.Payment_Name.toUpperCase() === (selectedPaymentmode || '').toUpperCase()
            );

            if (paymentMode && paymentMode.Payment_Id) {
              this.getAccounts(paymentMode.Payment_Id);
            }

            this.feesList = res.map((fee: any) => {
              const date = new Date(fee.Payment_Date);
              const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
              
              return {
                ...fee,
                tempPaidAmount: parseFloat(fee.Amount),
                Payment_Date: localDate.toISOString().split('T')[0],
                Payment_Mode: fee.Payment_mode || '',
                Transaction_ID: fee.Transaction_ID || '',
                Account_Id: Number(fee.Account_Id) || null,
                Tax_Type_Id: Number(fee.Tax_Type_Id) || null,
                Payment_Id: paymentMode?.Payment_Id || null,
              };
            });
          }
        },
        (err) => {
          console.error('Error loading fee list:', err);
        }
      );
    });
  }
  updateFee() {
    if (this.feesList.length > 0 && this.feesList[0].Receipt_Id > 0) {
      var netValue = 0,
        gstpers = 18,
        cgstpers = 9,
        sgstpers = 9,
        gst = 0,
        cgst = 0,
        sgst = 0,
        paid = 0;
      paid = this.feesList[0].tempPaidAmount;
      if (this.feesList[0].Tax_Type_Id == 1) {
        netValue = (paid * 100) / (100 + gstpers);
        gst = paid - netValue;
        cgst = gst / 2;
        sgst = gst / 2;
      } else {
        netValue = paid;
        gst = paid - netValue;
        cgst = gst / 2;
        sgst = gst / 2;
      }

      const feeData = this.feesList[0];
      const selectedPaymentId = feeData.Payment_Id;
      const paymentMode = this.allPaymentMode.find(
        (pm: any) => +pm.Payment_Id === +selectedPaymentId
      );

      const updatedFee = {
        Receipt_Id: feeData.Receipt_Id,
        Student_Id: feeData.Student_Id,
        Amount: feeData.tempPaidAmount,
        Entry_Date: feeData.Entry_Date || feeData.entry_date || feeData.entry_Date,
        User_Id: feeData.User_Id || feeData.user_id || feeData.User_id,
        Branch: feeData.Branch || feeData.branch || 0,
        Account_Id: feeData.Account_Id,
        Payment_mode: paymentMode ? paymentMode.Payment_Name : (feeData.Payment_Mode || feeData.Payment_mode || ''),
        Transaction_ID: feeData.Transaction_ID,
        Tax_Type_Id: feeData.Tax_Type_Id,
        Netvalue: netValue,
        Gstpers: gstpers,
        Cgstpers: cgstpers,
        Sgstpers: sgstpers,
        Gst: gst,
        Cgst: cgst,
        Sgst: sgst,
        Payment_Date: feeData.Payment_Date,
        Fine_Amount: this.calculateFine(feeData),
        Course_Name: feeData.Course_Name || feeData.course_Name || feeData.course_Name_ || '',
        Fee_Type_Name: feeData.Fee_Type_Name || ''
      };
      this.feesService.Update_FeesByReceipt_ID(updatedFee).subscribe(
        (res) => {
          this.loadFeesList();
          this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: {
              Message: 'Receipt saved.',
              Type: 'false',
              Heading: 'UPDATED',
            },
          });
          this.sendSelectedEmail(updatedFee.Student_Id, '', updatedFee.Course_Name, updatedFee);
          this.onUpdateCancel();
          this.selectedTabIndex = 1;
        },
        (err) => {
          console.error('Error updating fee:', err);
        }
      );
    }
  }

  // Helper method to convert ISO date to yyyy-MM-dd
  convertDateToYyyyMmDd(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toISOString().split('T')[0]; // "2025-07-04"
  }
  // allPaymentMode
  Get_All_PaymentMode() {
    this.feesService.Get_All_PaymentMode().subscribe((res) => {
      this.allPaymentMode = res;
      if (!this.isEditMode && this.feesList.length > 0 && this.feesList[0].Payment_Id) {
        this.getAccounts(this.feesList[0].Payment_Id);
      }
    });
  }
  change_payment(Payment_Id: any) {
    if (Payment_Id) {
      this.getAccounts(+Payment_Id);
      const modeObj = this.allPaymentMode?.find((p: any) => +p.Payment_Id === +Payment_Id);
      if (modeObj && this.feesList?.length > 0) {
        this.feesList[0].Payment_Mode = modeObj.Payment_Name;
      }
    }
  }
  getAccounts(Payment_Id: number): void {
    console.log('Payment_Id', Payment_Id);

    this.feesService.Get_Accounts().subscribe({
      next: (res: any) => {
        console.log('All accounts from API:', res);
        const list = Array.isArray(res) ? res : (res?.[0] || []);

        // Convert to number and filter
        this.allAccounts = list.filter(
          (account: any) => +account.Payment_Id === +Payment_Id
        );

        console.log('Filtered Accounts:', this.allAccounts);
      },
      error: (err) => {
        console.error('Error fetching accounts:', err);
        this.allAccounts = [];
      }
    });
  }

  gstalltaxtypes(): void {
    this.feesService.gstalltaxtypes().subscribe((res) => {
      this.alltaxtypes = res;
    });
  }

  onInstallmentChange(installmentId: number): void {
    const selected = this.installments.find(
      (i) => i.Installment_information_ID === installmentId
    );
    if (selected) {
      this.feesForm.patchValue({ Total_Amount: parseFloat(selected.Amount) });
    }
  }

  setupAutoAmount(): void {
    this.feesForm
      .get('Installment_information_ID')
      ?.valueChanges.subscribe((id) => {
        const selected = this.installments.find(
          (i) => i.Installment_information_ID === id
        );
        if (selected) {
          this.feesForm.patchValue({ Total_Amount: selected.Amount });
        }
      });
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

  getTodayDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const dd = String(today.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  loadFeesList(): void {
    const Student_Fees_ID = this.feesDetails?.get('Student_Fees_ID')?.value;
    console.log('Loading fees for Student_Fees_ID:', Student_Fees_ID);

    if (Student_Fees_ID) {
      this.feesService.Get_FeesByStudent_Fees_ID(Student_Fees_ID).subscribe(
        (res) => {
          console.log('Fees list response:', res);

          const today = this.getTodayDate();

          this.feesList = res.map((fee) => ({
            ...fee,
          // Initialize paid amount with remaining amount passed in form
          tempPaidAmount: this.feesDetails?.get('Paid_Amount')?.value || fee.Remaining_Amount || 0,
          // Format Payment_Date properly or set to today if null
            Payment_Date: today,
            Receipt_Id: 0, // Initialize Receipt_id
            selectedAccount: {}, // Initialize selectedAccount
            selectedtaxtypes: {},
            Tax_Type_Id: 1,
            Fine_Amount: this.calculateFine(fee)
          }));
          if (this.feesList.length > 0 && this.feesList[0].Payment_Id) {
            this.getAccounts(this.feesList[0].Payment_Id);
          }
        },
        (err) => {
          console.error('Error loading fee list:', err);
        }
      );
    } else {
      console.warn('Student_Fees_ID not available in feesDetails');
    }
  }

  Edit_FeesByReceipt_ID(Receipt_id): void {
    this.feesService.Edit_FeesByReceipt_ID(Receipt_id).subscribe(
      (res) => {
        const today = this.getTodayDate();

        this.feesList = res.map((fee) => ({
          ...fee,
          // Initialize paid amount with remaining amount passed in form
          tempPaidAmount: this.feesDetails?.get('Paid_Amount')?.value || fee.Remaining_Amount || 0,
          // Format Payment_Date properly or set to today if null
          Payment_Date: today,

          // Initialize selectedAccount
          selectedAccount: {}, // Initialize selectedAccount
          selectedtaxtypes: {},
          // Format Due_Date too if needed
          // Due_Date: fee.Due_Date
          //   ? new Date(fee.Due_Date).toISOString().substring(0, 10)
          //   : ''
        }));
      },
      (err) => {
        console.error('Error loading fee list:', err);
      }
    );
  }

  Delete_Receipt(fee) {
    this.feesService.Delete_FeesByReceipt_ID(fee.Receipt_Id).subscribe(
      () => {
        console.log('✅ Fee deleted successfully.');
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: {
            Message: 'Fee deleted successfully.',
            Type: 'false',
            Heading: 'DELETED',
          },
        });
        this.onUpdateCancel(); // Refresh the list after deletion
      },
      (err) => {
        console.error('Error deleting fee:', err);
      }
    );
  }
  saveFees(): void {
    ;
    this.isLoading = true;
    console.log(this.selectedAccount, 'selectedAccount');
    if (Object.keys(this.feesForm.value).length > 0) {
      // NEW Receipt
      if (this.feesList.length > 0 && this.feesList[0].Student_Fees_ID > 0) {    
        const remaining =
          this.feesList[0].Total_Amount - this.feesList[0].Paid_Amount;
        var netValue = 0,
          gstpers = 18,
          cgstpers = 9,
          sgstpers = 9,
          gst = 0,
          cgst = 0,
          sgst = 0,
          paid = 0;
        var totalPaid = this.feesList[0].tempPaidAmount;
        var fine = this.calculateFine(this.feesList[0]);
        paid = totalPaid - fine; // Core fee amount

        if (this.feesList[0].Tax_Type_Id == 1) {
          netValue = (paid * 100) / (100 + gstpers);
          gst = paid - netValue;
          cgst = gst / 2;
          sgst = gst / 2;
        } else {
          netValue = paid;
          gst = 0;
          (gstpers = 0), (cgstpers = 0), (sgstpers = 0), (cgst = 0);
          sgst = 0;
        }

        const selectedPaymentId = this.feesList[0].Payment_Id;

        const paymentMode = this.allPaymentMode.find(
          (pm: any) => +pm.Payment_Id === +selectedPaymentId
        );

        const updatedEntry: InstallmentEntry = {
          Student_Fees_ID: this.feesList[0].Student_Fees_ID,
          Student_ID: this.feesList[0].Student_ID,
          Course_ID: this.feesList[0].Course_ID,
          Course_Name: this.feesList[0].Course_Name,
          Installment_information_ID:
            this.feesList[0].Installment_information_ID,
          Total_Amount: this.feesList[0].Total_Amount,
          Paid_Amount: paid,
          Fee_Status: remaining > 0 ? 'Pending' : 'Paid',
          Payment_Date: this.feesList[0].Payment_Date,
          Due_Date: this.feesList[0].Due_Date,
          Payment_Mode: paymentMode.Payment_Name,
          Transaction_ID: this.feesList[0].Transaction_ID,
          Account_Id: this.feesList[0].Account_Id, //this.selectedAccount?.Account_id,
          Receipt_Id: this.feesList[0].Receipt_Id, // Use existing Receipt_Id or null
          Installment_Index: 1,
          Tax_Type_Id: this.feesList[0].Tax_Type_Id, //Tax_Type_Id:this.selectedtaxtypes?.Tax_Type_Id,
          Netvalue: netValue,
          Gstpers: gstpers,
          Cgstpers: cgstpers,
          Sgstpers: sgstpers,
          Gst: gst,
          Cgst: cgst,
          Sgst: sgst,
          Fine_Amount: this.calculateFine(this.feesList[0]),
          Fee_Type_Name: this.feesList[0].Fee_Type_Name || ''
        };
        // ✅ This is an update
        this.feesService
          .Save_Student_Fees_Details([updatedEntry])
          .subscribe(() => {
            this.isLoading = false;
            console.log('✅ Student fees saved successfully.');
            this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: {
                Message: 'Receipt saved.',
                Type: 'false',
                Heading: 'UPDATED',
              },
            });
            const studentId = this.feesList[0]?.Student_ID || this.feesList[0]?.Student_Id;
            if (this.selectedTemplateId && studentId) {
              this.sendSelectedEmail(studentId, '', this.feesList[0]?.Course_Name, updatedEntry, () => {
                this.onCancel();
                this.selectedTabIndex = 0;
              });
            } else {
              this.onCancel();
              this.selectedTabIndex = 0;
            }
          });
      } 
      // Update Receipt
      else {
        const selectedInstallment = this.installments.find(
          (i) =>
            i.Installment_information_ID ===
            this.feesList[0].Installment_information_ID
        );

        const feeType = selectedInstallment?.Fee_Type;
        const splitCount = this.getInstallmentSplitCount(feeType);

        const amounts = this.getRoundedInstallments(
          this.feesList[0].Total_Amount,
          splitCount,
          5000
        );

        var netValue = 0,
          gstpers = 18,
          cgstpers = 9,
          sgstpers = 9,
          gst = 0,
          cgst = 0,
          sgst = 0,
          paid = 0;
        
        var totalPaid = this.feesList[0].tempPaidAmount;
        var fine = this.calculateFine(this.feesList[0]);
        paid = totalPaid - fine; // Core fee amount

        if (this.feesList[0].Tax_Type_Id == 1) {
          netValue = (paid * 100) / (100 + gstpers);
          gst = paid - netValue;
          cgst = gst / 2;
          sgst = gst / 2;
        } else {
          netValue = paid;
          gst = 0;
          (gstpers = 0), (cgstpers = 0), (sgstpers = 0), (cgst = 0);
          sgst = 0;
        }

        const paymentModeName = this.allPaymentMode?.find((p: any) => +p.Payment_Id === +this.feesList[0]?.Payment_Id)?.Payment_Name || this.feesList[0]?.Payment_Mode || '';
        this.feesList[0].Payment_Mode = paymentModeName;

        const installmentEntries: InstallmentEntry[] = amounts.map(
          (amount, index) => ({
            Receipt_Id: this.feesList[0].Receipt_Id,
            Student_Fees_ID: this.feesList[0].Student_Fees_ID || 0,
            Student_ID: this.feesList[0].Student_Id,
            Course_ID: this.feesList[0].Course_ID || 0,
            Course_Name: this.feesList[0].Course_Name || '',
            Installment_information_ID:
              this.feesList[0].Installment_information_ID,
            Total_Amount: this.feesList[0].tempPaidAmount,
            Paid_Amount: paid,
            Fee_Status: 'Pending',
            Payment_Date: this.feesList[0].Payment_Date,
            Due_Date: null,
            Payment_Mode: this.feesList[0].Payment_Mode,
            Transaction_ID: this.feesList[0].Transaction_ID,
            Account_Id: this.feesList[0].Account_Id, //this.selectedAccount?.Account_id,
            Installment_Index: index + 1,
            Tax_Type_Id: this.feesList[0].Tax_Type_Id,
            Netvalue: netValue,
            Gstpers: gstpers,
            Cgstpers: cgstpers,
            Sgstpers: sgstpers,
            Gst: gst,
            Cgst: cgst,
            Sgst: sgst,
            Fine_Amount: this.calculateFine(this.feesList[0]),
            Fee_Type_Name: this.feesList[0].Fee_Type_Name || ''
          })
        );

        this.feesService
          .Save_Student_Fees_Details(installmentEntries)
          .subscribe(() => {
            this.isLoading = false;
            console.log('✅ Saved all rounded installments successfully.');
             
            const successDialog = this.dialogBox.open(DialogBox_Component, {
              panelClass: 'Dialogbox-Class',
              data: {
                Message: 'Student fees saved successfully.',
                Type: 'false',
                Heading: 'SAVED',
              },
            });

           const studentId = this.feesList[0]?.Student_ID || this.feesList[0]?.Student_Id;
           const currentFeeData = (installmentEntries && installmentEntries[0]) || this.feesList[0];
           if (this.selectedTemplateId && studentId) {
             this.sendSelectedEmail(studentId, '', this.feesList[0]?.Course_Name, currentFeeData, () => {
               this.onCancel();
             });
           } else {
             this.onCancel();
           }
          });
        console.log(installmentEntries);
      }
    } else {
      console.warn('❌ Form is invalid');
      this.feesForm.markAllAsTouched();
    }
    this.payFeeStatus = false;
  }

  onCancel(): void {
    const studentId = this.feesList[0]?.Student_ID || this.feesList[0]?.Student_Id;
    if (studentId) {
      this.cancel.emit(studentId);
    } else {
      this.cancel.emit(0);
    }
  }

  onUpdateCancel(): void {
    const studentId = this.feesList[0]?.Student_ID || this.feesList[0]?.Student_Id;
    if (studentId) {
      this.cancel.emit(studentId);
    } else {
      this.cancel.emit(0);
    }
  }

  calculateFine(fee: any): number {
    return 0;
  }
}
