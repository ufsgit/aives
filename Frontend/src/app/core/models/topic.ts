export class topic
{
Topic_ID:number;
Section_ID:number;
Topic_Name:string;
Topic_Order:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

