import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { user_Service } from '../../services/user.Service';

@Component({
  selector: 'app-enquiry-conversion',
  standalone: true,
  imports: [CommonModule, FormsModule, NgChartsModule],
  templateUrl: './enquiry-conversion.component.html',
  styleUrl: './enquiry-conversion.component.scss',
})
export class EnquiryConversionComponent implements OnInit {
  private userService = inject(user_Service);

  summaryRows: any[] = [];
  detailRows: any[] = [];

  fromDate = '';
  toDate = '';
  useCreatedDate = true;
  selectedView: 'table' | 'graph' = 'table';

  isLoadingSummary = false;
  isLoadingDetails = false;
  selectedSource: { Enquiry_Source_Id: number; Enquiry_Source_Name: string } | null = null;
  conversionChartType: ChartType = 'bar';
  conversionChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [],
  };
  conversionChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: '#64748b',
        },
        grid: {
          color: '#e2e8f0',
        },
      },
      x: {
        ticks: {
          color: '#475569',
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
        },
      },
    },
  };

  ngOnInit(): void {
    const today = this.getToday();
    this.fromDate = today;
    this.toDate = today;
    this.loadSummary();
  }

  get isDetailView(): boolean {
    return !!this.selectedSource;
  }

  loadSummary(): void {
    this.isLoadingSummary = true;
    this.userService
      .Get_Enquiry_Conversion_Summary({
        fromDate: this.useCreatedDate ? this.fromDate : '',
        toDate: this.useCreatedDate ? this.toDate : '',
      })
      .subscribe({
        next: (response: any) => {
          const rows = Array.isArray(response?.[0]) ? response[0] : response || [];
          this.summaryRows = rows.map((row: any, index: number) => ({
            ...row,
            rowNo: index + 1,
          }));
          this.updateChartData();
          this.isLoadingSummary = false;
        },
        error: () => {
          this.summaryRows = [];
          this.updateChartData();
          this.isLoadingSummary = false;
        },
      });
  }

  openDetails(source: any): void {
    this.selectedSource = {
      Enquiry_Source_Id: source.Enquiry_Source_Id,
      Enquiry_Source_Name: source.Enquiry_Source_Name,
    };
    this.loadDetails();
  }

  loadDetails(): void {
    if (!this.selectedSource) {
      return;
    }

    this.isLoadingDetails = true;
    this.userService
      .Get_Enquiry_Conversion_Details({
        sourceId: this.selectedSource.Enquiry_Source_Id,
        fromDate: this.useCreatedDate ? this.fromDate : '',
        toDate: this.useCreatedDate ? this.toDate : '',
      })
      .subscribe({
        next: (response: any) => {
          const rows = Array.isArray(response?.[0]) ? response[0] : response || [];
          this.detailRows = rows.map((row: any, index: number) => ({
            ...row,
            rowNo: index + 1,
          }));
          this.isLoadingDetails = false;
        },
        error: () => {
          this.detailRows = [];
          this.isLoadingDetails = false;
        },
      });
  }

  backToSummary(): void {
    this.selectedSource = null;
    this.detailRows = [];
  }

  applyFilters(): void {
    if (this.isDetailView) {
      this.loadDetails();
    } else {
      this.loadSummary();
    }
  }

  onDateRangeChanged(): void {
    if (this.toDate && this.fromDate && this.toDate < this.fromDate) {
      this.toDate = this.fromDate;
    }
    this.applyFilters();
  }

  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  get totalLeadCount(): number {
    return this.summaryRows.reduce((sum, row) => sum + (Number(row.Total_Leads_Count) || 0), 0);
  }

  get totalConversionCount(): number {
    return this.summaryRows.reduce((sum, row) => sum + (Number(row.Conversion_Count) || 0), 0);
  }

  get totalConversionPercentage(): number {
    if (this.totalLeadCount === 0) {
      return 0;
    }
    return Number(((this.totalConversionCount / this.totalLeadCount) * 100).toFixed(2));
  }

  private updateChartData(): void {
    const labels = this.summaryRows.map((row: any) => row.Enquiry_Source_Name || 'Unknown');
    const totalLeads = this.summaryRows.map((row: any) => Number(row.Total_Leads_Count) || 0);
    const convertedCount = this.summaryRows.map((row: any) => Number(row.Conversion_Count) || 0);

    this.conversionChartData = {
      labels,
      datasets: [
        {
          label: 'Total Leads',
          data: totalLeads,
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          barThickness: 24,
        },
        {
          label: 'Converted Count',
          data: convertedCount,
          backgroundColor: '#10b981',
          borderRadius: 8,
          barThickness: 24,
        },
      ],
    };
  }

  formatDate(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString('en-GB').replace(/\//g, '-');
  }
}
