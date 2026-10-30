import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CampaignService } from '../../services/campaign.service';
import { user_Service } from '../../services/user.Service';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { MatDialog } from '@angular/material/dialog';
import { Campaign } from '../../../core/models/campaign';

@Component({
    selector: 'app-campaign',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './campaign.component.html',
    styleUrl: './campaign.component.scss'
})
export class CampaignComponent implements OnInit {
    private campaignService = inject(CampaignService);
    private userService = inject(user_Service);
    private fb = inject(FormBuilder);
    private dialogBox = inject(MatDialog);

    campaignForm: FormGroup;
    campaignData: Campaign[] = [];
    users: any[] = [];
    selectedUserIDs: number[] = [];
    Entry_View = false;
    isLoading = false;
    campaignNameSearch = '';

    constructor() {
        this.campaignForm = this.fb.group({
            Campaign_ID: [0],
            Campaign_Name: ['', Validators.required],
            Campaign_Number: ['']
        });
    }

    ngOnInit(): void {
        this.loadUsers();
        this.searchCampaigns();
    }

    loadUsers() {
        this.userService.Search_user({}).subscribe(rows => {
            this.users = rows;
        });
    }

    searchCampaigns() {
        this.isLoading = true;
        this.campaignService.Search_Campaign(this.campaignNameSearch).subscribe({
            next: (rows) => {
                this.campaignData = rows;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    onUserCheckboxChange(userId: number, event: any) {
        if (event.target.checked) {
            this.selectedUserIDs.push(userId);
        } else {
            this.selectedUserIDs = this.selectedUserIDs.filter(id => id !== userId);
        }
    }

    isUserSelected(userId: number): boolean {
        return this.selectedUserIDs.includes(userId);
    }

    create() {
        this.Entry_View = true;
        this.selectedUserIDs = [];
        this.campaignForm.reset({
            Campaign_ID: 0,
            Campaign_Name: '',
            Campaign_Number: ''
        });
    }

    close() {
        this.Entry_View = false;
    }

    save() {
        if (this.campaignForm.valid) {
            if (this.selectedUserIDs.length === 0) {
                this.dialogBox.open(DialogBox_Component, { 
                    panelClass: 'Dialogbox-Class', 
                    data: { Message: 'Please select at least one user', Type: "2" } 
                });
                return;
            }

            this.isLoading = true;
            const payload = {
                ...this.campaignForm.value,
                User_IDs: this.selectedUserIDs
            };

            this.campaignService.Save_Campaign(payload).subscribe({
                next: (res) => {
                    this.isLoading = false;
                    this.dialogBox.open(DialogBox_Component, { 
                        panelClass: 'Dialogbox-Class', 
                        data: { Message: 'Campaign Saved Successfully', Type: "false" } 
                    });
                    this.Entry_View = false;
                    this.searchCampaigns();
                },
                error: (err) => {
                    this.isLoading = false;
                    this.dialogBox.open(DialogBox_Component, { 
                        panelClass: 'Dialogbox-Class', 
                        data: { Message: 'Error: ' + err.message, Type: "2" } 
                    });
                }
            });
        } else {
            this.dialogBox.open(DialogBox_Component, { 
                panelClass: 'Dialogbox-Class', 
                data: { Message: 'Please fill all required fields', Type: "2" } 
            });
        }
    }

    edit(campaign: Campaign) {
        this.Entry_View = true;
        this.campaignForm.patchValue(campaign);
        this.selectedUserIDs = campaign.User_IDs || [];
    }

    delete(campaignId: number) {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: 'Do you want to delete this campaign?', Type: true, Heading: 'Confirm' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'Yes') {
                this.isLoading = true;
                this.campaignService.Delete_Campaign(campaignId).subscribe({
                    next: () => {
                        this.isLoading = false;
                        this.searchCampaigns();
                        this.dialogBox.open(DialogBox_Component, { 
                            panelClass: 'Dialogbox-Class', 
                            data: { Message: 'Deleted Successfully', Type: "false" } 
                        });
                    },
                    error: (err) => {
                        this.isLoading = false;
                        this.dialogBox.open(DialogBox_Component, { 
                            panelClass: 'Dialogbox-Class', 
                            data: { Message: 'Error deleting campaign', Type: "2" } 
                        });
                    }
                });
            }
        });
    }
}
