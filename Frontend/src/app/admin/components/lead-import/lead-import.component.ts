import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { student_Service } from '../../services/student.Service';
import { course_Service } from '../../services/course.Service';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';

interface ImportData {
  SNo: number;
  Name: string;
  Phone_Number: string;
  Alternative_Number?: string;
  Email: string;
  Remarks?: string;
}

@Component({
  selector: 'app-lead-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatTableModule,
  ],
  templateUrl: './lead-import.component.html',
  styleUrl: './lead-import.component.scss'
})
export class LeadImportComponent implements OnInit {
  private studentService = inject(student_Service);
  private fb = inject(FormBuilder);

  private dialog = inject(MatDialog);

  importForm: FormGroup;
  branchData: any[] = [];
  departmentData: any[] = [];
  staffData: any[] = [];
  followUpStatusData: any[] = [];
  enquirySources: any[] = [];
  importedLeads: ImportData[] = [];
  file: File | null = null;
  isLoading: boolean = false;
  isImporting: boolean = false;
  
  sheetNames: string[] = [];
  selectedSheetName: string = '';
  workbook: XLSX.WorkBook | null = null;

  constructor() {
    this.importForm = this.fb.group({
      Branch: [null, Validators.required],
      Department: [null, Validators.required],
      AssignToStaff: [null, Validators.required],
      NextFollowUpDate: [this.getCurrentDate(), Validators.required],
      FollowUpStatus: [null, Validators.required],
      EnquirySource: [null, Validators.required],
      Remarks: ['']
    });
  }

  ngOnInit(): void {
    this.loadMetadata();
  }

  loadMetadata() {
    this.studentService.Branch_Dropdown().subscribe((res: any) => {
      this.branchData = Array.isArray(res[0]) ? res[0] : (Array.isArray(res) ? res : []);
    });

    this.studentService.Department_Dropdown().subscribe((res: any) => {
      this.departmentData = Array.isArray(res[0]) ? res[0] : (Array.isArray(res) ? res : []);
      const admissionDept = this.departmentData.find(d => d.Department_Name === "Admission");
      if (admissionDept) this.importForm.patchValue({ Department: admissionDept });
    });

    this.studentService.User_Dropdown().subscribe((res: any) => {
      this.staffData = Array.isArray(res[0]) ? res[0] : (Array.isArray(res) ? res : []);
      const loggedInUserId = Number(localStorage.getItem('User_ID'));
      const currentUser = this.staffData.find(s => s.User_ID === loggedInUserId);
      if (currentUser) this.importForm.patchValue({ AssignToStaff: currentUser });
    });

    this.studentService.Get_Followup_Status().subscribe((res: any) => {
      let rows: any[] = Array.isArray(res[0]) ? res[0] : (Array.isArray(res) ? res : []);
      this.followUpStatusData = rows;
      const initialStatus = this.followUpStatusData.find(s => s.Status_Name?.toLowerCase() === 'pending');
      if (initialStatus) this.importForm.patchValue({ FollowUpStatus: initialStatus });
    });

    this.studentService.Get_All_Enquiry().subscribe((res: any) => {
      this.enquirySources = Array.isArray(res[0]) ? res[0] : (Array.isArray(res) ? res : []);
    });
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  onFileSelected(event: any) {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.file = selectedFile;
      this.readFile();
    }
    // Clear the input value so the same file can be selected again
    event.target.value = '';
  }

  readFile() {
    if (!this.file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      this.workbook = XLSX.read(data, { type: 'array' });
      this.sheetNames = this.workbook.SheetNames;
      if (this.sheetNames.length > 0) {
        this.selectedSheetName = this.sheetNames[0];
        this.parseExcel();
      }
    };
    reader.readAsArrayBuffer(this.file);
  }

  onSheetChange(sheetName: string) {
    this.selectedSheetName = sheetName;
    this.parseExcel();
  }

  parseExcel() {
    if (!this.workbook || !this.selectedSheetName) return;

    const worksheet = this.workbook.Sheets[this.selectedSheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const allRows: any[][] = [];

    // Iterate through all rows in the range to respect hidden status accurately
    for (let R = range.s.r; R <= range.e.r; ++R) {
      // Check if row is hidden or has zero height (common in some Excel versions for filtered rows)
      const rowProps = worksheet['!rows'] ? worksheet['!rows'][R] : null;
      const isHidden = rowProps && (rowProps.hidden || rowProps.hpt === 0 || rowProps.hpx === 0);
      
      if (isHidden) {
        continue;
      }

      const row: any[] = [];
      let hasData = false;
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        // Use formatted value if available, else raw value
        const val = cell ? (cell.w || cell.v) : '';
        row.push(val);
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          hasData = true;
        }
      }

      // Only add rows that have at least some data
      if (hasData) {
        allRows.push(row);
      }
    }

    if (allRows.length < 1) {
      this.importedLeads = [];
      return;
    }

