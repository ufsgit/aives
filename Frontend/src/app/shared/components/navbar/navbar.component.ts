import { Component, HostListener, OnInit, inject } from '@angular/core';
import {
  ActivatedRoute,
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
} from '@angular/router';
import { ObservablesService } from '../../services/observables.service';
import { Subscription, filter, map } from 'rxjs';
import { BaseApi } from '../../services/_BaseApi.Service';
import { user_Service } from '../../../admin/services/user.Service';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../components/DialogBox/DialogBox.component';
import { student_Service } from '../../../admin/services/student.Service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: false,
})
export class NavbarComponent implements OnInit {

  // ✅ Inject Services
  private router = inject(Router);
  private dataService = inject(ObservablesService);
  private activatedRoute = inject(ActivatedRoute);
  private http = inject(BaseApi);
  user_Service = inject(user_Service);
  private dialog = inject(MatDialog);
  student_Service = inject(student_Service);

  todayFollowUpsCount: number = 0;
  pendingFollowUpsCount: number = 0;
  interestedLeadsCount: number = 0;
  isNotificationDropdownOpen: boolean = false;

  // ✅ UI State
  menuOpen: boolean = false;
  menuItems: any[] = [];
  private routerSubscription?: Subscription;

  user = localStorage.getItem('User_Type');
  title: string = 'Dashboard';
  userEmail: string = '';
  First_Name: string = '';

  isSidebarVisible: boolean = true;
  isSidebarPinned: boolean = true;
  isSmallScreen: boolean = false;

  constructor() {
    if (localStorage.getItem('Access_Token')) {
      this.getMenu();
    }
  }

  // ✅ Screen Resize
  @HostListener('window:resize')
  onResize() {
    this.isSmallScreen = window.innerWidth <= 768;
  }

  // ✅ Sidebar Controls
  toggleSidebar() {
    if (!this.isSidebarPinned) {
      this.isSidebarVisible = !this.isSidebarVisible;
    }
  }

  togglePinSidebar() {
    this.isSidebarPinned = !this.isSidebarPinned;
    this.isSidebarVisible = this.isSidebarPinned;
  }

