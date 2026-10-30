import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { user_Service } from '../../services/user.Service';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { EmailTemplateService } from '../../services/email-template.service';
import { EmailTemplate } from '../../../core/models/email_template';

@Component({
  selector: 'app-mail-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './mail-report.component.html',
  styleUrl: './mail-report.component.scss'
})
export class MailReportComponent implements OnInit {
  private userService = inject(user_Service);
  private templateService = inject(EmailTemplateService);
  
  tableData: any[] = [];
  templates: EmailTemplate[] = [];
  displayedColumns: string[] = ['date', 'leadName', 'template', 'email', 'subject', 'status', 'openedStatus'];
  isLoaded: boolean = false;
  isSyncing: boolean = false;
  syncMessage: string = '';

  // Filters
  sentOn: boolean = true;
  fromDate: string = '';
  toDate: string = '';
  selectedTemplateId: number | null = null;

  ngOnInit() {
    console.log('MailReportComponent initialized');
    this.fromDate = this.formatDate(new Date());
    this.toDate = this.formatDate(new Date());
    this.fetchTemplates();
    this.fetchReportData();
  }

  fetchTemplates() {
    this.templateService.searchTemplates('').subscribe({
      next: (res: any) => {
        this.templates = res || [];
      },
      error: (err) => console.error('Error fetching templates:', err)
    });
  }

  formatDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') return date;
    
    // Format to YYYY-MM-DD
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();

    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  }

  fetchReportData() {
    this.isLoaded = false;
    const filters = {
      fromDate: this.sentOn ? this.formatDate(this.fromDate) : '',
      toDate: this.sentOn ? this.formatDate(this.toDate) : '',
      templateId: this.selectedTemplateId
    };

    this.userService.Get_Mail_Report(filters).subscribe({
      next: (res: any) => {
        this.tableData = res || [];
        this.isLoaded = true;
      },
      error: (err) => {
        console.error('Error fetching mail report:', err);
        this.isLoaded = true;
      }
    });
  }

  syncBrevoOpens() {
    this.isSyncing = true;
    this.syncMessage = '';
    this.userService.Sync_Brevo_Opens().subscribe({
      next: (res: any) => {
        this.isSyncing = false;
        this.syncMessage = res?.message || `Synced successfully. ${res?.updated || 0} email(s) marked as opened.`;
        // Refresh the report to show updated opened statuses
        this.fetchReportData();
        // Clear message after 6 seconds
        setTimeout(() => { this.syncMessage = ''; }, 6000);
      },
      error: (err) => {
        this.isSyncing = false;
        const errBody = err.error;
        if (err.status === 403 && errBody?.message?.includes('Brevo API access blocked')) {
          this.syncMessage = 'Brevo API access blocked: Please add your server IP to the Brevo authorized IPs list at app.brevo.com/security/authorised_ips';
        } else {
          this.syncMessage = errBody?.message || 'Sync failed. Please try again.';
        }
        console.error('Sync_Brevo_Opens error:', err);
        setTimeout(() => { this.syncMessage = ''; }, 8000);
      }
    });
  }

  resetFilters() {
    this.sentOn = true;
    this.fromDate = this.formatDate(new Date());
    this.toDate = this.formatDate(new Date());
    this.selectedTemplateId = null;
    this.fetchReportData();
  }
}