    // Smart header detection: Find the first row that looks like a header row
    let headerIndex = 0;
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const row = allRows[i];
      const hasName = row.some(cell => /name|student|first|full/i.test(String(cell)));
      const hasPhone = row.some(cell => /phone|mobile|contact|number/i.test(String(cell)));
      if (hasName || hasPhone) {
        headerIndex = i;
        break;
      }
    }

    const headers = (allRows[headerIndex] || []).map(h => String(h).trim());
    const dataRows = allRows.slice(headerIndex + 1);

    const rawData = dataRows.map(rowArray => {
      const rowObj: any = {};
      headers.forEach((header, i) => {
        if (header) {
          rowObj[header] = rowArray[i];
        }
      });
      return rowObj;
    });

    this.importedLeads = rawData.map((row: any, index: number) => {
      const getVal = (possibleKeys: string[]) => {
        for (const pk of possibleKeys) {
          const normalizedPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const key of Object.keys(row)) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedKey === normalizedPk) {
              return row[key];
            }
          }
        }
        return '';
      };

      const name = getVal(['Name', 'StudentName', 'FirstName', 'FullName']) || '';
      const phone = getVal(['Phone', 'PhoneNumber', 'Mobile', 'MobileNumber', 'Contact', 'ContactNumber', 'WhatsApp', 'WhatsAppNumber', 'Number']) || '';
      const altPhone = getVal(['AlternativeNumber', 'AlternateNumber', 'AltNumber', 'AltPhone', 'AlternativeMobile', 'AlternateMobile', 'AltMobile', 'AltContact', 'AlternativeContact']) || '';
      const email = getVal(['Email', 'EmailAddress', 'EmailId', 'Mail']) || '';
      const remarks = getVal(['Remarks', 'Remark', 'Note', 'Notes', 'Comment', 'Comments', 'FollowUpDetails']) || '';

      return {
        SNo: index + 1,
        Name: name !== undefined && name !== null ? String(name).trim() : '',
        Phone_Number: phone !== undefined && phone !== null ? String(phone).trim() : '',
        Alternative_Number: altPhone !== undefined && altPhone !== null ? String(altPhone).trim() : '',
        Email: email !== undefined && email !== null ? String(email).trim() : '',
        Remarks: remarks !== undefined && remarks !== null ? String(remarks).trim() : ''
      };
    }).filter(lead => lead.Name || lead.Phone_Number);
  }

  downloadTemplate() {
    const template = [
      { 'Name': 'John Doe', 'Phone Number': '9876543210', 'Alternative Number': '', 'Email': 'john@example.com', 'Remarks': 'Follow up next week' }
    ];
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = { Sheets: { 'Template': worksheet }, SheetNames: ['Template'] };
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    FileSaver.saveAs(blob, 'Lead_Import_Template.xlsx');
  }

  importLeads() {
    if (this.importForm.invalid) {
      this.importForm.markAllAsTouched();
      return;
    }

    if (this.importedLeads.length === 0) {
      this.dialog.open(DialogBox_Component, {
        data: { Message: 'Please choose a file with data first!', Type: '3' }
      });
      return;
    }

    this.isImporting = true;
    const formValues = this.importForm.value;
    const currentUserId = Number(localStorage.getItem('User_ID'));

    const savePromises = this.importedLeads.map(lead => {
      const nameParts = lead.Name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        Student_ID: 0,
        First_Name: firstName,
        Last_Name: lastName,
        Email: lead.Email,
        Phone_Number: lead.Phone_Number,
        Alternative_Number: lead.Alternative_Number || '',
        Country_Code: '+91',
        Country_Code_Name: 'in',
        Delete_Status: 0,
        Active_Status: 'Active',
        Branch_Id: formValues.Branch?.Branch_Id || formValues.Branch?.Branch_ID,
        Branch_ID: formValues.Branch?.Branch_Id || formValues.Branch?.Branch_ID,
        Branch_Name: formValues.Branch?.Branch_Name,
        Department_Id: formValues.Department?.Department_Id || formValues.Department?.Department_ID,
        Department_Name: formValues.Department?.Department_Name,
        Assigned_Staff_ID: formValues.AssignToStaff?.User_ID,
        Assigned_Staff_Name: formValues.AssignToStaff?.First_Name,
        Follow_Up_Status_ID: formValues.FollowUpStatus?.Status_Id || formValues.FollowUpStatus?.Status_ID,
        Follow_Up_Status_Name: formValues.FollowUpStatus?.Status_Name,
        Next_Follow_Up_Date: formValues.NextFollowUpDate,
        Remark: lead.Remarks || formValues.Remarks,
        Enquiry_Source_Id: formValues.EnquirySource?.Enquiry_Source_Id || formValues.EnquirySource?.Enquiry_Source_ID,
        Created_By: currentUserId,
        Followup_Status: true
      };

      return this.studentService.Save_student(payload).toPromise();
    });

    Promise.all(savePromises).then(() => {
      this.isImporting = false;
      this.dialog.open(DialogBox_Component, {
        data: { Message: 'Leads imported successfully!', Type: 'false' }
      });
      // Do not clear importedLeads so they are displayed at the bottom as requested
    }).catch(err => {
      this.isImporting = false;
      console.error('Import error:', err);
      this.dialog.open(DialogBox_Component, {
        data: { Message: 'Some errors occurred during import.', Type: '2' }
      });
    });
  }

  compareObjects(o1: any, o2: any): boolean {
    if (o1 && o2) {
      return (o1.Branch_ID === o2.Branch_ID) ||
             (o1.Branch_Id === o2.Branch_Id) ||
             (o1.Department_ID === o2.Department_ID) || 
             (o1.Department_Id === o2.Department_Id) ||
             (o1.User_ID === o2.User_ID) ||
             (o1.Status_ID === o2.Status_ID) ||
             (o1.Status_Id === o2.Status_Id) ||
             (o1.Enquiry_Source_Id === o2.Enquiry_Source_Id) ||
             (o1.Enquiry_Source_ID === o2.Enquiry_Source_ID);
    }
    return o1 === o2;
  }
}
