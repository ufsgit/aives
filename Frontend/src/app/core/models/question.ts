export class question
{
Question_ID:number;
Exam_ID:number;
Question_Text:string;
Question_Media:string;
Answer_Options:string;
Correct_Answer:number;
Dificulty:number;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

