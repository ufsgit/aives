import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { student_Service } from '../../services/student.Service';
import { HttpClient } from '@angular/common/http';
import * as FileSaver from 'file-saver';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../shared/shared.module';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { MatDialog } from '@angular/material/dialog';

interface Installment {
  Index: number;
  DueDate: string;
  IsPaid: string;
  Amount: number;
  TaxApplied: string;
  TaxAmount: number;
  PaymentMode: string;
  PaymentStatus: string;
  Details: string;
  installment_amount: number;
}

interface StudentData {
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone_Number: string;
  Course_Name: string;
  Batch_Name: string;
  Status: string;
  Admission_Date: string;
  Branch_Name: string;
  Assigned_To: string;
  Source: string;
  Follow_Up_Date: string;
  Follow_Up_Status: string;
  Remarks: string;
  Branch_Id: number;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [FormsModule, CommonModule, MatIconModule, SharedModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent {
  dialogBox = inject(MatDialog);
  file: File | null = null;
  arrayBuffer: any;
  Student_Import_Details_Data: StudentData[] = [];
  isUploading: boolean = false;
  isSaving: boolean = false;
  // Field mapping properties
  firstNameField: string = 'First Name';
  lastNameField: string = 'Last Name';
  emailField: string = 'Email';
  countryNameField: string = 'Country Code_Name';
  countryCodeField: string = 'Country Code';
  phoneNumberField: string = 'Phone Number';
  rollNoField: string = 'Roll No';
  Search_Branch_Data: any[] = [];
  Search_Branch_Temp: any = {};
  displayedColumns: string[] = [
    'First_Name',
    'Last_Name',
    'Email',
    'Country_Code_Name',
    'Country_Code',
    'Phone_Number',
    'Roll_No',
  ];
  excelHeaders: string[] = [];

  Search_Branch: any = {};
  isLoading: boolean = false;

  constructor(
    private http: HttpClient,
    private student_Service_: student_Service
  ) {
    this.Branch_Dropdown();
  }
  exportExcel(): void {
    const worksheetData: any[][] = [];

    // Optional: Add headers only (no data)
    const headers = this.displayedColumns.map((col) => col.replace('_', ' '));
    worksheetData.push(headers);

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'Student Import': worksheet },
      SheetNames: ['Student Import'],
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob: Blob = new Blob([excelBuffer], {
      type: 'application/octet-stream',
    });

    FileSaver.saveAs(blob, 'Student_Import_Template.xlsx');
  }
  onFileSelected(event: any): void {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.file = selectedFile;
    }
  }

