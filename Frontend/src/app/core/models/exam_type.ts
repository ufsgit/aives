export class exam_type
{
ExamType_ID:number;
ExamType_Name:string;
Question_Type:string;
Answer_Type:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

