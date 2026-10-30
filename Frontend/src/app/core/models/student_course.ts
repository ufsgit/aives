export class student_course
{
StudentCourse_ID:number;
Student_ID:number;
Course_ID:number;
Enrollment_Date:string;
Expiry_Date:string;
Price:number;
Payment_Date:string;
Payment_Status:string;
LastAccessed_Content_ID:number;
Transaction_Id:string;
Delete_Status:number;
Payment_Method:string;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

