import { Component, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { user_Service } from '../../services/user.Service';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { course_Service } from '../../services/course.Service';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
    selector: 'app-teacher-report',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatInputModule, 
             MatAutocompleteModule, MatDatepickerModule, MatButtonModule, MatIconModule],
    providers: [provideNativeDateAdapter()],
    templateUrl: './teacher-report.component.html'
})
export class TeacherReportComponent implements OnInit {
    @ViewChild('Course', { static: false }) Course!: ElementRef<HTMLInputElement>;
    @ViewChild('Teacher', { static: false }) Teacher!: ElementRef<HTMLInputElement>;
    @ViewChild('Batch', { static: false }) Batch!: ElementRef<HTMLInputElement>;

    // Form Controls
    selectedCourse = new FormControl();
    selectedTeacher = new FormControl();
    selectedBatch = new FormControl();
    fromDate = new FormControl(new Date());
    toDate = new FormControl(new Date());

    private user = inject(user_Service);
    private course = inject(course_Service);
    private teacherService = inject(user_Service);

    // Table Data
    tableData: any[] = [];
    displayedColumns = ['Teacher_Name', 'Batch_Name', 'Course_Name', 'Start_Time', 'End_Time', 'Duration'];
    totalDuration = '';

    // Pagination
    pageSize = 25;
    currentPage = 1;
    totalRecords = 0;
    Math = Math;

    // Filter Options
    courseDatas: any[] = [];
    teacherDatas: any[] = [];
    batchDatas: any[] = [];
    coursefilteredOptions: any[] = [];
    teacherfilteredOptions: any[] = [];
    batchfilteredOptions: any[] = [];
    isLoading = false;

    constructor() {}

    ngOnInit() {
        this.loadInitialData();
    }

    /**
     * Loads initial data for courses, teachers, and batches
     */
    loadInitialData() {
      const params = {
        user_Name:  '',
        slot_wise: null,
        batch_wise:  null,
        course_id: 0,  // Use 0 if null/undefined
        hod_only: null
      }
        this.isLoading = true;
        forkJoin({
            courseNames: this.course.get_course_names(),
            courseItems: this.course.Get_All_Course_Items(),
            teachers: this.teacherService.Search_user(params  )
            
        }).subscribe({
            next: ({ courseNames, courseItems, teachers }) => {
              console.log('teachers: ', teachers);
                this.courseDatas = this.coursefilteredOptions = courseNames[0] || [];
                this.teacherDatas = this.teacherfilteredOptions = teachers || [];
                this.batchDatas = this.batchfilteredOptions = courseItems[3] || [];
                this.fetchReportData();
              },
              complete: () => {
                (this.isLoading = false)
                console.log('    this.teacherDatas : ',     this.teacherDatas );
              }
            });
          }

    displayFn(item: any): string {
      return item ? item.Course_Name || item.First_Name || item.Batch_Name || '' : '';
  }
    /**
     * Fetch report data based on selected filters
     */
    fetchReportData() {
        this.isLoading = true;
        const params = {
            Teacher_ID: this.selectedTeacher.value?.Teacher_ID || 0,
            Batch_ID: this.selectedBatch.value?.Batch_ID || 0,
            Course_ID: this.selectedCourse.value?.Course_ID || 0,
          fromDate: this.fromDate.value?.toLocaleDateString('en-CA') || '',
            toDate: this.toDate.value?.toLocaleDateString('en-CA') || ''
        };

        this.user.Get_Report_TeacherLiveClasses_By_BatchAndTeacher(
            params.Teacher_ID, 
            params.Batch_ID, 
            params.Course_ID,
            params.fromDate, 
            params.toDate, 
            this.currentPage, 
            this.pageSize
        ).subscribe({
            next: (res: any) => {
                const [countResult, data] = res;
                this.tableData = data || [];
                this.totalDuration = data?.[0]?.Total_Duration || 'N/A';
                this.totalRecords = countResult?.[0]?.total_count || 0;
            },
            complete: () => (this.isLoading = false)
        });
    }

    /**
     * Clears all filters and resets data
     */
    clearFilters() {
        [this.selectedCourse, this.selectedTeacher, this.selectedBatch].forEach(control => control.reset());
        this.toDate.setValue(new Date());
        this.fromDate.setValue(new Date());
        this.currentPage = 1;
        this.fetchReportData();
    }

    /**
     * Handles pagination change event
     * @param event Pagination event data
     */
    onPageChange(event: any) {
        this.currentPage = event.pageIndex + 1;
        this.pageSize = event.pageSize;
        this.fetchReportData();
    }

    /**
     * Filters options based on user input
     * @param type Filter type: course, teacher, or batch
     */
    filter(type: string) {
        const searchValue = (this[type as keyof this] as ElementRef<HTMLInputElement>).nativeElement.value.toLowerCase();

        switch (type) {
            case 'course':
                this.coursefilteredOptions = this.courseDatas.filter(option =>
                    option.Course_Name.toLowerCase().includes(searchValue)
                );
                break;
            case 'teacher':
                this.teacherfilteredOptions = this.teacherDatas.filter(option =>
                    option.Teacher_Name.toLowerCase().includes(searchValue)
                );
                break;
            case 'batch':
                this.batchfilteredOptions = this.batchDatas.filter(option =>
                    option.Batch_Name.toLowerCase().includes(searchValue)
                );
                break;
        }
    }
}
