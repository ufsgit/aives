export class menu
{
Menu_ID:number;
Menu_Name:string;
Route:string;
Parent_Menu_ID:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

