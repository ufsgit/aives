import { Component, OnInit, Input, Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { AnimationKeyframesSequenceMetadata } from '@angular/animations';
import { environment } from '../../../environments/environment';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { io } from 'socket.io-client';


const s3 = new AWS.S3({
    accessKeyId: environment.awsAccessKeyId,
    secretAccessKey: environment.awsSecretAccessKey,
    region: environment.awsRegion,
  });


@Injectable({
    providedIn: 'root' 
})
export class course_Service {
  private http = inject(HttpClient);

  private socket;
  uploadStatus: string;
  uploadProgress: number;
  totalFiles: number = 0;
  filesUploaded: number = 0;
  private uploadProgressSource = new BehaviorSubject<{ progress: number; status: string; totalFiles: number; filesUploaded: number }>({ progress: 0, status: 'Idle', totalFiles: 0, filesUploaded: 0 });
  public uploadProgress$ = this.uploadProgressSource.asObservable();
resetUploadProgress() {
  this.uploadProgressSource.next({
    progress: 0,
    status: 'Idle',
    totalFiles: 0,
    filesUploaded: 0
  });
}
public sendMessage(message: string) { 
  console.log('message: ', message);
  this.socket.emit('chat message', message);
}

public getMessages(): Observable<string> {
  return new Observable((observer) => {
    this.socket.on('chat message', (data: string) => {
      observer.next(data);
    });

    return () => {
      this.socket.disconnect();
    };
  });
}
Save_course(course_: any)
{ 

return this.http.post(environment.BasePath +'course/Save_course/',course_);
}
save_course_content(course_: any)
{ 

return this.http.post(environment.BasePath +'course/save_course_content/',course_);
}
Update_Time_Slot(course_: any)
{ 

return this.http.post(environment.BasePath +'course/Update_Time_Slot/',course_);
}
Student_Batch_Change(StudentList: any)
{ 

return this.http.post(environment.BasePath +'course/Student_Batch_Change/',StudentList);
}
ValidateTimeSlots(StudentList: any)
{ 

return this.http.post(environment.BasePath +'course/ValidateTimeSlots/',StudentList);
}
get_course_names( )
{ 
return this.http.get(environment.BasePath +'course/get_course_names/',);
}

Search_course(course: any)
{
  console.log('course: ', course);


var Search_Data={'course_Name':course}
 return this.http.get(environment.BasePath +'course/Search_course/',{params:Search_Data});

} 

Search_all_course(course: any)
{
  var Search_Data={'course_Name':course}
  return this.http.get(environment.BasePath +'course/Search_all_course/',{params:Search_Data});
}

Get_All_Course_Items(): Observable<any> {
    
  return this.http.get(environment.BasePath + 'course/Get_All_Course_Items/',);
}
Get_all_Batch(): Observable<any> {
    
  return this.http.get(environment.BasePath + 'course/Get_all_Batch/',);
}
Search_Section()
{

 return this.http.get(environment.BasePath +'course/Search_Section/',);

} 
Delete_course(course_Id)
{
 return this.http.get(environment.BasePath +'course/Delete_course/'+course_Id);}
Get_course(course_Id)
{
 return this.http.get(environment.BasePath +'course/Get_course/'+course_Id);
}
Get_Student_List_By_Batch(Batch_Id)
{
 return this.http.get(environment.BasePath +'course/Get_Student_List_By_Batch/'+Batch_Id);
}
Get_course_content(course_Id,Content_ID)
{
 return this.http.get(environment.BasePath +'course/Get_course_content/'+course_Id+'/'+Content_ID);
}
Delete_Course_Content(Content_ID)
{
 return this.http.post(environment.BasePath +'course/Delete_Course_Content/'+Content_ID,{});
}
Get_Available_Time_Slot(course_Id)
{
 return this.http.get(environment.BasePath +'course/Get_Available_Time_Slot/'+course_Id);
}
Get_ExamDetails_By_StudentId(exam_Id,student_Id)
{
 
  var Search_Data
   Search_Data = !student_Id ? { exam_Id } : { exam_Id, student_Id };


 return this.http.get(environment.BasePath +'student/Get_ExamDetails_By_StudentId/' ,{ params: Search_Data });
}
get_course_students(course_Id){
  return this.http.get(environment.BasePath +'course/Get_Course_Students/'+course_Id);

}
Get_Free_Time_Slot(course_Id){
  return this.http.get(environment.BasePath +'course/Get_Free_Time_Slot/'+course_Id);

}
Get_Course_Reviews(){
  return this.http.get(environment.BasePath +`course/Get_Course_Reviews/`);

}

Get_Teachers_By_Course_And_Batch(Course_Id: any, Batch_Id: any): Observable<any> {
  let params: any = { Course_Id, Batch_Id };
  return this.http.get(`${environment.BasePath}course/Get_Teachers_By_Course_And_Batch`, { params });
}


get_course_Batches(course_Id){
  return this.http.get(environment.BasePath +'course/get_course_Batches/'+course_Id);

}
get_Examof_Course(course_Id){
  return this.http.get(environment.BasePath +'course/get_Examof_Course/'+course_Id);

}
 async fileToRemoveAws(key: string): Promise<void> {
  console.log('key: ', key);
  const params = {
    Bucket: 'ufsnabeelphotoalbum',
    Key: key
  };
 
  try {
    // Delete the object from S3 bucket
    const upload =  await s3.deleteObject(params).promise();
    console.log('upload: ', upload);
    console.log(`Object with key ${key} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting object with key ${key}:`, error);
    throw error; // Re-throw the error to be caught by Promise.all()
  }
}
 upload(file: File, totalFilesCount: number,courseName,fileName?): Promise<{ key: string, fileName: string }> {
  return new Promise((resolve, reject) => {
    this.totalFiles = totalFilesCount;
    const randomString = uuidv4(); // Generate a random UUID

    console.log('file: ', file);

    // !fileName? fileName = `${randomString}_${file.name}`:fileName; 
    const [name, extension] = file.name.split(/\.(?=[^\.]+$)/); // Splits by the last dot to keep the extension

    // Remove special characters and spaces from the name part only
    const sanitizedFileName = name.replace(/[^a-zA-Z0-9]/g, '');
    
    // Append the random string to the sanitized file name and add the extension back
    fileName = `${randomString}.${extension}`;
    console.log('fileName: ', fileName);

    
    const contentType = file.type;
    console.log('courseName: ', courseName);
    const key = `Briffni/${courseName}/${fileName}`;
    console.log('key: ', key);
    const params = {
      Bucket: environment.awsS3Bucket,
      Key: key,
      Body: file,
      ACL: "public-read",
      ContentType: contentType,
    };

    this.uploadProgressSource.next({ progress: 0, status: 'Uploading...', totalFiles: this.totalFiles, filesUploaded: this.filesUploaded });

    const upload = s3.putObject(params).on('httpUploadProgress', (progress) => {
      const uploadProgress = Math.round((progress.loaded / progress.total) * 100);
      this.uploadProgressSource.next({ progress: uploadProgress, status: 'Uploading...', totalFiles: this.totalFiles, filesUploaded: this.filesUploaded });
    });

    upload.send((err, data) => {
      if (err) {
        console.log('err: ', err);
        this.uploadProgressSource.next({ progress: 0, status: 'Upload failed', totalFiles: this.totalFiles, filesUploaded: this.filesUploaded });
        reject(err);
      } else {
        console.log('success');
        this.filesUploaded++;
        // const signedUrl = s3.getSignedUrl('getObject', {
        //   Bucket: 'ufsnabeelphotoalbum',
        //   Key: key,
        //   ResponseContentDisposition: 'attachment',
        //   Expires: 6600
        // });
        // console.log('signedUrl: ', signedUrl);
        this.uploadProgressSource.next({ progress: 100, status: 'Upload successful', totalFiles: this.totalFiles, filesUploaded: this.filesUploaded });
        const s3Link = `https://${params.Bucket}.s3.amazonaws.com/${key}`;
        resolve({ key:key, fileName: file.name });
      }
    });
  });
}
Get_course_content_By_Day(
  Course_Id: number, 
  isLibrary: any, 
  Module_ID?: number, 
  Section_ID?: number, 
  Day_Id?: number,
  Is_Exam_Test?: number
) {
  let params: any = { Course_Id, isLibrary,Module_ID,Section_ID ,Day_Id,Is_Exam_Test};
  params.is_Student = false;


  return this.http.get(`${environment.BasePath}course/Get_course_content_By_Day`, { params });
}


}
