export class section
{
Section_ID:number;
Course_ID:number;
ExamType_ID:number;
Section_Name:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

