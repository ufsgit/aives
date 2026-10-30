export class content
{
Content_ID:number;
Topic_ID:number;
Content_Type:string;
Content:string;
Exam_ID:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

