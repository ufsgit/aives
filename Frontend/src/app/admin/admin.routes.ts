// admin/routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CategoryComponent } from './components/category/category.component';
import { CourseComponent } from './components/course/course.component';
import { TeacherComponent } from './components/teacher/teacher.component';
import { StudentComponent } from './components/student/student.component';
import { BatchComponent } from './components/course/batch/batch.component';
import { TeacherReportComponent } from './components/teacher-report/teacher-report.component';
import { StudentReportComponent } from './components/student-report/student-report.component';
import { ModuleComponent } from './components/module/module.component';
import { ReviewsComponent } from './components/reviews/reviews.component';
import { StudentAppinfoComponent } from './components/student-appinfo/student-appinfo.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { payment_installment_file_importComponent } from './components/payment_installment_file_import/payment_installment_file_import.component';
import { Course_Enrollment_ImportComponent } from './components/Course Enrollment Import/Course_Enrollment_Import.component';
import { ExamImportComponent } from './components/exam-import/exam-import.component';
import { LeadImportComponent } from './components/lead-import/lead-import.component';
import { ExpensesComponent } from './components/expenses/expenses.component';
import { ExpenseTypeComponent } from './components/expense-type/expense-type.component';
import { ReportsComponent } from './components/reports/reports.component';
import { TaxReportsComponent } from './components/tax-reports/tax-reports.component';
import { ExpenseCategoryComponent } from './components/expense-category/expense-category.component';
import { RegistrationreportComponent } from './components/registrationreport/registrationreport.component';
import { FeesTotalOutstandingComponent } from './components/fees-total-outstanding/fees-total-outstanding.component';
import { UpcomingInstallmentComponent } from './components/upcoming-installment/upcoming-installment.component';
import { DueInstalmentComponent } from './components/due-instalment/due-instalment.component';
import { StudentLeadComponent } from './components/student-lead/student-lead.component';
import { FollowUpReportsComponent } from './components/follow-up-reports/follow-up-reports.component';
import { FollowUpStatusComponent } from './components/follow-up-status/follow-up-status.component';
import { WorkReportComponent } from './components/work-report/work-report.component';
import { IncomeComponent } from './components/income/income.component';
import { LeaveComponent } from './components/leave/leave.component';
import { EnquirySourceComponent } from './components/enquiry-source/enquiry-source.component';
import { EnquiryConversionComponent } from './components/enquiry-conversion/enquiry-conversion.component';
import { MyStudentsComponent } from './components/my-students/my-students.component';
import { MarkAttendanceComponent } from './components/mark-attendance/mark-attendance.component';
import { AttendanceHistoryComponent } from './components/attendance-history/attendance-history.component';
import { EmailTemplateComponent } from './components/email-template/email-template.component';
import { MailReportComponent } from './components/mail-report/mail-report.component';
import { CampaignComponent } from './components/campaign/campaign.component';
import { StatusReportComponent } from './components/status-report/status-report.component';
import { BatchMailReportComponent } from './components/batch-mail-report/batch-mail-report.component';

