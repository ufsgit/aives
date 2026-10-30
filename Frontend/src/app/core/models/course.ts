export class course
{
Course_ID:number;
Course_Name:string;
Category_ID:number;
Validity:number;
Price:number;
Delete_Status:number;
Disable_Status:number;
Live_Class_Enabled:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