  // ✅ MAIN MENU FUNCTION (Mail Report INCLUDED HERE)
  async getMenu() {
    const User_Id = localStorage.getItem('User_Id');

    if (!User_Id) {
      console.error('User_Id not found');
      this.menuItems = [];
      return;
    }

    const menuOrder = [
      'Dashboard',
      'Lead',
      'Import',
      'Student',
      'My Students',
      'Attendance',
      'Mark Attendance',
      'Expenses',
      'Income',
      'Staff',
      'Email Template',
      'Mail Report',
      'Campaign',
      'Enquiry Source',
      'Enquiry Summary',
      'Lead Summary',
      'Expense Category',
      'Expense Type',
      'Course',
      'Student Reports',
      'Mock Test Subscribed',
      'Exam Upload',
      'Studentfile upload',
      'Fees Total Outstanding',
      'Upcoming Installment',
      'Due Instalment',
      'Account Reports',
      'Registration Reports',
      'Registration Summary',
      'Work Report',
      'Enquiry Conversion',
      'Status Report',
    ];

    this.user_Service.Get_user_Menus(User_Id).subscribe({
      next: (res: any) => {
        let items = Array.isArray(res?.[0]) ? res[0] : [];

        // ✅ Remove unwanted menu
        items = items.filter((item: any) => item?.Menu_Name !== 'Leave' && item?.Menu_Name !== 'Exam Upload');

        // ✅ Normalize menu names
        items = items.map((item: any) => {
          let name = item.Menu_Name?.trim();
          if (name === 'Reports') name = 'Account Reports';
          if (name === 'Email') name = 'Email Template';
          return { ...item, Menu_Name: name };
        });

        // Deduplicate items by Menu_Name
        const seen = new Set();
        items = items.filter((item: any) => {
          const key = item.Menu_Name;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Store allowed menu names in localStorage for route guards
        const allowedMenuNames = items.map((item: any) => item.Menu_Name);
        localStorage.setItem('Allowed_Menus', JSON.stringify(allowedMenuNames));

        const staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
        const userEmail = (localStorage.getItem('Email') || '').toLowerCase().trim();
        const isAdmin = staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';

        // ✅ Only inject fallback reports for Super Admin so other users see ONLY their assigned permissions
        if (isAdmin) {
          // ✅ 👉 Ensure Mail Report is always present
          const mailReportExists = items.some(
            (item: any) => item.Menu_Name === 'Mail Report'
          );

          if (!mailReportExists) {
            items.push({
              Menu_ID: 'fallback-mail-report',
              Menu_Name: 'Mail Report',
              Route: '/admin/Mail_Report',
            });
          }

          // ✅ 👉 Ensure Batch Mail Report is always present
          const batchMailReportExists = items.some(
            (item: any) => item.Menu_Name === 'Batch Mail Report'
          );

          if (!batchMailReportExists) {
            items.push({
              Menu_ID: 'fallback-batch-mail-report',
              Menu_Name: 'Batch Mail Report',
              Route: '/admin/batch-mail-report',
            });
          }

          // ✅ 👉 Ensure Status Report is always present
          const statusReportExists = items.some(
            (item: any) => item.Menu_Name === 'Status Report'
          );

          if (!statusReportExists) {
            items.push({
              Menu_ID: 'fallback-status-report',
              Menu_Name: 'Status Report',
              Route: '/admin/Status_Report',
            });
          }

          // ✅ 👉 Ensure Lead Summary is always present
          const leadSummaryExists = items.some(
            (item: any) => item.Menu_Name === 'Lead Summary'
          );

          if (!leadSummaryExists) {
            items.push({
              Menu_ID: 'fallback-lead-summary',
              Menu_Name: 'Lead Summary',
              Route: '/admin/Lead_Summary',
            });
          }

          // ✅ 👉 Ensure Mock Test Subscribed is always present
          const mockTestExists = items.some(
            (item: any) => item.Menu_Name === 'Mock Test Subscribed'
          );

          if (!mockTestExists) {
            items.push({
              Menu_ID: 'fallback-mock-test',
              Menu_Name: 'Mock Test Subscribed',
              Route: '/admin/mock-test-subscribed',
            });
          }

          // ✅ 👉 Ensure Registration Summary is always present
          const registrationSummaryExists = items.some(
            (item: any) => item.Menu_Name === 'Registration Summary'
          );

          if (!registrationSummaryExists) {
            items.push({
              Menu_ID: 'fallback-registration-summary',
              Menu_Name: 'Registration Summary',
              Route: '/admin/Registration_Summary',
            });
          }

          // ✅ 👉 Ensure Attendance is always present
          const attendanceExists = items.some(
            (item: any) => item.Menu_Name === 'Attendance' || item.Menu_Name === 'Mark Attendance'
          );

          if (!attendanceExists) {
            items.push({
              Menu_ID: 'fallback-attendance',
              Menu_Name: 'Attendance',
              Route: '/admin/Mark_Attendance',
            });
          }
        }

        // ✅ Fix routes
        items = items.map((item: any) => ({
          ...item,
          Route: this.getMenuRoute(item),
        }));

        // ✅ Sort menu
        items.sort((a: any, b: any) => {
          const indexA = menuOrder.indexOf(a.Menu_Name);
          const indexB = menuOrder.indexOf(b.Menu_Name);

          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;

          return indexA - indexB;
        });

        this.menuItems = items;

        console.log('Final Menu:', this.menuItems);
      },

      error: (err) => {
        console.error('Menu API error:', err);

        const staffId = parseInt(localStorage.getItem('User_Id') || localStorage.getItem('User_ID') || '0');
        const userEmail = (localStorage.getItem('Email') || '').toLowerCase().trim();
        const isAdmin = staffId === 1 || userEmail === 'admin_user@g.com' || userEmail === 'cs.mgr@testprepinenglish.com';

        if (isAdmin) {
          this.menuItems = [
            {
              Menu_ID: 'fallback-mail-report',
              Menu_Name: 'Mail Report',
              Route: '/admin/Mail_Report',
            },
            {
              Menu_ID: 'fallback-batch-mail-report',
              Menu_Name: 'Batch Mail Report',
              Route: '/admin/batch-mail-report',
            },
            {
              Menu_ID: 'fallback-status-report',
              Menu_Name: 'Status Report',
              Route: '/admin/Status_Report',
            },
            {
              Menu_ID: 'fallback-lead-summary',
              Menu_Name: 'Lead Summary',
              Route: '/admin/Lead_Summary',
            },
            {
              Menu_ID: 'fallback-mock-test',
              Menu_Name: 'Mock Test Subscribed',
              Route: '/admin/mock-test-subscribed',
            },
            {
              Menu_ID: 'fallback-registration-summary',
              Menu_Name: 'Registration Summary',
              Route: '/admin/Registration_Summary',
            },
            {
              Menu_ID: 'fallback-attendance',
              Menu_Name: 'Attendance',
              Route: '/admin/Mark_Attendance',
            },
          ];
        } else {
          this.menuItems = [];
        }
      },
    });
  }

  // ✅ INIT
  ngOnInit(): void {
    this.onResize();
    this.student_Service.todayFollowUpsCount$.subscribe((count) => {
      this.todayFollowUpsCount = count;
    });
    this.student_Service.pendingFollowUpsCount$.subscribe((count) => {
      this.pendingFollowUpsCount = count;
    });
    this.student_Service.interestedLeadsCount$.subscribe((count) => {
      this.interestedLeadsCount = count;
    });

    this.routerSubscription = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => {
          let route = this.activatedRoute;
          while (route.firstChild) route = route.firstChild;
          return route;
        })
      )
      .subscribe((route) => {
        const breadcrumbData = this.getBreadcrumb(route.snapshot.data);

        localStorage.setItem('NavTitle', breadcrumbData.breadcrumb);
        this.dataService.setData('NavTitle', breadcrumbData.breadcrumb);

        this.title = breadcrumbData.breadcrumb;
      });

    const navTitle = this.dataService.getData('NavTitle');
    if (navTitle) {
      this.title = this.normalizeTitle(navTitle);
    }

    this.userEmail = this.dataService.getData('Email') || '';
    this.First_Name = this.dataService.getData('Name') || '';
  }

