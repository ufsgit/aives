import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { user_Service } from '../../services/user.Service';

interface TeamStaff {
  User_ID: number;
  Full_Name: string;
  IsSelected: boolean;
}

@Component({
  selector: 'app-view-team-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-team-assignment.component.html',
  styleUrl: './view-team-assignment.component.scss',
})
export class ViewTeamAssignmentComponent {
  @Input() teamLeadId!: number;
  @Input() teamLeadName: string = '';
  @Output() closeView = new EventEmitter<void>();

  private user_Service_ = inject(user_Service);
  private dialogBox = inject(MatDialog);

  staffList: TeamStaff[] = [];
  isLoading: boolean = false;

  ngOnInit() {
    if (!this.teamLeadId) {
      this.closeView.emit();
      return;
    }

    this.loadTeamAssignment();
  }

  loadTeamAssignment() {
    this.isLoading = true;
    this.user_Service_.Get_Staff_Team_Assignment(this.teamLeadId).subscribe(
      (rows) => {
        this.staffList = (rows || []).map((item: any) => ({
          User_ID: item.User_ID,
          Full_Name: item.Full_Name,
          IsSelected: !!item.IsSelected,
        }));
        this.isLoading = false;
      },
      () => {
        this.isLoading = false;
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occured', Type: '2' },
        });
      }
    );
  }

  SaveTeamAssignment() {
    const payload = {
      teamLeadId: this.teamLeadId,
      staffIds: this.staffList
        .filter((staff) => staff.IsSelected)
        .map((staff) => staff.User_ID),
    };

    this.user_Service_.Save_Staff_Team_Assignment(payload).subscribe(
      () => {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Team updated successfully', Type: 'false' },
        });
        this.closeView.emit();
      },
      () => {
        this.dialogBox.open(DialogBox_Component, {
          panelClass: 'Dialogbox-Class',
          data: { Message: 'Error Occured', Type: '2' },
        });
      }
    );
  }

  Cancel() {
    this.closeView.emit();
  }
}
