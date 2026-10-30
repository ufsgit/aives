import { Component, OnInit } from '@angular/core';
import { user_Service } from '../../services/user.Service';
import { SharedModule } from '../../../shared/shared.module';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-student-appinfo',
  standalone: true,
  templateUrl: './student-appinfo.component.html',
  styleUrls: ['./student-appinfo.component.scss'],
  imports:[CommonModule,SharedModule]
})
export class StudentAppinfoComponent implements OnInit {
  appInfoList: any[] = [];
  filters = {
    isStudent: 1,
    appVersion: '',
    fromDate: '',
    toDate: '',
    nameSearch: '',
    isBatteryOptimized: null,
    page: 1, 
    pageSize: 10
  };
 // Adjust as necessary
  totalPages: number = 0; // This should be calculated based on total items

  constructor(private user_Service: user_Service) {}

  ngOnInit(): void {
    this.getAppInfoList();
  }
  onStudentChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.filters.isStudent = checkbox.checked ? 1 : 0;
  }
  getAppInfoList() {
    this.user_Service.Get_AppInfo_List(this.filters).subscribe(
      (data: any) => {
        this.appInfoList = data[1];
        this.totalPages = Math.ceil(data[0][0].total_count / this.filters.pageSize); // Calculate total pages
      },
      (error) => {
        console.error('Error fetching app info list', error);
      }
    );
  }

  nextPage() {
    if (this.filters.page < this.totalPages) {
      this.filters.page++;
      this.getAppInfoList(); // Fetch data for the new page
    }
  }

  previousPage() {
    if (this.filters.page > 1) {
        this.filters.page--;
      this.getAppInfoList(); // Fetch data for the new page
    }
  }
}

