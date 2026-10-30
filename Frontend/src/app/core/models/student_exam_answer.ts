export class student_exam_answer
{
StudentExamAnswer_ID:number;
StudentExam_ID:number;
Question_ID:number;
Submitted_Answer:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

