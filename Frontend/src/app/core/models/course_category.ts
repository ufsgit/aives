export class course_category
{
Category_ID:number;
Category_Name:string;
Delete_Status:number;
Enabled_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

