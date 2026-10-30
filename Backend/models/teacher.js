var fs = require('fs');
const { executeTransaction } = require('../helpers/sp-caller');
const db = require('../config/dbconnection');

async function ensureStaffTeamAssignmentTable(connection = null) {
    const queryRunner = connection || db.promise();
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS \`staff_team_assignment\` (
            \`Staff_Team_Assignment_ID\` INT NOT NULL AUTO_INCREMENT,
            \`staff_user_id\` INT NOT NULL,
            \`team_lead_user_id\` INT NOT NULL,
            \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`Staff_Team_Assignment_ID\`),
            UNIQUE KEY \`uq_staff_user_id\` (\`staff_user_id\`),
            KEY \`idx_team_lead_user_id\` (\`team_lead_user_id\`),
            CONSTRAINT \`fk_staff_assignment_staff\` FOREIGN KEY (\`staff_user_id\`) REFERENCES \`users\` (\`User_ID\`) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT \`fk_staff_assignment_team_lead\` FOREIGN KEY (\`team_lead_user_id\`) REFERENCES \`users\` (\`User_ID\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

var teacher =
{

    Get_Teacher_courses: async function (teacher_Id_) {
        console.log('teacher_Id_: ', teacher_Id_); 
        return executeTransaction('Get_Teacher_courses', [teacher_Id_]);
    },
    Get_Teacher_courses_With_Batch : async function (teacher_Id_) {
        return executeTransaction('Get_Teacher_courses_With_Batch ', [teacher_Id_]);
    },
    Get_Teacher_Students : async function (teacher_Id_,courseId) {
        return executeTransaction('Get_Teacher_Students ', [teacher_Id_,courseId]);
    },
    Get_teacherBatch_of_oneOnOne : async function (teacher_Id_) {
        return executeTransaction('Get_teacherBatch_of_oneOnOne ', [teacher_Id_]);
    },
    
    Get_OnGoing_liveClass: async function (teacher_Id_) {
        return executeTransaction('Get_OnGoing_liveClass', [teacher_Id_]);
    },
    Get_Upcomming_liveClass: async function (teacher_Id_) {
        return executeTransaction('Get_Upcomming_liveClass', [teacher_Id_]);
    },
    Get_Completed_liveClass: async function (teacher_Id_) {
        return executeTransaction('Get_Completed_liveClass', [teacher_Id_]);
    },
    Get_liveClass: async function (teacher_Id_) {
        return executeTransaction('Get_liveClass', [teacher_Id_]);
    },
    Get_Student_TimeSlots_By_TeacherID: async function (teacher_Id_) {
        return executeTransaction('Get_Student_TimeSlots_By_TeacherID', [teacher_Id_]);
    },
    Get_Teacher_Timing: async function (teacher_Id_) {
        return executeTransaction('Get_Teacher_Timing', [teacher_Id_]);
    },
    Get_Batch_StudentList: async function (Batch_Id) {
        return executeTransaction('Get_Batch_StudentList', [Batch_Id]);
    },
    Save_LiveClass: async function (Liveclass) {
        return executeTransaction('Save_LiveClass', [
            Liveclass.LiveClass_ID,
            Liveclass.Course_ID,
            Liveclass.Teacher_ID,
            Liveclass.Batch_Id,
            Liveclass.Scheduled_DateTime,
            Liveclass.Duration,
            Liveclass.Start_Time,
            Liveclass.End_Time,
            Liveclass.Live_Link,
            Liveclass.Record_Class_Link,
            Liveclass.Slot_Id,

        ]);
    },
    Update_Record_ClassLink: async function (Liveclass) {
        return executeTransaction('Update_Record_ClassLink', [
            Liveclass.LiveClass_ID,
            Liveclass.Record_Class_Link,
        ]);
    },
    
    Update_Record_Class_By_Link: async function (Liveclass) {
        return executeTransaction('Update_Record_Class_By_Link', [
            Liveclass.LiveClass_Link,
            Liveclass.Record_Class_Link,
        ]);
    },
    Save_OneToOne_Record_By_Link: async function (recording) {
        return executeTransaction('Save_OneToOne_Record_By_Link', [
            recording.Live_Link,
            recording.Record_Class_Link,
        ]);
    },
    Get_Staff_Team_Assignment: async function (teamLeadId) {
        await ensureStaffTeamAssignmentTable();
        const [rows] = await db.promise().query(
            `SELECT
                u.User_ID,
                TRIM(CONCAT(COALESCE(u.First_Name, ''), ' ', COALESCE(u.Last_Name, ''))) AS Full_Name,
                u.Email,
                CASE WHEN sta.team_lead_user_id = ? THEN 1 ELSE 0 END AS IsSelected
            FROM \`users\` u
            LEFT JOIN \`staff_team_assignment\` sta ON sta.staff_user_id = u.User_ID
            WHERE u.Delete_Status = 0
              AND u.User_Type_Id IN (1, 2, 3)
              AND u.User_ID <> 1
              AND LOWER(COALESCE(u.Email, '')) NOT IN ('admin_user@g.com', 'cs.mgr@testprepinenglish.com')
              AND u.User_ID <> ?
            ORDER BY u.First_Name ASC, u.Last_Name ASC`,
            [teamLeadId, teamLeadId]
        );
        return rows;
    },
    Save_Staff_Team_Assignment: async function (teamLeadId, staffIds = []) {
        const connection = await db.promise().getConnection();
        const normalizedTeamLeadId = Number(teamLeadId);
        const validStaffIds = [...new Set(
            (Array.isArray(staffIds) ? staffIds : [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0 && id !== 1 && id !== normalizedTeamLeadId)
        )];

        try {
            await ensureStaffTeamAssignmentTable(connection);
            await connection.beginTransaction();

            let filteredStaffIds = [];

            if (validStaffIds.length > 0) {
                const verifyPlaceholders = validStaffIds.map(() => '?').join(',');
                const [existingUsers] = await connection.query(
                    `SELECT User_ID
                     FROM \`users\`
                     WHERE User_ID IN (${verifyPlaceholders})
                       AND Delete_Status = 0
                       AND User_Type_Id IN (1, 2, 3)
                       AND User_ID <> 1
                       AND LOWER(COALESCE(Email, '')) NOT IN ('admin_user@g.com', 'cs.mgr@testprepinenglish.com')
                       AND User_ID <> ?`,
                    [...validStaffIds, normalizedTeamLeadId]
                );
                filteredStaffIds = existingUsers.map((row) => row.User_ID);
            }

            if (filteredStaffIds.length > 0) {
                const placeholders = filteredStaffIds.map(() => '?').join(',');
                await connection.query(
                    `DELETE FROM \`staff_team_assignment\`
                     WHERE team_lead_user_id = ?
                       AND staff_user_id NOT IN (${placeholders})`,
                    [normalizedTeamLeadId, ...filteredStaffIds]
                );

                const insertValues = [];
                const valuePlaceholders = filteredStaffIds
                    .map((staffId) => {
                        insertValues.push(staffId, normalizedTeamLeadId);
                        return '(?, ?)';
                    })
                    .join(', ');

                await connection.query(
                    `INSERT INTO \`staff_team_assignment\` (staff_user_id, team_lead_user_id)
                     VALUES ${valuePlaceholders}
                     ON DUPLICATE KEY UPDATE
                         team_lead_user_id = VALUES(team_lead_user_id),
                         updated_at = CURRENT_TIMESTAMP`,
                    insertValues
                );
            } else {
                await connection.query(
                    `DELETE FROM \`staff_team_assignment\`
                     WHERE team_lead_user_id = ?`,
                    [normalizedTeamLeadId]
                );
            }

            await connection.commit();
            return {
                teamLeadId: normalizedTeamLeadId,
                assignedStaffIds: filteredStaffIds,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
  
};
module.exports = teacher;