export const ADMIN_ROUTES: Routes = [

  {
    path: "",
    pathMatch: "full",
    redirectTo: () => {
      const staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
      const userEmail = (localStorage.getItem('Email') || '').toLowerCase().trim();
      const isSuperAdmin = staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';

      const allowedMenus: string[] = JSON.parse(localStorage.getItem('Allowed_Menus') || '[]');

      if (isSuperAdmin || allowedMenus.includes('Dashboard')) {
        return 'dash';
      }
      if (allowedMenus.includes('Lead')) {
        return 'Student_Lead';
      }
      if (allowedMenus.includes('Student')) {
        return 'student';
      }
      if (allowedMenus.includes('Attendance') || allowedMenus.includes('Mark Attendance')) {
        return 'Mark_Attendance';
      }
      return 'dash';
    },
  },
  {
    path: 'dash',
    component: DashboardComponent,
    data: { breadcrumb: 'Dashboard' }

  },
  {
    path: 'category',
    component: CategoryComponent,
    data: { breadcrumb: 'Course Categories' }

  },
  {
    path: 'course',
    component: CourseComponent,
    data: { breadcrumb: 'Course' }
  },

  {

    path: 'Faculty',
    component: TeacherComponent,
    data: { breadcrumb: 'Faculty' }
  },
  {
    path: 'student',
    component: StudentComponent,
    data: { breadcrumb: 'Student' }
  },

  {
    path: 'teacher_Report',
    component: TeacherReportComponent,
    data: { breadcrumb: 'Teacher Report' }
  },
  {
    path: 'student_Report',
    component: StudentReportComponent,
    data: { breadcrumb: 'Student Report' }
  },
  {
    path: 'course_module',
    component: ModuleComponent,
    data: { breadcrumb: 'Levels' }
  },
  {
    path: 'reviews',
    component: ReviewsComponent,
    data: { breadcrumb: 'FeedBack' }
  },
  {
    path: 'student_appInfo',
    component: StudentAppinfoComponent,
    data: { breadcrumb: 'Student AppInfo' }
  },
  {
    path: 'Teacher_attendance',
    component: TeacherReportComponent,
    data: { breadcrumb: 'Teacher Attendance' }
  },
  {
    path: 'file-upload',
    component: FileUploadComponent,
    data: { breadcrumb: 'Studentfile upload' }
  },
  {
    path: 'payment_installment_file_import',
    component: payment_installment_file_importComponent,
    data: { breadcrumb: 'Upload Installment Data ' }
  },
  {
    path: 'Course_Enrollment_Import',
    component: Course_Enrollment_ImportComponent,
    data: { breadcrumb: 'Enrollment Upload ' }
  },
  {
    path: 'Exam_Import',
    component: ExamImportComponent,
    data: { breadcrumb: 'Exam Upload ' }
  },
  {
    path: 'Expenses',
    component: ExpensesComponent,
    data: { breadcrumb: 'Expenses ' }
  },
  {
    path: 'Expense_Type',
    component: ExpenseTypeComponent,
    data: { breadcrumb: 'Expense Type' }
  },
  {
    path: 'Expense_Category',
    component: ExpenseCategoryComponent,
    data: { breadcrumb: 'Expense Category' }
  },
  {
    path: 'Income',
    component: IncomeComponent,
    data: { breadcrumb: 'Income' }
  },
  {
    path: 'Reports',
    component: ReportsComponent,
    data: { breadcrumb: 'Account Reports' }
  },
  {
    path: 'Student_Reports',
    component: StudentReportComponent,
    data: { breadcrumb: 'Student Reports' }
  },
  {
    path: 'Tax_Reports',
    component: TaxReportsComponent,
    data: { breadcrumb: 'Tax Reports' }
  },
  {
    path: 'Registration_Report',
    component: RegistrationreportComponent,
    data: { breadcrumb: 'Registration  Reports' }
  },
  {
    path: 'Fees_Total_Outstanding',
    component: FeesTotalOutstandingComponent,
    data: { breadcrumb: 'Fees Total Outstanding' }
  },
  {
    path: 'Upcoming_Installment',
    component: UpcomingInstallmentComponent,
    data: { breadcrumb: 'Upcoming Installment' }
  },
  {
    path: 'Due_Instalment',
    component: DueInstalmentComponent,
    data: { breadcrumb: 'Due Instalment' }
  },
  {
    path: 'Student_Lead',
    component: StudentLeadComponent,
    data: { breadcrumb: 'Lead' }
  },
  {
    path: 'Import',
    component: LeadImportComponent,
    data: { breadcrumb: 'Import' }
  },
  {
    path: 'Follow_up_Reports',
    component: FollowUpReportsComponent,
    data: { breadcrumb: 'Follow-up Reports' }
  },
  {
    path: 'Follow_up_Status',
    component: FollowUpStatusComponent,
    data: { breadcrumb: 'Follow-up Status' }
  },
  {
    path: 'Leave',
    component: LeaveComponent,
    data: { breadcrumb: 'Leave' }
  },
  {
    path: 'Work_Report',
    component: WorkReportComponent,
    data: { breadcrumb: 'Work Report' }
  },
  {
    path: 'Enquiry_Source',
    component: EnquirySourceComponent,
    data: { breadcrumb: 'Enquiry Source' }
  },
  {
    path: 'Enquiry_Conversion',
    component: EnquiryConversionComponent,
    data: { breadcrumb: 'Enquiry Conversion' }
  },
  {
    path: 'My_Students',
    component: MyStudentsComponent,
    data: { breadcrumb: 'My Students' }
  },
  {
    path: 'Mark_Attendance',
    component: MarkAttendanceComponent,
    data: { breadcrumb: 'Mark Attendance' }
  },
  {
    path: 'Attendance',
    redirectTo: 'Mark_Attendance',
    pathMatch: 'full'
  },
  {
    path: 'attendance',
    redirectTo: 'Mark_Attendance',
    pathMatch: 'full'
  },
  {
    path: 'Attendance_History',
    component: AttendanceHistoryComponent,
    data: { breadcrumb: 'Attendance History' }
  },
  {
    path: 'Enquiry_Summary',
    loadComponent: () => import('./components/enquiry-summary/enquiry-summary.component').then(c => c.EnquirySummaryComponent),
    data: { breadcrumb: 'Enquiry Summary' }
  },
  {
    path: 'Lead_Summary',
    loadComponent: () => import('./components/lead-summary/lead-summary.component').then(c => c.LeadSummaryComponent),
    data: { breadcrumb: 'Lead Summary' }
  },
  {
    path: 'email',
    component: EmailTemplateComponent,
    data: { breadcrumb: 'Email' }
  },
  {
    path: 'Mail_Report',
    component: MailReportComponent,
    data: { breadcrumb: 'Mail Report' }
  },
  {
    path: 'Campaign',
    component: CampaignComponent,
    data: { breadcrumb: 'Campaign' }
  },
  {
    path: 'Status_Report',
    component: StatusReportComponent,
    data: { breadcrumb: 'Status Report' }
  },
  {
    path: 'batch-mail-report',
    component: BatchMailReportComponent,
    data: { breadcrumb: 'Batch Mail Report' }
  },
  {
    path: 'mock-test-subscribed',
    loadComponent: () => import('./components/mock-test-subscribed/mock-test-subscribed.component').then(m => m.MockTestSubscribedComponent),
    data: { breadcrumb: 'Mock Test Subscribed' }
  },
  {
    path: 'Registration_Summary',
    loadComponent: () => import('./components/registration-summary/registration-summary.component').then(m => m.RegistrationSummaryComponent),
    data: { breadcrumb: 'Registration Summary' }
  }
];

