export class exam
{
Exam_ID:number;
Section_ID:number;
Course_ID:number;
Exam_Name:string;
Passing_Score:number;
Total_Questions:number;
Time_Limit:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

