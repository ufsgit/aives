CREATE TABLE `account_heads` (
  `Account_id` int NOT NULL,
  `Account_Name` varchar(100) DEFAULT NULL,
  `Opening` decimal(2,0) DEFAULT NULL,
  `Branch_Id` int DEFAULT NULL,
  `Payment_Id` int DEFAULT NULL,
  PRIMARY KEY (`Account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `appinfo` (
  `info_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `app_version` varchar(50) DEFAULT NULL,
  `model_name` varchar(100) DEFAULT NULL,
  `os_version` varchar(50) DEFAULT NULL,
  `sdk_int` int DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `is_battery_optimized` tinyint DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `isStudent` tinyint DEFAULT '0',
  `devicePushTokenVoip` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`info_id`)
) ENGINE=InnoDB AUTO_INCREMENT=208 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance_backup_1789108455112` (
  `Attendance_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Course_ID` int NOT NULL,
  `Batch_ID` int NOT NULL,
  `Attendance_Date` date NOT NULL,
  `Status` tinyint(1) NOT NULL COMMENT '1: Present, 0: Absent',
  `Marked_By` int DEFAULT NULL,
  `Created_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Attendance_ID`),
  UNIQUE KEY `unique_attendance` (`Student_ID`,`Batch_ID`,`Attendance_Date`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attendance_details` (
  `Detail_ID` int NOT NULL AUTO_INCREMENT,
  `Attendance_ID` int NOT NULL,
  `Student_ID` int NOT NULL,
  `Student_Name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` tinyint(1) NOT NULL,
  `Attendance_Date` date DEFAULT NULL,
  PRIMARY KEY (`Detail_ID`),
  UNIQUE KEY `uq_student_session` (`Attendance_ID`,`Student_ID`),
  CONSTRAINT `attendance_details_ibfk_1` FOREIGN KEY (`Attendance_ID`) REFERENCES `attendance_master` (`Attendance_ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=204 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `attendance_email_log` (
  `Log_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Batch_ID` int NOT NULL,
  `Email_Type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Sent_At` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Log_ID`),
  UNIQUE KEY `uq_attendance_email` (`Student_ID`,`Batch_ID`,`Email_Type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `attendance_master` (
  `Attendance_ID` int NOT NULL AUTO_INCREMENT,
  `Course_ID` int NOT NULL,
  `Course_Name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Batch_ID` int NOT NULL,
  `Batch_Name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Attendance_Date` date NOT NULL,
  `Marked_By` int DEFAULT NULL,
  `Marked_By_Name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Created_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Attendance_ID`),
  UNIQUE KEY `uq_session` (`Course_ID`,`Batch_ID`,`Attendance_Date`)
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blocked_users` (
  `block_id` int NOT NULL AUTO_INCREMENT,
  `blocker_id` int NOT NULL,
  `blocked_user_id` int NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Is_Student_Blocked` tinyint DEFAULT '0',
  PRIMARY KEY (`block_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `branches` (
  `Branch_Id` int NOT NULL AUTO_INCREMENT,
  `Branch_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  `Address1` varchar(1000) DEFAULT NULL,
  `Address2` varchar(1000) DEFAULT NULL,
  `Address3` varchar(1000) DEFAULT NULL,
  `Address4` varchar(1000) DEFAULT NULL,
  `Pincode` varchar(250) DEFAULT NULL,
  `ContactNo` varchar(500) DEFAULT NULL,
  `MobileNo` varchar(500) DEFAULT NULL,
  `Email` varchar(500) DEFAULT NULL,
  `Website` varchar(500) DEFAULT NULL,
  `GstNo` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Branch_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `call_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `call_start` timestamp NULL DEFAULT NULL,
  `call_end` timestamp NULL DEFAULT NULL,
  `call_duration` decimal(18,2) DEFAULT NULL,
  `call_type` varchar(20) DEFAULT NULL,
  `Is_Student_Called` tinyint DEFAULT '0',
  `Live_Link` varchar(45) DEFAULT NULL,
  `Call_Ringed` tinyint DEFAULT '1',
  `Call_Connected` tinyint DEFAULT '0',
  `Is_Finished` tinyint DEFAULT '0',
  `Call_Rejected` tinyint DEFAULT '0',
  `Record_Class_Link` varchar(245) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_teacher_student` (`teacher_id`,`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `campaign` (
  `Campaign_ID` int NOT NULL AUTO_INCREMENT,
  `Campaign_Name` varchar(255) NOT NULL,
  `Campaign_Number` varchar(100) NOT NULL,
  `Lead_Source_Type` varchar(50) DEFAULT 'Manual',
  `Delete_Status` tinyint DEFAULT '0',
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Is_FB_Integrated` tinyint DEFAULT '0',
  `FB_Campaign_ID` varchar(255) DEFAULT NULL,
  `FB_Page_ID` varchar(255) DEFAULT NULL,
  `FB_Page_AccessToken` text,
  `FB_Form_ID` varchar(255) DEFAULT NULL,
  `FB_Access_Token` text,
  `Last_Assigned_Index` int DEFAULT '-1',
  PRIMARY KEY (`Campaign_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `campaign_user` (
  `Campaign_ID` int NOT NULL,
  `User_ID` int NOT NULL,
  PRIMARY KEY (`Campaign_ID`,`User_ID`),
  KEY `User_ID` (`User_ID`),
  CONSTRAINT `campaign_user_ibfk_1` FOREIGN KEY (`Campaign_ID`) REFERENCES `campaign` (`Campaign_ID`),
  CONSTRAINT `campaign_user_ibfk_2` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `cart_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cart_id` int NOT NULL,
  `course_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `cart_id` (`cart_id`),
  CONSTRAINT `cart_items_ibfk_1` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `carts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `chatbot_history` (
  `ChatHistory_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int DEFAULT NULL,
  `Chat_Message` text,
  `IsReply` tinyint DEFAULT '0',
  `Chat_DateTime` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Last_Accesed_Content_Id` int DEFAULT NULL,
  `Last_Accesed_Section_Id` int DEFAULT NULL,
  `Last_Accesed_Course_Id` int DEFAULT NULL,
  PRIMARY KEY (`ChatHistory_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `content_visibility` (
  `Visibility_ID` int NOT NULL AUTO_INCREMENT,
  `Visbility_Name` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`Visibility_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course` (
  `Course_ID` int NOT NULL AUTO_INCREMENT,
  `Course_Name` varchar(200) NOT NULL,
  `Category_ID` int NOT NULL,
  `Validity` int NOT NULL,
  `Price` decimal(10,2) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Disable_Status` tinyint DEFAULT '0',
  `Live_Class_Enabled` tinyint DEFAULT NULL,
  `Description` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Things_To_Learn` longtext,
  `Thumbnail_Path` longtext,
  `Thumbnail_Name` longtext,
  `ThumbnailVideo_Path` longtext,
  `ThumbnailVideo_Name` longtext,
  PRIMARY KEY (`Course_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_batch` (
  `Batch_ID` int NOT NULL AUTO_INCREMENT,
  `Course_ID` int DEFAULT NULL,
  `Batch_Name` varchar(200) DEFAULT NULL,
  `Max_Students` int DEFAULT '0',
  `Current_Students` int DEFAULT '0',
  `Delete_Status` tinyint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Start_Date` varchar(45) DEFAULT NULL,
  `End_Date` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`Batch_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_category` (
  `Category_ID` int NOT NULL AUTO_INCREMENT,
  `Category_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Enabled_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Category_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_content` (
  `Content_ID` int NOT NULL AUTO_INCREMENT,
  `Course_Id` varchar(45) NOT NULL,
  `Section_ID` int NOT NULL,
  `Module_ID` int DEFAULT NULL,
  `Visibilities` json DEFAULT NULL,
  `Content_Name` varchar(200) DEFAULT NULL,
  `Content_Order` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Exam_ID` int DEFAULT NULL,
  `File_Path` longtext,
  `File_Name` longtext,
  `file_type` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contentThumbnail_name` longtext,
  `contentThumbnail_Path` longtext,
  `External_Link` longtext,
  `Days_Id` int DEFAULT NULL,
  `Is_Exam_Test` tinyint DEFAULT '0',
  PRIMARY KEY (`Content_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_hod` (
  `CourseHod_Id` int NOT NULL AUTO_INCREMENT,
  `Course_ID` int DEFAULT NULL,
  `User_ID` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  PRIMARY KEY (`CourseHod_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_module` (
  `Module_ID` int NOT NULL AUTO_INCREMENT,
  `Module_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Exam_Module` tinyint DEFAULT '0',
  `View_Order` int DEFAULT '1',
  `locked_Status` tinyint DEFAULT '0',
  `Enabled_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Module_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_reviews` (
  `Review_Id` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int DEFAULT NULL,
  `Course_ID` int DEFAULT NULL,
  `Rating` int DEFAULT NULL,
  `Comments` text,
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Review_Id`),
  CONSTRAINT `course_reviews_chk_1` CHECK ((`Rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_section` (
  `Course_Section_Id` int NOT NULL AUTO_INCREMENT,
  `Section_Id` int DEFAULT NULL,
  `Course_ID` varchar(45) NOT NULL,
  PRIMARY KEY (`Course_Section_Id`),
  KEY `fk_section_id` (`Section_Id`),
  CONSTRAINT `fk_section_id` FOREIGN KEY (`Section_Id`) REFERENCES `section` (`Section_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `course_teacher` (
  `CourseTeacher_ID` int NOT NULL AUTO_INCREMENT,
  `Course_ID` int NOT NULL,
  `Teacher_ID` int NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`CourseTeacher_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `custom_field` (
  `custom_field_id` int NOT NULL AUTO_INCREMENT,
  `custom_field_type_id` int DEFAULT NULL,
  `custom_field_name` varchar(255) NOT NULL,
  `Deleted_Status` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`custom_field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `custom_field_type` (
  `custom_field_type_id` int NOT NULL AUTO_INCREMENT,
  `custom_field_type_name` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`custom_field_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `data_log` (
  `id` int DEFAULT NULL,
  `value` longtext
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `data_log_` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Description_` longtext,
  `data_val` varchar(2000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6028 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `days` (
  `Days_Id` int NOT NULL,
  `Day_Name` varchar(45) DEFAULT NULL,
  `Is_Exam_Day` tinyint DEFAULT '0',
  `alias_Name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Days_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `debug_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `department` (
  `Department_Id` int NOT NULL AUTO_INCREMENT,
  `Department_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  PRIMARY KEY (`Department_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `document_types` (
  `Document_Type_Id` int NOT NULL AUTO_INCREMENT,
  `Document_Type_Name` varchar(100) NOT NULL,
  `Is_Active` tinyint(1) DEFAULT '1',
  `Created_At` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Document_Type_Id`),
  UNIQUE KEY `Document_Type_Name` (`Document_Type_Name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `dummy` (
  `iddummy` int NOT NULL,
  `dumm2` varchar(45) DEFAULT NULL,
  `dummycol` varchar(45) DEFAULT NULL,
  `dummycol1` varchar(45) DEFAULT NULL,
  `dummycol2` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`iddummy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_logs` (
  `Log_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int DEFAULT NULL,
  `Template_ID` int DEFAULT NULL,
  `Email_Address` varchar(255) DEFAULT NULL,
  `Subject` varchar(255) DEFAULT NULL,
  `Message_ID` varchar(255) DEFAULT NULL,
  `Body` text,
  `Sent_At` datetime DEFAULT CURRENT_TIMESTAMP,
  `Opened_At` datetime DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `Error_Message` text,
  PRIMARY KEY (`Log_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=262 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_templates` (
  `Template_ID` int NOT NULL AUTO_INCREMENT,
  `Template_Name` varchar(255) NOT NULL,
  `Subject` varchar(255) NOT NULL,
  `Body` text NOT NULL,
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Delete_Status` tinyint DEFAULT '0',
  `Attendance_Count` int DEFAULT '0',
  `Is_Active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`Template_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `enquiry_source` (
  `Enquiry_Source_Id` int NOT NULL AUTO_INCREMENT,
  `Enquiry_Source_Name` varchar(255) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Enquiry_Source_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `enquiry_source_custom_field` (
  `enquiry_source_custom_field_id` int NOT NULL AUTO_INCREMENT,
  `enquiry_source_id` int NOT NULL,
  `custom_field_id` int NOT NULL,
  `custom_field_name` varchar(255) NOT NULL,
  `isMandatory` tinyint(1) NOT NULL,
  `custom_field_type_id` int NOT NULL,
  PRIMARY KEY (`enquiry_source_custom_field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `exam` (
  `Exam_ID` int NOT NULL AUTO_INCREMENT,
  `Section_ID` int NOT NULL DEFAULT '0',
  `Course_ID` int NOT NULL,
  `Main_Question` longtext,
  `file_name` longtext,
  `Passing_Score` int DEFAULT NULL,
  `Total_Questions` int DEFAULT NULL,
  `Time_Limit` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `file_type` varchar(45) DEFAULT NULL,
  `Answer_Key_Name` longtext,
  `Answer_Key_Path` longtext,
  `Supporting_Document_Name` longtext,
  `Supporting_Document_Path` longtext,
  PRIMARY KEY (`Exam_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `exam_type` (
  `ExamType_ID` int NOT NULL AUTO_INCREMENT,
  `Answer_Media_Id` varchar(100) NOT NULL,
  `Have_Main_Question` tinyint DEFAULT '0',
  `Is_Main_Question_Text` tinyint DEFAULT '0',
  `Delete_Status` tinyint DEFAULT '0',
  `Have_Answer_Key` tinyint DEFAULT '0',
  `Have_Supporting_Document` tinyint DEFAULT '0',
  PRIMARY KEY (`ExamType_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `expense` (
  `Expense_Id` int NOT NULL AUTO_INCREMENT,
  `Expense_Type_Id` int NOT NULL,
  `User_Id` int NOT NULL,
  `Entry_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  `Amount` decimal(10,2) NOT NULL,
  `Description` varchar(200) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Account_Id` int DEFAULT NULL,
  `Account_Name` varchar(100) DEFAULT NULL,
  `Student_ID` int DEFAULT NULL,
  `StudentName` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Expense_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `expense_category` (
  `Expense_Category_Id` int NOT NULL AUTO_INCREMENT,
  `Expense_Category_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Expense_Category_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `expense_type` (
  `Expense_Type_Id` int NOT NULL AUTO_INCREMENT,
  `Expense_Type_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Expense_Category_Id` int DEFAULT NULL,
  PRIMARY KEY (`Expense_Type_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `follow_ups` (
  `Follow_Up_Id` int NOT NULL AUTO_INCREMENT,
  `Student_Id` int NOT NULL,
  `Entry_Date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `By_User_Id` int NOT NULL,
  `To_User_Id` int DEFAULT NULL,
  `Branch_Id` int DEFAULT NULL,
  `Status_Id` int DEFAULT NULL,
  `Department_Id` int DEFAULT NULL,
  `Remark` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Next_follow_Up` date DEFAULT NULL,
  `Delete_Status` tinyint(1) NOT NULL DEFAULT '0',
  `Created_Date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_Date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Follow_Up_Id`),
  KEY `idx_student_id` (`Student_Id`),
  KEY `idx_by_user_id` (`By_User_Id`),
  KEY `idx_to_user_id` (`To_User_Id`),
  KEY `idx_branch_id` (`Branch_Id`),
  KEY `idx_status_id` (`Status_Id`),
  KEY `idx_department_id` (`Department_Id`),
  KEY `idx_next_follow_up` (`Next_follow_Up`),
  CONSTRAINT `fk_follow_ups_student` FOREIGN KEY (`Student_Id`) REFERENCES `student` (`Student_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `followup_status` (
  `Status_Id` int NOT NULL AUTO_INCREMENT,
  `Status_Name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `Status_Color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '#6B7280',
  `Description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Display_Order` int DEFAULT '0',
  `Is_Active` tinyint(1) NOT NULL DEFAULT '1',
  `Delete_Status` tinyint(1) NOT NULL DEFAULT '0',
  `Created_Date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_Date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Status_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `income` (
  `Income_Id` int NOT NULL AUTO_INCREMENT,
  `Expense_Type_Id` int NOT NULL,
  `User_Id` int NOT NULL,
  `Entry_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  `Amount` decimal(10,2) NOT NULL,
  `Description` varchar(200) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Account_Id` int DEFAULT NULL,
  `Account_Name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Income_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `income_category` (
  `Income_Category_Id` int NOT NULL AUTO_INCREMENT,
  `Income_Category_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Income_Category_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `income_type` (
  `Income_Type_Id` int NOT NULL AUTO_INCREMENT,
  `Income_Type_Name` varchar(255) NOT NULL,
  `Income_Category_Id` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Income_Type_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `installment_information` (
  `Installment_information_ID` int NOT NULL AUTO_INCREMENT,
  `Details` varchar(255) DEFAULT NULL,
  `Duration` int DEFAULT NULL,
  `Amount` decimal(10,2) DEFAULT NULL,
  `Course_ID` int DEFAULT NULL,
  `Course_Name` varchar(255) DEFAULT NULL,
  `Fee_Type` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Batch_ID` int DEFAULT NULL,
  `Batch_Name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Installment_information_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `installments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `installment_number` int DEFAULT NULL,
  `is_paid` tinyint(1) DEFAULT '0',
  `amount` decimal(10,2) NOT NULL,
  `tax_applied` decimal(5,2) DEFAULT '0.00',
  `tax_amount` decimal(10,2) DEFAULT '0.00',
  `payment_mode` varchar(50) DEFAULT NULL,
  `cheque_date` varchar(50) DEFAULT NULL,
  `payment_status` varchar(20) DEFAULT 'unpaid',
  `details` text,
  `created_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Delete_Status` tinyint DEFAULT NULL,
  `installment_date` date DEFAULT NULL,
  `batch_id` int DEFAULT NULL,
  `batch_name` varchar(255) DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `Installment_information_ID` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `invoices` (
  `Invoice_Id` int NOT NULL AUTO_INCREMENT,
  `invoice_date` varchar(50) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `position` varchar(50) DEFAULT NULL,
  `course_name` varchar(100) DEFAULT NULL,
  `payment_period` varchar(50) DEFAULT NULL,
  `class_hours` varchar(20) DEFAULT NULL,
  `total_amount` varchar(20) DEFAULT NULL,
  `approved_by` varchar(100) DEFAULT NULL,
  `user_Id` int DEFAULT NULL,
  `Course_Id` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Invoice_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `late_fee_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) DEFAULT NULL,
  `setting_value` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `lead_response` (
  `Response_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Email` varchar(255) NOT NULL,
  `Full_Name` varchar(255) DEFAULT NULL,
  `Phone_Number` varchar(50) DEFAULT NULL,
  `Response_Choice` varchar(50) DEFAULT NULL,
  `Interested_Course` varchar(255) DEFAULT NULL,
  `Preferred_Mode` varchar(100) DEFAULT NULL,
  `Preferred_Time` varchar(100) DEFAULT NULL,
  `Target_Timeline` varchar(100) DEFAULT NULL,
  `Comments` text,
  `Raw_Response` json DEFAULT NULL,
  `Submitted_At` datetime DEFAULT CURRENT_TIMESTAMP,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Response_ID`),
  KEY `idx_student_id` (`Student_ID`),
  KEY `idx_email` (`Email`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `leaves` (
  `Leave_Id` int NOT NULL AUTO_INCREMENT,
  `User_Id` int NOT NULL,
  `From_Date` date DEFAULT NULL,
  `To_Date` date DEFAULT NULL,
  `Reason` text,
  `Status` varchar(50) DEFAULT 'Pending',
  `Is_Deleted` tinyint DEFAULT '0',
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Leave_Id`),
  KEY `User_Id` (`User_Id`),
  CONSTRAINT `leaves_ibfk_1` FOREIGN KEY (`User_Id`) REFERENCES `users` (`User_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `live_class` (
  `LiveClass_ID` int NOT NULL AUTO_INCREMENT,
  `Course_ID` int DEFAULT NULL,
  `Batch_Id` int DEFAULT NULL,
  `Teacher_ID` int DEFAULT NULL,
  `Scheduled_DateTime` datetime DEFAULT NULL,
  `Duration` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  `Start_Time` datetime DEFAULT NULL,
  `End_Time` datetime DEFAULT NULL,
  `Live_Link` varchar(250) DEFAULT NULL,
  `Is_Finished` tinyint DEFAULT '0',
  `Record_Class_Link` varchar(250) DEFAULT NULL,
  `Slot_Id` int DEFAULT NULL,
  PRIMARY KEY (`LiveClass_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `login_users` (
  `Login_ID` int NOT NULL AUTO_INCREMENT,
  `User_Id` int DEFAULT NULL,
  `Is_Student` tinyint DEFAULT '0',
  `User_Type_Id` int DEFAULT NULL,
  `Login_Time` varchar(45) DEFAULT NULL,
  `JWT_Token` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Login_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=545 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `media_types` (
  `media_types_id` int NOT NULL AUTO_INCREMENT,
  `media_name` varchar(205) DEFAULT NULL,
  `Delete_Status` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`media_types_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `menu` (
  `Menu_ID` int NOT NULL AUTO_INCREMENT,
  `Menu_Name` varchar(100) NOT NULL,
  `Route` varchar(200) DEFAULT NULL,
  `Parent_Menu_ID` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  PRIMARY KEY (`Menu_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=1017 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `menu_user_selection` (
  `Menu_User_Selection_ID` int NOT NULL AUTO_INCREMENT,
  `Menu_ID` int NOT NULL,
  `User_ID` int NOT NULL,
  `Is_Edit` tinyint DEFAULT NULL,
  `Is_View` tinyint DEFAULT NULL,
  `Is_Delete` tinyint DEFAULT NULL,
  `Is_Create` tinyint DEFAULT NULL,
  PRIMARY KEY (`Menu_User_Selection_ID`),
  KEY `Menu_ID` (`Menu_ID`),
  KEY `menu_user_selection_ibfk_2_idx` (`User_ID`),
  CONSTRAINT `menu_user_selection_ibfk_1` FOREIGN KEY (`Menu_ID`) REFERENCES `menu` (`Menu_ID`),
  CONSTRAINT `menu_user_selection_ibfk_2` FOREIGN KEY (`User_ID`) REFERENCES `users` (`User_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `mobile_version` (
  `Version_Id` int NOT NULL AUTO_INCREMENT,
  `Version` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`Version_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `mock_test_package` (
  `Package_ID` int NOT NULL AUTO_INCREMENT,
  `Package_Name` varchar(200) NOT NULL,
  `Status` tinyint DEFAULT '1',
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Package_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `mock_test_packages` (
  `Package_ID` int NOT NULL AUTO_INCREMENT,
  `Package_Name` varchar(255) NOT NULL,
  `Delete_Status` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`Package_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `occupation` (
  `Occupation_Id` int NOT NULL,
  `occupation` varchar(255) NOT NULL,
  `Delete_Status` int DEFAULT '0',
  PRIMARY KEY (`Occupation_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payment_mode` (
  `Payment_Id` int NOT NULL AUTO_INCREMENT,
  `Payment_Name` varchar(100) NOT NULL,
  `Deleted_Status` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`Payment_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `payment_request` (
  `payment_request_id` int NOT NULL AUTO_INCREMENT,
  `order_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_page_client_id` varchar(100) NOT NULL,
  `customer_id` varchar(100) DEFAULT NULL,
  `action` varchar(50) DEFAULT 'paymentPage',
  `return_url` text,
  `requestId` varchar(100) DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'INR',
  `status` varchar(50) DEFAULT NULL,
  `course_Id` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `question` (
  `Question_ID` int NOT NULL AUTO_INCREMENT,
  `Exam_ID` int NOT NULL,
  `Question_Text` text,
  `Answer_Options` json DEFAULT NULL,
  `Correct_Answer` varchar(100) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  `Answer_Media_Name` varchar(25) DEFAULT 'text',
  PRIMARY KEY (`Question_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=280 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `receipts` (
  `Receipt_Id` int NOT NULL AUTO_INCREMENT,
  `Student_Id` int DEFAULT NULL,
  `Amount` decimal(10,2) DEFAULT NULL,
  `Entry_Date` datetime DEFAULT NULL,
  `User_Id` int DEFAULT NULL,
  `Branch` int DEFAULT NULL,
  `Account_Id` int DEFAULT NULL,
  `Payment_mode` varchar(100) DEFAULT NULL,
  `Transaction_ID` varchar(45) DEFAULT NULL,
  `Voucher_Number` int DEFAULT NULL,
  `DeleteStatus` tinyint(1) DEFAULT NULL,
  `Tax_Type_Id` int DEFAULT NULL,
  `Netvalue` decimal(18,2) DEFAULT NULL,
  `Gstpers` decimal(18,2) DEFAULT NULL,
  `Cgstpers` decimal(18,2) DEFAULT NULL,
  `Sgstpers` decimal(18,2) DEFAULT NULL,
  `Gst` decimal(18,2) DEFAULT NULL,
  `Cgst` decimal(18,2) DEFAULT NULL,
  `Sgst` decimal(18,2) DEFAULT NULL,
  `Payment_Date` date DEFAULT NULL,
  `Roll_No` varchar(100) DEFAULT NULL,
  `notes` text,
  `Account_Name` varchar(200) DEFAULT NULL,
  `Fine_Amount` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`Receipt_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1127 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `recent_student_course` (
  `student_id` int NOT NULL,
  `course_id` int NOT NULL,
  PRIMARY KEY (`student_id`,`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int NOT NULL,
  `reported_user_id` int DEFAULT NULL,
  `chat_id` varchar(50) DEFAULT NULL,
  `report_reason` text,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('Pending','Reviewed','Resolved') DEFAULT 'Pending',
  PRIMARY KEY (`report_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `section` (
  `Section_ID` int NOT NULL AUTO_INCREMENT,
  `ExamType_ID` int NOT NULL,
  `Section_Name` varchar(100) NOT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  PRIMARY KEY (`Section_ID`),
  KEY `ExamType_ID` (`ExamType_ID`),
  CONSTRAINT `section_ibfk_2` FOREIGN KEY (`ExamType_ID`) REFERENCES `exam_type` (`ExamType_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `staff_team_assignment` (
  `Staff_Team_Assignment_ID` int NOT NULL AUTO_INCREMENT,
  `staff_user_id` int NOT NULL,
  `team_lead_user_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Staff_Team_Assignment_ID`),
  UNIQUE KEY `uq_staff_user_id` (`staff_user_id`),
  KEY `idx_team_lead_user_id` (`team_lead_user_id`),
  CONSTRAINT `fk_staff_assignment_staff` FOREIGN KEY (`staff_user_id`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_staff_assignment_team_lead` FOREIGN KEY (`team_lead_user_id`) REFERENCES `users` (`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student` (
  `Student_ID` int NOT NULL AUTO_INCREMENT,
  `First_Name` varchar(50) DEFAULT NULL,
  `Last_Name` varchar(100) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Country_Code_Name` varchar(45) DEFAULT 'in',
  `Country_Code` varchar(45) DEFAULT '+91',
  `Phone_Number` varchar(50) DEFAULT NULL,
  `Social_Provider` varchar(50) DEFAULT NULL,
  `Social_ID` varchar(100) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Occupation_Id` int DEFAULT NULL,
  `OTP` varchar(45) DEFAULT NULL,
  `Profile_Photo_Path` longtext,
  `Profile_Photo_Name` longtext,
  `Avatar` varchar(45) DEFAULT NULL,
  `Device_ID` longtext,
  `Last_Online` varchar(45) DEFAULT NULL,
  `deactivate_requested` tinyint DEFAULT NULL,
  `Roll_No` varchar(500) DEFAULT NULL,
  `Branch_Name` varchar(255) DEFAULT NULL,
  `Branch_Id` int DEFAULT NULL,
  `Follow_Up_Date` date DEFAULT NULL,
  `Status_Id` int DEFAULT NULL,
  `Status_Name` varchar(100) DEFAULT NULL,
  `To_User_Id` int DEFAULT NULL,
  `To_User_Name` varchar(100) DEFAULT NULL,
  `By_User_Id` int DEFAULT NULL,
  `Remark` varchar(1000) DEFAULT NULL,
  `Followup_Status` tinyint(1) DEFAULT '0',
  `Department_Id` int DEFAULT NULL,
  `Department_Name` varchar(100) DEFAULT NULL,
  `Age` int DEFAULT NULL,
  `Qualification` varchar(100) DEFAULT NULL,
  `Qualification_Description` varchar(255) DEFAULT NULL,
  `Alt_Phone_Number` varchar(50) DEFAULT NULL,
  `Address` varchar(255) DEFAULT NULL,
  `Guardian_Type` varchar(50) DEFAULT NULL,
  `Guardian_Name` varchar(100) DEFAULT NULL,
  `Guardian_Phone` varchar(50) DEFAULT NULL,
  `Guardian_Alt_Phone` varchar(50) DEFAULT NULL,
  `Height_cm` int DEFAULT NULL,
  `Weight_kg` int DEFAULT NULL,
  `Entry_Date` datetime DEFAULT CURRENT_TIMESTAMP,
  `Admission_Date` date DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `Is_Registered` tinyint DEFAULT '0',
  `Registration_No` int DEFAULT NULL,
  `Registered_By` int DEFAULT NULL,
  `Registered_By_Name` varchar(500) DEFAULT NULL,
  `Registered_On` datetime DEFAULT NULL,
  `Registered_Branch_Id` int DEFAULT NULL,
  `Enquiry_Source_Id` int DEFAULT '0',
  `Mock_Test_Subscribed` tinyint(1) DEFAULT '0',
  `Mock_Test_Package` varchar(100) DEFAULT NULL,
  `Roll_No_Character` varchar(50) DEFAULT NULL,
  `Priority` varchar(50) DEFAULT 'Medium',
  PRIMARY KEY (`Student_ID`),
  UNIQUE KEY `Roll_No_UNIQUE` (`Roll_No`)
) ENGINE=InnoDB AUTO_INCREMENT=3585 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_course` (
  `StudentCourse_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Course_ID` int NOT NULL,
  `Enrollment_Date` date NOT NULL,
  `Expiry_Date` date DEFAULT NULL,
  `Price` int DEFAULT NULL,
  `Payment_Date` datetime DEFAULT NULL,
  `Payment_Status` varchar(50) DEFAULT NULL,
  `LastAccessed_Content_ID` varchar(50) DEFAULT '0',
  `Transaction_Id` varchar(50) DEFAULT '0',
  `Delete_Status` tinyint DEFAULT '0',
  `Payment_Method` varchar(50) DEFAULT '0',
  `Batch_ID` int DEFAULT '0',
  `Slot_Id` int DEFAULT '0',
  `Requested_Slot_Id` int DEFAULT NULL,
  `IsStudentModuleLocked` int DEFAULT '1',
  `Certificate_Issued` tinyint DEFAULT '0',
  `Course_Amount` decimal(18,2) DEFAULT '0.00',
  `Installment_information_ID` varchar(50) DEFAULT NULL,
  `Total_FeeAmount` decimal(10,2) DEFAULT NULL,
  `Fee_Status` varchar(50) DEFAULT NULL,
  `Discount` decimal(10,2) DEFAULT NULL,
  `Fee_Amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`StudentCourse_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=1976 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_documents` (
  `Document_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Document_Type_Id` varchar(100) NOT NULL,
  `Document_Name` varchar(255) DEFAULT NULL,
  `Document_URL` text,
  `S3_Key` varchar(255) DEFAULT NULL,
  `fileName` varchar(255) DEFAULT NULL,
  `Delete_Status` tinyint(1) DEFAULT '0',
  `Uploaded_At` datetime DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Document_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_exam` (
  `StudentExam_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Exam_ID` int DEFAULT NULL,
  `Content_Id` int DEFAULT NULL,
  `Batch_Id` int DEFAULT NULL,
  `Course_Id` int DEFAULT NULL,
  `Listening` varchar(45) DEFAULT NULL,
  `Reading` varchar(45) DEFAULT NULL,
  `Writing` varchar(45) DEFAULT NULL,
  `Speaking` varchar(45) DEFAULT NULL,
  `Overall_Score` varchar(45) DEFAULT NULL,
  `CEFR_level` varchar(45) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Result_Date` varchar(45) DEFAULT NULL,
  `Exam_Name` varchar(145) DEFAULT NULL,
  PRIMARY KEY (`StudentExam_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_exam_answer` (
  `StudentExamAnswer_ID` int NOT NULL AUTO_INCREMENT,
  `StudentExam_ID` int NOT NULL,
  `Question_ID` int NOT NULL,
  `Submitted_Answer` varchar(250) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  PRIMARY KEY (`StudentExamAnswer_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_fees_details` (
  `Student_Fees_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Installment_information_ID` int DEFAULT NULL,
  `Course_ID` int DEFAULT NULL,
  `Course_Name` varchar(255) DEFAULT NULL,
  `Total_Amount` decimal(10,2) DEFAULT NULL,
  `Paid_Amount` decimal(10,2) DEFAULT '0.00',
  `Remaining_Amount` decimal(10,2) DEFAULT '0.00',
  `Fee_Status` varchar(20) DEFAULT 'Pending',
  `Payment_Date` date DEFAULT NULL,
  `Due_Date` datetime DEFAULT NULL,
  `Payment_Mode` varchar(50) DEFAULT NULL,
  `Transaction_ID` varchar(100) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  `Created_At` datetime DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Installment_Index` int DEFAULT '1',
  PRIMARY KEY (`Student_Fees_ID`),
  KEY `Student_ID` (`Student_ID`),
  KEY `Installment_information_ID` (`Installment_information_ID`),
  CONSTRAINT `student_fees_details_ibfk_1` FOREIGN KEY (`Student_ID`) REFERENCES `student` (`Student_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=8423 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_followup` (
  `Follow_Up_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `Branch_ID` int DEFAULT NULL,
  `Branch_Name` varchar(255) DEFAULT NULL,
  `Department_ID` int DEFAULT NULL,
  `Department_Name` varchar(255) DEFAULT NULL,
  `Assigned_Staff_ID` int DEFAULT NULL,
  `Assigned_Staff_Name` varchar(255) DEFAULT NULL,
  `Follow_Up_Status_ID` int DEFAULT NULL,
  `Follow_Up_Status_Name` varchar(100) DEFAULT NULL,
  `Next_Follow_Up_Date` date DEFAULT NULL,
  `Remark` text,
  `Created_Date` date DEFAULT NULL,
  `Created_By` int DEFAULT NULL,
  `Updated_Date` datetime DEFAULT NULL,
  `Updated_By` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Follow_Up_ID`),
  KEY `idx_student_id` (`Student_ID`),
  KEY `idx_branch_id` (`Branch_ID`),
  KEY `idx_department_id` (`Department_ID`),
  KEY `idx_assigned_staff_id` (`Assigned_Staff_ID`),
  KEY `idx_follow_up_status_id` (`Follow_Up_Status_ID`),
  KEY `idx_next_follow_up_date` (`Next_Follow_Up_Date`),
  CONSTRAINT `fk_student_followup_student` FOREIGN KEY (`Student_ID`) REFERENCES `student` (`Student_ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=882 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_hod_chat` (
  `chat_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `message` text,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `Is_Student_Sent` tinyint DEFAULT NULL,
  `is_read` tinyint DEFAULT '0',
  `File_Path` varchar(150) DEFAULT NULL,
  `fileSize` decimal(18,2) DEFAULT '0.00',
  `thumbUrl` varchar(145) DEFAULT NULL,
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB AUTO_INCREMENT=575 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_import_errors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_data` json DEFAULT NULL,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2023 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_interested_course` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=411 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_live_class` (
  `StudentLiveClass_ID` int NOT NULL AUTO_INCREMENT,
  `Student_ID` int NOT NULL,
  `LiveClass_ID` int NOT NULL,
  `Attendance_Duration` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  `Start_Time` varchar(50) DEFAULT NULL,
  `End_Time` varchar(50) DEFAULT NULL,
  `Update_Time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`StudentLiveClass_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `student_teacher_chat` (
  `chat_id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `student_id` int NOT NULL,
  `message` text NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Is_Student_Sent` tinyint DEFAULT '0',
  `is_read` tinyint DEFAULT '0',
  `File_Path` varchar(145) DEFAULT NULL,
  `fileSize` decimal(18,2) DEFAULT '0.00',
  `thumbUrl` varchar(145) DEFAULT NULL,
  PRIMARY KEY (`chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `category` varchar(50) DEFAULT 'General',
  `display_name` varchar(100) DEFAULT NULL,
  `data_type` enum('text','number','boolean','json','image') DEFAULT 'text',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tax_type` (
  `Tax_Type_Id` int NOT NULL,
  `Tax_Type_Name` varchar(45) DEFAULT NULL,
  `DeleteStatus` tinyint DEFAULT NULL,
  PRIMARY KEY (`Tax_Type_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `teacher_time_slot` (
  `Slot_Id` int NOT NULL AUTO_INCREMENT,
  `CourseTeacher_ID` int DEFAULT NULL,
  `start_time` varchar(50) NOT NULL,
  `end_time` varchar(50) NOT NULL,
  `batch_id` int DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT '0',
  PRIMARY KEY (`Slot_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `unlocked_exam` (
  `Content_ID` int DEFAULT NULL,
  `Exam_ID` int DEFAULT NULL,
  `Is_Question_Unlocked` tinyint DEFAULT '0',
  `Is_Question_Media_Unlocked` tinyint DEFAULT '0',
  `Is_Answer_Unlocked` tinyint DEFAULT '0',
  `Batch_ID` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_menu_selection` (
  `User_Menu_Selection_Id` int NOT NULL AUTO_INCREMENT,
  `Menu_Id` int DEFAULT NULL,
  `User_Id` int DEFAULT NULL,
  `IsEdit` tinyint DEFAULT NULL,
  `IsSave` tinyint DEFAULT NULL,
  `IsDelete` tinyint DEFAULT NULL,
  `IsView` tinyint DEFAULT NULL,
  `DeleteStatus` tinyint DEFAULT NULL,
  PRIMARY KEY (`User_Menu_Selection_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=2922 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_request` (
  `user_Request_ID` int NOT NULL AUTO_INCREMENT,
  `First_Name` varchar(50) NOT NULL,
  `Last_Name` varchar(100) DEFAULT NULL,
  `Email` varchar(100) NOT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint(1) DEFAULT '0',
  `OTP` varchar(45) DEFAULT NULL,
  `Password` varchar(255) NOT NULL,
  `Profile_Photo_Path` varchar(145) DEFAULT NULL,
  `Profile_Photo_Name` varchar(145) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Updated_At` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_Request_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_role` (
  `User_Role_Id` int NOT NULL,
  `User_Role_Name` varchar(50) DEFAULT NULL,
  `Role_Under_Id` int DEFAULT NULL,
  `Delete_Status` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`User_Role_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_status` (
  `User_Status_Id` int NOT NULL,
  `User_Status_Name` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`User_Status_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_type` (
  `User_Type_Id` int NOT NULL,
  `User_Type_Name` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`User_Type_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `users` (
  `User_ID` int NOT NULL AUTO_INCREMENT,
  `First_Name` varchar(50) NOT NULL,
  `Last_Name` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `PhoneNumber` varchar(50) DEFAULT NULL,
  `Delete_Status` tinyint DEFAULT NULL,
  `User_Type_Id` int DEFAULT NULL,
  `User_Role_Id` int DEFAULT NULL,
  `User_Active_Status` int DEFAULT NULL,
  `OTP` varchar(45) DEFAULT NULL,
  `password` varchar(45) DEFAULT NULL,
  `Profile_Photo_Path` varchar(145) DEFAULT NULL,
  `Profile_Photo_Name` varchar(145) DEFAULT NULL,
  `token` varchar(45) DEFAULT NULL,
  `Device_ID` longtext,
  `Branch_Id` int DEFAULT NULL,
  `Basic_Pay` decimal(10,2) DEFAULT NULL,
  `Google_Sheet_Webhook_URL` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`User_ID`),
  KEY `FK_User_Type` (`User_Type_Id`),
  KEY `FK_User_Role` (`User_Role_Id`),
  CONSTRAINT `FK_User_Role` FOREIGN KEY (`User_Role_Id`) REFERENCES `user_role` (`User_Role_Id`),
  CONSTRAINT `FK_User_Type` FOREIGN KEY (`User_Type_Id`) REFERENCES `user_type` (`User_Type_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
