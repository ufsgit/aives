import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoursemoduleService {
  private http = inject(HttpClient);

  Save_course_module(course_module_) {
    return this.http.post(environment.BasePath + 'Module/Save_course_module/', course_module_);
  }

  private extractData(res: Response) {
    let body = res;
    return body || {};
  }

  Search_course_module(course_module_Name): Observable<any> {
    var Search_Data = { 'course_module_Name': course_module_Name, 'allModule': true }
    return this.http.get(environment.BasePath + 'Module/Search_course_module/', { params: Search_Data });
  }

  Delete_course_module(course_module_Id) {
    return this.http.get(environment.BasePath + 'Module/Delete_course_module/' + course_module_Id);
  }

  Get_course_module(course_module_Id) {
    return this.http.get(environment.BasePath + 'Module/Get_course_module/' + course_module_Id);
  }

  Change_Module_Status(status) {
    return this.http.put(environment.BasePath + `Module/Change_Module_Status/`, status);
  }
  Change_Module_Order(order) {
    return this.http.post(environment.BasePath + `Module/Change_Module_Order/`, order);
  }
}
