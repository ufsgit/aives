import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EmailTemplate } from '../../core/models/email_template';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailTemplateService {
  private http = inject(HttpClient);
  private basePath = environment.BasePath;

  saveTemplate(template: EmailTemplate): Observable<any> {
    return this.http.post(this.basePath + 'EmailTemplate/Save_Email_Template', template);
  }

  getTemplate(id: number): Observable<any> {
    return this.http.get(this.basePath + `EmailTemplate/Get_Email_Template/${id}`);
  }

  searchTemplates(searchTerm: string = ''): Observable<any> {
    return this.http.get(this.basePath + 'EmailTemplate/Search_Email_Template', { params: { searchTerm } });
  }

  deleteTemplate(id: number): Observable<any> {
    return this.http.get(this.basePath + `EmailTemplate/Delete_Email_Template/${id}`);
  }

  sendTemplateEmail(templateId: number, toEmail: string, placeholders: any = {}, attachments: any[] = []): Observable<any> {
    return this.http.post(this.basePath + 'EmailTemplate/Send_Email_With_Template', {
      Template_ID: templateId,
      To_Email: toEmail,
      Placeholders: placeholders,
      Attachments: attachments,
      Sender_Email: localStorage.getItem('Email'),
      Sender_Name: localStorage.getItem('Name')
    });
  }
}

