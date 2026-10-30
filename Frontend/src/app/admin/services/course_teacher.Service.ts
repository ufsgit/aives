import { Component, OnInit, Input, Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AnimationKeyframesSequenceMetadata } from '@angular/animations';
@Injectable({
providedIn: 'root'
})
export class course_teacher_Service {
private http = inject(HttpClient);

constructor()
{
const httpOptions = {
headers: new HttpHeaders({
'Content-Type':  'application/json'
})
};
}AnimationKeyframesSequenceMetadata
Save_course_teacher(course_teacher_)
{
return this.http.post(environment.BasePath +'course_teacher/Save_course_teacher/',course_teacher_);}
private extractData(res: Response)
{
let body = res;
return body || { };
}
Search_course_teacher(course_teacher_Name):Observable<any>
{
var Search_Data={'course_teacher_Name':course_teacher_Name}
 return this.http.get(environment.BasePath +'course_teacher/Search_course_teacher/',{params:Search_Data});}
Delete_course_teacher(course_teacher_Id)
{
 return this.http.get(environment.BasePath +'course_teacher/Delete_course_teacher/'+course_teacher_Id);}
Get_course_teacher(course_teacher_Id)
{
 return this.http.get(environment.BasePath +'course_teacher/Get_course_teacher/'+course_teacher_Id);}
}