  uploadFile(): void {
    if (!this.file) {
      alert('Please select a file first!');
      return;
    }

    if (!this.Search_Branch || this.Search_Branch.Branch_Id === 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Please select a branch before uploading!',
          Type: '3',
        },
      });
      return;
    }

    this.isUploading = true;
    this.processExcel();
  }

  processExcel(): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.arrayBuffer = reader.result;
      const data = new Uint8Array(this.arrayBuffer);
      
      // ✅ More efficient way to read workbook from ArrayBuffer
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
      });

      if (rawData.length > 0) {
        this.excelHeaders = Object.keys(rawData[0]);
      } else {
        this.isUploading = false;
        alert('The Excel file appears to be empty.');
        return;
      }
      console.log('rawData', rawData);

      const cleanedData = rawData
        .map((row: any) => {
          // 🔁 Helper to get value from row with flexible header matching
          const getVal = (possibleHeaders: string[]): any => {
            const keys = Object.keys(row);
            const foundKey = keys.find(key => {
              const normalizedKey = key.toLowerCase().replace(/[\s_.]/g, '');
              return possibleHeaders.some(h => h.toLowerCase().replace(/[\s_.]/g, '') === normalizedKey);
            });
            return foundKey ? row[foundKey] : undefined;
          };

          const fullName = getVal(['Student Name', 'Full Name', 'Name']) || '';
          let First_Name = '';
          let Last_Name = '';
          if (fullName) {
            const parts = fullName.trim().split(' ');
            First_Name = parts[0];
            Last_Name = parts.slice(1).join(' ');
          } else {
            First_Name = getVal(['First Name', 'FirstName']) || '';
            Last_Name = getVal(['Last Name', 'LastName']) || '';
          }

          // 🔁 Shared phone number cleaning function
          const cleanPhone = (raw: any): string => {
            if (raw === undefined || raw === null) return '';
            const cleaned = raw.toString().replace(/[^\d,]/g, '');
            const numbers = cleaned
              .split(',')
              .map((num: string) => num.trim())
              .filter(Boolean);

            const normalizeNumber = (num: string): string => {
              let digitsOnly = '';
              if (/e\+?/i.test(num)) {
                digitsOnly = Number(num).toLocaleString('en-IN', {
                  maximumFractionDigits: 0,
                  useGrouping: false,
                });
              } else {
                digitsOnly = num;
              }
              return digitsOnly.length > 10 && digitsOnly.startsWith('91')
                ? digitsOnly.slice(digitsOnly.length - 10)
                : digitsOnly;
            };

            return normalizeNumber(numbers[0] || '');
          };

          // 🔁 Helper to normalize date to YYYY-MM-DD
          const normalizeDate = (val: any): string => {
            if (!val) return '';
            const str = val.toString().trim();
            if (!str) return '';

            // If already YYYY-MM-DD, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

            // Handle DD-MM-YYYY or DD/MM/YYYY
            const dmy = str.split(/[-/]/);
            if (dmy.length === 3) {
              if (dmy[0].length === 4) return `${dmy[0]}-${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}`; // YYYY-MM-DD
              return `${dmy[2]}-${dmy[1].padStart(2, '0')}-${dmy[0].padStart(2, '0')}`; // DD-MM-YYYY -> YYYY-MM-DD
            }

            return str;
          };

          return {
            First_Name: First_Name || '',
            Last_Name: Last_Name || '',
            Email: (getVal(['Email ID', 'Email', 'Mail']) || '').toString().trim(),
            Country_Code_Name: getVal(['Country Code Name', 'Country']) || '',
            Country_Code: getVal(['Country Code']) || '',
            Phone_Number: cleanPhone(getVal(['Contact Number', 'Phone Number', 'Mobile', 'Contact'])),
            Course_Name: getVal(['Course Name', 'Course']) || '',
            Batch_Name: getVal(['Batches', 'Batch']) || '',
            Status: getVal(['Student Status', 'Status']) || '',
            Admission_Date: normalizeDate(getVal(['Admission Date', 'Date'])),
            Branch_Name: this.Search_Branch.Branch_Name,
            Branch_Id: this.Search_Branch.Branch_Id,
            Branch_ID: this.Search_Branch.Branch_Id, // redundant but safer
            Assigned_To: getVal(['Created By', 'Assigned To', 'Staff']) || '',
            Source: getVal(['Source', 'Lead Source']) || '',
            Follow_Up_Date: normalizeDate(getVal(['Follow up Date', 'Follow Up Date', 'Next Followup'])),
            Next_Follow_Up_Date: normalizeDate(getVal(['Follow up Date', 'Follow Up Date', 'Next Followup'])),
            Follow_Up_Status: getVal(['Follow up Status', 'Follow Up Status']) || '',
            Remarks: getVal(['Note', 'Remarks', 'Remark', 'Comment']) || '',
            Roll_No: getVal(['Roll No.', 'Roll No', 'ID']) || '',
            Address: getVal(['Address']) || '',
            Father: getVal(['Father', 'Father Name']) || '',
            Mother: getVal(['Mother', 'Mother Name']) || '',
            GuardianNO: cleanPhone(getVal(['Guardian Contact Number', 'Guardian Contact', 'Guardian Phone'])),
            QUALIFICATION: getVal(['QUALIFICATION', 'Qualification']) || '',
            Created_By: Number(localStorage.getItem('User_ID')) || 0,
            Active_Status: 'Active',
            Delete_Status: 0,
            Student_ID: 0,
            Total_Amount: (() => {
              const val = getVal(['Total Amount', 'Fees', 'Amount']);
              if (val === undefined || val === null || val === '') return 0;
              return parseFloat(val.toString().replace(/Rs\.?/i, '').replace(/,/g, '').trim()) || 0;
            })(),
            Paid_Amount: (() => {
              const val = getVal(['Paid Amount', 'Paid']);
              if (val === undefined || val === null || val === '') return 0;
              return parseFloat(val.toString().replace(/Rs\.?/i, '').replace(/,/g, '').trim()) || 0;
            })(),
            Due_Date: normalizeDate(getVal(['Instalment 1', 'Installment 1'])),
            Payment_Mode: getVal(['Details', 'Payment Mode']) || '',
            
            // ✅ Dynamic Installments
            Installments: (() => {
              const installments: Installment[] = [];
              let notPaidTotal = 0;
              let paidInstallments: any[] = [];

              for (let i = 0; i < 19; i++) {
                const idx = i === 0 ? '' : `_${i}`;
                const parseAmount = (val: any): number => {
                  if (val === undefined || val === null || val === '') return 0;
                  const cleaned = val.toString().replace(/Rs\.?/i, '').replace(/,/g, '').trim();
                  return parseFloat(cleaned) || 0;
                };

                const dueDate = normalizeDate(getVal([`Instalment ${i + 1}`, `Installment ${i + 1}`]));
                const rawAmount = row[`Amount${idx}`] || getVal([`Amount ${i + 1}`]);
                const isPaid = (row[`Is Paid?${idx}`] || getVal([`Is Paid ${i + 1}`]) || '').toString().toUpperCase();
                const taxApplied = row[`Tax Applied${idx}`];
                const rawTaxAmount = row[`Tax Amount${idx}`];
                const paymentMode = row[`Payment Mode${idx}`];
                const paymentStatus = row[`Payment Status${idx}`];
                const details = row[`Details${idx}`];

                const amount = parseAmount(rawAmount);

                if (!dueDate && !rawAmount && !isPaid) continue;

                const installment = {
                  Index: i + 1,
                  DueDate: dueDate || '',
                  IsPaid: isPaid,
                  Amount: amount,
                  TaxApplied: taxApplied || '',
                  TaxAmount: parseAmount(rawTaxAmount),
                  PaymentMode: paymentMode || '',
                  PaymentStatus: paymentStatus || '',
                  Details: details || '',
                  installment_amount: 0
                };

                if (isPaid === 'NOT PAID') {
                  installment.installment_amount = amount;
                  notPaidTotal += amount;
                } else if (isPaid === 'PAID') {
                  paidInstallments.push(installment);
                }
                installments.push(installment);
              }

              const paidAmount = parseFloat(getVal(['Paid Amount', 'Paid'])) || 0;
              const remainingPaidAmount = paidAmount - notPaidTotal;
              const perInstallmentAmount = paidInstallments.length > 0 ? Math.ceil(remainingPaidAmount / paidInstallments.length) : 0;

              for (const inst of paidInstallments) {
                inst.installment_amount = Math.max(inst.Amount, perInstallmentAmount);
              }
              return installments;
            })()
          };
        })
        .filter((student) => student.First_Name || student.Roll_No || student.Email || student.Phone_Number);

      if (cleanedData.length === 0) {
        alert('No valid student data found in the Excel file. Please check if the column headers match (e.g., Student Name, Email, Contact Number).');
      }

      this.Student_Import_Details_Data = cleanedData;
      this.isUploading = false;
      console.log('Filtered & Imported Data:', this.Student_Import_Details_Data);
    };

    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      this.isUploading = false;
      alert('Error reading file. Please try again.');
    };

    reader.readAsArrayBuffer(this.file!);
  }

  Branch_Dropdown() {
    this.student_Service_.Branch_Dropdown().subscribe(
      (Rows) => {
        const defaultOption = { Branch_Id: 0, Branch_Name: 'Select Branch' };

        if (Rows && Array.isArray(Rows[0])) {
          this.Search_Branch_Data = [defaultOption, ...Rows[0]];
        } else if (Array.isArray(Rows)) {
          this.Search_Branch_Data = [defaultOption, ...Rows];
        } else {
          this.Search_Branch_Data = [defaultOption];
        }

        this.Search_Branch = defaultOption;
      },
      (err) => {
        console.error('Failed to fetch branch data:', err);
      }
    );
  }

  saveAllStudents(): void {
    if (this.Student_Import_Details_Data.length === 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'No data to save!', Type: '3' },
      });
      return;
    }

    if (!this.Search_Branch || this.Search_Branch.Branch_Id === 0) {
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Please select a branch before saving!', Type: '3' },
      });
      return;
    }

    this.isLoading = true;
    this.isSaving = true;

    this.student_Service_.saveStudentsImport(this.Student_Import_Details_Data).subscribe(
      (response) => {
        this.isSaving = false;
        this.isLoading = false;
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Students saved successfully!', Type: 'false' },
        });
        this.clearData();
      },
      (error) => {
        this.isSaving = false;
        this.isLoading = false;
        const errorMessage =
          error.error?.message || error.message || 'Unknown error';
        alert(`❌ Error: ${errorMessage}`);
      }
    );
  }

  clearData(): void {
    this.Student_Import_Details_Data = [];
    this.file = null;
    this.arrayBuffer = null;
    this.excelHeaders = [];

    const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  removeStudent(index: number): void {
    this.Student_Import_Details_Data.splice(index, 1);
  }
}
