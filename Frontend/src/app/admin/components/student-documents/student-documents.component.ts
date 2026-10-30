import {
  Component,
  EventEmitter,
  inject,
  Inject,
  Input,
  Optional,
  Output,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { student_Service } from '../../services/student.Service';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-student-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './student-documents.component.html',
  styleUrl: './student-documents.component.scss',
})
export class StudentDocumentsComponent {
  @Input() student: any;
  @Output() cancel = new EventEmitter<any>();

  // student = this.data.student;
  documentTypes: any[] = [];
  documentList: any[] = [];
  editingDocument: any = null; // ← to store the editing doc
  selectedDocType: number | null = null;
  selectedFile: File | null = null;
  dialogBox = inject(MatDialog);
  add_status: boolean = false;
  isLoading: boolean = false;

  constructor(
    private studentService: student_Service,
    @Inject(DOCUMENT) private document: Document,
    @Optional() public dialogRef?: MatDialogRef<StudentDocumentsComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data?: any
  ) {}

  goBack(): void {
    this.cancel.emit();
  }
  ngOnInit() {
    console.log("documentList",this.student);
    this.loadDocumentTypes();
    this.Get_StudentDocuments();
    
    
  }

  onCancel() {
    this.cancel.emit();
  }
  add_document() {
    this.add_status = !this.add_status;
    if (!this.add_status) {
      this.resetDocumentForm();
    }
  }
  resetDocumentForm() {
    this.selectedFile = null;
    this.selectedDocType = null;
    this.editingDocument = null;
    this.add_status = false;
  }

  editDocument(result: any): void {
    this.add_status = true;

    this.editingDocument = result;

    // Set selected doc type from the result
    this.selectedDocType = result.Document_Type_Name || '';

    // (Optional) If needed, you can store the old fileName or S3 key
  }

  deleteDocument(result: any) {
    const data = result;
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
        this.studentService
          .Delete_StudentDocument(data.Document_ID)
          .subscribe((res: any) => {
            console.log('res', res);
            if ((res as any).Deleted_Document_ID) {
              this.Get_StudentDocuments();
              const dialogRef = this.dialogBox.open(DialogBox_Component, {
                panelClass: 'Dialogbox-Class',
                data: { Message: 'Deleted', Type: 'false' },
              });
            }
          });
      }
    });
  }

  loadDocumentTypes() {
    this.studentService.Get_DocumentTypes().subscribe((res) => {
      this.documentTypes = res as any[];
    });
  }

  Get_StudentDocuments() {
    this.studentService
      .Get_StudentDocuments(this.student.Student_ID)
      .subscribe((res) => {
        this.documentList = res as any[];
        console.log('this.documentList', this.documentList);
      });
  }
  download(document: any): void {
    this.isLoading = true;
    const url = document.S3_Key;
    const fileName = document.fileName || 'student_document';

    this.downloadFileFromS3(url, fileName);
  }

  downloadFileFromS3(url: string, fileName: string = 'downloaded_file') {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);

        const link = this.document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.click();

        window.URL.revokeObjectURL(blobUrl); // Clean up memory
        this.isLoading = false;
      })
      .catch((error) => {
        this.isLoading = false;
        console.error('Download error:', error);
        alert('Failed to download file.');
      });
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async uploadDocument() {
    this.isLoading = true;
    if (!this.selectedDocType) {
      alert('Please select a document type.');
      return;
    }

    const studentName =
      `${this.student.First_Name}_${this.student.Student_ID}`.replace(
        /\s+/g,
        ''
      );
    const docType = this.selectedDocType;
    const docTypeId = this.documentTypes.find(
      (doc) => doc.Document_Type_Name === docType
    )?.Document_Type_Id;

    let fileURL = this.editingDocument?.Document_URL || '';
    let s3Key = this.editingDocument?.S3_Key || '';
    let uploadedFileName = this.editingDocument?.fileName || '';

    // Upload only if a new file is selected
    if (this.selectedFile) {
      const file = this.selectedFile;
      const key = `Trackbox/Students/${studentName}_${uuidv4()}`;

      const bucket = new S3({
        accessKeyId: environment.awsAccessKeyId,
        secretAccessKey: environment.awsSecretAccessKey,
        region: environment.awsRegion,
      });

      const params = {
        Bucket: environment.awsS3Bucket,
        Key: key,
        Body: file,
        ACL: 'public-read',
        ContentType: file.type,
      };

      try {
        const s3Result = await bucket.upload(params).promise();
        fileURL = s3Result.Location;
        s3Key = key;
        uploadedFileName = file.name;
      } catch (err) {
        console.error('S3 Upload Failed:', err);
        alert('Upload failed!');
        return;
      }
    }

    // Build payload
    const payload = {
      Document_ID: this.editingDocument?.Document_ID || 0,
      Student_ID: this.student.Student_ID,
      Document_Type_Id: docTypeId,
      Document_Name: docType,
      Document_URL: fileURL,
      S3_Key: s3Key,
      fileName: uploadedFileName,
    };

    try {
      await this.studentService.save_DocumentMetadata(payload).toPromise();
      this.Get_StudentDocuments();
      this.resetDocumentForm();
      this.isLoading = false;
      this.dialogBox.open(DialogBox_Component, {
        panelClass: 'Dialogbox-Class',
        data: {
          Message: 'Student document saved successfully!',
          Type: 'false',
        },
      });
    } catch (err) {
      console.error('Save metadata error:', err);
      alert('Failed to save document metadata.');
    }
  }
}
