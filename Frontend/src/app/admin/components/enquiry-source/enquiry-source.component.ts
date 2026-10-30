import { Component, inject } from '@angular/core';
import { student_Service } from '../../services/student.Service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { SharedModule } from "../../../shared/shared.module";
import { NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-enquiry-source',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './enquiry-source.component.html',
  styleUrl: './enquiry-source.component.scss'
})
export class EnquirySourceComponent {
  saveEnquirySource: any = ''
  getEnquirySources: any = ''
  save_status: boolean = false;
  selectedEnquiryID: any = 0;
  dialogBox = inject(MatDialog);
  url=inject(ActivatedRoute)
  searchQuery:string=''
  filteredEnquirySource: any[] = []; 
  noResults: boolean = false;
  isLoading: boolean = false;
  validButton!: NgForm;

  isEdit: boolean = true;
  isSave: boolean = true;
  isDelete: boolean = true;

  constructor(private studentApi: student_Service) { }

  ngOnInit() {
    this.getEnquirySource();

    this.url.queryParams.subscribe(params => {
      console.log("params",params);
      if (params['item']) {
        const receivedItem = JSON.parse(params['item']);
        console.log('Received Item:', receivedItem);

        this.isEdit = receivedItem?.IsEdit || false;
        this.isSave = receivedItem?.IsSave || false;
        this.isDelete = receivedItem?.IsDelete || false;

        console.log('Permissions:', this.isEdit, this.isSave, this.isDelete);
      }
    });
  }

  //Add Enquiry Source
  addEnquirySource() {
    this.save_status = true;
    this.searchQuery = '';
    this.filteredEnquirySource = this.getEnquirySources;
    this.noResults = false;
  }

  //Save Enquiry Source
  Save_Enquiry_Source(validButton: NgForm) {
    const data = {
      Enquiry_Source_Id: this.selectedEnquiryID || 0,
      Enquiry_Source_Name: this.saveEnquirySource
    };

    this.studentApi.Save_Enquiry_Source(data).subscribe((result) => {
      console.log("result", result);
      this.getEnquirySource();
      this.saveEnquirySource = '';
      this.selectedEnquiryID = null;
      validButton?.resetForm();
      this.save_status = false;
    });
  }

  cancelEdit() {
    this.saveEnquirySource = '';
    this.selectedEnquiryID = 0;
    this.save_status = false;
  }

  editEnquirySource(list:any) {
    this.save_status = true;
    this.saveEnquirySource = list.Enquiry_Source_Name
    this.selectedEnquiryID = list.Enquiry_Source_Id
  }

  deleteEnquirySource(data: any) {
    const Enquiry_Source_Id = data.Enquiry_Source_Id
    const dialogRef = this.dialogBox.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: {
        Message: 'Do you want to delete ?',
        Type: true,
        Heading: 'Confirm',
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result == 'Yes') {
        this.studentApi
          .Delete_Enquiry_Source(Enquiry_Source_Id)
          .subscribe((Res) => {
            console.log('Res: ', Res);
            this.getEnquirySource();
          });
      }
    });
  }

  getEnquirySource() {
    this.isLoading=true
    this.studentApi.Get_All_Enquiry().subscribe((enquirySource) => {
      this.getEnquirySources = enquirySource
      this.filteredEnquirySource = enquirySource
      console.log(enquirySource);
      this.isLoading=false
    })
  }

  searchEnquirySource(): void {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredEnquirySource = this.getEnquirySources;
      this.noResults = false;
      return;
    }
    
    this.filteredEnquirySource = this.getEnquirySources.filter((item: any) =>
      item.Enquiry_Source_Name.toLowerCase().includes(query)
    );

    this.noResults = this.filteredEnquirySource.length === 0;
  }
}
