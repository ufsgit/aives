export class chat_history
{
ChatHistory_ID:number;
Student_ID:number;
Chat_Message:string;
Chat_DateTime:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