  // ✅ Breadcrumb
  getBreadcrumb(routeData: any): { breadcrumb: string } {
    let breadcrumb = this.normalizeTitle(routeData?.breadcrumb || '');

    if (breadcrumb === 'Faculty') {
      breadcrumb = 'Staff';
    }

    return { breadcrumb };
  }

  private normalizeTitle(title: string): string {
    return title === 'Reports' ? 'Account Reports' : title;
  }

  // ✅ Icon Handling
  getMaterialIcon(label: string): string {
    switch (label) {
      case 'Dashboard':
      case 'Lead Summary':
        return 'dashboard';
      case 'Lead':
      case 'Student':
      case 'My Students':
        return 'group';
      case 'Import':
        return 'upload_file';
      case 'Expenses':
      case 'Income':
        return 'account_balance_wallet';
      case 'Staff':
        return 'badge';
      case 'Attendance':
      case 'Mark Attendance':
        return 'how_to_reg';
      case 'Email Template':
      case 'Mail Report':
      case 'Batch Mail Report':
        return 'mail';
      case 'Campaign':
        return 'campaign';
      case 'Enquiry Source':
      case 'Enquiry Summary':
        return 'source';
      case 'Expense Category':
      case 'Expense Type':
        return 'category';
      case 'Course':
        return 'menu_book';
      case 'Student Reports':
      case 'Registration Reports':
      case 'Account Reports':
      case 'Status Report':
      case 'Work Report':
      case 'Registration Summary':
        return 'assessment';
      case 'Mock Test Subscribed':
      case 'Exam Upload':
        return 'quiz';
      case 'Studentfile upload':
        return 'folder_open';
      case 'Fees Total Outstanding':
      case 'Upcoming Installment':
      case 'Due Instalment':
        return 'receipt_long';
      case 'Enquiry Conversion':
        return 'sync_alt';
      case 'Status':
        return 'fact_check';
      default:
        return 'radio_button_unchecked';
    }
  }

  // ✅ Route Fix
  getMenuRoute(item: any): string {
    const route = item?.Route || '';

    if (!route) return '/admin/dash';

    return route.startsWith('/') ? route : `/admin/${route}`;
  }

  // ✅ Active Check
  isActive(link: string): boolean {
    const options: IsActiveMatchOptions = {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    };

    return this.router.isActive(link, options);
  }

  // ✅ Mobile Menu
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  // ✅ Logout
  logout() {
    const dialogRef = this.dialog.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Are you sure you want to log out?',
        Type: true,
        Heading: 'Confirm Logout',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'Yes') {
        this.routerSubscription?.unsubscribe();

        localStorage.clear();
        this.dataService.clearData();

        const userType = Number(this.user);

        if ([1, 2, 3].includes(userType)) {
          this.router.navigateByUrl('auth');
        } else if (userType === 4) {
          this.router.navigateByUrl('auth/user');
        } else {
          this.router.navigateByUrl('auth');
        }
      }
    });
  }

  // ✅ Menu Actions
  performAction(nav: string) {
    if (nav === 'Sign Out') {
      this.logout();
    }
  }

  isLeadPage(): boolean {
    return this.router.url.includes('Student_Lead');
  }

  toggleNotificationDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
  }

  onSelectTodayFollowUps() {
    this.isNotificationDropdownOpen = false;
    this.student_Service.openTodayFollowUpsModal$.next();
  }

  onSelectPendingFollowUps() {
    this.isNotificationDropdownOpen = false;
    this.student_Service.openPendingFollowUpsModal$.next();
  }

  onSelectInterestedLeads() {
    this.isNotificationDropdownOpen = false;
    this.student_Service.openInterestedLeadsModal$.next();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.isNotificationDropdownOpen && !target.closest('.notification-container')) {
      this.isNotificationDropdownOpen = false;
    }
  }
}
