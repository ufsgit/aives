export class course_teacher
{
CourseTeacher_ID:number;
Course_ID:number;
Teacher_ID:number;
Availability_Schedule:string;
Delete_Status:number;
constructor(values: Object = {})  
{
Object.assign(this, values) 
}
}

