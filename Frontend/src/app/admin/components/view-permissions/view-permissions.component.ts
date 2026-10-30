import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { BaseApi } from '../../../shared/services/_BaseApi.Service';
import { CommonModule } from '@angular/common';
import { SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { user_Service } from '../../services/user.Service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';

interface Permission {
  Menu_ID: number;
  Menu_Name: string;
  View: boolean;
  Save: boolean;
  Edit: boolean;
  Delete: boolean;
}

@Component({
  selector: 'app-view-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-permissions.component.html',
  styleUrl: './view-permissions.component.scss',
})
export class ViewPermissionsComponent {
  @Input() userId!: number;
  @Output() userIdChange = new EventEmitter<number>(); // or string or any type

  private http = inject(BaseApi);
  dialogBox = inject(MatDialog);
  user_Service_ = inject(user_Service);
  menuItems: Permission[] = [];
  viewAll: boolean = false;
  saveAll: boolean = false;
  editAll: boolean = false;
  deleteAll: boolean = false;

  // ngOnChanges(changes: SimpleChanges) {
  //   if (changes['userId'] && this.userId) {
  //     // this.get_Menu_Permissions();
  //   }
  // }

  constructor() {}

  ngOnInit() {
    
    console.log('userId in ngOnInit:', this.userId);
    if (this.userId == 0) {
      this.getMenu();
    } else {
      this.get_Menu_Permissions(this.userId);
    }
  }

  async getMenu() {
    const response = await this.http.get('Get_All_Menu');
    this.menuItems = response.map((item) => ({
      Menu_ID: item.Menu_ID,
      Menu_Name: item.Menu_Name,
      View: false,
      Save: false,
      Edit: false,
      Delete: false,
    }));
  }

  async get_Menu_Permissions(userId: any) {
    // 1. Fetch all menu permissions for the user (including saved flags)
    // const response = await this.http.get(`user/Get_All_Menu_Permission?userId=${userId}`);
    //const response = await this.http.get(`user/Get_All_Menu_Permission/${userId}`);
    // console.log('The Response is:', response);

    this.user_Service_.Get_All_Menu_Permissions(userId).subscribe((res) => {
      this.menuItems = res[0].map((item) => ({
        Menu_ID: item.Menu_ID,
        Menu_Name: item.Menu_Name,
        View: item.IsView, // currently expecting `View`
        Save: item.IsSave,
        Edit: item.IsEdit,
        Delete: item.IsDelete,
      }));

      console.log('res[0]', res[0]);
      console.log('this.menuItems', this.menuItems);
    });

    // 2. Map the response to menuItems with the saved permission flags
    // this.menuItems = response.map(item => ({
    //   Menu_ID: item.Menu_ID,
    //   Menu_Name: item.Menu_Name,
    //   View: item.View === 1,     // currently expecting `View`
    //   Save: item.Save === 1,
    //   Edit: item.Edit === 1,
    //   Delete: item.Delete === 1,
    // }));

    // Optional: Update "Select All" checkboxes if needed
    this.updateSelectAllCheckboxes();
  }

  //

  updateSelectAllCheckboxes() {
    this.viewAll = this.menuItems.every((item) => item.View);
    this.saveAll = this.menuItems.every((item) => item.Save);
    this.editAll = this.menuItems.every((item) => item.Edit);
    this.deleteAll = this.menuItems.every((item) => item.Delete);
  }

  toggleAll(column: keyof Permission, checked: boolean) {
    this.menuItems.forEach((menu) => {
      (menu[column] as boolean) = checked;
    });
  }

  Save_Permission() {
    const payload = this.menuItems.map((item) => ({
      User_Id: this.userId,
      Menu_ID: item.Menu_ID,
      View: item.View ? 1 : 0,
      Save: item.Save ? 1 : 0,
      Edit: item.Edit ? 1 : 0,
      Delete: item.Delete ? 1 : 0,
    }));

    console.log('Sending permission data:', payload);

    // Save_User_Permission
    this.user_Service_.Save_User_Permission(payload).subscribe((res) => {
      console.log('res', res);

      const dialogRef = this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: { Message: 'Save User Permission', Type: 'false' },
      });
      this.userIdChange.emit(this.userId);
    });
  }
  Cancel() {
    this.userIdChange.emit(0);
  }
}
