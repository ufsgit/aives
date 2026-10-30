export class student_exam
{
StudentExam_ID:number;
Student_ID:number;
Exam_ID:number;
Score:number;
Attempted_Date:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

