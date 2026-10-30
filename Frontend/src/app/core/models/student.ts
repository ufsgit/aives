export class student
{
[x: string]: any;
Student_ID:number;
First_Name:string;
Last_Name:string;
Email:string;
Phone_Number:string;
Country_Code:string;
Country_Code_Name:string;
Social_Provider:string;
Social_ID:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
} 
}

