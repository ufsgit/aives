import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { student_Service } from '../../services/student.Service';

@Component({
  selector: 'app-status-report',
  standalone: true,
  imports: [CommonModule, FormsModule, NgChartsModule],
  templateUrl: './status-report.component.html',
  styleUrl: './status-report.component.scss'
})
export class StatusReportComponent implements OnInit {
  private studentService = inject(student_Service);
  
  statusData: any[] = [];
  isLoading = true;
  totalRecords = 0;

  fromDate = '';
  toDate = '';
  useCreatedDate = true;
  selectedView: 'table' | 'graph' = 'table';

  // Chart Configuration
  public chartType: ChartType = 'bar';
  public chartData: ChartData<'bar'> = {
    labels: [],
    datasets: [],
  };
  public chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: '#64748b' },
        grid: { color: '#e2e8f0' },
      },
      x: {
        ticks: { color: '#475569' },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { usePointStyle: true },
      },
    },
  };

  ngOnInit() {
    const today = this.getToday();
    this.fromDate = today;
    this.toDate = today;
    this.loadStatusReport();
  }

  loadStatusReport() {
    this.isLoading = true;
    const fDate = this.useCreatedDate ? this.fromDate : '';
    const tDate = this.useCreatedDate ? this.toDate : '';

    this.studentService.Get_Status_Report(fDate, tDate).subscribe({
      next: (data) => {
        this.statusData = data;
        this.totalRecords = this.statusData.reduce((acc, curr) => acc + curr.RecordCount, 0);
        this.updateChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching status report:', err);
        this.isLoading = false;
      }
    });
  }

  applyFilters() {
    this.loadStatusReport();
  }

  onDateRangeChanged() {
    if (this.toDate && this.fromDate && this.toDate < this.fromDate) {
      this.toDate = this.fromDate;
    }
    this.applyFilters();
  }

  getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private updateChartData() {
    const labels = this.statusData.map(item => item.Status_Name);
    const counts = this.statusData.map(item => item.RecordCount);
    const colors = this.statusData.map(item => item.Status_Color || '#3B82F6');

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Record Count',
          data: counts,
          backgroundColor: '#10b981',
          borderRadius: 6,
          barThickness: 30,
        }
      ]
    };
  }
}
