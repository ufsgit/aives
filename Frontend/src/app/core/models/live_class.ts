export class live_class
{
LiveClass_ID:number;
Course_ID:number;
Teacher_ID:number;
Scheduled_DateTime:string;
Duration:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

