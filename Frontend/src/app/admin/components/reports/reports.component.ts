import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../services/reports.service';
import { StudentFeesService } from '../../services/student-fees.service';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatIconModule } from '@angular/material/icon';


@Component({
  selector: 'app-reports',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  userList: any[] = [];
  accountList: any[] = [];
  filteredBranches: any[] = [];
  filteredData: any[] = [];
  selectedUser: any = null;
  selectedAccount: any = null;
  selectedBranch: any;
  selectedType: string = '';
  fromDate: string = '';
  toDate: string = '';
  fullData: any[] = [];
  Total_Count: any = 0;
  Total_Recieved_Amount: any;
  Closing_Amount: any;
  Expense_Amount: any;
  Total_Fine_Amount: any;
  showAllInPDF: boolean = false;
   branchName:string=""
  showMoreOptions = false;


  constructor(
    private reportsService: ReportsService,
    private feesService: StudentFeesService
  ) {
    this.filteredBranches = [];
  }

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0]; // Format: 'YYYY-MM-DD'
    this.fromDate = today;
    this.toDate = today;
    this.Get_UserList();
    this.Get_AccountList();
    this.filterReceiptExpenseData()
    // this.Get_BranchList();
    
  }

  onFromDateChange(): void {
    if (this.toDate && new Date(this.toDate) < new Date(this.fromDate)) {
      this.toDate = ''; // Clear invalid toDate
    }
  }

  Get_UserList() {
    this.reportsService.Get_UserList().subscribe((result) => {
      this.userList = result;
      console.log(result);
    });
  }

  exportToExcel(): void {
  if (!this.filteredData.length) {
    alert('No data to export.');
    return;
  }

  // Format the data before exporting
  const exportData = this.filteredData.map((item: any) => ({
    Date: this.formatDate(item.Date),
    Type: item.Type,
    Account: item.Account_Name || '',
    Amount: item.Amount,
    Fine: item.Fine_Amount || 0,
    Details: item.Type === 'Expense' ? item.Expense_Type : '-',
    Description: item.Description,
    User: item.User_Name,
    Branch: item.Branch_Name || '-'
  }));

  // Create worksheet & workbook
  const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
  const workbook: XLSX.WorkBook = {
    Sheets: { 'Report': worksheet },
    SheetNames: ['Report']
  };

  // Trigger Excel download
  XLSX.writeFile(workbook, 'Receipts_And_Expenses_Report.xlsx');
}

onUserChange(user: any) {
  console.log('User selected:', user);
  this.selectedUser = user;
}
  formatDate(date: string) {
    

  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  };
  return new Date(date).toLocaleDateString('en-GB', options).replace(/\//g, '-');
    // return new Date(date).toLocaleDateString();
  }

  Get_AccountList(): void {
    this.feesService.Get_Accounts().subscribe((res) => {
      this.accountList = res;
    });
  }
  // Search_Receipts_and_Expense
  filterReceiptExpenseData(): void {
    // Prepare the payload to send to the backend
    const payload = {
      User_Id: this.selectedUser?.User_ID || null,
      Account_Id: this.selectedAccount?.Account_id || null,
      Account_Name: this.selectedAccount?.Account_Name || null,
      Type: this.selectedType || null,
      FromDate: this.fromDate || null,
      ToDate: this.toDate || null,
    };
    
    this.reportsService.Search_Receipts_and_Expense(payload).subscribe({
      next: (result: any) => {
        console.log("result",result);

        this.filteredData = result.data || [];
         this.currentPage = 1;

         this.Total_Recieved_Amount = result.Expenses?.Total_Amount || 0
         this.Closing_Amount = result.Expenses?.Closing_Amount || 0
         this.Expense_Amount = result.Expenses?.Expense_Amount || 0
         this.Total_Fine_Amount = result.Expenses?.Total_Fine || 0
        this.Total_Count = result.data?.[0]?.TotalCount || result.data?.length || 0;
              
      },
      error: (error: any) => {
        console.error('Error fetching receipt/expense data:', error);
      },
    });
  }

  // Pagination
pageSizeOptions: number[] = [10, 15, 25];
pageSize: number = 10;
currentPage: number = 1;


get totalPages(): number {
  return Math.ceil(this.filteredData.length / this.pageSize) || 1;
}

pagedData(): any[] {
  const start = (this.currentPage - 1) * this.pageSize;
  return this.filteredData.slice(start, start + this.pageSize);
}

