export class media
{
Media_ID:number;
Course_ID:number;
Media_Type:string;
Media_Path:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

