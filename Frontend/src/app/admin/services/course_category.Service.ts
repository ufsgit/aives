import { Component, OnInit, Input, Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AnimationKeyframesSequenceMetadata } from '@angular/animations';
import { environment } from '../../../environments/environment';
@Injectable({
    providedIn: 'root'
})
export class course_category_Service {
    private http = inject(HttpClient);

    Save_course_category(course_category_) {
        return this.http.post(environment.BasePath + 'course_category/Save_course_category/', course_category_);
    }
    private extractData(res: Response) {
        let body = res;
        return body || {};
    }
    Search_course_category(course_category_Name): Observable<any> {
        var Search_Data = { 'course_category_Name': course_category_Name,'allCategory':true }
        return this.http.get(environment.BasePath + 'course_category/Search_course_category/', { params: Search_Data });
    }
    Delete_course_category(course_category_Id) {
        return this.http.get(environment.BasePath + 'course_category/Delete_course_category/' + course_category_Id);
    }
    Get_course_category(course_category_Id) {
        return this.http.get(environment.BasePath + 'course_category/Get_course_category/' + course_category_Id);
    }
    ChangeCategoryStatus(status){
        return this.http.put(environment.BasePath + `course_category/ChangeStatus/`,status);
    }
}

