export class user_role
{
User_Role_Id:number;
User_Role_Name:string;
Role_Under_Id:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

