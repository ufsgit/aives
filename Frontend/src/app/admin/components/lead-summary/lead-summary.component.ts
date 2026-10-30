import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { student_Service } from '../../services/student.Service';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-lead-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-summary.component.html',
  styleUrl: './lead-summary.component.scss'
})
export class LeadSummaryComponent implements OnInit {
  private studentService = inject(student_Service);
  private router = inject(Router);

  isLoading = true;
  summary: any = {
    MissedLeads: 0,
    FollowupLeads: 0,
    TransferredLeads: 0,
    TotalLeads: 0,
    UpcomingFollowup: 0
  };
  statusSummary: any[] = [];
  private readonly cardColors = [
    '#eff6ff',
    '#f0fdf4',
    '#fff7ed',
    '#fdf2f8',
    '#f5f3ff',
    '#ecfeff',
    '#fefce8',
    '#f8fafc',
    '#f0f9ff'
  ];

  private readonly cardAccentColors = [
    '#2563eb',
    '#16a34a',
    '#ea580c',
    '#db2777',
    '#7c3aed',
    '#0891b2',
    '#ca8a04',
    '#475569',
    '#0284c7'
  ];

  // Staff Dropdown
  staffList: any[] = [];
  selectedStaff: number | null = null;

  // Date Filter Properties
  fromDate: string = '';
  toDate: string = '';
  dateRangePreset: string = 'all';

  activeTab: string = 'Dashboard'; // Tabs: Dashboard, Leads, Work, Amc, Payment, Tasks, Summary

  ngOnInit(): void {
    this.loadStaff();
    this.loadData();
  }

  onDatePresetChange() {
    const today = new Date();
    if (this.dateRangePreset === 'all') {
      this.fromDate = '';
      this.toDate = '';
    } else if (this.dateRangePreset === 'today') {
      this.fromDate = today.toISOString().split('T')[0];
      this.toDate = this.fromDate;
    } else if (this.dateRangePreset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      this.fromDate = yesterday.toISOString().split('T')[0];
      this.toDate = this.fromDate;
    } else if (this.dateRangePreset === 'thisWeek') {
      const first = today.getDate() - today.getDay();
      const firstDay = new Date(today.setDate(first)).toISOString().split('T')[0];
      this.fromDate = firstDay;
      this.toDate = new Date().toISOString().split('T')[0];
    } else if (this.dateRangePreset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      this.fromDate = firstDay;
      this.toDate = new Date().toISOString().split('T')[0];
    }
    
    if (this.dateRangePreset !== 'custom') {
      this.loadData();
    }
  }

  loadStaff() {
    this.studentService.User_Dropdown().subscribe({
      next: (res: any) => {
        this.staffList = res || [];
      },
      error: (err) => console.error('Error loading staff dropdown:', err)
    });
  }

  loadData() {
    this.isLoading = true;
    const fDate = this.fromDate ? this.fromDate : undefined;
    const tDate = this.toDate ? this.toDate : undefined;
    const sId = this.selectedStaff ? this.selectedStaff : undefined;

    this.studentService.Get_Lead_Dashboard_Summary(fDate, tDate, sId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (res: any) => {
          if (res) {
            this.summary = {
              MissedLeads: Number(res.metrics?.MissedLeads || 0),
              FollowupLeads: Number(res.metrics?.FollowupLeads || 0),
              TransferredLeads: Number(res.metrics?.TransferredLeads || 0),
              TotalLeads: Number(res.metrics?.TotalLeads || 0),
              UpcomingFollowup: Number(res.metrics?.UpcomingFollowup || 0)
            };
            this.statusSummary = (res.statusCounts || []).filter((s: any) => s.Status_Name !== 'New Existing Clients');
          }
        },
        error: (err) => console.error('Error loading summary data:', err)
      });
  }

  onFilterChange() {
    this.loadData();
  }

  onTabClick(tab: string) {
    this.activeTab = tab;
    if (tab === 'Dashboard') {
      // Stay on this page as it's the Lead Summary Dashboard
      this.loadData();
    } else if (tab === 'Leads') {
      this.router.navigateByUrl('/admin/Student_Lead');
    } else if (tab === 'Work') {
      this.router.navigateByUrl('/admin/Work_Report');
    } else if (tab === 'Payment') {
      this.router.navigateByUrl('/admin/Expenses');
    } else if (tab === 'Tasks') {
      this.router.navigateByUrl('/admin/Status_Report');
    }
  }

  onAttendanceClick() {
    this.router.navigateByUrl('/admin/Mark_Attendance');
  }

  onCardClick(cardName: string) {
    this.router.navigate(['/admin/Student_Lead'], { queryParams: { status: cardName } });
  }

  getCardBackground(index: number): string {
    return this.cardColors[index % this.cardColors.length];
  }

  getCardBorderColor(index: number): string {
    return this.cardAccentColors[index % this.cardAccentColors.length] + '22';
  }

  getStatusColor(statusColor: string | null | undefined, index: number): string {
    return this.cardAccentColors[index % this.cardAccentColors.length];
  }

  getIconBackgroundColor(statusColor: string | null | undefined, index: number): string {
    const color = this.getStatusColor(statusColor, index);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}26` : this.getCardBackground(index);
  }

  getIconBorderColor(statusColor: string | null | undefined, index: number): string {
    const color = this.getStatusColor(statusColor, index);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}55` : color;
  }

  getIconShadow(statusColor: string | null | undefined, index: number): string {
    return 'none';
  }

  getIconForStatus(statusName: string): string {
    const iconMap: { [key: string]: string } = {
      'New': 'description',
      'No Response': 'chat_bubble',
      'Closed - Future Potential': 'show_chart',
      'Not interested': 'person',
      'Interested': 'favorite',
      'New Existing Clients': 'group',
      'Payment Done': 'account_balance_wallet',
      'Blank': 'work',
      'Later': 'schedule',
      'Follow back': 'replay'
    };
    return iconMap[statusName] || 'description';
  }
}




