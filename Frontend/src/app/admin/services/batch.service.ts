import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  private http = inject(HttpClient);

  Save_Batch(Batch_) {
      return this.http.post(environment.BasePath + 'Batch/Save_Batch/', Batch_);
  }
  GetAllCourses(course_Type) {
    var Search_Data = { 'course_Type': '', }

      return this.http.get(environment.BasePath + 'student/GetAllCourses', { params: Search_Data });
  }
  private extractData(res: Response) {
      let body = res;
      return body || {};
  }
  Search_Batch(Batch_Name): Observable<any> {
      var Search_Data = { 'Batch_Name': Batch_Name, }
      return this.http.get(environment.BasePath + 'Batch/Search_Batch/', { params: Search_Data });
  }
  Delete_Batch(Batch_Id) {
      return this.http.get(environment.BasePath + 'Batch/Delete_Batch/' + Batch_Id);
  }
  Get_Batch(Batch_Id) {
      return this.http.get(environment.BasePath + 'Batch/Get_Batch/' + Batch_Id);
  }
  ChangeCategoryStatus(status){
      return this.http.put(environment.BasePath + `Batch/ChangeStatus/`,status);
  }
  Get_Batch_Details(Batch_Id) {
    return this.http.get(environment.BasePath + 'Batch/Get_Batch_Details/' + Batch_Id);
}
}
