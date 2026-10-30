export interface EmailTemplate {
    Template_ID?: number;
    Template_Name: string;
    Subject: string;
    Body: string;
    Attendance_Count?: number;
    Is_Active?: boolean;
    Created_At?: Date;
    Updated_At?: Date;
}