prevPage(): void {
  if (this.currentPage > 1) {
    this.currentPage--;
  }
}

nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
  }
}

onPageSizeChange(): void {
  this.currentPage = 1; // Reset to first page when page size changes
}


downloadPDF(): void {
  if (!this.filteredData.length) {
    alert('No data to export.');
    return;
  }
  
 this.branchName = [...new Set(this.filteredData.map(item => item.Branch_Name).filter(name => !!name))].join(', ');
   console.log('this.branchName>',this.filteredData[0].Branch_Name
);

  this.loadImageAsBase64('assets/images/logo2.svg').then((base64Image: string) => {
    const doc = new jsPDF();

// const userName = this.selectedUser?.value?.First_Name || 'All Users';
  const userName = this.selectedUser?.value?.First_Name?? this.selectedUser?.First_Name?? 'All Users';
const fromDateStr = this.fromDate ? new Date(this.fromDate ).toLocaleDateString('en-GB') : 'N/A';
  const toDateStr = this.toDate ? new Date(this.toDate ).toLocaleDateString('en-GB') : 'N/A';
  // const AccountName = this.selectedAccount?.value?.Account_Name || 'All Account';
  const AccountName = this.selectedAccount?.value?.Account_Name?? this.selectedAccount?.Account_Name?? 'All Account';

  const TypeName = this.selectedType || 'All Types';

  // const TypeName = this.selectedType?.value || 'All Types'; // assuming `selectedBranch`
  const totalReceivedAmount = this.Total_Recieved_Amount || 0;
  const ExpenseAmount = this.Expense_Amount || 0;
  const TotalFineAmount = this.Total_Fine_Amount || 0;
  const ClosingAmount = this.Closing_Amount || 0;


    let currentY = 10;
    doc.setFontSize(14);
  doc.text('Receipts and Expenses Report', 105, currentY , { align: 'center' });
currentY += 5;
    // Add logo at top-left (x=10, y=5, width=20, height=20)
    doc.addImage(base64Image, 'PNG', 10, 10, 20, 20);
    // Branch Name to right of logo
    doc.text(`${this.branchName || 'N/A'}`, 35, currentY + 5 );

    // // Title next to the logo
    // doc.setFontSize(14);
    // doc.text('Receipts and Expenses Report', 35, 20);
  currentY += 15;
      // --- Filter Info Section ---
const pageCenter = 105; // A4 center in mm

doc.setFontSize(10);

// Line 1: Course | Batch
doc.text(`User: ${userName}`, pageCenter - 70, currentY);
doc.text(`Account: ${AccountName}`, pageCenter + 20, currentY);
currentY += 6;

// Line 2: From | To
doc.text(`From: ${fromDateStr}`, pageCenter - 70, currentY);
doc.text(`To: ${toDateStr}`, pageCenter + 20, currentY);
currentY += 6;

// Line 3: Total Duration (you can center it or align with left side)
doc.text(`Total Recieved Amount: ${totalReceivedAmount}`, pageCenter - 70, currentY);
doc.text(`Type: ${TypeName}`, pageCenter + 20, currentY);
currentY += 6;

// Line 3: Total Duration (you can center it or align with left side)
doc.text(`Expense Amount: ${ExpenseAmount}`, pageCenter - 70, currentY);
doc.text(`Total Fine Amount: ${TotalFineAmount}`, pageCenter + 20, currentY);
currentY += 6;

doc.text(`Closing Amount: ${ClosingAmount}`, pageCenter - 70, currentY);
currentY += 6;


    // Format the data for the PDF
    const pdfData = this.filteredData.map((item: any, index: number) => [
      index + 1,
      this.formatDate(item.Date),
      item.Type,
      item.Account_Name || '',
      item.Amount,
      item.Fine_Amount || 0,
      item.Type === 'Expense' ? item.Expense_Type : '-',
      item.Description,
      item.User_Name,
      item.Branch_Name || '-'
    ]);

    const headers = [['#', 'Date', 'Type', 'Account', 'Amount', 'Fine', 'Details', 'Description', 'User', 'Branch']];

    autoTable(doc, {
      head: headers,
      body: pdfData,
      startY: currentY,
      styles: { fontSize: 8 }
    });

    doc.save('Receipts_And_Expenses_Report.pdf');
  }).catch(err => {
    console.error('Image load failed:', err);
    alert('Error loading logo image.');
  });
}

loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } else {
        reject('Could not get canvas context.');
      }
    };

    img.onerror = (err) => reject(err);
  });
}
}