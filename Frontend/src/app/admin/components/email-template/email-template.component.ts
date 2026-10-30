import { Component, OnInit, inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { EmailTemplateService } from '../../services/email-template.service';
import { EmailTemplate } from '../../../core/models/email_template';
import { DialogBox_Component } from '../../../shared/components/DialogBox/DialogBox.component';

import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-email-template',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-template.component.html',
  styleUrl: './email-template.component.scss'
})
export class EmailTemplateComponent implements OnInit {
  private emailTemplateService = inject(EmailTemplateService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  Entry_View = false;
  emailTemplateForm: FormGroup;
  emailTemplates: EmailTemplate[] = [];
  isLoading = false;
  submitted = false;
  isCountSectionVisible = false;

  constructor() {
    this.emailTemplateForm = this.fb.group({
      Template_ID: [0],
      Template_Name: ['', Validators.required],
      Subject: ['', Validators.required],
      Body: ['', Validators.required],
      Attendance_Count: [0],
      Is_Active: [true]
    });
  }

  get currentSubjectPlaceholder(): string {
    return this.isCountSectionVisible && this.getCountValue() > 0
      ? 'Enter the email subject. Use {{attendance_count}} for dynamic count.'
      : 'Enter the email subject line';
  }

  getCountValue(): number {
    const val = this.emailTemplateForm?.get('Attendance_Count')?.value;
    return val !== null && val !== undefined && !isNaN(Number(val)) ? Number(val) : 0;
  }

  addCount(initialValue: number = 1): void {
    this.isCountSectionVisible = true;
    const current = this.getCountValue();
    const countToSet = current > 0 ? current : initialValue;
    this.emailTemplateForm.patchValue({ Attendance_Count: countToSet });
  }

  removeCount(): void {
    this.isCountSectionVisible = false;
    this.emailTemplateForm.patchValue({ Attendance_Count: 0 });
  }

  onCountInputChange(): void {
    const val = this.getCountValue();
    if (val <= 0) {
      this.emailTemplateForm.patchValue({ Attendance_Count: 0 }, { emitEvent: false });
    }
  }

  onCountBlur(): void {
    const val = this.getCountValue();
    if (val <= 0) {
      this.removeCount();
    }
  }

  ngOnInit(): void {
    this.loadTemplates();

    this.emailTemplateForm.get('Template_Name')?.valueChanges.subscribe((name: string) => {
      const trimmed = (name || '').trim().toLowerCase();
      if (trimmed === 'first day attendance' && !this.isCountSectionVisible) {
        this.addCount(1);
      } else if ((trimmed === 'five day attendance' || trimmed === '5 days attendance') && !this.isCountSectionVisible) {
        this.addCount(5);
      }
    });
  }

  loadTemplates() {
    this.isLoading = true;
    this.emailTemplateService.searchTemplates('').subscribe({
      next: (data) => {
        this.emailTemplates = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.showDialog('Error loading templates', '2');
      }
    });
  }

  createNew() {
    this.Entry_View = true;
    this.submitted = false;
    this.isCountSectionVisible = false;
    this.emailTemplateForm.reset({
      Template_ID: 0,
      Template_Name: '',
      Subject: '',
      Body: '',
      Attendance_Count: 0,
      Is_Active: true
    });
  }

  editTemplate(template: EmailTemplate) {
    this.Entry_View = true;
    this.submitted = false;
    const count = template.Attendance_Count ? Number(template.Attendance_Count) : 0;
    this.isCountSectionVisible = count > 0;

    this.emailTemplateForm.patchValue({
      ...template,
      Attendance_Count: count,
      Is_Active: template.Is_Active !== undefined ? !!template.Is_Active : true
    });
  }

  saveTemplate() {
    this.submitted = true;

    const missing: string[] = [];
    const templateName = this.emailTemplateForm.get('Template_Name')?.value;
    const subject = this.emailTemplateForm.get('Subject')?.value;
    const body = this.emailTemplateForm.get('Body')?.value;

    if (!templateName || !String(templateName).trim()) {
      missing.push('Template Name');
    }
    if (!subject || !String(subject).trim()) {
      missing.push('Email Subject');
    }
    if (!body || !String(body).trim()) {
      missing.push('Email Body');
    }

    if (missing.length > 0 || this.emailTemplateForm.invalid) {
      const message = missing.length > 0
        ? `Please fill in: ${missing.join(', ')}`
        : 'Please fill all required fields';
      this.showDialog(message, '2');

      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const countVal = this.getCountValue();
    if (!this.isCountSectionVisible || countVal <= 0) {
      this.emailTemplateForm.patchValue({ Attendance_Count: 0 });
    }

    this.isLoading = true;
    this.emailTemplateService.saveTemplate(this.emailTemplateForm.value).subscribe({
      next: (res) => {
        if (res && res[0] && res[0].InsertId > 0) {
          this.showDialog('Template saved successfully', 'false');
          this.Entry_View = false;
          this.loadTemplates();
        } else {
          this.showDialog('Error saving template', '2');
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.showDialog('Error saving template', '2');
      }
    });
  }

  deleteTemplate(id: number) {
    const dialogRef = this.dialog.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: { Message: 'Do you want to delete this template?', Type: true, Heading: 'Confirm' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'Yes') {
        this.isLoading = true;
        this.emailTemplateService.deleteTemplate(id).subscribe({
          next: () => {
            this.showDialog('Template deleted', 'false');
            this.loadTemplates();
          },
          error: (err) => {
            this.isLoading = false;
            this.showDialog('Error deleting template', '2');
          }
        });
      }
    });
  }

  closeClick() {
    this.Entry_View = false;
  }

  private showDialog(message: string, type: string) {
    this.dialog.open(DialogBox_Component, {
      panelClass: 'Dialogbox-Class',
      data: { Message: message, Type: type }
    });
  }
}
