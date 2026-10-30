import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { student_Service } from '../../services/student.Service';
import { course_Service } from '../../services/course.Service';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-registrationreport',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './registrationreport.component.html',
  styleUrls: ['./registrationreport.component.scss'],
  providers: [DatePipe]
})
export class RegistrationreportComponent implements OnInit {
  student_Service_ = inject(student_Service);
  course_Service_ = inject(course_Service);
  datePipe = inject(DatePipe);
  route = inject(ActivatedRoute);

  // Filters
  searchTerm: string = '';
  fromDate: string = '';
  toDate: string = '';
  selectedCourseId: number | null = null;
  selectedEnrolledById: number | null = null;
  activeStatus: string = 'all';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  Total_Entries: number = 0;

  // Data arrays
  reportData: any[] = [];
  courseList: any[] = [];
  staffData: any[] = [];
  statusData: any[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'dropout', label: 'Dropout' }
  ];

  isLoading: boolean = false;
  searchTimeout: any;

  filepath = environment['FilePath'];

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['fromDate']) this.fromDate = params['fromDate'];
      if (params['toDate']) this.toDate = params['toDate'];
      if (params['enrolledById']) this.selectedEnrolledById = Number(params['enrolledById']);
      
      this.loadDropdowns();
      this.Search_Report();
    });
  }

  loadDropdowns() {
    this.student_Service_.Course_Dropdown().subscribe((res: any) => {
      this.courseList = res;
    });

    this.student_Service_.User_Dropdown().subscribe((res: any) => {
      this.staffData = res;
    });
  }

  onSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.Search_Report();
    }, 500);
  }

  onFilterChange() {
    this.currentPage = 1;
    this.Search_Report();
  }

  Search_Report() {
    this.isLoading = true;
    this.student_Service_.Get_Registration_Report(
      this.searchTerm,
      this.currentPage,
      this.pageSize,
      this.selectedCourseId,
      null, // batchId not needed in report filter per prompt, or we pass null
      'all', // enrollment_status (always all enrolled for this report)
      this.activeStatus,
      this.fromDate,
      this.toDate,
      this.selectedEnrolledById
    ).subscribe((res: any) => {
      if (res && res.length >= 2) {
        this.Total_Entries = res[0] && res[0][0] ? (res[0][0].total_count || 0) : 0;
        this.reportData = res[1] || [];
      } else {
        this.Total_Entries = 0;
        this.reportData = [];
      }
      this.isLoading = false;
    }, err => {
      console.error(err);
      this.isLoading = false;
      this.Total_Entries = 0;
      this.reportData = [];
    });
  }

  // Pagination Helpers
  get totalPages(): number {
    return Math.ceil(this.Total_Entries / this.pageSize);
  }

  getPageNumbers(): number[] {
    const maxPagesToShow = 5;
    const pages: number[] = [];
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.Search_Report();
    }
  }

  changePageSize(newSize: string): void {
    this.pageSize = parseInt(newSize, 10);
    this.currentPage = 1;
    this.Search_Report();
  }

  getStartIndex(): number {
    if (this.Total_Entries === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.Total_Entries);
  }
}
