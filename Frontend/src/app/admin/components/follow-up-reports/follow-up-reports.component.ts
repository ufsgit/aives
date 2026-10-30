import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-follow-up-reports',
  imports: [CommonModule],
  templateUrl: './follow-up-reports.component.html',
  styleUrl: './follow-up-reports.component.scss'
})
export class FollowUpReportsComponent {
  // Table Data
 displayedColumns = [
  'Student_ID',
  'Name', // merged First_Name + Last_Name
  'Email',
  'Branch_Name',
  'Entry_Date'
];

}
