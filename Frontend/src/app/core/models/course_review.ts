export class course_review
{
Review_ID:number;
Student_ID:number;
Course_ID:number;
Comment:string;
Rating:number;
Review_Date:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

