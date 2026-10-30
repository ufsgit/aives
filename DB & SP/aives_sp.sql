DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Add_Course_ToCart`(IN p_user_id INT, IN p_course_id INT)
BEGIN
  DECLARE v_cart_id INT;
  DECLARE v_existing_item_id INT;
  DECLARE v_existing_quantity INT;
  DECLARE v_course_exists BOOLEAN;

  -- Check if the course exists in the course table and Delete_Status is false
  SELECT EXISTS (
    SELECT 1
    FROM course
    WHERE Course_ID = p_course_id AND Delete_Status = FALSE
  ) INTO v_course_exists;

  -- If the course does not exist or Delete_Status is true, exit the procedure
  IF NOT v_course_exists THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Course does not exist or has been deleted';
  END IF;

  -- Retrieve the cart_id for the specified user_id
  SELECT id INTO v_cart_id
  FROM carts
  WHERE user_id = p_user_id
  LIMIT 1;

  -- If the cart_id is NULL, the user does not have a cart yet
  IF v_cart_id IS NULL THEN
    -- Create a new cart for the user
    INSERT INTO carts (user_id) VALUES (p_user_id);
    -- Get the ID of the newly inserted cart
    SET v_cart_id = LAST_INSERT_ID();
    -- Add the course to the cart_items table
    INSERT INTO cart_items (cart_id, course_id) VALUES (v_cart_id, p_course_id);
  ELSE
    -- Check if the course is already in the cart
    SELECT id, quantity INTO v_existing_item_id, v_existing_quantity
    FROM cart_items
    WHERE cart_id = v_cart_id AND course_id = p_course_id
    LIMIT 1; -- Limit the result to one row

    -- If the course is not already in the cart
    IF v_existing_item_id IS NULL THEN
      -- Add the course to the cart_items table
      INSERT INTO cart_items (cart_id, course_id) VALUES (v_cart_id, p_course_id);
    ELSE
      -- Increment the quantity of the existing course in the cart
      UPDATE cart_items
      SET quantity = v_existing_quantity + 1
      WHERE id = v_existing_item_id;
    END IF;
  END IF;

  -- Return the user_id and cart_id as a result
  SELECT p_user_id AS user_id, v_cart_id AS cart_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `AdjustNegativeRemainingAmount`(IN in_Student_ID INT)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE target_id INT;
  DECLARE target_rem DECIMAL(10,2);
  DECLARE cur CURSOR FOR
    SELECT Student_Fees_ID, Remaining_Amount
    FROM student_fees_details
    WHERE Student_ID = in_Student_ID AND Remaining_Amount < 0
    ORDER BY Due_Date ASC;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO target_id, target_rem;
    IF done THEN
      LEAVE read_loop;
    END IF;

 insert into data_log values("target_rem",target_rem);
  insert into data_log values("target_id",target_id);
    -- Find positive Remaining_Amount row to absorb this negative
SET @adjust_amt = ABS(target_rem);
    
    UPDATE student_fees_details pos
JOIN (
    SELECT Student_Fees_ID
    FROM student_fees_details
    WHERE Student_ID = in_Student_ID
      AND Remaining_Amount > 0
      AND Student_Fees_ID != target_id
      AND Delete_Status = 0
    ORDER BY Student_Fees_ID ASC
    LIMIT 1
) AS sub ON pos.Student_Fees_ID = sub.Student_Fees_ID
SET 
   pos.Paid_Amount = pos.Paid_Amount + @adjust_amt
-- , pos.Fee_Status = CASE WHEN (pos.Remaining_Amount - 5000) <= 0 THEN 'Paid' ELSE 'Pending' END
;

    -- After absorbing, reset the negative row to 0
   UPDATE student_fees_details 
SET Paid_Amount = Total_Amount 
WHERE Student_Fees_ID = target_id;


  END LOOP;

  CLOSE cur;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Block_User`(
    IN blocker_id_ INT,
    IN blocked_user_id_ INT,
    IN Is_Student_Blocked_ Tinyint
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM blocked_users WHERE blocker_id = blocker_id_ AND blocked_user_id = blocked_user_id_ AND Is_Student_Blocked=Is_Student_Blocked_
    ) THEN
        INSERT INTO blocked_users (blocker_id, blocked_user_id, timestamp,Is_Student_Blocked)
        VALUES (blocker_id_, blocked_user_id_, NOW(),Is_Student_Blocked_);
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Branch_Dropdown`()
BEGIN
select * from branches where Delete_Status=0 ;

 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `BulkImportInstallmentsBatch`(
    IN p_json_data JSON
)
BEGIN
    DECLARE v_roll_no VARCHAR(20);
    DECLARE v_installment_number INT DEFAULT 1;
    DECLARE v_student_id INT;
    DECLARE v_is_paid TINYINT;
    DECLARE v_amount DECIMAL(10,2);
    DECLARE v_tax_applied DECIMAL(5,2);
    DECLARE v_tax_amount DECIMAL(10,2);
    DECLARE v_payment_mode VARCHAR(50);
    DECLARE v_cheque_date DATE;
    DECLARE v_installment_date_1 DATE;
    DECLARE v_payment_status VARCHAR(20);
    DECLARE v_details TEXT;
    DECLARE v_batch_id INT;
    DECLARE v_batch_name VARCHAR(255);
    DECLARE v_course_id INT;
    DECLARE v_course_name VARCHAR(255);
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_total_count INT DEFAULT JSON_LENGTH(p_json_data);
    DECLARE v_processed_count INT DEFAULT 0;
    DECLARE v_skipped_count INT DEFAULT 0;
    DECLARE v_error_count INT DEFAULT 0;

    DECLARE v_current_record JSON;

    DECLARE v_temp_is_paid VARCHAR(10);
    DECLARE v_temp_amount VARCHAR(20);
    DECLARE v_temp_tax_applied VARCHAR(10);
    DECLARE v_temp_tax_amount VARCHAR(20);
    DECLARE v_temp_batch_id VARCHAR(10);
    DECLARE v_temp_course_id VARCHAR(10);
    DECLARE v_temp_cheque_date VARCHAR(50);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        INSERT INTO data_log_ VALUES(0, 'PROCEDURE_ERROR', CONCAT('Error at index: ', v_index));
        ROLLBACK;
        SELECT 
            'error' as status,
            CONCAT('Error at index: ', v_index) as message,
            0 as total_records,
            0 as processed_count,
            0 as skipped_count,
            1 as error_count;
        RESIGNAL;
    END;

    START TRANSACTION;

    WHILE v_index < v_total_count DO
        SET v_current_record = JSON_EXTRACT(p_json_data, CONCAT('$[', v_index, ']'));

        SET v_student_id = NULL;
        SET v_is_paid = 0;
        SET v_amount = 0.00;
        SET v_tax_applied = 0.00;
        SET v_tax_amount = 0.00;
        SET v_batch_id = NULL;
        SET v_course_id = NULL;
        SET v_cheque_date = NULL;

        SET v_roll_no = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.roll_no'));
        SET v_temp_is_paid = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.is_paid'));
        SET v_is_paid = CASE 
            WHEN v_temp_is_paid IN ('1', 'true', 'paid') THEN 1 
            ELSE 0 
        END;

        SET v_temp_amount = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.amount'));
        SET v_amount = CASE 
            WHEN v_temp_amount IS NOT NULL AND v_temp_amount != 'null' THEN CAST(v_temp_amount AS DECIMAL(10,2))
            ELSE 0.00 
        END;

        SET v_temp_tax_applied = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.tax_applied'));
        SET v_tax_applied = CASE 
            WHEN v_temp_tax_applied IS NOT NULL AND v_temp_tax_applied != 'null' THEN CAST(v_temp_tax_applied AS DECIMAL(5,2))
            ELSE 0.00 
        END;

        SET v_temp_tax_amount = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.tax_amount'));
        SET v_tax_amount = CASE 
            WHEN v_temp_tax_amount IS NOT NULL AND v_temp_tax_amount != 'null' THEN CAST(v_temp_tax_amount AS DECIMAL(10,2))
            ELSE 0.00 
        END;

        SET v_temp_batch_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.batch_id'));
        SET v_batch_id = CASE 
            WHEN v_temp_batch_id IS NOT NULL AND v_temp_batch_id != 'null' AND v_temp_batch_id != '' THEN CAST(v_temp_batch_id AS SIGNED)
            ELSE NULL 
        END;

        SET v_temp_course_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.course_id'));
        SET v_course_id = CASE 
            WHEN v_temp_course_id IS NOT NULL AND v_temp_course_id != 'null' AND v_temp_course_id != '' THEN CAST(v_temp_course_id AS SIGNED)
            ELSE NULL 
        END;

        SET v_payment_mode = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.payment_mode'));
        SET v_payment_status = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.payment_status'));
        SET v_details = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.details'));
        SET v_batch_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.batch_name'));
        SET v_course_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.course_name'));

        SET v_temp_cheque_date = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.cheque_date'));
        SET v_cheque_date = CASE 
            WHEN v_temp_cheque_date IS NOT NULL AND v_temp_cheque_date != 'null' AND v_temp_cheque_date != '' THEN v_temp_cheque_date
            ELSE NULL 
        END;

        SET v_installment_date_1 = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.installment_date_1'));

        IF v_roll_no IS NOT NULL AND v_roll_no != '' AND v_roll_no != 'null' THEN
            SELECT Student_ID INTO v_student_id FROM student WHERE Roll_No = v_roll_no LIMIT 1;
             insert into data_log_ values(0,v_course_name,'v_course_name');
            IF v_student_id IS NOT NULL THEN
                BEGIN
                    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
                    BEGIN
                        SET v_error_count = v_error_count + 1;
                    END;

                    INSERT INTO student_fees_details (
                        Student_ID,
                        Installment_information_ID,
                        Course_ID,
                        Course_Name,
                        Total_Amount,
                        Paid_Amount,
                        Remaining_Amount,
                        Fee_Status,
                        Payment_Date,
                        Due_Date,
                        Payment_Mode,
                        Transaction_ID,
                        Delete_Status,
                        Created_At,
                        Updated_At,
                        Installment_Index
                    ) VALUES (
                        v_student_id,
                        NULL,
                        v_course_id,
                        v_course_name,
                        v_amount,
                        CASE WHEN v_is_paid = 1 THEN v_amount ELSE 0.00 END,
                        CASE WHEN v_is_paid = 0 THEN v_amount ELSE 0.00 END,
                        CASE WHEN v_is_paid = 1 THEN 'Paid' ELSE 'Pending' END,
                        CASE WHEN v_is_paid = 1 THEN CURDATE() ELSE NULL END,
                        v_installment_date_1,
                        v_payment_mode,
                        NULL,
                        0,
                        NOW(),
                        NOW(),
                        v_installment_number
                    ) ON DUPLICATE KEY UPDATE
                        Total_Amount = VALUES(Total_Amount),
                        Paid_Amount = VALUES(Paid_Amount),
                        Remaining_Amount = VALUES(Remaining_Amount),
                        Fee_Status = VALUES(Fee_Status),
                        Payment_Date = VALUES(Payment_Date),
                        Due_Date = VALUES(Due_Date),
                        Payment_Mode = VALUES(Payment_Mode),
                        Updated_At = NOW(),
                        Installment_Index = VALUES(Installment_Index);

                    SET v_processed_count = v_processed_count + 1;
                END;
            ELSE
                SET v_skipped_count = v_skipped_count + 1;
            END IF;
        ELSE
            SET v_skipped_count = v_skipped_count + 1;
        END IF;

        SET v_index = v_index + 1;
    END WHILE;

    COMMIT;

    SELECT 
        'success' as status,
        'Import completed successfully' as message,
        v_total_count as total_records,
        v_processed_count as processed_count,
        v_skipped_count as skipped_count,
        v_error_count as error_count,
        CASE 
            WHEN v_error_count = 0 THEN 'All records processed successfully'
            WHEN v_processed_count > 0 THEN 'Import completed with some errors'
            ELSE 'Import failed'
        END as summary;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Bulk_Student_Import`(IN p_students_json JSON)
BEGIN
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_total_count INT DEFAULT JSON_LENGTH(p_students_json);
    DECLARE v_success_count INT DEFAULT 0;
    DECLARE v_error_count INT DEFAULT 0;

    -- Student-related declarations
    DECLARE v_student_id INT;
    DECLARE v_current_student JSON;

    DECLARE v_first_name VARCHAR(50);
    DECLARE v_last_name VARCHAR(100);
    DECLARE v_email VARCHAR(100);
    DECLARE v_country_code_name VARCHAR(45);
    DECLARE v_country_code VARCHAR(45);
    DECLARE v_phone_number VARCHAR(50);
    DECLARE v_roll_no VARCHAR(50);
    DECLARE v_branch_name VARCHAR(255);
    DECLARE v_branch_id INT;
    DECLARE v_address VARCHAR(255);

    DECLARE v_father_name VARCHAR(100);
    DECLARE v_mother_name VARCHAR(100);
    DECLARE v_guardian_name VARCHAR(100);
    DECLARE v_guardian_phone VARCHAR(100);
    DECLARE v_guardian_alt_phone VARCHAR(100);

    DECLARE v_course_name VARCHAR(200);
    DECLARE v_course_id INT;
    DECLARE v_course_price DECIMAL(10,2) DEFAULT 0.0;
    DECLARE v_validity INT DEFAULT 30;

    DECLARE v_batch_name VARCHAR(200);
    DECLARE v_batch_id INT;

    DECLARE v_total_amount DECIMAL(10,2);
    DECLARE v_paid_amount DECIMAL(10,2);
    DECLARE v_remaining_amount DECIMAL(10,2);

    -- Installment declarations
    DECLARE v_installment JSON;
    DECLARE v_installment_count INT DEFAULT 0;
    DECLARE v_inst_index INT;
    DECLARE v_inst_index_number INT;
    DECLARE v_inst_due_date_raw VARCHAR(100);
    DECLARE v_inst_due_date DATETIME;
    DECLARE v_inst_amount DECIMAL(10,2);
    DECLARE v_inst_tax DECIMAL(10,2);
    DECLARE v_inst_tax_applied VARCHAR(10);
    DECLARE v_inst_payment_mode VARCHAR(50);
    DECLARE v_inst_payment_status VARCHAR(50);
    DECLARE v_inst_details TEXT;
    DECLARE v_inst_is_paid VARCHAR(10);

    -- Temp values
    DECLARE v_temp_inst_id INT;
    DECLARE v_temp_amount DECIMAL(10,2);
    DECLARE v_temp_index INT;

    -- Error handler
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    WHILE v_index < v_total_count DO
        SET v_current_student = JSON_EXTRACT(p_students_json, CONCAT('$[', v_index, ']'));

        -- Parse basic fields
        SET v_first_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.First_Name'));
        SET v_last_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Last_Name'));
        SET v_email = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Email'));
        SET v_country_code_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Country_Code_Name'));
        SET v_country_code = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Country_Code'));
        SET @raw_phone = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Phone_Number'));
        SET @cleaned_phone = REGEXP_REPLACE(@raw_phone, '[^0-9,]', '');
        SET v_phone_number = RIGHT(SUBSTRING_INDEX(@cleaned_phone, ',', 1), 10);

        SET v_roll_no = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Roll_No'));
        SET v_branch_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Branch_Name'));
        SET v_branch_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Branch_Id'));
        SET v_course_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Course_Name'));
        SET v_batch_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Batch_Name'));
        SET v_address = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Address'));

        SET v_father_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Father'));
        SET v_mother_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Mother'));
        SET v_guardian_alt_phone = JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.GuardianNO'));
        SET v_guardian_name = IFNULL(NULLIF(v_father_name, ''), v_mother_name);
        SET v_guardian_phone = TRIM(BOTH ',' FROM CONCAT_WS(',', NULLIF(v_phone_number, ''), NULLIF(v_guardian_alt_phone, '')));

        SET v_total_amount = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Total_Amount')) AS DECIMAL(10,2));
        SET v_paid_amount = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_current_student, '$.Paid_Amount')) AS DECIMAL(10,2));
        SET v_remaining_amount = v_total_amount - v_paid_amount;

        -- Insert or get Course
        SELECT Course_ID INTO v_course_id FROM course WHERE Course_Name = v_course_name LIMIT 1;
        IF v_course_id IS NULL THEN
            INSERT INTO course (Course_Name, Category_ID, Validity, Price)
            VALUES (v_course_name, 1, v_validity, v_course_price);
            SET v_course_id = LAST_INSERT_ID();
        END IF;

        -- Insert or get Batch
        SELECT Batch_ID INTO v_batch_id FROM course_batch WHERE Batch_Name = v_batch_name AND Course_ID = v_course_id LIMIT 1;
        IF v_batch_id IS NULL THEN
            INSERT INTO course_batch (Course_ID, Batch_Name, Max_Students, Current_Students, Delete_Status)
            VALUES (v_course_id, v_batch_name, 100, 0, 0);
            SET v_batch_id = LAST_INSERT_ID();
        END IF;

        -- Insert Student
        INSERT INTO student (First_Name, Last_Name, Email, Country_Code_Name, Country_Code, Phone_Number,
            Roll_No, Branch_Name, Branch_Id, Address, Guardian_Name, Guardian_Phone, Delete_Status)
        VALUES (NULLIF(v_first_name, ''), NULLIF(v_last_name, ''), NULLIF(v_email, ''),
            COALESCE(NULLIF(v_country_code_name, ''), 'in'),
            COALESCE(NULLIF(v_country_code, ''), '+91'), NULLIF(v_phone_number, ''),
            NULLIF(v_roll_no, ''), NULLIF(v_branch_name, ''),
            CASE WHEN v_branch_id = '' OR v_branch_id IS NULL THEN NULL ELSE CAST(v_branch_id AS UNSIGNED) END,
            NULLIF(v_address, ''), NULLIF(v_guardian_name, ''), NULLIF(v_guardian_phone, ''), 0);

        SELECT Student_ID INTO v_student_id FROM student WHERE Roll_No = v_roll_no LIMIT 1;

        -- Insert student course
        INSERT INTO student_course (Student_ID, Course_ID, Batch_ID, Enrollment_Date, Expiry_Date, Price, Payment_Status, Course_Amount)
        VALUES (v_student_id, v_course_id, v_batch_id, CURDATE(), DATE_ADD(CURDATE(), INTERVAL v_validity DAY), v_course_price, 'Pending', v_total_amount);

        -- Installments - create temp table
        DROP TEMPORARY TABLE IF EXISTS temp_installments;
        CREATE TEMPORARY TABLE temp_installments (
            idx INT AUTO_INCREMENT PRIMARY KEY,
            Installment_ID INT,
            Amount DECIMAL(10,2)
        );

        INSERT INTO temp_installments (Installment_ID, Amount)
        SELECT Installment_information_ID, Amount
        FROM installment_information
        WHERE Course_ID = v_course_id AND Fee_Type = 'FourTime';

      --  SET v_installment_count = JSON_LENGTH(JSON_EXTRACT(v_current_student, '$.Installments'));
      SET v_installment_count = ROW_COUNT();
        SET v_inst_index = 0;

        -- STEP 1: Insert all rows (paid & unpaid)
        WHILE v_inst_index < v_installment_count DO
            SET v_installment = JSON_EXTRACT(v_current_student, CONCAT('$.Installments[', v_inst_index, ']'));

            SET v_inst_index_number = IFNULL(CAST(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.Index')) AS UNSIGNED), v_inst_index + 1);
            SET v_inst_due_date_raw = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.DueDate'));
            SET v_inst_due_date = STR_TO_DATE(v_inst_due_date_raw, '%d %b, %Y');

            SET v_inst_amount = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.Amount')) AS DECIMAL(10,2));
            SET v_inst_tax = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.TaxAmount')) AS DECIMAL(10,2));
            SET v_inst_tax_applied = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.TaxApplied'));
            SET v_inst_payment_mode = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.PaymentMode'));
            SET v_inst_payment_status = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.PaymentStatus'));
            SET v_inst_details = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.Details'));
            SET v_inst_is_paid = UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.IsPaid'))));

            -- Fetch corresponding temp installment info
            SELECT Installment_ID, Amount INTO v_temp_inst_id, v_temp_amount
            FROM temp_installments WHERE idx = v_inst_index + 1;

            -- Insert fee record
            INSERT INTO student_fees_details (
                Student_ID, Installment_information_ID, Course_ID, Course_Name,
                Total_Amount, Paid_Amount, Remaining_Amount,
                Due_Date, Payment_Mode, Transaction_ID,
                Delete_Status, Installment_Index
            ) VALUES (
                v_student_id, v_temp_inst_id, v_course_id, v_course_name,
                v_temp_amount, 0, v_temp_amount,
                v_inst_due_date, NULLIF(v_inst_payment_mode, ''),
                CONCAT('TXN-', UUID()), 0, v_inst_index + 1
            );

            SET v_inst_index = v_inst_index + 1;
        END WHILE;

        -- STEP 2: Call Save_Student_Fees_Details for paid installments
        SET v_inst_index = 0;
        WHILE v_inst_index < v_installment_count DO
            SET v_installment = JSON_EXTRACT(v_current_student, CONCAT('$.Installments[', v_inst_index, ']'));
            SET v_inst_is_paid = UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.IsPaid'))));

            IF v_inst_is_paid = 'PAID' THEN
                SET v_inst_due_date_raw = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.DueDate'));
                SET v_inst_due_date = STR_TO_DATE(v_inst_due_date_raw, '%d %b, %Y');
                SET v_inst_amount = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.Amount')) AS DECIMAL(10,2));
                SET v_inst_tax = CAST(JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.TaxAmount')) AS DECIMAL(10,2));
                SET v_inst_tax_applied = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.TaxApplied'));
                SET v_inst_payment_mode = JSON_UNQUOTE(JSON_EXTRACT(v_installment, '$.PaymentMode'));

                -- Fetch from temp table again
                SELECT Installment_ID, Amount INTO v_temp_inst_id, v_temp_amount
                FROM temp_installments WHERE idx = v_inst_index + 1;

                CALL Save_Student_Fees_Details(
                    0, v_student_id, v_temp_inst_id, v_course_id, v_course_name,
                    v_total_amount, v_inst_amount, 'Paid', CURDATE(), v_inst_due_date,
                    v_inst_payment_mode, CONCAT('TXN-', UUID()), v_inst_index + 1,
                    0, 1, 1,
                    v_temp_amount, v_inst_tax_applied, v_inst_tax,
                    0, 0, 0, 0
                );
            END IF;

            SET v_inst_index = v_inst_index + 1;
        END WHILE;

        SET v_success_count = v_success_count + 1;
        SET v_index = v_index + 1;
    END WHILE;

    COMMIT;

    SELECT
        v_total_count AS total_processed,
        v_success_count AS successful_inserts,
        v_error_count AS failed_inserts,
        CASE
            WHEN v_error_count = 0 THEN 'All students imported successfully'
            WHEN v_success_count = 0 THEN 'All imports failed'
            ELSE CONCAT(v_success_count, ' imported, ', v_error_count, ' failed')
        END AS status;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Buy_Course`(IN p_request_id VARCHAR(100))
BEGIN
    DECLARE course_validity INT;
    DECLARE course_Name_ VARCHAR(255);
    DECLARE Price_ DECIMAL(10,2);
    DECLARE student_Name_ VARCHAR(255);
    DECLARE course_expiry_date DATE;
    DECLARE v_course_id INT;
    DECLARE v_student_id VARCHAR(100);
    DECLARE v_order_id VARCHAR(100);
	DECLARE v_action VARCHAR(100);
    DECLARE course_conflict INT;
	DECLARE v_Batch_Id INT;

    -- Get payment request details
    SELECT pr.amount, pr.customer_id, pr.order_id, pr.status, c.course_Id, c.Validity, c.Course_Name,action
    INTO Price_, v_student_id, v_order_id, @payment_status, v_course_id, course_validity, course_Name_,v_action
    FROM payment_request pr
    JOIN course c ON c.Course_ID = pr.course_Id
    WHERE pr.requestId = p_request_id;
    
    -- Get student name
    SELECT First_Name INTO student_Name_ 
    FROM student 
    WHERE Student_ID = v_student_id;

    -- Check if the course is valid
    IF course_validity IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid Course_ID';
    END IF;

    -- Calculate expiry date
    SET course_expiry_date = DATE_ADD(CURDATE(), INTERVAL course_validity DAY);

    -- Check for Course conflicts
    SELECT COUNT(*) INTO course_conflict 
    FROM student_course 
    WHERE Course_ID = v_course_id 
    AND Student_ID = v_student_id 
    AND Delete_Status = 0 
    AND Expiry_Date >= CURDATE();
    
# for testing apple purchase  puprose on april 04   auto batch asign needed should to be remove hardcode (riyas flutter developer) 
	SELECT Batch_ID into v_Batch_Id
	FROM course_batch
	WHERE Course_ID = v_course_id
	  AND Delete_Status = 0
	  AND STR_TO_DATE(End_Date, '%Y-%m-%d') >= CURDATE()
	ORDER BY Start_Date ASC
	LIMIT 1;
    IF course_conflict = 0 THEN
        -- Insert new student course record
        INSERT INTO student_course (
            Student_ID, 
            Course_ID, 
            Enrollment_Date, 
            Expiry_Date, 
            Price, 
            Payment_Date, 
            Payment_Status, 
            LastAccessed_Content_ID, 
            Transaction_Id, 
            Delete_Status, 
            Payment_Method,
            Slot_Id,
            Requested_Slot_Id,
            Batch_ID,
            IsStudentModuleLocked,
            Certificate_Issued
        ) VALUES (
            v_student_id, 
            v_course_id, 
            CURDATE(), 
            course_expiry_date, 
            Price_, 
            NOW(), 
            'PAID', 
            0, 
            v_order_id, 
            0, 
           v_action,
            NULL,
            NULL,
            v_Batch_Id,
            1,
            0
        );
    ELSE
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Student is already enrolled in this course';
    END IF;

    -- Return the details
    SELECT 
        v_course_id AS Course_ID_, 
        v_student_id AS Student_ID_, 
        course_Name_ AS Course_Name_, 
        student_Name_ AS Student_Name_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Call_Update_Fee_Balance_For_All`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE sid INT;
    DECLARE cur CURSOR FOR SELECT Student_ID FROM student_fees_details;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO sid;
        IF done THEN
            LEAVE read_loop;
        END IF;
        CALL Update_Fee_Balance(sid);
    END LOOP;

    CLOSE cur;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `ChangeCategoryStatus`( In category_ID_ int, In status_ int  )
Begin 
 UPDATE course_category set Enabled_Status = status_   Where Category_ID = category_ID_ ;
 select category_ID_;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `ChangeStatus`( In category_ID_ int, In status_ int  )
Begin 
 UPDATE course_category set Enabled_Status = status_   Where Category_ID = category_ID_ ;
 select category_ID_;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Change_Module_Order`(
    IN p_OrderJSON JSON

)
BEGIN

	DECLARE v_Module_ID INT;
    DECLARE v_Order INT;
    DECLARE v_Index INT DEFAULT 0;
    DECLARE v_Count INT;
		
        
	SET v_Count = JSON_LENGTH(p_OrderJSON);
    
    -- Loop through the JSON array
    WHILE v_Index < v_Count DO
        -- Extract Module_ID and Order from the current JSON object
        SET v_Module_ID = JSON_EXTRACT(p_OrderJSON, CONCAT('$[', v_Index, '].Module_ID'));
        SET v_Order = JSON_EXTRACT(p_OrderJSON, CONCAT('$[', v_Index, '].Order'));
        
        -- Update the order for the current module
        UPDATE course_module
        SET View_Order = v_Order
        WHERE Module_ID = v_Module_ID;
        
        -- Move to the next element
        SET v_Index = v_Index + 1;
    END WHILE;
    
        
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Change_Module_Status`(
    IN module_ID_ INT,
    IN status_ INT
)
BEGIN 
    UPDATE course_module 
    SET Enabled_Status = status_   
    WHERE Module_ID = module_ID_;
    
    SELECT module_ID_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `change_password`( IN p_password varchar(50),IN p_user_ID varchar(50),IN token_  varchar(50))
BEGIN
update  users set password = p_password  where User_ID = p_user_ID and token =token_ ;
    SELECT ROW_COUNT() AS update_count;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Change_Student_Module_Lock_Status`(
    IN Student_ID_ INT,
    IN Course_ID_ INT,
    IN status_ INT
)
BEGIN 
    UPDATE student_course  SET IsStudentModuleLocked = status_ WHERE Student_ID = Student_ID_ and Course_ID = Course_ID_;
    SELECT Student_ID_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `CheckStudentEnrollment`(
    IN p_Student_ID INT,
    IN p_Course_ID INT
)
BEGIN
    -- Declare a variable to store the result
    DECLARE v_StudentCourse_ID INT DEFAULT 0;
    DECLARE v_Batch_Id INT DEFAULT 0;
    -- Select the StudentCourse_ID if the student is enrolled in the given course
    SELECT StudentCourse_ID ,Batch_ID
    INTO v_StudentCourse_ID,v_Batch_Id
    FROM student_course
    WHERE Student_ID = p_Student_ID
      AND Course_ID = p_Course_ID
      AND Delete_Status = 0
      AND   CURDATE() <= DATE_ADD(Expiry_Date, INTERVAL 1 MONTH)
      AND Enrollment_Date <= CURDATE()
    LIMIT 1;
    
    -- Return the result (either the found StudentCourse_ID or 0)
    SELECT IFNULL(v_StudentCourse_ID, 0) AS StudentCourse_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_App_Version`(
    IN p_Version VARCHAR(45)
)
BEGIN
    -- Check if the provided version matches any version in the table and return 1 or 0
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM mobile_version
                WHERE Version = p_Version
            ) THEN 1
            ELSE 0
        END AS IsEqual;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_Call_Availability`(
    IN p_id INT,
    IN p_is_student_calling TINYINT
)
BEGIN
    DECLARE is_in_call BOOLEAN;
    DECLARE is_in_live_class BOOLEAN;
    
    SET is_in_call = FALSE;
    SET is_in_live_class = FALSE;
    
    -- Check in call_history table
    SELECT TRUE INTO is_in_call
    FROM call_history
    WHERE (
        CASE 
            WHEN p_is_student_calling = 1 THEN teacher_id = p_id
            ELSE student_id = p_id
        END
    )
    AND Is_Finished = 0
    LIMIT 1;
    
    -- If not in call_history, check live_class table
    IF NOT is_in_call THEN
        IF p_is_student_calling = 1 THEN
            -- Check for teacher in live_class
            SELECT TRUE INTO is_in_live_class
            FROM live_class
            WHERE Teacher_ID = p_id
                AND Is_Finished = 0
                AND Delete_Status = 0
            LIMIT 1;
        ELSE
            -- Check for student in student_live_class
            SELECT TRUE INTO is_in_live_class
            FROM student_live_class slc
            INNER JOIN live_class lc ON slc.LiveClass_ID = lc.LiveClass_ID
            WHERE slc.Student_ID = p_id
                AND slc.Delete_Status = 0
                AND lc.Is_Finished = 0
                AND lc.Delete_Status = 0
                AND slc.End_Time IS NULL
            LIMIT 1;
        END IF;
    END IF;
    
    -- Return result
    SELECT 
        CASE
            WHEN is_in_call THEN TRUE
            WHEN is_in_live_class THEN TRUE
            ELSE FALSE
        END AS is_busy, 
        CASE
            WHEN is_in_call THEN 'Person is currently in a one-on-one call'
            WHEN is_in_live_class THEN 'Person is currently in a live class'
            ELSE 'Person is available for a call'
        END AS message;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_Options`(
    IN correct_options VARCHAR(100), 
    IN selected_options VARCHAR(100),
    OUT result BOOLEAN
)
BEGIN
    DECLARE correct_count INT;
    DECLARE selected_count INT;
    DECLARE matching_count INT;

    -- Count the number of correct options
    SET correct_count = 1 + LENGTH(correct_options) - LENGTH(REPLACE(correct_options, ',', ''));

    -- Count the number of selected options
    SET selected_count = 1 + LENGTH(selected_options) - LENGTH(REPLACE(selected_options, ',', ''));

    -- Count the number of matching options between correct and selected
    SET matching_count = (
        SELECT COUNT(*)
        FROM (
            SELECT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(correct_options, ',', n.n), ',', -1)) AS option_value
            FROM (
                SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
            ) AS n
            WHERE n.n <= correct_count
        ) AS correct_opts
        WHERE FIND_IN_SET(correct_opts.option_value, selected_options)
    );

    -- Compare the counts: they must match in length and all options must match
    SET result = (correct_count = selected_count AND correct_count = matching_count);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_OTP`(
    IN p_student_id INT,
    IN p_otp INT,
    IN IsStudent INT
)
BEGIN
    DECLARE otp_match INT DEFAULT 0;

    IF IsStudent = 1 THEN
        -- Check if the OTP matches for the given Student_ID in the student table
        SELECT COUNT(*) INTO otp_match
        FROM student
        WHERE Student_ID = p_student_id AND OTP = p_otp AND delete_status = 0;
        IF otp_match > 0 THEN
        -- Update Last_Online with the current timestamp
        UPDATE student
        SET Last_Online = NOW()
        WHERE Student_ID = p_student_id;
    END IF;
    ELSE
        -- Check if the OTP matches for the given User_ID in the users table
        SELECT COUNT(*) INTO otp_match
        FROM users
        WHERE User_ID = p_student_id AND OTP = p_otp AND Delete_Status = 0;
    END IF;

    -- Return 1 if OTP matches, 0 otherwise
    SELECT otp_match;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `check_User`(
    IN p_UserId INT,
    IN p_IsStudent TINYINT,
    IN p_Token LONGTEXT
)
BEGIN
    DECLARE v_DeleteStatus TINYINT;
    DECLARE usertype_ TINYINT;
    DECLARE v_TokenCount INT;
    SET usertype_ = 0;

    IF p_IsStudent = 0 THEN
        SELECT Delete_Status, User_Type_Id INTO v_DeleteStatus, usertype_
        FROM users
        WHERE User_ID = p_UserId;
    ELSE
        SELECT Delete_Status INTO v_DeleteStatus
        FROM student
        WHERE Student_ID = p_UserId;
    END IF;

    SELECT COUNT(*) INTO v_TokenCount
    FROM login_users
    WHERE User_Id = p_UserId
      AND Is_Student = p_IsStudent
      AND JWT_Token = p_Token;

    IF usertype_ = 1 THEN
        SET v_TokenCount = 1;
    END IF;

    SELECT
        CASE
            WHEN v_DeleteStatus IS NULL THEN 'NOT_FOUND'
            WHEN v_DeleteStatus = 1 THEN 'DELETED'
            WHEN v_DeleteStatus = 0 AND v_TokenCount > 0 THEN 'ACTIVE'
            WHEN v_DeleteStatus = 0 AND v_TokenCount = 0 THEN 'INVALID_TOKEN'
            ELSE 'Unknown error'
        END AS status,
        CASE
            WHEN v_DeleteStatus = 0 AND v_TokenCount > 0 THEN 1
            ELSE 0
        END AS status_code,
        COALESCE(v_DeleteStatus, -1) AS delete_status,
        v_TokenCount AS token_valid,
        usertype_ AS user_type_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_User_Blocked_Status`(
    IN user_id_ INT,
    IN other_user_id_ INT
)
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM blocked_users WHERE blocker_id = user_id_ AND blocked_user_id = other_user_id_) AS has_blocked,
        (SELECT COUNT(*) FROM blocked_users WHERE blocker_id = other_user_id_ AND blocked_user_id = user_id_) AS has_been_blocked;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Check_User_Exist`(
    IN p_email VARCHAR(100),
    IN p_phone_number VARCHAR(50),
    IN p_country_code VARCHAR(45),    -- Added country code parameter
    IN p_country_code_name VARCHAR(45),  -- Added country code name parameter
    IN otp_ INT,
    IN Device_ID_ LONGTEXT
)
BEGIN
    DECLARE user_exists INT DEFAULT 0;
    DECLARE user_id INT;
    DECLARE Occupation_Id_ INT;
    DECLARE newuser INT DEFAULT 1;
    DECLARE First_Name_ VARCHAR(100);
   
    -- Log the input email, phone number, and country code info
    INSERT INTO data_log(value) VALUES (p_email);
    INSERT INTO data_log(value) VALUES (p_phone_number);
    INSERT INTO data_log(value) VALUES (p_country_code);
    INSERT INTO data_log(value) VALUES (p_country_code_name);

    -- Check if email is provided
    IF p_email IS NOT NULL AND p_email <> '' THEN
        -- First, check if the email exists in the 'users' table
        SELECT COUNT(*) INTO user_exists
        FROM users
        WHERE email = p_email AND Delete_Status = 0;
       
        -- If email exists in 'users', throw an error
        IF user_exists > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists in Teacher ';
        ELSE
            -- If email is not in 'users', check in 'student' table
            SELECT Student_ID, COUNT(*), First_Name INTO user_id, user_exists, First_Name_
            FROM student
            WHERE email = p_email AND Delete_Status = 0
            GROUP BY Student_ID;
           
            IF user_exists > 0 THEN
                -- Update OTP for existing user in 'student' table
                UPDATE student
                SET OTP = otp_, Device_ID = Device_ID_
                WHERE email = p_email;
               
                SELECT Student_ID, 0 INTO user_id, newuser
                FROM student
                WHERE email = p_email AND Delete_Status = 0;
            END IF;
        END IF;
    -- Check if phone number is provided
    ELSEIF p_phone_number IS NOT NULL AND p_phone_number <> '' THEN
        -- Check if user with provided phone number exists in 'student' table
        SELECT Student_ID, COUNT(*), First_Name INTO user_id, user_exists, First_Name_
        FROM student
        WHERE phone_number = p_phone_number
        AND Country_Code = p_country_code    -- Added country code check
        AND Country_Code_Name = p_country_code_name  -- Added country code name check
        AND Delete_Status = 0
        GROUP BY Student_ID;
       
        IF user_exists > 0 THEN
            -- Update OTP for existing user with provided phone number
            UPDATE student
            SET OTP = otp_, Device_ID = Device_ID_
            WHERE phone_number = p_phone_number
            AND Country_Code = p_country_code
            AND Country_Code_Name = p_country_code_name;    -- Added country code name check
           
            SELECT Student_ID, 0 INTO user_id, newuser
            FROM student
            WHERE phone_number = p_phone_number
            AND Country_Code = p_country_code
            AND Country_Code_Name = p_country_code_name  -- Added country code name check
            AND Delete_Status = 0;
        END IF;
    END IF;
   
    -- Log the user existence result
    INSERT INTO data_log(value) VALUES (user_exists);
   
    -- Insert new record if user does not exist with either email or phone number
    IF user_exists = 0 AND (p_phone_number IS NOT NULL AND p_phone_number <> '' OR p_email IS NOT NULL AND p_email <> '') THEN
        INSERT INTO student (Email, Phone_Number, Country_Code, Country_Code_Name, OTP, Device_ID)    -- Added Country_Code_Name
        VALUES (p_email, p_phone_number, p_country_code, p_country_code_name, otp_, Device_ID_);        -- Added p_country_code_name
       
        SET user_id = LAST_INSERT_ID();
        SET newuser = 1; -- New user flag
    ELSE
        -- If user exists, check if the First_Name is null
        SELECT First_Name, Occupation_Id INTO First_Name_, Occupation_Id_
        FROM student
        WHERE Student_ID = user_id AND Delete_Status = 0;
       
        IF First_Name_ IS NULL OR First_Name_ = '' THEN
            SET newuser = 1;
        ELSE
            SET newuser = 0;
        END IF;
    END IF;
   
    -- Return user_id and newuser flag
    SELECT user_id AS Student_ID, newuser, Occupation_Id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `course_batch_Dropdown`()
BEGIN
select * from course_batch where Delete_Status=0 ;

 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Course_Dropdown`()
BEGIN
select * from course where Delete_Status=0 ;

 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `deactivate_Account`(In mobile_Number INT )
BEGIN
 update student set deactivate_requested =true where Phone_Number =mobile_Number;
  select Student_ID from student where Phone_Number =mobile_Number;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `deleteInstallmentInformation`(
    IN p_installment_information_id INT
)
BEGIN
    UPDATE installment_information
    SET Delete_Status = 1
    WHERE Installment_information_ID = p_installment_information_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Attendance`(IN p_courseId INT, IN p_batchId INT, IN p_date VARCHAR(20))
BEGIN 
    DECLARE v_attendance_id INT;
    
    SELECT Attendance_ID INTO v_attendance_id 
    FROM attendance_master 
    WHERE Course_ID = p_courseId AND Batch_ID = p_batchId AND Attendance_Date = p_date;
    
    IF v_attendance_id IS NOT NULL THEN
        DELETE FROM attendance_master WHERE Attendance_ID = v_attendance_id;
        -- attendance_details will be deleted automatically due to ON DELETE CASCADE
    END IF;
    
    SELECT 1 as success; 
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Batch`(
    IN p_Batch_Id INT
)
BEGIN
    Update course_batch set Delete_Status=1 WHERE Batch_ID = p_Batch_Id;
    
    SELECT p_Batch_Id as Batch_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Campaign`(IN Campaign_ID_ INT)
BEGIN
                UPDATE campaign SET Delete_Status = 1 WHERE Campaign_ID = Campaign_ID_;
                SELECT Campaign_ID_ AS Campaign_ID;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_course`( In course_id_ Int)
Begin 
 update course set Delete_Status=true where Course_ID =course_id_ ;
 select course_id_ as course_id;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_course_category`( In course_category_Id_ Int)
Begin 
 update course_category set Delete_Status=true where Category_ID =course_category_Id_ ;
 select course_category_Id_;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Course_Content`(IN Content_Id_ INT)
BEGIN
    DECLARE affectedRows INT DEFAULT 0;

    -- Delete from course_content table
    DELETE FROM course_content WHERE Content_ID = Content_Id_;
    SET affectedRows = affectedRows + ROW_COUNT();

    -- Delete from exam table
    DELETE FROM exam WHERE Exam_ID = (SELECT Exam_ID FROM course_content WHERE Content_ID = Content_Id_);
    SET affectedRows = affectedRows + ROW_COUNT();

    -- Return the total number of affected rows
    SELECT affectedRows AS TotalAffectedRows;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_course_module`(
    IN course_module_Id_ INT
)
BEGIN 
    UPDATE course_module 
    SET Delete_Status = true 
    WHERE Module_ID = course_module_Id_;
    
    SELECT course_module_Id_ AS Module_Id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Email_Template`(
                IN p_Template_ID INT
            )
BEGIN
                UPDATE email_templates SET Delete_Status = 1 WHERE Template_ID = p_Template_ID;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Enquiry_Source`(
                IN p_Enquiry_Source_Id INT
            )
BEGIN
                UPDATE enquiry_source 
                SET Delete_Status = 1 
                WHERE Enquiry_Source_Id = p_Enquiry_Source_Id;
                
                SELECT p_Enquiry_Source_Id AS Enquiry_Source_Id, 'Deleted Successfully' AS message;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Exam`(
    IN in_Exam_ID INT
)
BEGIN
    -- Soft-delete the exam
    UPDATE exam
    SET Delete_Status = 1
    WHERE Exam_ID = in_Exam_ID;

    -- Optional: Soft-delete related questions
    UPDATE question
    SET Delete_Status = 1
    WHERE Exam_ID = in_Exam_ID;

    SELECT 'Exam and related questions soft-deleted successfully' AS Status;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Expense`(
    IN p_Expense_Id INT
)
BEGIN
    UPDATE Expense
    SET Delete_Status = 1
    WHERE Expense_Id = p_Expense_Id;

    -- Return the ID of the deleted (soft-deleted) expense
    SELECT p_Expense_Id AS Expense_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Expense_Category`(
    IN p_Expense_Category_Id INT
)
BEGIN
    UPDATE Expense_Category
    SET Delete_Status = 1
    WHERE Expense_Category_Id = p_Expense_Category_Id;
    
    -- Optionally return affected ID
    SELECT p_Expense_Category_Id AS Deleted_Expense_Category_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Expense_Type`(
    IN p_Expense_Type_Id INT
)
BEGIN
    UPDATE Expense_Type
    SET Delete_Status = 1
    WHERE Expense_Type_Id = p_Expense_Type_Id;
    
    -- Optionally return affected ID
    SELECT p_Expense_Type_Id AS Deleted_Expense_Type_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_FeesByReceipt_ID`(
    IN P_Receipt_Id INT
)
BEGIN
	Declare Student_Id_ int;
    set Student_Id_=(Select Student_id from receipts where Receipt_Id=P_Receipt_Id);
	update receipts set DeleteStatus =1  WHERE Receipt_Id = P_Receipt_Id;
    call Update_Fee_Balance(Student_Id_);
    SELECT P_Receipt_Id as Receipt_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Followup_Status`(IN Status_Id_ INT)
BEGIN UPDATE followup_status SET Delete_Status = 1 WHERE Status_Id = Status_Id_; SELECT 1 AS success; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Income`(IN p_Income_Id INT)
BEGIN
                UPDATE income SET Delete_Status = 1 WHERE Income_Id = p_Income_Id;
                SELECT 1 AS success;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Income_Category`(IN p_Income_Category_Id INT)
BEGIN
                UPDATE income_category SET Delete_Status = 1 WHERE Income_Category_Id = p_Income_Category_Id;
                SELECT 1 AS success;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Income_Type`(IN p_Income_Type_Id INT)
BEGIN
                UPDATE income_type SET Delete_Status = 1 WHERE Income_Type_Id = p_Income_Type_Id;
                SELECT 1 AS success;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Invoice`(in Invoice_Id_ Int)
BEGIN
update invoices set Delete_Status = true where Invoice_Id=Invoice_Id_;
select Invoice_Id_ as  Invoice_Id ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Leave`(IN Leave_Id_ INT)
BEGIN
                UPDATE Leaves SET Is_Deleted = 1 WHERE Leave_Id = Leave_Id_;
                SELECT Leave_Id_ AS Leave_Id;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_MockTestPackage`(
    IN Package_ID_ INT
)
BEGIN
    UPDATE mock_test_packages
    SET Delete_Status = 1
    WHERE Package_ID = Package_ID_;
    
    SELECT 1 AS Status;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_StudentDocument`(
    IN p_Document_ID INT
)
BEGIN
    UPDATE student_documents
    SET 
        Delete_Status = 1,
        Updated_At = CURRENT_TIMESTAMP
    WHERE Document_ID = p_Document_ID;

    -- âœ… Return the Document_ID after deletion
    SELECT p_Document_ID AS Deleted_Document_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_Student_Account`(
    IN p_Student_ID INT
)
BEGIN
    -- Update the Delete_Status to 1 where the Student_ID matches the input parameter
    UPDATE student
    SET Delete_Status = 1
    WHERE Student_ID = p_Student_ID;
    select p_Student_ID as Student_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `delete_Student_Exam_result`(    IN p_StudentExam_ID INT)
BEGIN
update student_exam set Delete_Status =true where StudentExam_ID =p_StudentExam_ID;
 select StudentExam_ID from student_exam where StudentExam_ID =p_StudentExam_ID;
 
 END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Delete_User`(IN user_Id_ INT)
BEGIN
    UPDATE users
    SET Delete_Status = true
    WHERE User_ID = user_Id_;
    SELECT user_Id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Department_Dropdown`()
BEGIN
select * from department where Delete_Status=0 ;

 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Edit_FeesByReceipt_ID`(
    IN P_Receipt_Id INT
)
BEGIN
    SELECT 
		Receipt_Id ,
		Student_Id ,
		Amount ,
		Entry_Date ,
		User_Id,
		Branch ,
		Payment_mode ,
		Transaction_ID ,Account_Name,account_heads.Account_id,Voucher_Number
        FROM 
            receipts inner join account_heads on account_heads.Account_id=receipts.Account_id
        WHERE 
            Receipt_Id = P_Receipt_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `enroleCourse`(
    IN Student_ID_ int,
    IN Course_ID_ int,
    IN Enrollment_Date_ date,
    IN Price_ int,
    IN Payment_Date_ datetime,
    IN Payment_Status_ varchar(50),
    IN LastAccessed_Content_ID_ VARCHAR(50),
    IN Transaction_Id_ varchar(50),
    IN Delete_Status_ tinyint,
    IN Payment_Method_ varchar(50),
    IN Slot_Id_ int,
    IN Batch_Id_ int,
    IN StudentCourse_ID_ int
)
BEGIN
     DECLARE course_validity INT;
    DECLARE course_expiry_date DATE;
    DECLARE existing_Course_ID INT;
    DECLARE course_Name_ VARCHAR(100);
    DECLARE student_Name_ VARCHAR(100);
    DECLARE slot_conflict INT;
    DECLARE course_conflict INT;
    -- Fetch course details
    SELECT Validity, Course_Name,Price INTO course_validity, course_Name_,Price_ FROM course WHERE Course_ID = Course_ID_;
    SELECT First_Name INTO student_Name_ FROM student WHERE Student_ID = Student_ID_;

    -- Check if the course is valid
    IF course_validity IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid Course_ID';
    END IF;

    -- Check if the StudentCourse_ID is provided for update
    IF StudentCourse_ID_ > 0 THEN
        SELECT Course_ID INTO existing_Course_ID FROM student_course WHERE StudentCourse_ID = StudentCourse_ID_;

		  IF Batch_Id_ IS NULL THEN
				SET course_expiry_date = DATE_ADD(Enrollment_Date_, INTERVAL course_validity DAY);
			ELSE
				-- Fetch End_Date from course_batch table based on Batch_ID
				SELECT End_Date INTO course_expiry_date
				FROM course_batch
				WHERE Batch_ID = Batch_Id_;
			END IF;

            -- If the course is different, update all fields, including expiry

            UPDATE student_course
            SET 
                Course_ID = Course_ID_,
                Enrollment_Date = Enrollment_Date_,
                Expiry_Date = course_expiry_date,
                Price = Price_,
                Payment_Date = Payment_Date_,
                Payment_Status = Payment_Status_,
                LastAccessed_Content_ID = LastAccessed_Content_ID_,
                Transaction_Id = Transaction_Id_,
                Delete_Status = Delete_Status_,
                Payment_Method = Payment_Method_,
                Slot_Id = Slot_Id_,
                Requested_Slot_Id = Slot_Id_,
                Batch_ID = Batch_Id_
            WHERE 
                StudentCourse_ID = StudentCourse_ID_;
      

    ELSE
    insert into  data_log  values (45682,Batch_Id_);
		
     #   SET course_expiry_date = DATE_ADD(Enrollment_Date_, INTERVAL course_validity DAY);
           IF Batch_Id_ IS NULL THEN
				SET course_expiry_date = DATE_ADD(Enrollment_Date_, INTERVAL course_validity DAY);
			ELSE
				-- Fetch End_Date from course_batch table based on Batch_ID
				SELECT End_Date INTO course_expiry_date
				FROM course_batch
				WHERE Batch_ID = Batch_Id_;
			END IF;

        -- Check for slot conflicts
        SELECT COUNT(*) INTO slot_conflict 
        FROM student_course 
        WHERE Slot_Id = Slot_Id_ AND Student_ID != Student_ID_ AND Delete_Status = 0 AND Expiry_Date >= CURDATE();

        -- Check for Course conflicts
        SELECT COUNT(*) INTO course_conflict 
        FROM student_course 
        WHERE  Course_ID = Course_ID_ and  Student_ID = Student_ID_ AND Delete_Status = 0 AND Expiry_Date >= CURDATE();
      IF course_conflict > 0 THEN
			SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'Student is already enrolled in this course'; 
		ELSE 
			IF slot_conflict > 0 THEN
            INSERT INTO student_course (
                Student_ID, 
                Course_ID, 
                Enrollment_Date, 
                Expiry_Date, 
                Price, 
                Payment_Date, 
                Payment_Status, 
                LastAccessed_Content_ID, 
                Transaction_Id, 
                Delete_Status, 
                Payment_Method,
                Slot_Id,
                Requested_Slot_Id,
                Batch_ID
            ) VALUES (
                Student_ID_, 
                Course_ID_, 
                Enrollment_Date_, 
                course_expiry_date, 
                Price_, 
                Payment_Date_, 
                Payment_Status_, 
                LastAccessed_Content_ID_, 
                Transaction_Id_, 
                Delete_Status_, 
                Payment_Method_,
                NULL, 
                Slot_Id_,
                Batch_Id_
            );
        ELSE
            -- No conflict, insert Slot_Id as provided
            INSERT INTO student_course (
                Student_ID, 
                Course_ID, 
                Enrollment_Date, 
                Expiry_Date, 
                Price, 
                Payment_Date, 
                Payment_Status, 
                LastAccessed_Content_ID, 
                Transaction_Id, 
                Delete_Status, 
                Payment_Method,
                Slot_Id,
                Requested_Slot_Id,
                Batch_ID
            ) VALUES (
                Student_ID_, 
                Course_ID_, 
                Enrollment_Date_, 
                course_expiry_date, 
                Price_, 
                Payment_Date_, 
                Payment_Status_, 
                LastAccessed_Content_ID_, 
                Transaction_Id_, 
                Delete_Status_, 
                Payment_Method_,
                Slot_Id_,
                Slot_Id_,
                Batch_Id_
            );
        END IF;
			END IF;
    	END IF; 
    -- Return the details
    SELECT Course_ID_, Student_ID_, course_Name_, student_Name_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `enroleCourseFromAdmin`(
    IN Student_ID_ int,
    IN Course_ID_ int,
    IN Enrollment_Date_ date,
    IN Price_ int,
    IN Payment_Date_ datetime,
    IN Payment_Status_ varchar(50),
    IN LastAccessed_Content_ID_ VARCHAR(50),
    IN Transaction_Id_ varchar(50),
    IN Delete_Status_ tinyint,
    IN Payment_Method_ varchar(50),
    IN Slot_Id_ int,
    IN Batch_Id_ int,
    IN StudentCourse_ID_ int,
    IN Installment_information_ID_ VARCHAR(50),
    IN Total_FeeAmount_ decimal(10,2),
    IN Fee_Status_ varchar(50),
    IN Discount_ decimal(10,2),
    IN Fee_Amount_ decimal(10,2)
)
BEGIN
    DECLARE course_validity INT;
    DECLARE course_expiry_date DATE;
    DECLARE existing_Course_ID INT;
    DECLARE course_Name_ VARCHAR(100);
    DECLARE student_Name_ VARCHAR(100);
    DECLARE slot_conflict INT;
    DECLARE course_conflict INT;

    -- Fetch course details
    SELECT Validity, Course_Name INTO course_validity, course_Name_ FROM course WHERE Course_ID = Course_ID_;
    SELECT First_Name INTO student_Name_ FROM student WHERE Student_ID = Student_ID_;

    -- Check if the course is valid
    IF course_validity IS NULL THEN
        SELECT Course_ID_, Student_ID_, course_Name_, student_Name_;
    ELSE

        -- If StudentCourse_ID_ is not provided or 0, check if student already has an active enrollment for this course
        IF StudentCourse_ID_ IS NULL OR StudentCourse_ID_ <= 0 THEN
            SELECT StudentCourse_ID INTO StudentCourse_ID_
            FROM student_course
            WHERE Course_ID = Course_ID_ AND Student_ID = Student_ID_ AND Delete_Status = 0
            ORDER BY StudentCourse_ID DESC
            LIMIT 1;
        END IF;

        -- Check if the StudentCourse_ID is provided for update
        IF StudentCourse_ID_ > 0 THEN
            SELECT Course_ID INTO existing_Course_ID FROM student_course WHERE StudentCourse_ID = StudentCourse_ID_;

            IF Batch_Id_ IS NULL THEN
                SET course_expiry_date = DATE_ADD(Enrollment_Date_, INTERVAL course_validity DAY);
            ELSE
                SELECT End_Date INTO course_expiry_date
                FROM course_batch
                WHERE Batch_ID = Batch_Id_;
            END IF;

            UPDATE student_course
            SET 
                Course_ID = Course_ID_,
                Enrollment_Date = Enrollment_Date_,
                Expiry_Date = course_expiry_date,
                Price = Price_,
                Payment_Date = Payment_Date_,
                Payment_Status = Payment_Status_,
                LastAccessed_Content_ID = LastAccessed_Content_ID_,
                Transaction_Id = Transaction_Id_,
                Delete_Status = Delete_Status_,
                Payment_Method = 'ADMIN',
                Slot_Id = Slot_Id_,
                Requested_Slot_Id = Slot_Id_,
                Batch_ID = Batch_Id_,
                Installment_information_ID = Installment_information_ID_,
                Total_FeeAmount = Total_FeeAmount_,
                Fee_Status = Fee_Status_,
                Discount = Discount_,
                Fee_Amount = Fee_Amount_
            WHERE 
                StudentCourse_ID = StudentCourse_ID_;

        ELSE
            IF Batch_Id_ IS NULL THEN
                SET course_expiry_date = DATE_ADD(Enrollment_Date_, INTERVAL course_validity DAY);
            ELSE
                SELECT End_Date INTO course_expiry_date
                FROM course_batch
                WHERE Batch_ID = Batch_Id_;
            END IF;

            -- Check for slot conflicts
            SELECT COUNT(*) INTO slot_conflict 
            FROM student_course 
            WHERE Slot_Id = Slot_Id_ AND Student_ID != Student_ID_ AND Delete_Status = 0 AND Expiry_Date >= CURDATE();

            -- Check for Course conflicts
            SELECT COUNT(*) INTO course_conflict 
            FROM student_course 
            WHERE Course_ID = Course_ID_ AND Student_ID = Student_ID_ AND Delete_Status = 0 AND Expiry_Date >= CURDATE();

            IF course_conflict > 0 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Student is already enrolled in this course'; 
            ELSE 
                IF slot_conflict > 0 THEN
                    INSERT INTO student_course (
                        Student_ID, 
                        Course_ID, 
                        Enrollment_Date, 
                        Expiry_Date, 
                        Price, 
                        Payment_Date, 
                        Payment_Status, 
                        LastAccessed_Content_ID, 
                        Transaction_Id, 
                        Delete_Status, 
                        Payment_Method,
                        Slot_Id,
                        Requested_Slot_Id,
                        Batch_ID,
                        Installment_information_ID,
                        Total_FeeAmount,
                        Fee_Status,
                        Discount,
                        Fee_Amount
                    ) VALUES (
                        Student_ID_, 
                        Course_ID_, 
                        Enrollment_Date_, 
                        course_expiry_date, 
                        Price_, 
                        Payment_Date_, 
                        Payment_Status_, 
                        LastAccessed_Content_ID_, 
                        Transaction_Id_, 
                        Delete_Status_, 
                        'ADMIN',
                        NULL, 
                        Slot_Id_,
                        Batch_Id_,
                        Installment_information_ID_,
                        Total_FeeAmount_,
                        Fee_Status_,
                        Discount_,
                        Fee_Amount_
                    );
                ELSE
                    INSERT INTO student_course (
                        Student_ID, 
                        Course_ID, 
                        Enrollment_Date, 
                        Expiry_Date, 
                        Price, 
                        Payment_Date, 
                        Payment_Status, 
                        LastAccessed_Content_ID, 
                        Transaction_Id, 
                        Delete_Status, 
                        Payment_Method,
                        Slot_Id,
                        Requested_Slot_Id,
                        Batch_ID,
                        Installment_information_ID,
                        Total_FeeAmount,
                        Fee_Status,
                        Discount,
                        Fee_Amount
                    ) VALUES (
                        Student_ID_, 
                        Course_ID_, 
                        Enrollment_Date_, 
                        course_expiry_date, 
                        Price_, 
                        Payment_Date_, 
                        Payment_Status_, 
                        LastAccessed_Content_ID_, 
                        Transaction_Id_, 
                        Delete_Status_, 
                        'ADMIN',
                        Slot_Id_,
                        Slot_Id_,
                        Batch_Id_,
                        Installment_information_ID_,
                        Total_FeeAmount_,
                        Fee_Status_,
                        Discount_,
                        Fee_Amount_
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    SELECT Course_ID_, Student_ID_, course_Name_, student_Name_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Followup_status_Dropdown`()
BEGIN SELECT Status_Id, Status_Name, Status_Color FROM followup_status WHERE Delete_Status = 0 AND Is_Active = 1 ORDER BY Display_Order ASC; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Generate_certificate`(in StudentCourse_ID_ int,in value_ tinyint)
BEGIN 
update student_course set Certificate_Issued = value_ where StudentCourse_ID=StudentCourse_ID_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetAvailableUsers`(IN p_Student_ID INT)
BEGIN
    DECLARE v_Enrolled INT;

    -- Check if the student is enrolled in any course
    SELECT COUNT(*) INTO v_Enrolled
    FROM student_course
    WHERE Student_ID = p_Student_ID;

    IF v_Enrolled = 0 THEN
        -- Student is not enrolled in any course
        SELECT *
        FROM users
        WHERE Delete_Status = 0
          AND User_Type_Id = 2;
    ELSE
        -- Student is enrolled in one or more courses
			SELECT DISTINCT u.*
		FROM users u
		JOIN course_teacher ct ON u.User_ID = ct.Teacher_ID
		JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
		JOIN student_course sc ON tts.Slot_Id = sc.Slot_Id
		WHERE sc.Student_ID = p_Student_ID   
        AND sc.Expiry_Date > CURDATE()
		  AND u.Delete_Status = 0;

    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetCallsAndChats`(
    IN p_type VARCHAR(20),
    IN p_sender VARCHAR(20),
    IN p_teacher_id INT,
    IN p_student_id INT
)
BEGIN
    IF p_type = 'call' THEN
        IF p_sender = 'teacher' THEN
            SELECT
                id,
                teacher_id,
                student_id,
                call_start,
                call_end,
                call_duration,
                call_type
            FROM call_history
            WHERE teacher_id = p_teacher_id;
        ELSEIF p_sender = 'student' THEN
            SELECT
                id,
                teacher_id,
                student_id,
                call_start,
                call_end,
                call_duration,
                call_type
            FROM call_history
            WHERE student_id = p_student_id;
        END IF;
    ELSEIF p_type = 'chat' THEN
        IF p_sender = 'teacher' THEN
            SELECT
                chat_id,
                teacher_id,
                student_id,
                message,
                timestamp
            FROM student_teacher_chat
            WHERE teacher_id = p_teacher_id;
        ELSEIF p_sender = 'student' THEN
            SELECT
                chat_id,
                teacher_id,
                student_id,
                message,
                timestamp
            FROM student_teacher_chat
            WHERE student_id = p_student_id;
        END IF;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetStudentsByCourseId`( In course_Id_ Int)
Begin 
 SELECT sc.StudentCourse_ID,sc.Student_ID,sc.Course_ID,s.First_Name,sc.Enrollment_Date,sc.Expiry_Date,sc.Price,sc.Payment_Date,sc.Payment_Status,
 sc.LastAccessed_Content_ID,sc.Transaction_Id,sc.Delete_Status,sc.Payment_Method
 From student_course sc JOIN student s ON sc.Student_ID = s.Student_ID where sc.Course_ID =course_Id_ and sc.Delete_Status=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Accounts`(
            IN User_Id_ INT
        )
BEGIN
            DECLARE Branch_Id_ INT;
            SET Branch_Id_ = (SELECT Branch_Id FROM users WHERE User_ID = User_Id_);

            IF Branch_Id_ IS NOT NULL AND EXISTS (SELECT 1 FROM account_heads WHERE Branch_Id = Branch_Id_) THEN
                SELECT Account_id, Account_Name, Payment_Id 
                FROM account_heads 
                WHERE Branch_Id = Branch_Id_;
            ELSE
                SELECT Account_id, Account_Name, Payment_Id 
                FROM account_heads;
            END IF;
        END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_all_Batch`()
BEGIN
   SELECT *
    FROM course_batch
    WHERE  Delete_Status = false ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Course_Items`()
BEGIN
    -- Call Search_course_category
 SELECT Category_ID,
Category_Name,
Delete_Status From course_category where  Delete_Status= false and Enabled_Status = true ;


		SELECT 
			s.Section_ID,
			s.Section_Name,
			et.Have_Main_Question,
			et.Is_Main_Question_Text,
			et.Have_Answer_Key,
			et.Have_Supporting_Document, 
			mt.media_name AS Answer_Media_Name
		FROM 
			section s
		INNER JOIN 
			exam_type et ON s.ExamType_ID = et.ExamType_ID
		INNER JOIN 
			media_types mt ON et.Answer_Media_Id = mt.media_types_id
		WHERE 
			s.Delete_Status = 0 AND
			et.Delete_Status = 0 AND
			mt.Delete_Status = 0;


    SELECT User_ID,     CONCAT(First_Name, ' ', Last_Name) AS First_Name,
Last_Name, Email, PhoneNumber, Delete_Status, User_Type_Id, User_Role_Id, User_Active_Status 
    FROM users
    WHERE  Delete_Status = false And User_Type_Id =2;
    
    
    SELECT *
    FROM course_batch
    WHERE  Delete_Status = false ;

    SELECT Module_ID,
               Module_Name,
               Delete_Status,
               Enabled_Status
        FROM course_module
        WHERE
           Delete_Status = false
          AND Enabled_Status = true;
          
          
              SELECT *
        FROM content_visibility;
	select * from days;
       
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Enquiry`()
BEGIN
    SELECT 
        Enquiry_Source_Id,
        Enquiry_Source_Name,
        Delete_Status
    FROM 
        Enquiry_Source
    WHERE 
        Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_installment_information`(
IN Course_ID_ INT
)
BEGIN
  SELECT 
    Installment_information_ID,
    Details,
    Duration,
    Amount,
    Course_ID,
    Course_Name,
    Fee_Type,
    Delete_Status
  FROM installment_information
  WHERE Course_ID = Course_ID_ AND Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Live_Class`()
BEGIN
    SELECT 
        tts.start_time,  tts.end_time,
        c.Course_Name,
        ct.Course_ID,ct.Teacher_ID,
        cb.Batch_Name,cb.batch_id, tts.CourseTeacher_ID,tts.Slot_Id
    FROM 
        teacher_time_slot tts
    INNER JOIN 
        course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN 
        course c ON ct.Course_ID = c.Course_ID
    INNER JOIN 
        course_batch cb ON tts.batch_id = cb.Batch_ID
    WHERE 
      
         ct.Delete_Status = 0
        AND c.Delete_Status=0
        AND tts.Delete_Status = 0
        AND cb.Delete_Status = 0
		AND (cb.End_Date >= CURDATE() OR cb.End_Date IS NULL)
    ORDER BY 
        tts.start_time;
       
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Menu`()
BEGIN
  SELECT 
    Menu_ID,
    Menu_Name,
    Route,
    Parent_Menu_ID,
    Delete_Status
  FROM menu
  WHERE Delete_Status = FALSE;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Menu_Permission`(IN User_Id_ INT)
BEGIN
  SELECT 
    m.Menu_ID,
    m.Menu_Name,
    m.Route,
    m.Parent_Menu_ID,
    m.Delete_Status,
    coalesce(ums.IsView,0) as IsView,
    coalesce(ums.IsSave,0) as IsSave,
    coalesce(ums.IsEdit,0) as IsEdit,
   coalesce(ums.IsDelete,0) as IsDelete
  FROM menu m
  left JOIN user_menu_selection ums 
    ON ums.Menu_ID = m.Menu_ID AND ums.User_Id = User_Id_
  WHERE m.Delete_Status = FALSE
  union
  SELECT
      m.Menu_ID,
    m.Menu_Name,
    m.Route,
    m.Parent_Menu_ID,
    m.Delete_Status,
    0 IsView,
0 IsSave,
0 IsEdit,
0 IsDelete
  FROM menu m
    WHERE m.Delete_Status = FALSE and  m.Menu_ID  not in(select Menu_ID from user_menu_selection);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Menu_Permissions`(IN User_Id_ INT)
BEGIN
  SELECT 
    m.Menu_ID,
    m.Menu_Name,
    m.Route,
    m.Parent_Menu_ID,
    m.Delete_Status,
    coalesce(ums.IsView,0) as IsView,
    coalesce(ums.IsSave,0) as IsSave,
    coalesce(ums.IsEdit,0) as IsEdit,
   coalesce(ums.IsDelete,0) as IsDelete
  FROM menu m
  left JOIN user_menu_selection ums 
    ON ums.Menu_ID = m.Menu_ID AND ums.User_Id = User_Id_
  WHERE m.Delete_Status = FALSE
  union
  SELECT
      m.Menu_ID,
    m.Menu_Name,
    m.Route,
    m.Parent_Menu_ID,
    m.Delete_Status,
    0 IsView,
0 IsSave,
0 IsEdit,
0 IsDelete
  FROM menu m
    WHERE m.Delete_Status = FALSE and  m.Menu_ID  not in(select Menu_ID from user_menu_selection);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_PaymentMode`()
BEGIN
    SELECT 
        Payment_Id,
        Payment_Name
    FROM 
        payment_mode
    WHERE 
        Deleted_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Students`( In student_Name_ varchar(100))
Begin 
 set student_Name_ = Concat( '%',student_Name_ ,'%');
 SELECT * From student where First_Name like student_Name_ and Delete_Status=false and First_Name IS NOT NULL AND First_Name <> ''  ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_All_Time_Slot`(IN CourseID INT)
BEGIN
    SELECT MIN(tts.Slot_Id) AS Slot_Id, tts.start_time, tts.end_time,CourseID
    FROM teacher_time_slot tts
    JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    LEFT JOIN student_course sc ON tts.Slot_Id = sc.Slot_Id 
        AND sc.Course_ID = ct.Course_ID 
        AND sc.Delete_Status = 0
    WHERE ct.Course_ID = CourseID
    and tts.Delete_Status=0 
      AND ct.Delete_Status = 0
    #  AND (
    #    sc.Slot_Id IS NULL 
     #   OR sc.Expiry_Date < CURDATE()
    #  )
      AND tts.batch_id IS NULL
    GROUP BY tts.start_time, tts.end_time
    ORDER BY tts.start_time;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_AppInfo`(
    IN p_isStudent TINYINT,
    IN p_user_id INT
)
BEGIN
    SELECT * 
    FROM appinfo
    WHERE isStudent = p_isStudent 
    AND user_id = p_user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_appinfo_List`(
    p_is_student TINYINT,
    p_app_version VARCHAR(50),
    p_from_date VARCHAR(50),
    p_to_date VARCHAR(50),
    p_name_search VARCHAR(100),
    p_is_battery_optimized TINYINT, -- -1 means don't check
    p_page INT,
    p_page_size INT
)
BEGIN
    DECLARE v_offset INT;
    SET v_offset = (p_page - 1) * p_page_size; 

    IF p_is_student = 1 THEN
        -- Get total count for students
        SELECT COUNT(*) as total_count 
        FROM appinfo a
        INNER JOIN student s ON a.user_id = s.Student_ID
        WHERE 
            (p_app_version IS NULL OR a.app_version LIKE CONCAT('%', p_app_version, '%'))
            AND (p_from_date IS NULL OR DATE(a.created_at) >= DATE(p_from_date))
            AND (p_to_date IS NULL OR DATE(a.created_at) <= DATE(p_to_date))
            AND (p_name_search IS NULL OR (s.First_Name LIKE CONCAT('%', p_name_search, '%') OR s.Last_Name LIKE CONCAT('%', p_name_search, '%')))
            AND (p_is_battery_optimized = -1 OR a.is_battery_optimized = p_is_battery_optimized) -- Modified condition
            AND s.Delete_Status = 0;

        -- Get paginated results for students
        SELECT 
            a.*,
            s.First_Name,
            s.Last_Name,
            s.Email,
            s.Phone_Number,
            s.Country_Code,
            s.Country_Code_Name,
            'student' as user_type
        FROM appinfo a
        INNER JOIN student s ON a.user_id = s.Student_ID
        WHERE 
            (p_app_version IS NULL OR a.app_version LIKE CONCAT('%', p_app_version, '%'))
            AND (p_from_date IS NULL OR DATE(a.created_at) >= DATE(p_from_date))
            AND (p_to_date IS NULL OR DATE(a.created_at) <= DATE(p_to_date))
            AND (p_name_search IS NULL OR (s.First_Name LIKE CONCAT('%', p_name_search, '%') OR s.Last_Name LIKE CONCAT('%', p_name_search, '%')))
            AND (p_is_battery_optimized = -1 OR a.is_battery_optimized = p_is_battery_optimized) -- Modified condition
            AND s.Delete_Status = 0
        ORDER BY a.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset;

    ELSE
        -- Similar changes for the teacher section
        SELECT COUNT(*) as total_count 
        FROM appinfo a
        INNER JOIN users u ON a.user_id = u.User_ID
        WHERE 
            (p_app_version IS NULL OR a.app_version LIKE CONCAT('%', p_app_version, '%'))
            AND (p_from_date IS NULL OR DATE(a.created_at) >= DATE(p_from_date))
            AND (p_to_date IS NULL OR DATE(a.created_at) <= DATE(p_to_date))
            AND (p_name_search IS NULL OR (u.First_Name LIKE CONCAT('%', p_name_search, '%') OR u.Last_Name LIKE CONCAT('%', p_name_search, '%')))
            AND (p_is_battery_optimized = -1 OR a.is_battery_optimized = p_is_battery_optimized) -- Modified condition
            AND u.Delete_Status = 0;

        SELECT 
            a.*,
            u.First_Name,  
            u.Last_Name,
            u.Email,
            u.PhoneNumber as Phone_Number,
            NULL as Country_Code,
            NULL as Country_Code_Name,
            'teacher' as user_type
        FROM appinfo a
        INNER JOIN users u ON a.user_id = u.User_ID
        WHERE 
            (p_app_version IS NULL OR a.app_version LIKE CONCAT('%', p_app_version, '%'))
            AND (p_from_date IS NULL OR DATE(a.created_at) >= DATE(p_from_date))
            AND (p_to_date IS NULL OR DATE(a.created_at) <= DATE(p_to_date))
            AND (p_name_search IS NULL OR (u.First_Name LIKE CONCAT('%', p_name_search, '%') OR u.Last_Name LIKE CONCAT('%', p_name_search, '%')))
            AND (p_is_battery_optimized = -1 OR a.is_battery_optimized = p_is_battery_optimized) -- Modified condition
            AND u.Delete_Status = 0
        ORDER BY a.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Assigned_Staff_Dropdown`(IN p_user_id INT)
BEGIN
    DECLARE v_is_special_admin INT DEFAULT 0;

    -- Check if it's the admin
    SELECT 1 INTO v_is_special_admin 
    FROM users 
    WHERE User_ID = p_user_id AND Email = 'admin_user@G.COM' LIMIT 1;

    CREATE TEMPORARY TABLE IF NOT EXISTS temp_allowed_staff (staff_id INT);
    TRUNCATE TABLE temp_allowed_staff;

    INSERT INTO temp_allowed_staff (staff_id)
    WITH RECURSIVE staff_hierarchy AS (
        SELECT p_user_id as staff_id
        UNION ALL
        SELECT sta.staff_user_id as staff_id
        FROM staff_team_assignment sta
        INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
    )
    SELECT staff_id FROM staff_hierarchy;

    IF v_is_special_admin = 1 THEN
        SELECT * FROM users 
        WHERE Delete_Status = 0 AND User_Type_Id IN (1, 2, 3);
    ELSE
        SELECT * FROM users u
        WHERE u.Delete_Status = 0 AND u.User_Type_Id IN (1, 2, 3) AND u.User_ID IN (SELECT staff_id FROM temp_allowed_staff)
        ORDER BY u.First_Name ASC, u.Last_Name ASC;
    END IF;

    DROP TEMPORARY TABLE IF EXISTS temp_allowed_staff;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Attendance_Details_By_Session`(IN p_courseId INT, IN p_batchId INT, IN p_date VARCHAR(20))
BEGIN 
    SELECT 
        s.Student_ID, 
        CONCAT(s.First_Name, ' ', IFNULL(s.Last_Name, '')) as Student_Name, 
        ad.Status 
    FROM attendance_master am
    JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
    JOIN student s ON ad.Student_ID = s.Student_ID 
    WHERE am.Course_ID = p_courseId AND am.Batch_ID = p_batchId AND am.Attendance_Date = p_date; 
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Attendance_History`(
    IN p_courseId INT,
    IN p_batchId INT,
    IN p_fromDate VARCHAR(20),
    IN p_toDate VARCHAR(20),
    IN p_staffId INT
)
BEGIN
    SELECT 
        DATE_FORMAT(a.Attendance_Date, '%Y-%m-%d') as Attendance_Date, 
        a.Course_ID,
        a.Batch_ID,
        c.Course_Name, 
        b.Batch_Name, 
        CONCAT(u.First_Name, ' ', IFNULL(u.Last_Name, '')) as Marked_By_Name, 
        1 as Session, 
        MAX(a.Status) as Status 
    FROM attendance a 
    LEFT JOIN course c ON a.Course_ID = c.Course_ID 
    LEFT JOIN course_batch b ON a.Batch_ID = b.Batch_ID 
    LEFT JOIN users u ON a.Marked_By = u.User_ID 
    WHERE (p_courseId = 0 OR a.Course_ID = p_courseId) 
    AND (p_batchId = 0 OR a.Batch_ID = p_batchId) 
    AND (p_fromDate = '' OR a.Attendance_Date >= p_fromDate) 
    AND (p_toDate = '' OR a.Attendance_Date <= p_toDate) 
    GROUP BY a.Attendance_Date, a.Course_ID, a.Batch_ID, a.Marked_By 
    ORDER BY a.Attendance_Date DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Attendance_Summary_Report`(
    IN p_studentId INT,
    IN p_courseId INT,
    IN p_batchId INT,
    IN p_fromDate VARCHAR(20),
    IN p_toDate VARCHAR(20),
    IN p_staffId INT,
    IN p_status INT
)
BEGIN
    -- 1. Detailed List
    SELECT 
        am.Attendance_ID,
        am.Attendance_Date, 
        s.Student_ID,
        CONCAT(s.First_Name, ' ', IFNULL(s.Last_Name, '')) as Student_Name,
        c.Course_Name, 
        b.Batch_Name, 
        CONCAT(u.First_Name, ' ', IFNULL(u.Last_Name, '')) as Marked_By_Name, 
        ad.Status 
    FROM attendance_master am 
    JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
    JOIN student s ON ad.Student_ID = s.Student_ID
    LEFT JOIN course c ON am.Course_ID = c.Course_ID 
    LEFT JOIN course_batch b ON am.Batch_ID = b.Batch_ID 
    LEFT JOIN users u ON am.Marked_By = u.User_ID 
    WHERE (p_studentId = 0 OR ad.Student_ID = p_studentId)
    AND (p_courseId = 0 OR am.Course_ID = p_courseId) 
    AND (p_batchId = 0 OR am.Batch_ID = p_batchId) 
    AND (p_fromDate = '' OR am.Attendance_Date >= p_fromDate) 
    AND (p_toDate = '' OR am.Attendance_Date <= p_toDate) 
    AND (p_staffId = 0 OR am.Marked_By = p_staffId)
    AND (
        p_status = -1 
        OR (p_status = 0 AND ad.Status IN (0, 2)) -- Absent includes Leave
        OR (p_status = 1 AND ad.Status = 1)        -- Present
        OR (ad.Status = p_status)                  -- Specific status
    )
    ORDER BY am.Attendance_Date DESC, Student_Name ASC;

    -- 2. Summary Counts
    SELECT 
        SUM(CASE WHEN ad.Status = 1 THEN 1 ELSE 0 END) as Total_Present,
        SUM(CASE WHEN ad.Status IN (0, 2) THEN 1 ELSE 0 END) as Total_Absent, -- Count Absent + Leave as Absent
        SUM(CASE WHEN ad.Status = 2 THEN 1 ELSE 0 END) as Total_Leave,
        SUM(CASE WHEN ad.Status = 3 THEN 1 ELSE 0 END) as Total_Late,
        COUNT(*) as Total_Records
    FROM attendance_master am
    JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
    WHERE (p_studentId = 0 OR ad.Student_ID = p_studentId)
    AND (p_courseId = 0 OR am.Course_ID = p_courseId) 
    AND (p_batchId = 0 OR am.Batch_ID = p_batchId) 
    AND (p_fromDate = '' OR am.Attendance_Date >= p_fromDate) 
    AND (p_toDate = '' OR am.Attendance_Date <= p_toDate) 
    AND (p_staffId = 0 OR am.Marked_By = p_staffId)
    AND (
        p_status = -1 
        OR (p_status = 0 AND ad.Status IN (0, 2))
        OR (p_status = 1 AND ad.Status = 1)
        OR (ad.Status = p_status)
    );
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Available_Hod`(IN p_Student_ID INT)
BEGIN
    DECLARE v_Enrolled INT;
	DECLARE v_Course_ID INT;
		SELECT Course_ID INTO v_Course_ID
		FROM student_course
		WHERE Student_ID = p_Student_ID
       ORDER BY StudentCourse_ID DESC
		LIMIT 1;

    -- Check if the student is enrolled in any course
    SELECT COUNT(*) INTO v_Enrolled
    FROM student_course
    WHERE Student_ID = p_Student_ID;

    IF v_Enrolled = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student is Not enrolled in any course';

    ELSE
        -- Student is enrolled in one or more courses
			SELECT DISTINCT u.*,sc.Course_ID as courseId
		FROM users u
		JOIN course_hod ch ON ch.User_ID = u.User_ID   
		JOIN student_course sc ON ch.Course_ID = sc.Course_ID
		WHERE sc.Student_ID = p_Student_ID    and sc.Course_ID=v_Course_ID
        AND sc.Expiry_Date > CURDATE()
		  AND u.Delete_Status = 0 And u.User_Type_Id=3 And u.User_Active_Status =1;

    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Available_Mentors`(IN p_Student_ID INT)
BEGIN
    DECLARE v_Course_ID INT;
    DECLARE v_Batch_ID INT;

    -- Get the most recent Course_ID for the student
    SELECT Course_ID, Batch_ID INTO v_Course_ID, v_Batch_ID
    FROM student_course
    WHERE Student_ID = p_Student_ID 
    ORDER BY StudentCourse_ID DESC
    LIMIT 1;

    WITH Latest_HOD AS (
        SELECT DISTINCT
            u.User_ID,
            u.First_Name,
            u.Profile_Photo_Path,
            u.Last_Name,
            u.Email,
            u.PhoneNumber,
            u.User_Type_Id,
            u.User_Active_Status,
            sc.Course_ID AS courseId,
            c.Course_Name,
            NULL AS start_time,
            NULL AS end_time,
            NULL AS Batch_ID,
            NULL AS Slot_Id,
            0 AS has_batch_wise,
            0 AS has_slot_wise
        FROM users u
        JOIN course_hod ch ON ch.User_ID = u.User_ID
        JOIN student_course sc ON ch.Course_ID = sc.Course_ID
        JOIN course c ON c.Course_ID = sc.Course_ID
        WHERE sc.Student_ID = p_Student_ID
          AND sc.Course_ID IN (
              SELECT Course_ID
              FROM student_course
              WHERE Student_ID = p_Student_ID
          )
          AND sc.Expiry_Date > CURDATE()
          AND u.Delete_Status = 0
          AND u.User_Type_Id = 3
          AND u.User_Active_Status = 1
          AND c.Delete_Status = FALSE
        ORDER BY User_ID 
        LIMIT 1
    )

    -- Fetch available mentors with grouped timings
    SELECT
        User_ID,
        MAX(Profile_Photo_Path) AS Profile_Photo_Path,
        MAX(First_Name) AS First_Name,
        MAX(Last_Name) AS Last_Name,
        MAX(Email) AS Email,
        MAX(PhoneNumber) AS PhoneNumber,
        MAX(User_Type_Id) AS User_Type_Id,
        MAX(User_Active_Status) AS User_Active_Status,
        MAX(courseId) AS courseId,
        MAX(Course_Name) AS Course_Name,
        MAX(Batch_ID) AS Batch_ID,
        GROUP_CONCAT(DISTINCT 
            CASE 
                WHEN start_time IS NOT NULL AND end_time IS NOT NULL 
                THEN CONCAT(TIME_FORMAT(start_time, '%H:%i'), '-', TIME_FORMAT(end_time, '%H:%i'))
            END
            ORDER BY start_time SEPARATOR ', '
        ) AS start_time,
        MAX(Slot_Id) AS Slot_Id,
        MAX(has_batch_wise) AS has_batch_wise,
        MAX(has_slot_wise) AS has_slot_wise
    FROM (
        -- Get Available Mentors for Slot (One-on-One)
        SELECT DISTINCT
            u.User_ID,
            u.First_Name,
            u.Profile_Photo_Path,
            u.Last_Name,
            u.Email,
            u.PhoneNumber,
            u.User_Type_Id,
            u.User_Active_Status,
            NULL AS courseId,
            NULL AS Course_Name,
            NULL AS Batch_ID,
            tts.start_time,
            tts.end_time,
            sc.Slot_Id,
            0 AS has_batch_wise,
            1 AS has_slot_wise
        FROM users u
        JOIN course_teacher ct ON u.User_ID = ct.Teacher_ID
        JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
        JOIN student_course sc ON tts.Slot_Id = sc.Slot_Id
        JOIN course c ON c.Course_ID = ct.Course_ID
        WHERE sc.Student_ID = p_Student_ID
          AND sc.Expiry_Date > CURDATE()
          AND u.Delete_Status = 0
          AND c.Delete_Status = FALSE

        UNION ALL

        -- Include Latest HOD
        SELECT DISTINCT
            User_ID,
            First_Name,
            Profile_Photo_Path,
            Last_Name,
            Email,
            PhoneNumber,
            User_Type_Id,
            User_Active_Status,
            courseId,
            Course_Name,
            Batch_ID,
            start_time,
            end_time,
            Slot_Id,
            has_batch_wise,
            has_slot_wise
        FROM Latest_HOD

        UNION ALL

        -- Get Teachers by Batch
        SELECT DISTINCT
            u.User_ID,
            u.First_Name,
            u.Profile_Photo_Path,
            u.Last_Name,
            u.Email,
            u.PhoneNumber,
            u.User_Type_Id,
            u.User_Active_Status,
            NULL AS courseId,
            c.Course_Name,
            sc.Batch_ID,
            tts.start_time,
            tts.end_time,
            NULL AS Slot_Id,
            1 AS has_batch_wise,
            0 AS has_slot_wise
        FROM users u
        JOIN course_teacher ct ON u.User_ID = ct.Teacher_ID
        JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
        JOIN student_course sc ON tts.Batch_ID = sc.Batch_ID
        JOIN course c ON c.Course_ID = ct.Course_ID
        WHERE sc.Student_ID = p_Student_ID
          AND sc.Expiry_Date > CURDATE()
          AND u.Delete_Status = 0
          AND c.Delete_Status = 0
          AND sc.Batch_ID IN (
              SELECT Batch_ID
              FROM student_course
              WHERE Student_ID = p_Student_ID
          )
          AND tts.Delete_Status = 0
          AND ct.Delete_Status = 0
    ) AS Results
    GROUP BY User_ID, courseId
    ORDER BY User_Type_Id DESC;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Available_Time_Slot`(IN CourseID INT)
BEGIN

SELECT 
    tts.Slot_Id, 
    TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
	TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,


    sc.Slot_Id AS Student_Slot_Id, 
    MAX(s.Delete_Status) AS Student_Delete_Status, 
    MAX(sc.StudentCourse_ID) AS StudentCourse_ID,
    ct.Course_ID,
    CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
    u.User_ID,
    MAX(sc.Expiry_Date) AS Expiry_Date
FROM 
    teacher_time_slot tts
JOIN 
    course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
JOIN 
    users u ON u.User_ID = ct.Teacher_ID
LEFT JOIN 
    student_course sc ON tts.Slot_Id = sc.Slot_Id 
         AND sc.Course_ID = ct.Course_ID 
LEFT JOIN 
    student s ON sc.Student_ID = s.Student_ID
WHERE 
    ct.Course_ID = CourseID
    AND tts.Delete_Status = 0 
    AND ct.Delete_Status = 0
        AND u.Delete_Status = 0
    AND tts.batch_id IS NULL 
GROUP BY 
    tts.Slot_Id, tts.start_time, tts.end_time, ct.Course_ID, u.First_Name, u.Last_Name, u.User_ID
HAVING 
    (tts.Slot_Id IS NULL) OR 
    (COUNT(sc.StudentCourse_ID) = 0) OR 
    (COUNT(CASE WHEN s.Delete_Status = 0 THEN 1 END) = 0) OR  -- Ensure no active students
    (MAX(sc.Expiry_Date) < CURDATE());

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Batch`(
    IN p_Batch_Id INT
)
BEGIN
    SELECT * FROM Batch WHERE Batch_ID = p_Batch_Id and Delete_Status = false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Batch_Days`(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_module_id INT
)
BEGIN
    DECLARE v_batch_id INT;
    DECLARE v_days_passed INT;
    DECLARE v_start_date VARCHAR(255);  -- Variable to hold Start_Date as VARCHAR
-- Fetch the Batch_ID and Start_Date for the given Student_ID and Course_ID
SELECT cb.Batch_ID, cb.Start_Date
INTO v_batch_id, v_start_date
FROM student_course sc
INNER JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
WHERE sc.Student_ID = p_student_id
  AND sc.Course_ID = p_course_id 
  AND sc.Delete_Status = 0 limit 1;

-- Calculate the number of days passed since the batch started
-- Added +2 to include one extra day (+1 for inclusive counting, +1 for unlocking next day)
SELECT DATEDIFF(CURDATE(), STR_TO_DATE(v_start_date, '%Y-%m-%d')) + 2
INTO v_days_passed;

-- Fetch distinct day details with grouping, exam day status, and isToday
SELECT 
    d.Days_Id,
    d.Day_Name,
    IF(d.Days_Id <= v_days_passed, 1, 0) AS is_day_unlocked,
    CASE 
        WHEN EXISTS (
            SELECT 1
            FROM course_content cc
            WHERE cc.Days_Id = d.Days_Id
              AND cc.Exam_ID IS NOT NULL
              AND cc.Is_Exam_Test = TRUE
              AND cc.Course_Id = p_course_id
              AND cc.Module_ID = p_module_id
        ) THEN TRUE
        ELSE FALSE
    END AS is_exam_day,
    -- Determine if current day matches the number of days since batch started
    -- Subtract 1 from v_days_passed to get the current day
    IF(d.Days_Id = (v_days_passed - 1), 1, 0) AS isToday
FROM days d
INNER JOIN course_content cc ON cc.Days_Id = d.Days_Id
WHERE cc.Course_Id = p_course_id
  AND cc.Module_ID = p_module_id
GROUP BY d.Days_Id, d.Day_Name
ORDER BY d.Days_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Batch_Details`(IN batchID_ INT)
BEGIN
    -- First result set: Scheduled batch teachers
    SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
            'CourseTeacher_ID', ct.CourseTeacher_ID,
            'Teacher_ID', u.User_ID,
            'teacherName', CONCAT(u.First_Name, ' ', u.Last_Name),
            'Delete_Status', ct.Delete_Status,
            'timeSlots', (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'Slot_Id', tts.Slot_Id,
                        'Delete_Status', tts.Delete_Status,
                        'startTime', tts.start_time,
                        'endTime', tts.end_time
                    )
                )
                FROM teacher_time_slot tts
                WHERE tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                AND tts.Delete_Status = 0 
                AND ct.Delete_Status = 0
            )
        )
    ) AS scheduledTeachers
    FROM course_teacher ct
    LEFT JOIN users u ON ct.Teacher_ID = u.User_ID AND u.Delete_Status = 0
    WHERE ct.CourseTeacher_ID IN (
        SELECT DISTINCT tts.CourseTeacher_ID
        FROM teacher_time_slot tts
        WHERE tts.batch_id = batchID_ AND tts.Delete_Status = 0
    )
    AND ct.Delete_Status = 0;

    -- Second result set: One-on-one teachers for students, grouped by teacher
SELECT 
    u.User_ID as Teacher_ID,
    CONCAT(u.First_Name, ' ', u.Last_Name) as TeacherName,
    GROUP_CONCAT(DISTINCT CONCAT(s.First_Name, ' ', s.Last_Name)) as Students,
    GROUP_CONCAT(DISTINCT s.Student_ID) as Student_IDs,
    GROUP_CONCAT(DISTINCT tts.Slot_Id) as Slot_Ids,
    GROUP_CONCAT(DISTINCT tts.start_time) as StartTimes,
    GROUP_CONCAT(DISTINCT tts.end_time) as EndTimes
FROM student_course sc
INNER JOIN student s ON s.Student_ID = sc.Student_ID
INNER JOIN teacher_time_slot tts ON tts.Slot_Id = sc.Slot_Id  -- Changed to INNER JOIN
INNER JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID  -- Changed to INNER JOIN
    AND ct.Course_ID = sc.Course_ID
INNER JOIN users u ON ct.Teacher_ID = u.User_ID  -- Changed to INNER JOIN
WHERE sc.Batch_ID = batchID_
    AND s.Delete_Status = 0 
    AND sc.Delete_Status = 0
    AND ct.Delete_Status = 0
    AND tts.Delete_Status = 0
    AND u.Delete_Status = 0
    AND tts.batch_id IS NULL
GROUP BY u.User_ID, CONCAT(u.First_Name, ' ', u.Last_Name);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Batch_Mail_Report`(
                    IN p_course_id INT,
                    IN p_batch_id INT,
                    IN p_from_date DATE,
                    IN p_to_date DATE
                )
BEGIN
                    SELECT 
                        am.Course_ID,
                        am.Batch_ID,
                        COALESCE(MAX(am.Course_Name), MAX(c.Course_Name), '') as Course_Name,
                        COALESCE(MAX(am.Batch_Name), MAX(cb.Batch_Name), '') as Batch_Name,
                        MAX(am.Attendance_Date) as Attendance_Date,
                        MAX(el.Sent_At) as Sent_At,
                        IFNULL(MAX(et.Template_Name), el.Subject) as Template_Name,
                        el.Subject,
                        COUNT(DISTINCT el.Log_ID) as Total_Sent,
                        COUNT(DISTINCT CASE WHEN LOWER(el.Status) IN ('success', 'delivered') THEN el.Log_ID END) as Success_Count,
                        COUNT(DISTINCT CASE WHEN LOWER(el.Status) = 'failed' THEN el.Log_ID END) as Failed_Count,
                        COUNT(DISTINCT CASE WHEN el.Opened_At IS NOT NULL THEN el.Log_ID END) as Opened_Count
                    FROM email_logs el
                    LEFT JOIN email_templates et ON el.Template_ID = et.Template_ID
                    JOIN attendance_details ad ON el.Student_ID = ad.Student_ID
                    JOIN attendance_master am ON ad.Attendance_ID = am.Attendance_ID
                        AND (
                            DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(IFNULL(am.Created_Date, am.Attendance_Date), '+00:00', '+05:30'))
                            OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30'))
                            OR ABS(TIMESTAMPDIFF(HOUR, IFNULL(am.Created_Date, am.Attendance_Date), el.Sent_At)) <= 12
                        )
                    LEFT JOIN course c ON am.Course_ID = c.Course_ID
                    LEFT JOIN course_batch cb ON am.Batch_ID = cb.Batch_ID
                    WHERE 
                        (p_course_id = 0 OR am.Course_ID = p_course_id)
                        AND (p_batch_id = 0 OR am.Batch_ID = p_batch_id)
                        AND (
                            (p_from_date IS NULL AND p_to_date IS NULL)
                            OR (
                                (p_from_date IS NULL OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) >= p_from_date) 
                                AND (p_to_date IS NULL OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) <= p_to_date)
                            )
                            OR (
                                (p_from_date IS NULL OR DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30')) >= p_from_date) 
                                AND (p_to_date IS NULL OR DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30')) <= p_to_date)
                            )
                        )
                    GROUP BY am.Course_ID, am.Batch_ID, DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')), el.Subject
                    ORDER BY MAX(el.Sent_At) DESC;
                END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Batch_StudentList`(IN Batch_Id_ int )
BEGIN
select s.Student_ID,s.Country_Code,sc.Batch_ID,s.Device_ID,s.Phone_Number,s.Email , concat(s.First_Name , ' ', s.Last_Name) as Name , ai.devicePushTokenVoip from student_course sc

inner join student s on s.Student_ID=sc.Student_ID
inner join  appinfo ai  on ai.user_id = s.Student_ID and isStudent = 1

 where Batch_ID=Batch_Id_ and s.Delete_Status =false and sc.Delete_Status =false
;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Blocked_User`(IN user_id INT)
BEGIN
    SELECT 
        b.block_id, 
        b.blocked_user_id, 
        IFNULL(s.First_Name, u.First_Name) AS First_Name,
        IFNULL(s.Last_Name, u.Last_Name) AS Last_Name,
        IFNULL(s.Email, u.Email) AS Email,
		IFNULL(s.Profile_Photo_Path,U.Profile_Photo_Path) AS Profile_Photo_Path

    FROM blocked_users b
    LEFT JOIN student s ON b.blocked_user_id = s.Student_ID AND b.Is_Student_Blocked = 1
    LEFT JOIN users u ON b.blocked_user_id = u.User_ID AND b.Is_Student_Blocked = 0
    WHERE b.blocker_id = user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Calls_And_Chats_List`(
    IN p_type VARCHAR(20),
    IN p_sender VARCHAR(20),
    IN p_teacher_id INT,
    IN p_student_id INT
)
BEGIN
    IF p_type = 'call' THEN
			IF p_sender = 'teacher' THEN
				SELECT
					call_history.*,
					s.Profile_Photo_Path,
					s.First_Name,
					s.Delete_Status
				FROM call_history
				INNER JOIN student s ON s.Student_ID = call_history.student_id
				WHERE teacher_id = p_teacher_id AND Is_Finished = 1
				ORDER BY id DESC
				LIMIT 20;
			ELSEIF p_sender = 'student' THEN
				SELECT
					call_history.*,
					u.User_ID,
					u.First_Name,
					u.Profile_Photo_Path,
					u.Delete_Status
				FROM call_history
				INNER JOIN users u ON u.User_ID = call_history.teacher_id
				WHERE student_id = p_student_id AND Is_Finished = 1
				ORDER BY id DESC
				LIMIT 20;
			END IF;


		ELSEIF p_type = 'chat' THEN
  IF p_sender = 'teacher' THEN
        SELECT 
            stc.student_id,
            s.First_Name,
            s.Last_Name,
            s.Profile_Photo_Path,
            MAX(stc.message) AS message,  
            s.Delete_Status,
            MAX(stc.File_Path) AS File_Path,  
            MAX(stc.timestamp) AS timestamp,  
            (SELECT COUNT(*) 
             FROM student_teacher_chat 
             WHERE teacher_id = p_teacher_id 
               AND student_id = stc.student_id 
               AND Is_Student_Sent = 1 
               AND is_read = 0) AS unread_count,
            MAX(CASE 
                WHEN bu1.blocked_user_id IS NOT NULL THEN 1 ELSE 0 
            END) AS is_blocked,  -- The teacher has blocked the student
            MAX(CASE 
                WHEN bu2.blocked_user_id IS NOT NULL THEN 1 ELSE 0 
            END) AS have_been_blocked  -- The teacher has been blocked by the student
        FROM student_teacher_chat stc
        INNER JOIN student s ON s.Student_ID = stc.student_id
        LEFT JOIN blocked_users bu1 ON (bu1.blocker_id = p_teacher_id AND bu1.blocked_user_id = stc.student_id)
        LEFT JOIN blocked_users bu2 ON (bu2.blocker_id = stc.student_id AND bu2.blocked_user_id = p_teacher_id)
        INNER JOIN (
            SELECT student_id, MAX(timestamp) AS max_timestamp
            FROM student_teacher_chat
            WHERE teacher_id = p_teacher_id
            GROUP BY student_id 
        ) latest ON stc.student_id = latest.student_id 
                  AND stc.timestamp = latest.max_timestamp
        WHERE stc.teacher_id = p_teacher_id
        GROUP BY 
            stc.student_id, 
            s.First_Name, 
            s.Last_Name, 
            s.Profile_Photo_Path, 
            s.Delete_Status  
        ORDER BY MAX(stc.timestamp) DESC;  

    ELSEIF p_sender = 'student' THEN
        SELECT
            stc.teacher_id,
            u.First_Name,
            u.Last_Name,
            u.Delete_Status,
            u.Profile_Photo_Path,
            MAX(stc.message) AS message,  
            MAX(stc.File_Path) AS File_Path,  
            MAX(stc.timestamp) AS timestamp,  
            (SELECT COUNT(*) 
             FROM student_teacher_chat 
             WHERE student_id = p_student_id 
               AND teacher_id = stc.teacher_id 
               AND Is_Student_Sent = 0 
               AND is_read = 0) AS unread_count,
            MAX(CASE 
                WHEN bu1.blocked_user_id IS NOT NULL THEN 1 ELSE 0 
            END) AS is_blocked,  -- The student has blocked the teacher
            MAX(CASE 
                WHEN bu2.blocked_user_id IS NOT NULL THEN 1 ELSE 0 
            END) AS have_been_blocked  -- The student has been blocked by the teacher
        FROM student_teacher_chat stc
        INNER JOIN users u ON u.User_ID = stc.teacher_id
        LEFT JOIN blocked_users bu1 ON (bu1.blocker_id = p_student_id AND bu1.blocked_user_id = stc.teacher_id)
        LEFT JOIN blocked_users bu2 ON (bu2.blocker_id = stc.teacher_id AND bu2.blocked_user_id = p_student_id)
        INNER JOIN (
            SELECT teacher_id, MAX(timestamp) AS max_timestamp
            FROM student_teacher_chat
            WHERE student_id = p_student_id
            GROUP BY teacher_id
        ) latest ON stc.teacher_id = latest.teacher_id AND stc.timestamp = latest.max_timestamp
        WHERE stc.student_id = p_student_id
        GROUP BY 
            stc.teacher_id, 
            u.First_Name, 
            u.Last_Name, 
            u.Delete_Status, 
            u.Profile_Photo_Path  
        ORDER BY MAX(stc.timestamp) DESC;  

    END IF;
END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_call_history`(
    IN p_student_id INT,
    IN p_teacher_id INT
)
BEGIN

    
    SELECT
    DATE_FORMAT(DATE(calls.call_start), '%Y-%m-%d') AS message_date,
    calls.teacher_id,
    calls.student_id,
    calls.call_start AS message_timestamp,
    calls.id AS call_id,
    calls.call_start,
    calls.call_end,
    calls.call_duration,
    calls.call_type,
    calls.Is_Student_Called AS is_student,
	CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
	CONCAT(s.First_Name, ' ', s.Last_Name) AS Student_Name,
    u.Profile_Photo_Path as Teacher_Profile,
    s.Profile_Photo_Path as Student_Profile
	FROM
    call_history AS calls
    JOIN users u ON u.User_ID = calls.teacher_id
	JOIN student s ON s.Student_ID =  calls.student_id

	WHERE
    calls.teacher_id = p_teacher_id AND calls.student_id = p_student_id limit 20;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_ChatList_Hod`(IN p_user_id INT)
BEGIN
   SELECT 
        shc.student_id,
        s.First_Name,
        s.Last_Name,
		s.Delete_Status,
        s.Profile_Photo_Path,
        shc.message,
        shc.File_Path,
        shc.course_id,
        shc.timestamp,
        (SELECT COUNT(*) 
         FROM student_hod_chat 
         WHERE user_id = p_user_id 
           AND student_id = shc.student_id 
           AND Is_Student_Sent = 1 
           AND is_read = 0) AS unread_count
    FROM student_hod_chat shc
    INNER JOIN student s ON s.Student_ID = shc.student_id
    INNER JOIN (
        SELECT student_id, MAX(timestamp) AS max_timestamp
        FROM student_hod_chat
        WHERE user_id = p_user_id
        GROUP BY student_id
    ) latest ON shc.student_id = latest.student_id 
              AND shc.timestamp = latest.max_timestamp
    WHERE shc.user_id = p_user_id
    GROUP BY 
        shc.student_id, 
        s.First_Name, 
        s.Last_Name, 
        s.Profile_Photo_Path,
        shc.message,
        shc.File_Path,
        shc.course_id,
        shc.timestamp
    ORDER BY shc.timestamp DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Chats_Media`(
    IN p_Student_id INT,
    IN p_Teacher_id INT
)
BEGIN

 SELECT
    stc.Is_Student_Sent,
    p_Teacher_id as Teacher_Id,
    CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
    p_Student_id as Student_Id,
	CONCAT(s.First_Name, ' ', s.Last_Name) AS Student_Name,
    stc.message,
    stc.File_Path,
    stc.timestamp
FROM student_teacher_chat stc
JOIN users u ON u.User_ID = stc.teacher_id
JOIN student s ON s.Student_ID = stc.student_id
WHERE stc.teacher_id = p_Teacher_id
  AND stc.student_id = p_Student_id
  AND (stc.File_Path IS NOT NULL AND stc.File_Path <> '');

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_chat_call_history`(
    IN p_teacher_id INT,
    IN p_student_id INT
)
BEGIN
    DECLARE result_json JSON DEFAULT JSON_OBJECT();

    -- Combine chat and call logs and label dates
    SET result_json = (
        SELECT JSON_OBJECTAGG(
                message_date, messages_calls
            )
        FROM (
            SELECT
                DATE_FORMAT(DATE(chat.timestamp), '%Y-%m-%d') AS message_date,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'message_id', chat.chat_id,
                        'teacher_id', chat.teacher_id,
                        'student_id', chat.student_id,
                        'message', chat.message,
                        'message_timestamp', chat.timestamp,
                        'call_id', NULL,
                        'call_start', NULL,
                        'call_end', NULL,
                        'call_duration', NULL,
                        'call_type', NULL,
                        'File_Path',   chat.File_Path,
                        'is_student', chat.Is_Student_Sent
                    )
                ) AS messages_calls
            FROM
                student_teacher_chat AS chat
            WHERE
                (chat.teacher_id = p_teacher_id AND chat.student_id = p_student_id)
            GROUP BY
                message_date
            UNION ALL
            SELECT
                DATE_FORMAT(DATE(calls.call_start), '%Y-%m-%d') AS message_date,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'message_id', NULL,
                        'teacher_id', calls.teacher_id,
                        'student_id', calls.student_id,
                        'message', NULL,
                        'message_timestamp', calls.call_start,
                        'call_id', calls.id,
                        'call_start', calls.call_start,
                        'call_end', calls.call_end,
                        'call_duration', calls.call_duration,
                        'call_type', calls.call_type,
						'File_Path', NULL,
                        'is_student', calls.Is_Student_Called
                    )
                ) AS messages_calls
            FROM
                call_history AS calls
            WHERE
                (calls.teacher_id = p_teacher_id AND calls.student_id = p_student_id)
            GROUP BY
                message_date
        ) AS combined
        ORDER BY
            message_date DESC  -- Sort by date in descending order
    );

    SELECT result_json;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Chat_With_Bot`( In student_ID_ Int)
Begin 
 SELECT * From chatbot_history where Student_ID =student_ID_ and Delete_Status=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Completed_Calls`(in p_teacher_id int)
BEGIN
 SELECT
                id,
                teacher_id,
               call_history.student_id,
                call_start,
                s.First_Name,
                call_end,
                call_duration,
                call_type,Live_Link
            FROM call_history
            inner join student s on s.Student_ID =call_history.student_id
            WHERE teacher_id = p_teacher_id and Is_Finished=1;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Completed_liveClass`(IN p_teacher_id INT)
BEGIN
    SELECT 
        lc.LiveClass_ID,
        lc.Batch_Id,
        lc.Course_ID,
        c.Course_Name,
        lc.Duration, 
        lc.Start_Time,
        lc.End_Time,
        lc.Scheduled_DateTime,
        lc.Live_Link,
        cb.Batch_Name,
        u.First_Name AS First_Name
    FROM 
        live_class lc
    INNER JOIN 
        users u ON lc.Teacher_ID = u.User_ID
    INNER JOIN 
        course c ON lc.Course_ID = c.Course_ID
	INNER JOIN 
        course_batch cb ON lc.Batch_Id = cb.Batch_ID
    WHERE 
        lc.Teacher_ID = p_teacher_id
        AND lc.Is_Finished = 1
        AND lc.Delete_Status = 0 
    ORDER BY 
        lc.Scheduled_DateTime Desc;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_course`(IN courseID INT)
BEGIN
    SELECT
		c.*,
        CASE WHEN c.Disable_Status = 1 THEN 'true' ELSE 'false' END AS Disable_Status,
        CASE WHEN c.Live_Class_Enabled = 1 THEN 'true' ELSE 'false' END AS Live_Class_Enabled,
  (
        SELECT JSON_ARRAYAGG(
            CASE 
                WHEN timeSlots IS NOT NULL THEN
                    JSON_OBJECT(
                        'CourseTeacher_ID', ct.CourseTeacher_ID,
                        'Teacher_ID', ct.Teacher_ID,
                        'Delete_Status', ct.Delete_Status,
                        'timeSlots', timeSlots
                    )
                ELSE NULL
            END
        )
        FROM (
            SELECT 
                ct.CourseTeacher_ID,
                ct.Teacher_ID,
                ct.Delete_Status,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'Slot_Id', tts.Slot_Id,
                            'Delete_Status', tts.Delete_Status,
                            'startTime', tts.start_time,
                            'endTime', tts.end_time
                        )
                    )
                    FROM teacher_time_slot tts
                    WHERE tts.CourseTeacher_ID = ct.CourseTeacher_ID  
                      AND tts.Delete_Status = 0 
                      AND tts.batch_id IS NULL
                ) AS timeSlots
            FROM course_teacher ct
            join users u on  ct.Teacher_ID = u.User_ID
            WHERE ct.Course_ID = courseID AND ct.Delete_Status = 0 and u.Delete_Status=false
        ) ct
        WHERE timeSlots IS NOT NULL
    ) AS scheduledTeachers,
        (
            SELECT JSON_ARRAYAGG(Section_Id)
            FROM course_section cs
            WHERE cs.Course_ID = c.Course_ID
        ) AS Sections,
         (
            SELECT JSON_ARRAYAGG(Batch_ID)
            FROM course_batch cb
            WHERE cb.Course_ID = c.Course_ID
        ) AS scheduledBatch,
       ( SELECT JSON_ARRAYAGG(JSON_OBJECT('Section_Id', cs.Section_Id, 'Section_Name', s.section_name)) AS Sections
		FROM course_section cs
		INNER JOIN section s ON cs.Section_Id = s.Section_Id
		WHERE cs.Course_ID = c.Course_ID)AS Section_Name
    FROM
        course c
    WHERE
        c.Course_ID = courseID;
SELECT
    sec.Section_ID AS sectionId,
    sec.section_name AS   section_name,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'sectionId', sec.Section_ID,
			'Module_ID', cc.Module_ID,
            'Days_Id',cc.Days_Id,
			'Visibilities', cc.Visibilities,
            'contentName', cc.Content_Name,
            'externalLink',cc.External_Link,
            'Content_ID',cc.Content_ID,
			'Is_Exam_Test',cc.Is_Exam_Test,
			'contentThumbnail_name', IF(cc.contentThumbnail_name != 'null', cc.contentThumbnail_name, NULL),
            'contentThumbnail_Path',  IF(cc.contentThumbnail_Path != 'null', cc.contentThumbnail_Path, NULL),
            'file', IF(cc.File_Path != 'null', cc.File_Path, NULL),
            'file_name',  IF(cc.file_name != 'null', cc.file_name, NULL),
            'file_type',cc.file_type,
            'exams', (
                SELECT
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'examName', e.Main_Question,
                            'totalQuestions', e.Total_Questions,
                            'Main_Question', e.Main_Question,
                            'Exam_ID',e.Exam_ID,
							'file_name', e.file_name,
                            'file_type', e.file_type,
                            'Supporting_Document_Name', e.Supporting_Document_Name,
                            'Supporting_Document_Path', e.Supporting_Document_Path,
							'Answer_Key_Name', e.Answer_Key_Name,
                            'Answer_Key_Path', e.Answer_Key_Path,
                            'passingScore', e.Passing_Score,
                            'timeLimit', e.Time_Limit,
                            'questions', (
                                SELECT
                                    JSON_ARRAYAGG(
                                        JSON_OBJECT(
											'Question_ID', q.Question_ID,
											'Answer_Media_Name',q.Answer_Media_Name,
                                            'questionText', q.Question_Text,
                                            'answerOptions', q.Answer_Options,
                                            'correctAnswer', q.Correct_Answer
                                        )
                                    )
                                FROM
                                    question q
                                WHERE
                                    q.Exam_ID = e.Exam_ID
                                    AND q.Delete_Status = 0
                            )
                        )
                    )
                FROM
                    exam e
                WHERE
                    e.Course_ID =courseID
                    AND e.Section_ID = sec.Section_ID
                    AND e.Delete_Status = 0 AND e.Exam_ID = cc.Exam_ID
            )
        )
    ) AS contents
FROM
    section sec
LEFT JOIN
    course_content cc ON sec.Section_ID = cc.Section_ID AND cc.Course_Id = courseID
WHERE
    sec.Section_ID IN (
        SELECT DISTINCT Section_ID
        FROM course_content
        WHERE Delete_Status = 0 AND Course_Id = courseID
    )
GROUP BY
    sec.Section_ID;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_CourseContent_By_SectionAndStudent`(
    IN p_Section_Name VARCHAR(100),
    IN p_Student_ID INT
)
BEGIN
    DECLARE v_Section_ID INT;
    DECLARE v_Course_ID VARCHAR(45);
    DECLARE v_Last_Accessed_Content_ID INT;
    DECLARE v_Content_ID INT DEFAULT NULL;
    DECLARE v_Content_Name VARCHAR(255);
    DECLARE v_Supporting_Document_Path VARCHAR(255);
    DECLARE v_Answer_Key_Path LONGTEXT;
    DECLARE v_Main_Question LONGTEXT;

    -- Get Section_ID from section table based on Section_Name
    SELECT Section_ID 
    INTO v_Section_ID 
    FROM section 
    WHERE Section_Name = p_Section_Name 
      AND Delete_Status = 0
    LIMIT 1;

    -- Get Course_ID from student_course table based on Student_ID 
    SELECT Course_ID 
    INTO v_Course_ID 
    FROM student_course 
    WHERE Student_ID = p_Student_ID
    LIMIT 1;

    -- Get the Last Accessed Content ID from chatbot_history
    SELECT Last_Accesed_Content_Id 
    INTO v_Last_Accessed_Content_ID 
    FROM chatbot_history 
    WHERE Student_ID = p_Student_ID
      AND Last_Accesed_Section_Id = v_Section_ID
      AND Delete_Status = 0
    ORDER BY ChatHistory_ID DESC
    LIMIT 1;

    -- Fetch the next content if Last Accessed Content ID exists
    IF v_Last_Accessed_Content_ID IS NOT NULL THEN
        -- Attempt to fetch the next content after Last Accessed Content ID
        SELECT c.Content_ID, c.Content_Name, e.Supporting_Document_Path, e.Answer_Key_Path, e.Main_Question
        INTO v_Content_ID, v_Content_Name, v_Supporting_Document_Path, v_Answer_Key_Path, v_Main_Question
        FROM course_content c
        INNER JOIN exam e ON e.Exam_ID = c.Exam_ID
        WHERE c.Section_ID = v_Section_ID
          AND c.Course_ID = v_Course_ID
          AND JSON_CONTAINS(c.Visibilities, '2')
          AND c.Delete_Status = 0
          AND c.Content_ID > v_Last_Accessed_Content_ID
        ORDER BY c.Content_ID
        LIMIT 1;

        -- If no next content found, fetch the first content in the section
        IF v_Content_ID IS NULL THEN
            SELECT c.Content_ID, c.Content_Name, e.Supporting_Document_Path, e.Answer_Key_Path, e.Main_Question
            INTO v_Content_ID, v_Content_Name, v_Supporting_Document_Path, v_Answer_Key_Path, v_Main_Question
            FROM course_content c
            INNER JOIN exam e ON e.Exam_ID = c.Exam_ID
            WHERE c.Section_ID = v_Section_ID
              AND c.Course_ID = v_Course_ID
              AND JSON_CONTAINS(c.Visibilities, '2')
              AND c.Delete_Status = 0
            ORDER BY c.Content_ID
            LIMIT 1;
        END IF;

    ELSE
        -- Fetch the first content if no Last Accessed Content ID
        SELECT c.Content_ID, c.Content_Name, e.Supporting_Document_Path, e.Answer_Key_Path, e.Main_Question
        INTO v_Content_ID, v_Content_Name, v_Supporting_Document_Path, v_Answer_Key_Path, v_Main_Question
        FROM course_content c
        INNER JOIN exam e ON e.Exam_ID = c.Exam_ID
        WHERE c.Section_ID = v_Section_ID
          AND c.Course_ID = v_Course_ID
          AND JSON_CONTAINS(c.Visibilities, '2')
          AND c.Delete_Status = 0
        ORDER BY c.Content_ID
        LIMIT 1;
    END IF;

    -- Return the selected content
    SELECT v_Content_ID AS Content_ID, 
           v_Course_ID AS Course_ID, 
           v_Content_Name AS Content_Name, 
           v_Supporting_Document_Path AS Supporting_Document_Path, 
           v_Answer_Key_Path AS Answer_Key_Path, 
           v_Main_Question AS Main_Question,
           v_Section_ID AS Section_ID
           ;

    -- Update chatbot_history with the latest accessed Content_ID
    IF v_Content_ID IS NOT NULL THEN
        UPDATE chatbot_history 
        SET Last_Accesed_Content_Id = v_Content_ID,
            Last_Accesed_Section_Id = v_Section_ID,
            Last_Accesed_Course_Id = v_Course_ID,
            Chat_DateTime = NOW()
        WHERE Student_ID = p_Student_ID 
          AND Last_Accesed_Section_Id = v_Section_ID
          AND Delete_Status = 0
        ORDER BY ChatHistory_ID DESC
        LIMIT 1;

        -- Insert new record if no rows were updated
        IF ROW_COUNT() = 0 THEN
            INSERT INTO chatbot_history (Student_ID, Last_Accesed_Content_Id, Last_Accesed_Section_Id, Last_Accesed_Course_Id, Chat_DateTime, IsReply, Delete_Status)
            VALUES (p_Student_ID, v_Content_ID, v_Section_ID, v_Course_ID, NOW(), 0, 0);
        END IF;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Courses_By_Category`( In category_ID_ varchar(100))
Begin 
 
 SELECT Course_ID,
Course_Name,
Category_ID,
Validity,
Price,
Delete_Status,
Disable_Status,
Live_Class_Enabled From course where Category_ID = category_ID_ and Delete_Status=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Courses_By_StudentId`(
    IN student_Id_ INT,
    IN Course_Name_ VARCHAR(100),
    IN priceFrom DECIMAL(10,2),
    IN priceTo DECIMAL(10,2)
)
BEGIN
    SET Course_Name_ = CONCAT('%', Course_Name_, '%');

    -- Select the required data with optional price filtering
    SELECT 
        c.Course_Name,
        c.Thumbnail_Path,
        cb.Start_Date as Batch_start_Date,
        cb.End_Date as Batch_End_Date,
         sc.*,
        CONCAT(s.First_Name, ' ', s.Last_Name) AS name,
        CASE 
            WHEN cb.Delete_Status = TRUE THEN NULL 
            ELSE cb.Batch_Name 
        END AS Batch_Name,
        sc.IsStudentModuleLocked,
        TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
        TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,
        CASE 
            WHEN sc.Expiry_Date IS NOT NULL AND sc.Expiry_Date < CURDATE() THEN 1
            ELSE 0
        END AS Is_Expired,
        -- Calculate course completion percentage
        cc.total_content_count,
        cc.content_position,
        IFNULL(ROUND((cc.content_position / cc.total_content_count) * 100, 2), 0) AS course_completion_percentage,
        
        CASE 
            WHEN tts.Delete_Status = TRUE THEN NULL 
            ELSE TIME_FORMAT(tts.start_time, '%h:%i %p') 
        END AS start_time,
        CASE 
            WHEN tts.Delete_Status = TRUE THEN NULL 
            ELSE TIME_FORMAT(tts.end_time, '%h:%i %p') 
        END AS end_time,

        -- Get teacher name for one-on-one sessions matching Course_ID
        (SELECT CONCAT(u.First_Name, ' ', u.Last_Name)
        FROM teacher_time_slot tts 
        JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
        JOIN users u ON ct.Teacher_ID = u.User_ID 
        WHERE tts.Slot_Id = sc.Slot_Id  
        AND ct.Course_ID = sc.Course_ID 
        AND ct.Delete_Status = false 
        AND tts.Delete_Status = false 
        AND u.Delete_Status = false
        LIMIT 1) AS Teacher_Name_One_On_One,

        -- Get teacher name for batch sessions matching Course_ID
        (SELECT CONCAT(u.First_Name, ' ', u.Last_Name)
        FROM teacher_time_slot tts 
        JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
        JOIN users u ON ct.Teacher_ID = u.User_ID 
        JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
        WHERE tts.batch_id = sc.Batch_ID 
        AND ct.Course_ID = sc.Course_ID 
        AND ct.Delete_Status = false 
        AND tts.Delete_Status = false 
        AND cb.Delete_Status = false 
        AND u.Delete_Status = false
        LIMIT 1) AS Teacher_Name_Batch,
         
        (
        SELECT 
            JSON_ARRAYAGG(
                CONCAT(TIME_FORMAT(tts.start_time, '%h:%i %p'), ' - ', TIME_FORMAT(tts.end_time, '%h:%i %p'))
            )
        FROM 
            teacher_time_slot tts
        JOIN 
            course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
        JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
        WHERE 
            tts.Batch_ID = sc.Batch_ID
            AND ct.Course_ID = sc.Course_ID
            AND ct.Delete_Status = FALSE
            AND cb.Delete_Status = false
            AND tts.Delete_Status = FALSE
        ) AS Batch_Timings

    FROM 
        student_course sc
    JOIN 
        course c ON sc.Course_ID = c.Course_ID
    LEFT JOIN 
        course_batch cb ON cb.Batch_ID = sc.Batch_ID    
    LEFT JOIN 
        teacher_time_slot tts ON tts.Slot_Id = sc.Slot_Id
    INNER JOIN 
        student s ON s.Student_ID = sc.Student_ID
    LEFT JOIN
        (
            -- Subquery to get total content count and position of last accessed content
            SELECT 
                cc.Course_Id,
                COUNT(CASE WHEN cc.Delete_Status = 0 THEN 1 END) AS total_content_count,
                SUM(CASE WHEN cc.Delete_Status = 0 AND cc.Content_ID <= sc.LastAccessed_Content_ID THEN 1 ELSE 0 END) AS content_position
            FROM 
                course_content cc
            JOIN 
                student_course sc ON cc.Course_Id = sc.Course_ID AND sc.Student_ID = student_Id_ and sc.Delete_Status=0
            GROUP BY 
                cc.Course_Id
        ) cc ON cc.Course_Id = sc.Course_ID

    WHERE 
        sc.Student_ID = student_Id_
        AND sc.Delete_Status = 0
        AND c.Course_Name LIKE Course_Name_
        AND c.Delete_Status = 0
        AND (priceFrom = 0 OR priceTo = 0 OR c.Price BETWEEN priceFrom AND priceTo);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_course_Batches`(IN courseID INT)
BEGIN
 SELECT 
    cb.*,
    c.Course_Name,
    CASE 
        WHEN cb.End_Date < CURDATE() THEN TRUE
        ELSE FALSE
    END AS is_expired,
    -- Get student count for each batch
    (
        SELECT COUNT(*)
        FROM student_course sc
        WHERE sc.Batch_ID = cb.Batch_ID
        AND sc.Delete_Status = false
    ) as student_count,
    -- Get time slots as JSON array using subquery to exclude nulls
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'Slot_Id', Slot_Id,
                'start_time', start_time,
                'end_time', end_time,
                'teacher_name', teacher_name,
                'teacher_id', teacher_id
            )
        )
        FROM (
            SELECT 
                tts.Slot_Id,
                TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
                TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,
                CONCAT(u.First_Name, ' ', u.Last_Name) as teacher_name,
                u.User_ID as teacher_id
            FROM teacher_time_slot tts
            JOIN course_teacher ct ON ct.CourseTeacher_ID = tts.CourseTeacher_ID 
                AND ct.Delete_Status = false
            JOIN users u ON u.User_ID = ct.Teacher_ID 
                AND u.Delete_Status = false
            WHERE tts.batch_id = cb.Batch_ID 
                AND tts.Delete_Status = false
        ) valid_slots
    ) as time_slots,
    -- Get only non-deleted teacher names
    GROUP_CONCAT(
        DISTINCT 
        IF(ct.Delete_Status = false AND u.Delete_Status = false,
            CONCAT(u.First_Name, ' ', u.Last_Name),
            NULL
        )
    ) as teachers
FROM 
    course_batch cb
    INNER JOIN course c ON c.Course_ID = cb.Course_ID
    LEFT JOIN teacher_time_slot tts ON tts.batch_id = cb.Batch_ID AND tts.Delete_Status = false
    LEFT JOIN course_teacher ct ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
    LEFT JOIN users u ON u.User_ID = ct.Teacher_ID
WHERE 
    cb.course_id = courseID 
    AND cb.Delete_Status = false
    AND c.Delete_Status = false
GROUP BY 
    cb.Batch_ID, cb.Course_ID, c.Course_Name
ORDER BY 
    is_expired ASC,
    CASE 
        WHEN cb.End_Date < CURDATE() THEN cb.End_Date
        ELSE cb.Start_Date
    END DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Course_By_CourseId`(In Course_ID_ Int)
BEGIN
SELECT * From course where Course_ID =Course_ID_ and Delete_Status=false ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_course_category`( In course_category_Id_ Int)
Begin 
 SELECT Category_ID,
Category_Name,
Delete_Status From course_category where course_category_Id =course_category_Id_ and DeleteStatus=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_course_content`(IN courseID INT, IN Content_ID INT)
BEGIN
    -- Fetch content details for the given Content_ID
    SELECT 
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'Content_ID', cc.Content_ID,
                'contentName', cc.Content_Name,
                'Section_ID',cc.Section_ID,
				'Module_ID',cc.Module_ID,
                'Days_Id',cc.Days_Id,
				'externalLink',cc.External_Link,
				'visibilities',cc.visibilities,
                'file', IF(cc.File_Path IS NOT NULL AND cc.File_Path != 'null', cc.File_Path, NULL),
                'file_name', IF(cc.file_name IS NOT NULL AND cc.file_name != 'null', cc.file_name, NULL),
                'file_type', cc.file_type,
                'Is_Exam_Test', cc.Is_Exam_Test,
                'contentThumbnail_name', IF(cc.contentThumbnail_name IS NOT NULL AND cc.contentThumbnail_name != 'null', cc.contentThumbnail_name, NULL),
                'contentThumbnail_Path', IF(cc.contentThumbnail_Path IS NOT NULL AND cc.contentThumbnail_Path != 'null', cc.contentThumbnail_Path, NULL),
                'exam', (
                    SELECT JSON_OBJECT(
                        'Main_Question', e.Main_Question,
                        'file_name', e.file_name,
                        'file_type', e.file_type,
                        'Supporting_Document_Path', e.Supporting_Document_Path,
                        'Supporting_Document_Name', e.Supporting_Document_Name,
                        'Answer_Key_Path', e.Answer_Key_Path,
                        'Answer_Key_Name', e.Answer_Key_Name
                    )
                    FROM exam e
                    WHERE e.Exam_ID = cc.Exam_ID
                      AND e.Course_ID = courseID
                      AND e.Section_ID = cc.Section_ID
                      AND e.Delete_Status = 0
                )
            )
        ) AS contentDetails
    FROM course_content cc
    WHERE cc.Content_ID = Content_ID
      AND cc.Course_Id = courseID
      AND cc.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_course_content_By_Day`(
    IN courseID INT, 
    IN Module_ID_ INT, 
    IN section_id_ INT,
    IN Day_Id_ INT,
    IN Student_Id_ INT, 
    IN visibilityType INT,
	IN Batch_ID_ INT,
    IN Is_Exam_Test_ tinyint
)
BEGIN
    DECLARE p_batch_Id INT DEFAULT NULL;
    DECLARE p_Student_Enrolled_Date DATE;
    DECLARE p_Batch_start_Date DATE;
    DECLARE p_latest_date DATE;
    DECLARE days_difference INT DEFAULT NULL;

    -- Retrieve the Batch_ID and Enrollment_Date if Student_Id_ is provided
    IF Student_Id_ <> 0 THEN
        SELECT Batch_ID, STR_TO_DATE(Enrollment_Date, '%Y-%m-%d') 
        INTO p_batch_Id, p_Student_Enrolled_Date
        FROM student_course 
        WHERE Student_ID = Student_Id_ 
          AND Course_ID = courseID   AND Delete_Status=0 ;
      ELSE 
     Set  p_batch_Id = Batch_ID_;
      
    END IF;

    -- Check visibility type and batch ID only if visibilityType = 2
    IF visibilityType = 2 AND p_batch_Id IS NOT NULL AND Student_Id_ <> 0 THEN
        -- Fetch the Batch Start Date
        SELECT STR_TO_DATE(Start_Date, '%Y-%m-%d') 
        INTO p_Batch_start_Date 
        FROM course_batch 
        WHERE Batch_ID = p_batch_Id;

        -- Get the latest date between Enrollment and Start Date
        SET p_latest_date = GREATEST(p_Student_Enrolled_Date, p_Batch_start_Date);

        -- Calculate the difference in days
        SET days_difference = DATEDIFF(CURDATE(), p_latest_date);

        -- If less than 3 days have passed, return an empty result
        IF days_difference <= 0 THEN
            SELECT 'Library Access Will Be Available 2 Days After Enrollment' AS contents;
        
        END IF;
    END IF;

 SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
            'Content_ID', cc.Content_ID,
            'Days_Id', cc.Days_Id,
            'Module_ID', cc.Module_ID,
            'Module_Name', cm.Module_Name,
            'Section_ID', cc.Section_ID,
            'Section_Name', s.Section_Name,
            'contentName', cc.Content_Name,
            'Visibilities',cc.Visibilities,
            'Is_Exam_Test',cc.Is_Exam_Test,
            'External_Link',cc.External_Link,
            'file', IF(cc.File_Path IS NOT NULL AND cc.File_Path != 'null', cc.File_Path, NULL),
            'file_name', IF(cc.file_name IS NOT NULL AND cc.file_name != 'null', cc.file_name, NULL),
            'file_type', cc.file_type,
            'contentThumbnail_name', IF(cc.contentThumbnail_name IS NOT NULL AND cc.contentThumbnail_name != 'null', cc.contentThumbnail_name, NULL),
            'contentThumbnail_Path', IF(cc.contentThumbnail_Path IS NOT NULL AND cc.contentThumbnail_Path != 'null', cc.contentThumbnail_Path, NULL),
            'exams', (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'Exam_ID', e.Exam_ID,
                        'examName', e.Main_Question,
                        'totalQuestions', e.Total_Questions,
                        'Main_Question', e.Main_Question,
                        'file_name', e.file_name,
                        'file_type', e.file_type,
                        'Supporting_Document_Name', e.Supporting_Document_Name,
                        'Supporting_Document_Path', e.Supporting_Document_Path,
                        'Answer_Key_Name', e.Answer_Key_Name,
                        'Answer_Key_Path', e.Answer_Key_Path,
                        'passingScore', e.Passing_Score,
                        'timeLimit', e.Time_Limit,
                        'is_Exam_Unlocked', (
                            SELECT IF(
                                EXISTS (
                                    SELECT 1
                                    FROM unlocked_exam ue
                                    WHERE ue.Content_ID = cc.Content_ID
                                      AND ue.Exam_ID = e.Exam_ID
                                      AND (ue.Batch_ID = p_batch_Id)
                                ),
                                TRUE,
                                FALSE
                            )
                        ),
                        'Is_Question_Unlocked', COALESCE(ue.Is_Question_Unlocked, FALSE),
                        'Is_Question_Media_Unlocked', COALESCE(ue.Is_Question_Media_Unlocked, FALSE),
						'Is_Answer_Unlocked', COALESCE(ue.Is_Answer_Unlocked, FALSE),
                        'questions', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'Question_ID', q.Question_ID,
                                    'Answer_Media_Name', q.Answer_Media_Name,
                                    'questionText', q.Question_Text,
                                    'answerOptions', q.Answer_Options,
                                    'correctAnswer', q.Correct_Answer
                                )
                            )
                            FROM question q
                            WHERE q.Exam_ID = e.Exam_ID
                              AND q.Delete_Status = 0
                        )
                    )
                )
                FROM exam e
                LEFT JOIN unlocked_exam ue ON ue.Exam_ID = e.Exam_ID AND ue.Content_ID = cc.Content_ID AND (ue.Batch_ID = p_batch_Id)
                WHERE e.Course_ID = courseID
                  AND e.Delete_Status = 0
                  AND e.Exam_ID = cc.Exam_ID
            )
        )
    ) AS contents
    FROM course_content cc
    LEFT JOIN course_module cm ON cc.Module_ID = cm.Module_ID AND cm.Delete_Status = 0
    LEFT JOIN section s ON cc.Section_ID = s.Section_ID AND s.Delete_Status = 0
    WHERE cc.Course_Id = courseID
    AND (Module_ID_ = 0 OR cc.Module_ID = Module_ID_)
    AND (section_id_ = 0 OR cc.Section_ID = section_id_)
    AND (Day_Id_ = 0 OR cc.Days_Id = Day_Id_)
	AND (Is_Exam_Test_ = 0 OR cc.Is_Exam_Test = Is_Exam_Test_)
    AND cc.Delete_Status = 0
    AND (CASE 
            WHEN visibilityType = 1 THEN JSON_CONTAINS(cc.Visibilities, '1')
            ELSE JSON_CONTAINS(cc.Visibilities, '2')
          END
    );

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_course_content_By_Module`(IN courseID INT, IN Module_ID_ INT )
BEGIN

                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'Content_ID', cc.Content_ID,
                            'contentName', cc.Content_Name,
                            'file', IF(cc.File_Path IS NOT NULL AND cc.File_Path != 'null', cc.File_Path, NULL),
                            'file_name', IF(cc.file_name IS NOT NULL AND cc.file_name != 'null', cc.file_name, NULL),
                            'file_type', cc.file_type,
                            'contentThumbnail_name', IF(cc.contentThumbnail_name IS NOT NULL AND cc.contentThumbnail_name != 'null', cc.contentThumbnail_name, NULL),
                            'contentThumbnail_Path', IF(cc.contentThumbnail_Path IS NOT NULL AND cc.contentThumbnail_Path != 'null', cc.contentThumbnail_Path, NULL),
                            'exams', (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'Exam_ID', e.Exam_ID,
                                        'examName', e.Main_Question,
                                        'totalQuestions', e.Total_Questions,
                                        'Main_Question', e.Main_Question,
                                        'file_name', e.file_name,
                                        'file_type', e.file_type,
                                        'Supporting_Document_Name', e.Supporting_Document_Name,
                                        'Supporting_Document_Path', e.Supporting_Document_Path,
                                        'Answer_Key_Name', e.Answer_Key_Name,
                                        'Answer_Key_Path', e.Answer_Key_Path,
                                        'passingScore', e.Passing_Score,
                                        'timeLimit', e.Time_Limit,
                                        'questions', (
                                            SELECT JSON_ARRAYAGG(
                                                JSON_OBJECT(
                                                    'Question_ID', q.Question_ID,
                                                    'Answer_Media_Name', q.Answer_Media_Name,
                                                    'questionText', q.Question_Text,
                                                    'answerOptions', q.Answer_Options,
                                                    'correctAnswer', q.Correct_Answer
                                                )
                                            )
                                            FROM question q
                                            WHERE q.Exam_ID = e.Exam_ID
                                              AND q.Delete_Status = 0
                                        )
                                    )
                                )
                                FROM exam e
                                WHERE e.Course_ID = courseID
                                  AND e.Delete_Status = 0
                                  AND e.Exam_ID = cc.Exam_ID
                            )
                        )
                    ) as contents
                    FROM course_content cc
                    WHERE cc.Course_Id = courseID
                      AND cc.Module_ID = Module_ID_
                      AND cc.Delete_Status = 0    ;                         
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_course_fees`(
   IN p_course_id INT
)
BEGIN
    IF p_course_id IS NULL OR p_course_id = 0 THEN
        SELECT 
            Installment_information_ID,
            Details,
            Duration,
            Amount,
            Course_ID,
            Course_Name,
            Fee_Type,
            Batch_ID,
            Batch_Name
        FROM 
            installment_information
        WHERE 
            Delete_Status = 0;
    ELSE
        SELECT 
            Installment_information_ID,
            Details,
            Duration,
            Amount,
            Course_ID,
            Course_Name,
            Fee_Type,
            Batch_ID,
            Batch_Name
        FROM 
            installment_information
        WHERE 
            Course_ID = p_course_id AND Delete_Status = 0;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Course_Info`(In Course_ID_ Int)
BEGIN
SELECT * From course where Course_ID =Course_ID_ and Delete_Status=false ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Course_Module`()
BEGIN
SELECT * FROM course_module WHERE  Delete_Status = false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_course_names`()
BEGIN
select Course_ID, Course_Name from course where Delete_Status =false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Course_Reviews`(
    IN p_student_id INT,
    IN p_course_id INT
)
BEGIN
    -- Check if both student_id and course_id are provided
    IF p_student_id IS NOT NULL AND p_course_id IS NOT NULL THEN
        -- Get specific student course review
        SELECT * FROM course_reviews cr
        inner join student s on s.Student_ID =  cr.Student_ID
        WHERE cr.Student_ID = p_student_id AND cr.Course_ID = p_course_id ;
        
    -- If only student_id is provided, get all reviews of the student
    ELSEIF p_student_id IS NOT NULL THEN
        -- Get all reviews of the student
        SELECT * FROM course_reviews  cr
        inner join student s on s.Student_ID =  cr.Student_ID
        WHERE s.Student_ID = p_student_id;
        
    -- If only course_id is provided, get all reviews of the course
    ELSEIF p_course_id IS NOT NULL THEN
        -- Get all reviews of the course
        SELECT cr.*,s.First_Name,s.Profile_Photo_Path FROM course_reviews cr
        inner join student s on cr.Student_ID = s.Student_ID
        WHERE Course_ID = p_course_id;
        
    -- If neither student_id nor course_id is provided, return empty result set
    ELSE
      
                SELECT cr.*,
                concat(s.First_Name,' ',s.Last_Name) as Name, s.Profile_Photo_Path
                FROM course_reviews cr
        inner join student s on cr.Student_ID = s.Student_ID 
       order by Review_Id desc;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Course_Students`(IN course_Id_ INT)
BEGIN 

        SELECT 
    sc.StudentCourse_ID,
    sc.Student_ID,
    sc.Course_ID,
    s.First_Name,
    s.Last_Name,
    s.Profile_Photo_Path, 
     COALESCE(
        -- For one-on-one sessions, get teacher from course_teacher matching Course_ID
        (
         SELECT  u.User_ID 
    FROM teacher_time_slot tts 
     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
     JOIN users u ON ct.Teacher_ID = u.User_ID 
     WHERE tts.Slot_Id =  sc.Slot_Id 
     AND ct.Course_ID =  sc.Course_ID  AND u.Delete_Status =false
	LIMIT 1),0
     
    ) AS selectedTeacher,
 /*   COALESCE(
        -- For one-on-one sessions, get teacher from course_teacher matching Course_ID
        (SELECT u.User_ID 
         FROM teacher_time_slot tts 
		JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
         JOIN users u ON ct.Teacher_ID = u.User_ID   WHERE ct.Course_ID =  sc.Course_ID  and ct.Delete_Status =0 and u.Delete_Status=0 and  tts.Slot_Id  = sc.Slot_Id 
         LIMIT 1),0
     
    ) AS selectedTeacher, */
    sc.Enrollment_Date,
    sc.Expiry_Date,
    sc.Price,
    sc.Payment_Date,
    sc.Payment_Status,
    sc.LastAccessed_Content_ID,
    sc.Transaction_Id,
    sc.Delete_Status,
    sc.Payment_Method,
    sc.Batch_ID,
    cb.Batch_Name,
    sc.Requested_Slot_Id,
    sc.Slot_Id,
	TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
	TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,
	TIME_FORMAT(ttss.start_time, '%h:%i %p') AS allocatedStartTime,
	TIME_FORMAT(ttss.end_time, '%h:%i %p') AS allocatedEndTime,

    -- Get teacher name for one-on-one sessions matching Course_ID
    (SELECT CONCAT(u.First_Name, ' ', u.Last_Name)
    FROM teacher_time_slot tts 
     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
     JOIN users u ON ct.Teacher_ID = u.User_ID 
     WHERE tts.Slot_Id = sc.Slot_Id 
	AND ct.Course_ID = sc.Course_ID AND ct.Delete_Status=false and tts.Delete_Status =false AND u.Delete_Status =false and isnull(tts.batch_id)

     LIMIT 1) AS Teacher_Name_One_On_One,
    -- Get teacher name for batch sessions matching Course_ID
    (SELECT CONCAT(u.First_Name, ' ', u.Last_Name)
     FROM teacher_time_slot tts 
     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
     JOIN users u ON ct.Teacher_ID = u.User_ID 
     WHERE tts.batch_id = sc.Batch_ID 
     AND ct.Course_ID = sc.Course_ID AND ct.Delete_Status =false and tts.Delete_Status =false AND u.Delete_Status =false
     LIMIT 1) AS Teacher_Name_Batch
FROM 
    student_course sc
JOIN 
    student s ON sc.Student_ID = s.Student_ID
LEFT JOIN 
    course_batch cb ON sc.Batch_ID = cb.Batch_ID
LEFT JOIN 
    teacher_time_slot tts ON sc.Requested_Slot_Id = tts.Slot_Id
    AND EXISTS (
        SELECT 1 FROM course_teacher ct 
        WHERE ct.CourseTeacher_ID = tts.CourseTeacher_ID 
        AND ct.Course_ID = sc.Course_ID  
    ) 
LEFT JOIN 
    teacher_time_slot ttss ON sc.Slot_Id = ttss.Slot_Id
    AND EXISTS (
        SELECT 1 FROM course_teacher ct 
        WHERE ct.CourseTeacher_ID = ttss.CourseTeacher_ID 
        AND ct.Course_ID = sc.Course_ID AND ct.Delete_Status=false 
    ) AND  ttss.Delete_Status =false and isnull(ttss.batch_id)
WHERE 
    sc.Course_ID = course_Id_ 
    AND sc.Delete_Status = FALSE 
    AND s.Delete_Status = FALSE 
    AND sc.Expiry_Date > CURDATE()
GROUP BY 
    sc.StudentCourse_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Dashboard`()
BEGIN
                    -- 1. Accounts Summary (Only Aives Branch)
                    SELECT 
                        a.account_id,
                        a.account_name,
                        a.total_value_a - COALESCE(b.total_value_b, 0) AS total_value_b
                    FROM (
                        SELECT ah.account_id, ah.account_name, SUM(r.Amount) AS total_value_a
                        FROM account_heads ah
                        JOIN branches br ON ah.Branch_Id = br.Branch_Id 
                            AND IFNULL(br.Delete_Status, 0) = 0 
                            AND (LOWER(br.Branch_Name) = 'aives' OR br.Branch_Id = 5)
                        LEFT JOIN receipts r ON ah.Account_Name = r.Account_Name AND (r.DeleteStatus IS NULL OR r.DeleteStatus = 0)
                        GROUP BY ah.account_id, ah.account_name
                    ) a
                    LEFT JOIN (
                        SELECT ah.account_id, SUM(e.Amount) AS total_value_b
                        FROM account_heads ah
                        JOIN branches br ON ah.Branch_Id = br.Branch_Id 
                            AND IFNULL(br.Delete_Status, 0) = 0 
                            AND (LOWER(br.Branch_Name) = 'aives' OR br.Branch_Id = 5)
                        LEFT JOIN expense e ON e.Account_Name = ah.Account_Name AND (e.Delete_Status IS NULL OR e.Delete_Status = 0)
                        GROUP BY ah.account_id
                    ) b ON a.account_id = b.account_id;

                    -- 2. Popular Course
                    SELECT 
                        c.Course_Name, 
                        COUNT(sc.StudentCourse_ID) AS Enrollment_Count
                    FROM course c
                    LEFT JOIN student_course sc ON c.Course_ID = sc.Course_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    WHERE IFNULL(c.Delete_Status, 0) = 0
                    GROUP BY c.Course_ID, c.Course_Name
                    ORDER BY Enrollment_Count DESC
                    LIMIT 10;

                    -- 3. Month Wise Student Enrollment (Current Year)
                    SELECT 
                        MONTHNAME(COALESCE(sc.Enrollment_Date, s.Admission_Date)) AS Month,
                        COUNT(DISTINCT s.Student_ID) AS Student_Count
                    FROM student s
                    JOIN student_course sc ON s.Student_ID = sc.Student_ID
                    WHERE IFNULL(s.Delete_Status, 0) = 0
                      AND IFNULL(sc.Delete_Status, 0) = 0
                      AND COALESCE(sc.Enrollment_Date, s.Admission_Date) IS NOT NULL
                      AND YEAR(COALESCE(sc.Enrollment_Date, s.Admission_Date)) = YEAR(CURDATE())
                    GROUP BY Month
                    ORDER BY MONTH(STR_TO_DATE(CONCAT('01 ', Month, ' ', YEAR(CURDATE())), '%d %M %Y'));

                    -- 4. DUMMY (Expected as data[3], will be overwritten by backend JS)
                    SELECT 1 AS Dummy;

                    -- 5. Month Wise Lead Report (Current Year)
                    SELECT 
                        MONTHNAME(COALESCE(Entry_Date, Admission_Date)) AS Month,
                        COUNT(Student_ID) AS Lead_Count
                    FROM student
                    WHERE IFNULL(Delete_Status, 0) = 0 
                      AND COALESCE(Entry_Date, Admission_Date) IS NOT NULL
                      AND IFNULL(Is_Registered, 0) = 0
                      AND YEAR(COALESCE(Entry_Date, Admission_Date)) = YEAR(CURDATE())
                    GROUP BY Month
                    ORDER BY MONTH(STR_TO_DATE(CONCAT('01 ', Month, ' ', YEAR(CURDATE())), '%d %M %Y'));

                    -- 6. Student Status Representation (Categorized for Registered Students)
                    SELECT 
                        CASE 
                            WHEN LOWER(Status_Name) = 'completed' THEN 'Completed'
                            WHEN LOWER(Status_Name) IN ('dropout', 'deactivated') THEN 'Dropout'
                            WHEN isActive = 1 THEN 'Active'
                            ELSE 'Dropout'
                        END AS Status, 
                        CAST(COUNT(Student_ID) AS UNSIGNED) AS Count
                    FROM student
                    WHERE IFNULL(Delete_Status, 0) = 0
                      AND Is_Registered = 1
                    GROUP BY Status;

                    -- 7. Total Courses
                    SELECT COUNT(Course_ID) AS Total_Courses
                    FROM course
                    WHERE IFNULL(Delete_Status, 0) = 0;
                END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Dashboard_Data_By_StudentId`(IN studentID INT)
BEGIN
select rc.course_id,c.Course_Name,c.Category_ID,c.Validity,c.Price,c.Live_Class_Enabled,sc.LastAccessed_Content_ID 
from recent_student_course rc 
JOIN course c  ON rc.course_id = c.Course_ID 
JOIN student_course sc ON rc.course_id = sc.Course_ID and sc.student_id = studentID
where rc.student_id = studentID  ;
call breffini.Search_course('', 'popular', studentID);
call breffini.Search_course('', 'recommended', studentID);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_DeviceId_By_UserId`(In senderId_ int,In isStudent_ Int)
BEGIN

    IF isStudent_ = 1 THEN
		select Device_ID from  student where Student_ID =senderId_;
    ELSE
		select Device_ID from  users where User_ID =senderId_;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_DocumentTypes`()
BEGIN
    SELECT 
        Document_Type_Id, 
        Document_Type_Name 
    FROM 
        document_types 
    WHERE 
        Is_Active = 1
    ORDER BY 
        Document_Type_Name ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Due_installments`(
            IN p_Student_ID INT,
            IN p_Branch_Id INT,
            IN p_Course_ID INT,
            IN p_FromDate DATE,
            IN p_ToDate DATE,
            IN p_PageSize INT,
            IN p_PageNumber INT
        )
BEGIN
            DECLARE v_Offset INT;
            SET v_Offset = (p_PageNumber - 1) * p_PageSize;

            -- Count total matching records and total amounts
            SELECT 
                COUNT(DISTINCT st.Student_ID) AS totalRecords,
                IFNULL(SUM(fee.Outstanding_Amount), 0) AS Total_Amount,
                IFNULL(SUM(fee.Paid_Amount), 0) AS Total_Paid_Amount,
                IFNULL(SUM(fee.Remaining_Amount), 0) AS Outstanding_Amount
            FROM 
                student AS st
            LEFT JOIN
                student_course AS sc ON sc.Student_ID = st.Student_ID
            LEFT JOIN (
                SELECT
                    Student_ID,
                    SUM(Paid_Amount) AS Paid_Amount,
                    SUM(Remaining_Amount) AS Remaining_Amount,
                    SUM(CASE WHEN Due_Date <= CURDATE() AND Remaining_Amount > 0 THEN Remaining_Amount ELSE 0 END) AS Outstanding_Amount
                FROM
                    student_fees_details
                WHERE
                    Delete_Status = 0
                GROUP BY
                    Student_ID
            ) AS fee ON fee.Student_ID = st.Student_ID
            WHERE
                st.Delete_Status = 0 AND
                (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
                (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID);

            -- List results with Fine calculation
            SELECT
                st.Student_ID,
                st.First_Name,
                st.Last_Name,
                st.Email,
                c.Course_Name,
                cb.Batch_Name,
                fee.Remaining_Amount AS Due_Amount,
                fee.Fine_Amount
            FROM
                student AS st
            LEFT JOIN
                student_course AS sc ON sc.Student_ID = st.Student_ID
            LEFT JOIN
                course AS c ON c.Course_ID = sc.Course_ID
            LEFT JOIN
                course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
            LEFT JOIN (
                SELECT
                    Student_ID,
                    SUM(Remaining_Amount) AS Remaining_Amount,
                    -- Fine Logic: 100 for any installment past due date
                    SUM(CASE WHEN Due_Date < CURDATE() AND Remaining_Amount > 0 THEN 100 ELSE 0 END) AS Fine_Amount
                FROM
                    student_fees_details
                WHERE
                    Delete_Status = 0
                GROUP BY
                    Student_ID
            ) AS fee ON fee.Student_ID = st.Student_ID
            WHERE
                st.Delete_Status = 0 AND
                fee.Remaining_Amount > 0 AND
                (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
                (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID)
            ORDER BY st.Student_ID
            LIMIT p_PageSize OFFSET v_Offset;
        END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Email_Logs_By_Student`(
                IN p_Student_ID INT
            )
BEGIN
                SELECT * FROM Email_Logs WHERE Student_ID = p_Student_ID ORDER BY Sent_At DESC;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Email_Template`(
                IN p_Template_ID INT
            )
BEGIN
                SELECT * FROM email_templates WHERE Template_ID = p_Template_ID AND Delete_Status = 0;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Enquiry_Conversion_Details`(
    IN p_source_id INT,
    IN p_from_date VARCHAR(20),
    IN p_to_date VARCHAR(20)
)
BEGIN
    SELECT 
        s.Student_ID,
        CONCAT(COALESCE(s.First_Name, ''), ' ', COALESCE(s.Last_Name, '')) AS Student_Name,
        s.Email,
        CONCAT(COALESCE(s.Country_Code, ''), ' ', COALESCE(s.Phone_Number, '')) AS Mobile,
        s.Registered_On,
        s.Roll_No,
        s.Admission_Date
    FROM student s
    WHERE s.Enquiry_Source_Id = p_source_id
        AND s.Is_Registered = 1
        AND s.Delete_Status = 0
        AND (p_from_date = '' OR p_from_date IS NULL OR DATE(s.Registered_On) >= p_from_date)
        AND (p_to_date = '' OR p_to_date IS NULL OR DATE(s.Registered_On) <= p_to_date)
    ORDER BY s.Registered_On DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Enquiry_Conversion_Summary`(
    IN p_from_date VARCHAR(20),
    IN p_to_date VARCHAR(20)
)
BEGIN
    SELECT 
        es.Enquiry_Source_Id,
        es.Enquiry_Source_Name,
        IFNULL(tl.Total_Leads_Count, 0) AS Total_Leads_Count,
        IFNULL(cc.Conversion_Count, 0) AS Conversion_Count,
        IFNULL(ROUND((IFNULL(cc.Conversion_Count, 0) / NULLIF(tl.Total_Leads_Count, 0)) * 100, 2), 0) AS Conversion_Percentage,
        cc.Latest_Conversion_Date
    FROM enquiry_source es
    LEFT JOIN (
        SELECT Enquiry_Source_Id, COUNT(Student_ID) AS Total_Leads_Count
        FROM student
        WHERE Delete_Status = 0
        AND (p_from_date = '' OR p_from_date IS NULL OR DATE(Entry_Date) >= p_from_date)
        AND (p_to_date = '' OR p_to_date IS NULL OR DATE(Entry_Date) <= p_to_date)
        GROUP BY Enquiry_Source_Id
    ) tl ON es.Enquiry_Source_Id = tl.Enquiry_Source_Id
    LEFT JOIN (
        SELECT Enquiry_Source_Id, COUNT(Student_ID) AS Conversion_Count, MAX(Registered_On) AS Latest_Conversion_Date
        FROM student
        WHERE Is_Registered = 1 AND Delete_Status = 0
        AND (p_from_date = '' OR p_from_date IS NULL OR DATE(Registered_On) >= p_from_date)
        AND (p_to_date = '' OR p_to_date IS NULL OR DATE(Registered_On) <= p_to_date)
        GROUP BY Enquiry_Source_Id
    ) cc ON es.Enquiry_Source_Id = cc.Enquiry_Source_Id
    WHERE es.Delete_Status = 0
    ORDER BY Conversion_Count DESC, Total_Leads_Count DESC, es.Enquiry_Source_Name ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Enquiry_Summary`(
        IN p_From_Date DATETIME,
        IN p_To_Date DATETIME
    )
BEGIN
        -- Result Set 1: Enquiry Sources
        SELECT Enquiry_Source_Id, Enquiry_Source_Name 
        FROM enquiry_source 
        WHERE IFNULL(Delete_Status, 0) = 0
        ORDER BY Enquiry_Source_Name;

        -- Result Set 2: Follow-up Statuses
        SELECT Status_Id, Status_Name, Status_Color
        FROM followup_status 
        WHERE IFNULL(Delete_Status, 0) = 0 AND Is_Active = 1
        ORDER BY Display_Order, Status_Name;

        -- Result Set 3: Counts per Source and Status
        -- Use Registered_On for date filtering
        SELECT 
            s.Enquiry_Source_Id, 
            fs.Status_Id, 
            COUNT(s.Student_ID) as LeadCount
        FROM student s
        JOIN (
            SELECT sf.Student_ID, sf.Follow_Up_Status_ID
            FROM student_followup sf
            WHERE sf.Follow_Up_ID = (
                SELECT sf2.Follow_Up_ID 
                FROM student_followup sf2 
                WHERE sf2.Student_ID = sf.Student_ID AND IFNULL(sf2.Delete_Status, 0) = 0
                ORDER BY sf2.Created_Date DESC, sf2.Follow_Up_ID DESC
                LIMIT 1
            )
        ) latest_fu ON s.Student_ID = latest_fu.Student_ID
        JOIN followup_status fs ON fs.Status_Id = latest_fu.Follow_Up_Status_ID
        WHERE s.Is_Registered = 0 
          AND IFNULL(s.Delete_Status, 0) = 0 
          AND IFNULL(fs.Delete_Status, 0) = 0
          AND (p_From_Date IS NULL OR s.Registered_On >= p_From_Date)
          AND (p_To_Date IS NULL OR s.Registered_On <= p_To_Date)
        GROUP BY s.Enquiry_Source_Id, fs.Status_Id;
    END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_ExamDetails_By_StudentId`(
    IN student_Id_ INT,
    IN exam_Id_ INT
)
BEGIN
    SELECT
        e.Main_Question,
        cc.Content_Name,
        e.file_name,
        e.file_type,
        e.Passing_Score,
        e.Time_Limit,
        e.Total_Questions,
        (
            SELECT
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'Question_ID', q.Question_ID,
                        'Answer_Media_Name', q.Answer_Media_Name,
                        'questionText', q.Question_Text,
                        'answerOptions', q.Answer_Options,
                        'correctAnswer', q.Correct_Answer,
                        'Submitted_Answer', (
                            SELECT a.Submitted_Answer
                            FROM student_exam_answer a
                            WHERE
                                a.StudentExam_ID = (
                                    SELECT StudentExam_ID
                                    FROM student_exam
                                    WHERE Student_ID = student_Id_
                                        AND Exam_ID = exam_Id_
                                )
                                AND a.Question_ID = q.Question_ID
                            LIMIT 1
                        )
                    )
                )
            FROM
                question q
            WHERE
                q.Exam_ID = exam_Id_
                AND q.Delete_Status = 0
        ) AS questions,
        IF(
            (
                SELECT COUNT(*)
                FROM student_exam
                WHERE Student_ID = student_Id_
                    AND Exam_ID = exam_Id_
            ) > 0,
            TRUE,
            FALSE
        ) AS Attended_Exam
    FROM
        exam e
        JOIN course_content cc ON e.Exam_ID = cc.Exam_ID
    WHERE
        e.Exam_ID = exam_Id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_Examof_Course`(IN p_course_id INT)
BEGIN
  SELECT 
    Content_ID, 
    Course_Id, 
    Section_ID, 
    Content_Name, 
    Exam_ID, 
    Module_ID
  FROM 
    course_content cc
  WHERE 
    cc.Course_Id = p_course_id
    AND cc.Exam_ID IS NOT NULL
    AND cc.Is_Exam_Test = TRUE;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Exams_With_Course`(IN courseId INT)
BEGIN
    IF courseId = 0 THEN
        SELECT 
            e.Exam_ID,
            e.Course_ID,
            c.Course_Name,
            e.Main_Question,
            e.Passing_Score,
            e.Total_Questions,
            e.Time_Limit
        FROM exam e
        JOIN course c ON e.Course_ID = c.Course_ID
        WHERE e.Delete_Status = 0;
    ELSE
        SELECT 
            e.Exam_ID,
            e.Course_ID,
            c.Course_Name,
            e.Main_Question,
            e.Passing_Score,
            e.Total_Questions,
            e.Time_Limit
        FROM exam e
        JOIN course c ON e.Course_ID = c.Course_ID
        WHERE e.Course_ID = courseId AND e.Delete_Status = 0;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Exam_Days`(
    IN p_student_id INT,
    IN p_course_id INT
)
BEGIN
    DECLARE v_batch_id INT;

    -- Fetch the Batch_ID for the given Student_ID and Course_ID
    SELECT Batch_ID
    INTO v_batch_id
    FROM student_course
    WHERE Student_ID = p_student_id
      AND Course_ID = p_course_id;

    -- Fetch modules with associated days that have exams
SELECT
    cm.Module_ID,
    cm.Module_Name,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'Days_Id', d.Days_Id,
            'Day_Name', d.Day_Name,
            'Is_Exam_Day', d.Is_Exam_Day,
            'Is_Exam_Day_Unlocked', IFNULL(exam_info.Is_Exam_Day_Unlocked, FALSE)
        )
    ) AS Days
FROM 
    course_module cm
INNER JOIN 
    (SELECT DISTINCT
        cc.Module_ID,
        cc.Days_Id
     FROM course_content cc
     WHERE cc.Course_Id = Course_ID
       AND cc.Exam_ID IS NOT NULL
		AND cc.Is_Exam_Test = True
    ) AS unique_days ON unique_days.Module_ID = cm.Module_ID
INNER JOIN 
    days d ON unique_days.Days_Id = d.Days_Id
LEFT JOIN (
    SELECT 
        cc.Days_Id,
        MAX(CASE 
            WHEN EXISTS (
                SELECT 1
                FROM unlocked_exam ue
                WHERE ue.Exam_ID = cc.Exam_ID
                AND ue.Batch_ID = v_batch_id
            ) THEN TRUE
            ELSE FALSE
        END) AS Is_Exam_Day_Unlocked
    FROM course_content cc
    WHERE cc.Course_Id = Course_ID
    GROUP BY cc.Days_Id
) AS exam_info ON exam_info.Days_Id = d.Days_Id
WHERE 
    cm.Module_ID IN (
        SELECT DISTINCT cc.Module_ID
        FROM course_content cc
        WHERE cc.Course_Id = p_course_id
          AND cc.Exam_ID IS NOT NULL
                      	AND cc.Is_Exam_Test = True
    )
GROUP BY 
    cm.Module_ID, cm.Module_Name
ORDER BY
    cm.Module_ID;


END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Exam_Days_By_Module`(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_module_id INT
)
BEGIN
    DECLARE v_batch_id INT;

    -- Fetch the Batch_ID for the given Student_ID and Course_ID
    SELECT Batch_ID
    INTO v_batch_id
    FROM student_course
    WHERE Student_ID = p_student_id
      AND Course_ID = p_course_id;

    -- Fetch distinct day details with grouping and exam day status
    SELECT 
        d.Days_Id,
        d.Day_Name,
        MAX(CASE 
            WHEN EXISTS (
                SELECT 1
                FROM unlocked_exam ue
                WHERE ue.Exam_ID = cc.Exam_ID
                AND ue.Batch_ID = v_batch_id
            ) THEN TRUE
            ELSE FALSE
        END) AS Is_Exam_Day_Unlocked
    FROM days d
    INNER JOIN course_content cc ON cc.Days_Id = d.Days_Id
    WHERE cc.Course_Id = p_course_id
      AND cc.Module_ID = p_module_id
      AND cc.Is_Exam_Test = 1
    GROUP BY d.Days_Id, d.Day_Name
    ORDER BY d.Days_Id;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Exam_Details`(
    IN in_Exam_ID INT
)
BEGIN
  -- Fetch questions for the given Exam_ID
  SELECT 
    q.Question_ID,
    q.Exam_ID,
    q.Question_Text,
    q.Answer_Options,
    q.Correct_Answer,
    q.Answer_Media_Name
  FROM question q
  WHERE q.Exam_ID = in_Exam_ID AND q.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Exam_Modules_By_CourseId`(
    IN p_Course_Id VARCHAR(45)
)
BEGIN
    SELECT
        cm.Module_ID,
        cm.Module_Name
    FROM
        course_content cc
    INNER JOIN
        course_module cm ON cc.Module_ID = cm.Module_ID
    WHERE
        cc.Course_Id = p_Course_Id
        AND cc.Is_Exam_Test = 1
    GROUP BY
        cm.Module_ID, cm.Module_Name;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_ExpenseList`()
BEGIN
    SELECT 
    e.Expense_Id,
    e.Expense_Type_Id,
    e.User_Id,
    e.Entry_Date,
    e.Amount,
    e.Account_Id,
    e.Account_Name,
    e.Description,
    e.StudentName,
    us.First_Name,
    exty.Expense_Type_Name
FROM 
    Expense e
LEFT JOIN 
    expense_type exty ON e.Expense_Type_Id = exty.Expense_Type_Id
    LEFT JOIN 
    users us ON e.User_Id = us.User_ID
WHERE 
    e.Delete_Status = 0
    ORDER BY 
        Entry_Date DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_ExpenseList_Student_ID`(
	IN Student_ID_ int
)
BEGIN
    SELECT 
    e.Expense_Id,
    e.Expense_Type_Id,
    e.User_Id,
    e.Entry_Date,
    e.Amount,
    e.Account_Id,
    e.Account_Name,
    e.Description,
    e.StudentName,
    us.First_Name,
    exty.Expense_Type_Name
FROM 
    Expense e
LEFT JOIN 
    expense_type exty ON e.Expense_Type_Id = exty.Expense_Type_Id
    LEFT JOIN 
    users us ON e.User_Id = us.User_ID
WHERE e.Student_ID = Student_ID_ AND e.Delete_Status = 0
    ORDER BY 
        Entry_Date DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Expense_Category`()
BEGIN
    SELECT 
        Expense_Category_Id,
        Expense_Category_Name,
        Delete_Status
    FROM 
        expense_category
    WHERE 
        Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Expense_Type`()
BEGIN
    SELECT 
        et.Expense_Type_Id,
        et.Expense_Type_Name,
        et.Expense_Category_Id,
         ec.Expense_Category_Name,
        et.Delete_Status
    FROM 
        Expense_Type et
	JOIN 
        expense_category ec 
        ON et.Expense_Category_Id = ec.Expense_Category_Id
    WHERE 
       et.Delete_Status = 0
        AND ec.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_FeesByReceipt_ID`(IN input_Receipt_Id INT)
BEGIN
    SELECT 
        Receipt_Id,
        Student_Id,
        Amount,
        Entry_Date,
        User_Id,
        Branch,
        Account_Id,
        Payment_mode,
        Transaction_ID,
        Voucher_Number,
        DeleteStatus,
        Tax_Type_Id,
        Netvalue,
        Gstpers,
        Cgstpers,
        Sgstpers,
        Gst,
        Cgst,
        Sgst,
        Payment_Date
    FROM 
        receipts
    WHERE 
        Receipt_Id = input_Receipt_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_FeesByStudentCourse`(
  IN p_Student_ID INT,
  IN p_Course_ID INT
)
BEGIN
  SELECT 
    sfd.Student_Fees_ID,
    sfd.Installment_Index,
    sfd.Total_Amount,
    sfd.Paid_Amount,
    sfd.Remaining_Amount,
    sfd.Fee_Status,
    sfd.Payment_Date,
    sfd.Due_Date,
    sfd.Payment_Mode,
    sfd.Transaction_ID,
    sfd.Installment_information_ID,
    sfd.Course_ID,
    sfd.Course_Name,
    sfd.Created_At,
    sfd.Updated_At,
    ii.Fee_Type,
    ii.Duration
  FROM student_fees_details sfd
  LEFT JOIN installment_information ii 
    ON sfd.Installment_information_ID = ii.Installment_information_ID
  WHERE 
    sfd.Student_ID = p_Student_ID
    AND sfd.Course_ID = p_Course_ID
    AND sfd.Delete_Status = 0
   ORDER BY ii.Duration ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_FeesByStudentId`(
    IN p_student_id INT
)
BEGIN
    SELECT 
        Student_Fees_ID,
        Student_ID,
        Installment_information_ID,
        Installment_Index,
        Course_ID,
        Course_Name,
        Total_Amount,
        Paid_Amount,
        Remaining_Amount,
        Fee_Status,
        Payment_Date,
        DATE_FORMAT(Due_Date, "%m-%d-%Y") Due_Date,
        Payment_Mode,
        Transaction_ID,
        Delete_Status,
        Created_At,
        Updated_At
    FROM student_fees_details
    WHERE Student_ID = p_student_id
      AND (Delete_Status IS NULL OR Delete_Status = 0)
    ORDER BY Student_Fees_ID ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_FeesByStudent_Fees_ID`(
    IN p_Student_Fees_ID INT
)
BEGIN
    SELECT 
        Student_Fees_ID,
        Student_ID,
        Installment_information_ID,
        Installment_Index,
        Course_ID,
        Course_Name,
        Total_Amount,
        Paid_Amount,
        Remaining_Amount,
        Fee_Status,
        Payment_Date,
         DATE_FORMAT(Due_Date, '%d/%m/%Y') as Due_Date
        ,
       '' Payment_Mode,
       '' Transaction_ID,
        Delete_Status,
        Created_At,
        Updated_At
    FROM student_fees_details
    WHERE Student_Fees_ID = p_Student_Fees_ID
      AND (Delete_Status IS NULL OR Delete_Status = 0)
    ORDER BY Due_Date ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Fine_Report`(
            IN p_Student_ID INT,
            IN p_Batch_ID INT,
            IN p_Course_ID INT,
            IN p_Fine_Per_Day DECIMAL(10,2),
            IN p_FromDate DATE,
            IN p_ToDate DATE,
            IN p_PageNumber INT,
            IN p_PageSize INT
        )
BEGIN
            DECLARE v_Offset INT;
            SET v_Offset = (p_PageNumber - 1) * p_PageSize;

            -- Fine report: overdue unpaid installments
            SELECT
                SQL_CALC_FOUND_ROWS
                s.Student_ID,
                CONCAT(s.First_Name, ' ', s.Last_Name) AS Student_Name,
                s.Mobile_Number,
                i.id AS Installment_ID,
                i.installment_number,
                i.amount AS Installment_Amount,
                i.installment_date AS Due_Date,
                DATEDIFF(CURDATE(), i.installment_date) AS Days_Overdue,
                ROUND(DATEDIFF(CURDATE(), i.installment_date) * p_Fine_Per_Day, 2) AS Fine_Amount,
                i.batch_name AS Batch_Name,
                i.course_name AS Course_Name,
                i.payment_status
            FROM installments i
            JOIN student s ON i.student_id = s.Student_ID
            WHERE i.is_paid = 0
              AND i.Delete_Status = 0
              AND i.installment_date < CURDATE()
              AND (p_Student_ID = 0 OR i.student_id = p_Student_ID)
              AND (p_Batch_ID = 0 OR i.batch_id = p_Batch_ID)
              AND (p_Course_ID = 0 OR i.course_id = p_Course_ID)
              AND (p_FromDate IS NULL OR i.installment_date >= p_FromDate)
              AND (p_ToDate IS NULL OR i.installment_date <= p_ToDate)
            ORDER BY Days_Overdue DESC
            LIMIT p_PageSize OFFSET v_Offset;

            -- Count total and summary
            SELECT
                FOUND_ROWS() AS totalRecords,
                SUM(i.amount) AS Total_Due_Amount,
                SUM(ROUND(DATEDIFF(CURDATE(), i.installment_date) * p_Fine_Per_Day, 2)) AS Total_Fine_Amount
            FROM installments i
            JOIN student s ON i.student_id = s.Student_ID
            WHERE i.is_paid = 0
              AND i.Delete_Status = 0
              AND i.installment_date < CURDATE()
              AND (p_Student_ID = 0 OR i.student_id = p_Student_ID)
              AND (p_Batch_ID = 0 OR i.batch_id = p_Batch_ID)
              AND (p_Course_ID = 0 OR i.course_id = p_Course_ID)
              AND (p_FromDate IS NULL OR i.installment_date >= p_FromDate)
              AND (p_ToDate IS NULL OR i.installment_date <= p_ToDate);
        END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Followup_Status`()
BEGIN SELECT * FROM followup_status WHERE Delete_Status = 0 ORDER BY Display_Order ASC; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Free_Time_Slot`(IN CourseID INT)
BEGIN
SELECT 
    tts.Slot_Id, 

	TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
	TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,
    sc.Slot_Id AS Student_Slot_Id, 
    MAX(s.Delete_Status) AS Student_Delete_Status, 
    MAX(sc.StudentCourse_ID) AS StudentCourse_ID,
    ct.Course_ID,
    CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
    u.User_ID,
    MAX(sc.Expiry_Date) AS Expiry_Date
FROM 
    teacher_time_slot tts
JOIN 
    course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
JOIN 
    users u ON u.User_ID = ct.Teacher_ID
LEFT JOIN 
    student_course sc ON tts.Slot_Id = sc.Slot_Id 
         AND sc.Course_ID = ct.Course_ID 
LEFT JOIN 
    student s ON sc.Student_ID = s.Student_ID
WHERE 
    ct.Course_ID = CourseID
    AND tts.Delete_Status = 0 
    AND ct.Delete_Status = 0
    AND tts.batch_id IS NULL  AND u.Delete_Status =false
GROUP BY 
    tts.Slot_Id, tts.start_time, tts.end_time, ct.Course_ID, u.First_Name, u.Last_Name, u.User_ID
HAVING 
    (tts.Slot_Id IS NULL) OR 
    (COUNT(sc.StudentCourse_ID) = 0) OR 
    (COUNT(CASE WHEN s.Delete_Status = 0 THEN 1 END) = 0) OR  -- Ensure no active students
    (MAX(sc.Expiry_Date) < CURDATE());


END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_hod_chat_history`(
    IN p_student_id INT,
    IN p_course_id INT
)
BEGIN
    SELECT JSON_OBJECTAGG(
        message_date, messages
    ) AS result_json
    FROM (
        SELECT
            DATE_FORMAT(DATE(chat.timestamp), '%Y-%m-%d') AS message_date,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'message_id', chat.chat_id,
                    'student_id', chat.student_id,
                    'user_id', chat.user_id,
                    'course_id', chat.course_id,
                    'message', chat.message,
                    'message_timestamp', chat.timestamp,
                    'File_Path', chat.File_Path,
                    'Is_Student_Sent', chat.Is_Student_Sent
                )
            ) AS messages
        FROM
            student_hod_chat AS chat
        WHERE
            chat.student_id = p_student_id AND chat.course_id = p_course_id
        GROUP BY
            message_date
        ORDER BY
            message_date DESC
    ) AS combined;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Hod_Course`(In p_user_Id INT )
BEGIN
  SELECT ch.User_ID, ch.Course_ID,c.*
        FROM course_hod ch
        JOIN course c ON c.Course_ID = ch.Course_ID 
        WHERE c.Delete_Status = FALSE and ch.User_ID= p_user_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_InActive_Students`()
BEGIN
    SELECT Student_ID, First_Name, Last_Name, Device_ID, Last_Online,Phone_Number
    FROM student 
  WHERE TIMESTAMPDIFF(HOUR, STR_TO_DATE(Last_Online, '%Y-%m-%d %H:%i:%s'), NOW()) >= 11 and !isnull( Last_Online) and Delete_Status = 0 ;
  END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_IncomeList`()
BEGIN
            SELECT
                i.Income_Id,
                i.Expense_Type_Id,
                i.User_Id,
                i.Entry_Date,
                i.Amount,
                i.Account_Id,
                i.Account_Name,
                i.Description,
                us.First_Name,
                et.Expense_Type_Name
            FROM income i
            LEFT JOIN expense_type et ON i.Expense_Type_Id = et.Expense_Type_Id
            LEFT JOIN users us ON i.User_Id = us.User_ID
            WHERE i.Delete_Status = 0
            ORDER BY i.Entry_Date DESC;
        END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Income_Category`()
BEGIN
                SELECT * FROM income_category WHERE Delete_Status = 0;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Income_Type`()
BEGIN
                SELECT it.*, ic.Income_Category_Name 
                FROM income_type it
                LEFT JOIN income_category ic ON it.Income_Category_Id = ic.Income_Category_Id
                WHERE it.Delete_Status = 0;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_InstallmentsByCourseID`(
    IN input_Course_ID INT
)
BEGIN
    SELECT 
        Installment_information_ID,
        Details,
        Duration,
        Amount,
        Course_ID,
        Course_Name,
        Fee_Type
    FROM 
        installment_information
    WHERE 
        Course_ID = input_Course_ID 
        AND Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_InstallmentsByFee_Type`(
	IN fees_Type_ VARCHAR(50), 
    IN input_Course_ID INT,
    IN Batch_ID_ INT
)
BEGIN
    SELECT 
        Installment_information_ID,
        Details,
        Duration,
        Amount,
        Course_ID,
        Course_Name,
        Fee_Type,
        Batch_ID
    FROM 
        installment_information
    WHERE 
        Course_ID = input_Course_ID AND Fee_Type = fees_Type_ AND Batch_ID = Batch_ID_
        AND Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Last_Day_Recordings`()
BEGIN
 SELECT LiveClass_ID, Record_Class_Link
    FROM live_class
    WHERE Record_Class_Link IS NOT NULL
      AND Record_Class_Link != ''
      AND Is_Finished=1
      AND DATE(Start_Time) < DATE_SUB(CURDATE(), INTERVAL 5 DAY);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Leaves`(IN User_Id_ INT)
BEGIN
                IF User_Id_ > 0 THEN
                    SELECT l.*, u.First_Name, u.Last_Name 
                    FROM Leaves l
                    JOIN users u ON l.User_Id = u.User_ID
                    WHERE l.User_Id = User_Id_ AND l.Is_Deleted = 0
                    ORDER BY l.Created_At DESC;
                ELSE
                    SELECT l.*, u.First_Name, u.Last_Name 
                    FROM Leaves l
                    JOIN users u ON l.User_Id = u.User_ID
                    WHERE l.Is_Deleted = 0
                    ORDER BY l.Created_At DESC;
                END IF;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_liveClass`(in p_teacher_id int )
BEGIN
 SELECT
    lc.LiveClass_ID,
    lc.Course_ID,
    c.Course_Name,
    lc.Teacher_ID,
    lc.Start_Time,
    lc.Live_Link,
    u.First_Name,
	u.Last_Name,
    lc.Scheduled_DateTime,
    lc.Duration
FROM
    live_class lc
    JOIN course c ON lc.Course_ID = c.Course_ID
    JOIN users u ON lc.Teacher_ID = u.User_ID
WHERE
  lc.Is_Finished=1 and lc.Teacher_ID =p_teacher_id
    AND lc.Delete_Status = false;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Live_Classes_By_CourseId`( In course_Id_ Int,IN UserId_ INT,IN Batch_Id_ INT)
Begin 

 SELECT
    lc.LiveClass_ID,
    lc.Course_ID,
    c.Course_Name,
    lc.Teacher_ID,
    lc.Start_Time,
    lc.Live_Link,
    u.First_Name,
	u.Last_Name,
    lc.Scheduled_DateTime,
    lc.Duration
FROM
    live_class lc
    JOIN course c ON lc.Course_ID = c.Course_ID
    JOIN users u ON lc.Teacher_ID = u.User_ID
WHERE
    lc.Course_ID = course_Id_ and lc.Is_Finished=0 and Batch_Id=Batch_Id_
    AND lc.Delete_Status = false;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Mail_Report`(
        IN p_From_Date DATETIME,
        IN p_To_Date DATETIME,
        IN p_Template_ID INT
    )
BEGIN
        SELECT 
            el.Log_ID,
            el.Sent_At,
            el.Opened_At,
            CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) AS Lead_Name,
            et.Template_Name AS Mail_Template,
            el.Email_Address,
            el.Subject,
            el.Message_ID,
            el.Status
        FROM Email_Logs el
        LEFT JOIN student s ON el.Student_ID = s.Student_ID
        LEFT JOIN email_templates et ON el.Template_ID = et.Template_ID
        WHERE 
            (p_From_Date IS NULL OR el.Sent_At >= p_From_Date) AND
            (p_To_Date IS NULL OR el.Sent_At <= p_To_Date) AND
            (p_Template_ID IS NULL OR el.Template_ID = p_Template_ID)
        ORDER BY el.Sent_At DESC;
    END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_MockTestPackages`()
BEGIN
    SELECT Package_ID, Package_Name
    FROM mock_test_packages
    WHERE Delete_Status = 0
    ORDER BY Package_ID DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Module_Of_Course`(
    IN p_Course_ID INT,
    IN p_Student_ID INT
)
BEGIN
    SELECT 
        cm.Module_ID,   cm.Module_Name,  cm.Exam_Module,
        CASE 
            WHEN cm.locked_Status = 1 THEN
                CASE 
                    WHEN sc.IsStudentModuleLocked = 1 THEN TRUE
                    ELSE FALSE
                END
            ELSE FALSE
        END AS IsStudentModuleLocked 
    FROM 
        course_module cm
    LEFT JOIN 
        student_course sc 
    ON 
        sc.Course_ID = p_Course_ID 
        AND sc.Student_ID = p_Student_ID AND sc.Delete_Status=0
    WHERE 
        cm.Module_ID IN (
            SELECT DISTINCT Module_ID
            FROM course_content
            WHERE Course_Id = p_Course_ID
        )         order by cm.View_Order ,cm.Module_ID desc;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_OneToOne_Recordings`(
    IN p_student_id INT
)
BEGIN
    SELECT
        DATE_FORMAT(DATE(calls.call_start), '%Y-%m-%d') AS message_date,
        calls.teacher_id,
        calls.student_id,
        calls.call_start AS message_timestamp,
        calls.id AS call_id,
        calls.call_start,
        calls.call_end,
        calls.call_duration,
        calls.call_type,
        calls.Is_Student_Called AS is_student,
        calls.Record_Class_Link,
        CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
        CONCAT(s.First_Name, ' ', s.Last_Name) AS Student_Name,
        u.Profile_Photo_Path as Teacher_Profile,
        s.Profile_Photo_Path as Student_Profile
    FROM
        call_history AS calls
        JOIN users u ON u.User_ID = calls.teacher_id
        JOIN student s ON s.Student_ID = calls.student_id
    WHERE 
        calls.student_id = p_student_id 
        AND calls.Record_Class_Link IS NOT NULL
        AND calls.Record_Class_Link != ''
    ORDER BY 
        calls.call_start DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Ongoing_Calls`(in id_ int,in isStudent int)
BEGIN

	if isStudent =0
    then
    
    /* For Getting The incoming call of a teacher */
    
			SELECT
            	call_history.*,
					s.Profile_Photo_Path,
					s.First_Name,
                    s.Last_Name,
                    s.Phone_Number,
                    s.Email,
					s.Delete_Status
            
            FROM call_history
            inner join student s on s.Student_ID =call_history.student_id
          WHERE teacher_id = id_  order by id desc LIMIT 20;
		 #   WHERE teacher_id = id_ and Is_Student_Called = 1  order by id desc;

            
	else 
    	SELECT
					call_history.*,
					u.User_ID,
					u.First_Name,
					u.Profile_Photo_Path,
					u.Delete_Status
            FROM call_history
            inner join users u on u.User_ID =call_history.teacher_id
			WHERE student_id = id_ order by id desc LIMIT 20;

          #  WHERE student_id = id_  and Is_Student_Called = 0  order by id desc;
		end if;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_OnGoing_liveClass`(IN p_teacher_id INT)
BEGIN
    SELECT 
        lc.LiveClass_ID,
        lc.Batch_Id,
        lc.Course_ID,
        c.Course_Name,
        lc.Duration,
        lc.Start_Time,
        lc.End_Time,
        lc.Scheduled_DateTime,
        lc.Live_Link,
        u.First_Name AS First_Name
    FROM 
        live_class lc
    INNER JOIN 
        users u ON lc.Teacher_ID = u.User_ID
    INNER JOIN 
        course c ON lc.Course_ID = c.Course_ID
    WHERE 
        lc.Teacher_ID = p_teacher_id
        AND lc.Is_Finished = 0
        AND lc.Delete_Status = 0
    ORDER BY 
        lc.Scheduled_DateTime ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Outstanding_Student`(
    IN p_Student_ID INT,
    IN p_Branch_Id INT,
    IN p_Course_ID INT,
    IN p_IsActive TINYINT,
    IN p_From_Date DATE,
    IN p_To_Date DATE,
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
   SELECT 
        COUNT(DISTINCT st.Student_ID) AS totalRecords,
        IFNULL(SUM(f.Remaining_Amount), 0) AS Outstanding_Amount,
        IFNULL(SUM(f.Paid_Amount), 0) AS Total_Paid_Amount,
        IFNULL(SUM(f.Total_Amount), 0) AS Total_Amount
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN student_fees_details f ON f.Student_ID = st.Student_ID AND f.Delete_Status = 0
    WHERE 
      st.Delete_Status = 0 AND
            
			(p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
			(p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
			(p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
			(p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) ;
           /*     AND
(p_From_Date IS NULL OR st.Entry_Date >= p_From_Date) AND
        (p_To_Date IS NULL OR st.Entry_Date <= p_To_Date); */

   -- Paged result
		SELECT 
			st.Student_ID,
			st.First_Name,
			st.Last_Name,
			st.Email,
			st.Branch_Id,
			st.Branch_Name,
			st.isActive,
			st.Delete_Status,
			st.Entry_Date,
			st.Country_Code,
			st.Phone_Number,
			st.Profile_Photo_Path,
			st.Profile_Photo_Name,
			st.Status_Name,
			st.To_User_Name,
			st.Qualification,
			st.Follow_Up_Date,
			st.Remark,
			st.Is_Registered,
			st.Roll_No,
			st.Registered_On,
			cb.Batch_Name,
			st.Admission_Date,
			sc.Course_ID,
            
			IFNULL(fee.Outstanding_Amount, 0) AS Outstanding_Amount
		FROM 
			student AS st
		LEFT JOIN 
			student_course AS sc ON sc.Student_ID = st.Student_ID
		LEFT JOIN 
			course_batch as cb ON cb.Batch_ID = sc.Batch_ID
		LEFT JOIN (
			SELECT 
				Student_ID, 
				SUM(Remaining_Amount) AS Outstanding_Amount,
                SUM(Paid_Amount) AS Total_Paid_Amount,
                SUM(Total_Amount) AS Total_Amount
			FROM 
				student_fees_details
			WHERE 
				Delete_Status = 0
              
			GROUP BY 
				Student_ID
		) AS fee ON fee.Student_ID = st.Student_ID
		WHERE 
			st.Delete_Status = 0 AND
            fee.Outstanding_Amount > 0 AND
			(p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
			(p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
			(p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
			(p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) 
        /*    AND
		(p_From_Date IS NULL OR st.Entry_Date >= p_From_Date) AND
	(p_To_Date IS NULL OR st.Entry_Date <= p_To_Date) */
		LIMIT p_PageSize OFFSET v_Offset;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Outstanding_Student_old`(
    IN p_Student_ID INT,
    IN p_Branch_Id INT,
    IN p_Course_ID INT,
    IN p_IsActive TINYINT,
    IN p_From_Date DATE,
    IN p_To_Date DATE,
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
   SELECT 
        COUNT(DISTINCT st.Student_ID) AS totalRecords,
        IFNULL(SUM(f.Remaining_Amount), 0) AS Outstanding_Amount,
        IFNULL(SUM(f.Paid_Amount), 0) AS Total_Paid_Amount,
        IFNULL(SUM(f.Total_Amount), 0) AS Total_Amount
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN student_fees_details f ON f.Student_ID = st.Student_ID AND f.Delete_Status = 0
    WHERE 
        st.Delete_Status = 0 AND
        (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
        (p_Branch_Id IS NULL OR p_Branch_Id = 0 OR st.Branch_Id = p_Branch_Id) AND
        (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive);
           /*     AND
(p_From_Date IS NULL OR st.Entry_Date >= p_From_Date) AND
        (p_To_Date IS NULL OR st.Entry_Date <= p_To_Date); */

   -- Paged result
		SELECT 
			st.Student_ID,
			st.First_Name,
			st.Last_Name,
			st.Email,
			st.Branch_Id,
			st.Branch_Name,
			st.isActive,
			st.Delete_Status,
			st.Entry_Date,
			st.Country_Code,
			st.Phone_Number,
			st.Profile_Photo_Path,
			st.Profile_Photo_Name,
			st.Status_Name,
			st.To_User_Name,
			st.Qualification,
			st.Follow_Up_Date,
			st.Remark,
			st.Is_Registered,
			st.Roll_No,
			st.Registered_On,
			cb.Batch_Name,
			st.Admission_Date,
			sc.Course_ID,
            
			IFNULL(fee.Outstanding_Amount, 0) AS Outstanding_Amount
		FROM 
			student AS st
		LEFT JOIN 
			student_course AS sc ON sc.Student_ID = st.Student_ID
		LEFT JOIN 
			course_batch as cb ON cb.Batch_ID = sc.Batch_ID
		LEFT JOIN (
			SELECT 
				Student_ID, 
				SUM(Remaining_Amount) AS Outstanding_Amount,
                SUM(Paid_Amount) AS Total_Paid_Amount,
                SUM(Total_Amount) AS Total_Amount
			FROM 
				student_fees_details
			WHERE 
				Delete_Status = 0
              
			GROUP BY 
				Student_ID
		) AS fee ON fee.Student_ID = st.Student_ID
		WHERE 
			st.Delete_Status = 0 AND
            fee.Outstanding_Amount > 0 AND
			(p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
			(p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
			(p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
			(p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) 
        /*    AND
		(p_From_Date IS NULL OR st.Entry_Date >= p_From_Date) AND
	(p_To_Date IS NULL OR st.Entry_Date <= p_To_Date) */
		LIMIT p_PageSize OFFSET v_Offset;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Profile_Photo`(
    IN Is_Student TINYINT, 
    IN Id_ INT
)
BEGIN
    IF (Is_Student = TRUE) THEN
        SELECT 
            Profile_Photo_Path, 
            CONCAT(First_Name, ' ', Last_Name) AS Full_Name
        FROM 
            student 
        WHERE 
            Student_ID = Id_;
    ELSE 
        SELECT 
            Profile_Photo_Path, 
            CONCAT(First_Name, ' ', Last_Name) AS Full_Name 
        FROM  
            users 
        WHERE 
            User_ID = Id_;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_questions`(
  IN in_Exam_ID INT
)
BEGIN
  SELECT 
    Question_ID,
    Exam_ID,
    Question_Text,
    Answer_Options,
    Correct_Answer,
    Answer_Media_Name
  FROM question
  WHERE Exam_ID = in_Exam_ID AND Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Recorded_LiveClasses`(
    IN p_Student_ID INT,
    IN p_Course_ID INT
)
BEGIN
    SELECT lc.LiveClass_ID, lc.Record_Class_Link, lc.Start_Time
    FROM live_class lc
    JOIN student_course sc ON lc.Batch_Id = sc.Batch_ID
    WHERE sc.Student_ID = p_Student_ID
      AND sc.Course_ID = p_Course_ID
      AND lc.Record_Class_Link IS NOT NULL
      AND lc.Record_Class_Link != ''
      AND lc.Is_Finished = 1
    ORDER BY lc.Start_Time ASC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Registration_Report`(
    IN search_term VARCHAR(100),
    IN page_number INT,
    IN page_size INT,
    IN filter_course_id INT,
    IN filter_batch_id INT,
    IN enrollment_status VARCHAR(50),
    IN active_status VARCHAR(20),
    IN from_date DATE,
    IN to_date DATE,
    IN enrolled_by_id INT
)
BEGIN
    DECLARE offset_value INT;
    SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
    SET search_term = CONCAT('%', search_term, '%');
    SET offset_value = (page_number - 1) * page_size;

    IF enrollment_status IS NULL THEN SET enrollment_status = 'all'; END IF;
    IF active_status IS NULL THEN SET active_status = 'all'; END IF;

    -- Count query for pagination
    SELECT COUNT(DISTINCT s.Student_ID) AS total_count
    FROM student s
    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID
    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
    WHERE
        s.Is_Registered = 1
        AND s.Delete_Status = false
        AND (
            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
        )
        AND (filter_course_id IS NULL OR filter_course_id = 0 OR sc.Course_ID = filter_course_id)
        AND (filter_batch_id IS NULL OR filter_batch_id = 0 OR cb.Batch_ID = filter_batch_id)
        AND (enrolled_by_id IS NULL OR enrolled_by_id = 0 OR s.Registered_By = enrolled_by_id)
        AND (
            from_date IS NULL OR 
            (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) >= from_date)
        )
        AND (
            to_date IS NULL OR 
            (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) <= to_date)
        )
        AND (
            (active_status = 'active' AND s.isActive = 1) OR
            (active_status = 'deactivated' AND s.isActive = 0) OR
            (active_status = 'dropout' AND s.isActive = 0) OR
            (active_status = 'completed' AND LOWER(s.Status_Name) = 'completed') OR
            (active_status = 'all')
        );

    -- Main data query
    SELECT
        s.Student_ID,
        s.First_Name,
        s.Last_Name,
        s.Email,
        s.Country_Code,
        s.Phone_Number,
        s.Branch_Name,
        s.Status_Name,
        s.isActive,
        s.Is_Registered,
        s.Roll_No,
        s.Roll_No_Character,
        s.Registered_On,
        s.Registered_By,
        CONCAT(u.First_Name, ' ', IFNULL(u.Last_Name, '')) AS Registered_By_Name,
        MAX(c.Course_Name) AS Course_Name,
        MAX(cb.Batch_Name) AS Batch_Name,
        true AS is_enrolled
    FROM
        student s
    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID
    LEFT JOIN course c ON sc.Course_ID = c.Course_ID
    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
    LEFT JOIN users u ON s.Registered_By = u.User_ID
    WHERE
        s.Is_Registered = 1 
        AND s.Delete_Status = false
        AND (
            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
            s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term OR
            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
        )
        AND (filter_course_id IS NULL OR filter_course_id = 0 OR sc.Course_ID = filter_course_id)
        AND (filter_batch_id IS NULL OR filter_batch_id = 0 OR cb.Batch_ID = filter_batch_id)
        AND (enrolled_by_id IS NULL OR enrolled_by_id = 0 OR s.Registered_By = enrolled_by_id)
        AND (
            from_date IS NULL OR 
            (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) >= from_date)
        )
        AND (
            to_date IS NULL OR 
            (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) <= to_date)
        )
        AND (
            (active_status = 'active' AND s.isActive = 1) OR
            (active_status = 'deactivated' AND s.isActive = 0) OR
            (active_status = 'dropout' AND s.isActive = 0) OR
            (active_status = 'completed' AND LOWER(s.Status_Name) = 'completed') OR
            (active_status = 'all')
        )
    GROUP BY s.Student_ID
    ORDER BY s.Roll_No DESC
    LIMIT page_size OFFSET offset_value;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Registration_Summary`(
    IN from_date DATE,
    IN to_date DATE
)
BEGIN
    SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));

    SELECT 
        s.Registered_By AS Staff_ID,
        COALESCE(u.First_Name, 'Self/Online') AS Staff_Name,
        COUNT(s.Student_ID) AS Total_Registrations
    FROM student s
    LEFT JOIN users u ON s.Registered_By = u.User_ID
    WHERE s.Is_Registered = 1 AND s.Delete_Status = false
      AND (
          from_date IS NULL OR 
          (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) >= from_date)
      )
      AND (
          to_date IS NULL OR 
          (s.Registered_On IS NOT NULL AND DATE(s.Registered_On) <= to_date)
      )
    GROUP BY s.Registered_By, u.First_Name
    ORDER BY Total_Registrations DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Report_LiveClasses_By_BatchAndTeacher`(
    IN p_Teacher_ID INT,
    IN p_Batch_ID INT,
    IN p_Course_ID INT,
    IN p_Start_Date varchar(50),
    IN p_End_Date varchar(50)
)
BEGIN
				SET @query = "SELECT 
				t.User_ID AS Teacher_ID,
				CONCAT(t.First_Name, ' ', t.Last_Name) AS Teacher_Name,
				b.Batch_ID,
				b.Batch_Name,
				c.Course_ID,
				c.Course_Name,
				DATE_FORMAT(lc.Start_Time, '%d-%M-%Y %h:%i %p') as Start_Time,
				DATE_FORMAT(lc.End_Time, '%d-%M-%Y %h:%i %p') AS End_Time,
				TIMEDIFF(lc.End_Time, lc.Start_Time) AS Duration,
				CONCAT(
					FLOOR(SUM(TIME_TO_SEC(TIMEDIFF(lc.End_Time, lc.Start_Time))) OVER () / 3600), ' hr ',
					ROUND(MOD(SUM(TIME_TO_SEC(TIMEDIFF(lc.End_Time, lc.Start_Time))) OVER (), 3600) / 60), ' min'
				) AS Total_Duration
			FROM 
				live_class lc 
				JOIN users t ON lc.Teacher_ID = t.User_ID
				JOIN course_batch b ON lc.Batch_Id = b.Batch_ID
				JOIN course c ON lc.Course_ID = c.Course_ID
			WHERE 
				lc.Delete_Status = 0 ";

    IF p_Teacher_ID IS NOT NULL AND p_Teacher_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Teacher_ID = ', p_Teacher_ID);
    END IF;

    IF p_Batch_ID IS NOT NULL AND p_Batch_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Batch_Id = ', p_Batch_ID);
    END IF;

    IF p_Course_ID IS NOT NULL AND p_Course_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Course_ID = ', p_Course_ID);
    END IF;

IF p_Start_Date <> '' AND p_End_Date <> '' THEN
    SET @query = CONCAT(@query, ' AND DATE_FORMAT(lc.Start_Time, ''%Y-%m-%d'') >= ''', p_Start_Date, ''' AND DATE_FORMAT(lc.End_Time, ''%Y-%m-%d'') <= ''', p_End_Date, '''');
END IF;


insert into data_log values(45, @query);
    -- Execute the final dynamic query
    PREPARE stmt FROM @query;
    EXECUTE stmt;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Report_Registration`(
   IN p_Student_Search VARCHAR(255),
    IN p_Batch_Search VARCHAR(255),
    IN p_Course_Search VARCHAR(255),
    IN p_IsActive TINYINT,
    IN p_From_Date VARCHAR(10),
    IN p_To_Date VARCHAR(10),
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    DECLARE v_From_Date DATE;
    DECLARE v_To_Date DATE;
    DECLARE v_Student_Search VARCHAR(255);
    DECLARE v_Batch_Search VARCHAR(255);
    DECLARE v_Course_Search VARCHAR(255);

    SET v_From_Date = IF(TRIM(p_From_Date) = '', NULL, STR_TO_DATE(p_From_Date, '%Y-%m-%d'));
    SET v_To_Date = IF(TRIM(p_To_Date) = '', NULL, STR_TO_DATE(p_To_Date, '%Y-%m-%d'));
    SET v_Student_Search = IF(TRIM(COALESCE(p_Student_Search, '')) = '', NULL, LOWER(TRIM(p_Student_Search)));
    SET v_Batch_Search = IF(TRIM(COALESCE(p_Batch_Search, '')) = '', NULL, LOWER(TRIM(p_Batch_Search)));
    SET v_Course_Search = IF(TRIM(COALESCE(p_Course_Search, '')) = '', NULL, LOWER(TRIM(p_Course_Search)));

    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
    SELECT COUNT(*) AS totalRecords
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN course AS c ON c.Course_ID = sc.Course_ID
    LEFT JOIN course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
    WHERE 
        st.Delete_Status = 0 AND
        st.Is_Registered = 1 AND
        (v_Student_Search IS NULL OR
            LOWER(CONCAT_WS(' ', st.First_Name, st.Last_Name)) LIKE CONCAT('%', v_Student_Search, '%') OR
            LOWER(COALESCE(st.Phone_Number, '')) LIKE CONCAT('%', v_Student_Search, '%')
        ) AND
        (v_Batch_Search IS NULL OR LOWER(COALESCE(cb.Batch_Name, '')) LIKE CONCAT('%', v_Batch_Search, '%')) AND
        (v_Course_Search IS NULL OR LOWER(COALESCE(c.Course_Name, '')) LIKE CONCAT('%', v_Course_Search, '%')) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) AND
        (v_From_Date IS NULL OR st.Registered_On >= v_From_Date) AND
        (v_To_Date IS NULL OR st.Registered_On <= v_To_Date);

    -- Paged result
    SELECT 
        st.Student_ID,
        st.First_Name,
        st.Last_Name,
        st.Email,
        st.Phone_Number,
        st.Country_Code,
        st.Branch_Id,
        st.Branch_Name,
        st.isActive,
        st.Delete_Status,
        st.Entry_Date,
        st.Registered_On,
        st.Registered_By_Name,
        sc.Course_ID,
        c.Course_Name,
        cb.Batch_Name
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN course AS c ON c.Course_ID = sc.Course_ID
    LEFT JOIN course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
    WHERE 
        st.Delete_Status = 0 AND
        st.Is_Registered = 1 AND
        (v_Student_Search IS NULL OR
            LOWER(CONCAT_WS(' ', st.First_Name, st.Last_Name)) LIKE CONCAT('%', v_Student_Search, '%') OR
            LOWER(COALESCE(st.Phone_Number, '')) LIKE CONCAT('%', v_Student_Search, '%')
        ) AND
        (v_Batch_Search IS NULL OR LOWER(COALESCE(cb.Batch_Name, '')) LIKE CONCAT('%', v_Batch_Search, '%')) AND
        (v_Course_Search IS NULL OR LOWER(COALESCE(c.Course_Name, '')) LIKE CONCAT('%', v_Course_Search, '%')) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) AND
        (v_From_Date IS NULL OR st.Registered_On >= v_From_Date) AND
        (v_To_Date IS NULL OR st.Registered_On <= v_To_Date)
    ORDER BY st.Registered_On DESC, st.Student_ID DESC
    LIMIT p_PageSize OFFSET v_Offset;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Report_Student`(
   IN p_Student_Search VARCHAR(255),
    IN p_Batch_Search VARCHAR(255),
    IN p_Course_Search VARCHAR(255),
    IN p_IsActive TINYINT,
    IN p_From_Date VARCHAR(10),
    IN p_To_Date VARCHAR(10),
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    DECLARE v_From_Date DATE;
    DECLARE v_To_Date DATE;
    DECLARE v_Student_Search VARCHAR(255);
    DECLARE v_Batch_Search VARCHAR(255);
    DECLARE v_Course_Search VARCHAR(255);

    SET v_From_Date = IF(TRIM(p_From_Date) = '', NULL, STR_TO_DATE(p_From_Date, '%Y-%m-%d'));
    SET v_To_Date = IF(TRIM(p_To_Date) = '', NULL, STR_TO_DATE(p_To_Date, '%Y-%m-%d'));
    SET v_Student_Search = IF(TRIM(COALESCE(p_Student_Search, '')) = '', NULL, LOWER(TRIM(p_Student_Search)));
    SET v_Batch_Search = IF(TRIM(COALESCE(p_Batch_Search, '')) = '', NULL, LOWER(TRIM(p_Batch_Search)));
    SET v_Course_Search = IF(TRIM(COALESCE(p_Course_Search, '')) = '', NULL, LOWER(TRIM(p_Course_Search)));

    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
    SELECT COUNT(*) AS totalRecords
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN course AS c ON c.Course_ID = sc.Course_ID
    LEFT JOIN course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
    WHERE 
        st.Delete_Status = 0 AND
        (v_Student_Search IS NULL OR
            LOWER(CONCAT_WS(' ', st.First_Name, st.Last_Name)) LIKE CONCAT('%', v_Student_Search, '%') OR
            LOWER(COALESCE(st.Phone_Number, '')) LIKE CONCAT('%', v_Student_Search, '%')
        ) AND
        (v_Batch_Search IS NULL OR LOWER(COALESCE(cb.Batch_Name, '')) LIKE CONCAT('%', v_Batch_Search, '%')) AND
        (v_Course_Search IS NULL OR LOWER(COALESCE(c.Course_Name, '')) LIKE CONCAT('%', v_Course_Search, '%')) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) AND
        (v_From_Date IS NULL OR st.Entry_Date >= v_From_Date) AND
        (v_To_Date IS NULL OR st.Entry_Date <= v_To_Date);

    -- Paged result
    SELECT 
        st.Student_ID,
        st.First_Name,
        st.Last_Name,
        st.Email,
        st.Phone_Number,
        st.Country_Code,
        st.Branch_Id,
        st.Branch_Name,
        st.isActive,
        st.Delete_Status,
        st.Entry_Date,
        sc.Course_ID
    FROM student AS st
    LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN course AS c ON c.Course_ID = sc.Course_ID
    LEFT JOIN course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
    WHERE 
        st.Delete_Status = 0 AND
        (v_Student_Search IS NULL OR
            LOWER(CONCAT_WS(' ', st.First_Name, st.Last_Name)) LIKE CONCAT('%', v_Student_Search, '%') OR
            LOWER(COALESCE(st.Phone_Number, '')) LIKE CONCAT('%', v_Student_Search, '%')
        ) AND
        (v_Batch_Search IS NULL OR LOWER(COALESCE(cb.Batch_Name, '')) LIKE CONCAT('%', v_Batch_Search, '%')) AND
        (v_Course_Search IS NULL OR LOWER(COALESCE(c.Course_Name, '')) LIKE CONCAT('%', v_Course_Search, '%')) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive) AND
        (v_From_Date IS NULL OR st.Entry_Date >= v_From_Date) AND
        (v_To_Date IS NULL OR st.Entry_Date <= v_To_Date)
    ORDER BY st.Entry_Date DESC, st.Student_ID DESC
    LIMIT p_PageSize OFFSET v_Offset;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Report_StudentLiveClasses_By_BatchAndStudent`(
    IN p_Student_ID INT,
    IN p_Batch_ID INT,
    IN p_Course_ID INT,
    IN p_Start_Date varchar(50),
    IN p_End_Date varchar(50),
    IN p_PageNumber INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE offset_val INT;
    DECLARE query VARCHAR(4000);
    DECLARE count_query VARCHAR(4000);
    SET offset_val = (p_PageNumber - 1) * p_PageSize;
    
    -- Base query for data
    SET @query = "
        SELECT 
            s.Student_ID,
            CONCAT(s.First_Name, ' ', s.Last_Name) AS Student_Name,
            b.Batch_ID,
            b.Batch_Name,
            c.Course_ID,
            c.Course_Name,
            DATE_FORMAT(sl.Start_Time, '%d-%M-%Y %h:%i %p') as Start_Time,
            DATE_FORMAT(sl.End_Time, '%d-%M-%Y %h:%i %p') AS End_Time,
         CONCAT(
        FLOOR(Attendance_Duration / 3600), ' hr ',
        FLOOR((Attendance_Duration % 3600) / 60), ' min ',
        Attendance_Duration % 60, ' sec'
 
    ) AS Duration,
    
    CONCAT(
        FLOOR(Attendance_Duration / 3600), ' hr ',
        FLOOR((Attendance_Duration % 3600) / 60), ' min ',
        Attendance_Duration % 60, ' sec'
    ) AS formatted_duration,

            CONCAT(
                FLOOR(SUM(TIME_TO_SEC(TIMEDIFF(sl.End_Time, sl.Start_Time))) OVER () / 3600), ' hr ',
                ROUND(MOD(SUM(TIME_TO_SEC(TIMEDIFF(sl.End_Time, sl.Start_Time))) OVER (), 3600) / 60), ' min'
            ) AS Total_Duration
        FROM 
            student_live_class sl
            JOIN student s ON sl.Student_ID = s.Student_ID
            JOIN live_class lc ON sl.LiveClass_ID = lc.LiveClass_ID
            JOIN course_batch b ON lc.Batch_Id = b.Batch_ID
            JOIN course c ON lc.Course_ID = c.Course_ID
        WHERE 
            sl.Delete_Status = 0 ";

    -- Count query for total records
    SET @count_query = "
        SELECT COUNT(*) as total_count
        FROM 
            student_live_class sl
            JOIN student s ON sl.Student_ID = s.Student_ID
            JOIN live_class lc ON sl.LiveClass_ID = lc.LiveClass_ID
            JOIN course_batch b ON lc.Batch_Id = b.Batch_ID
            JOIN course c ON lc.Course_ID = c.Course_ID
        WHERE 
            sl.Delete_Status = 0 ";

    -- Add filters to both queries
    IF p_Student_ID IS NOT NULL AND p_Student_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND s.Student_ID = ', p_Student_ID);
        SET @count_query = CONCAT(@count_query, ' AND s.Student_ID = ', p_Student_ID);
    END IF;

    IF p_Batch_ID IS NOT NULL AND p_Batch_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Batch_Id = ', p_Batch_ID);
        SET @count_query = CONCAT(@count_query, ' AND lc.Batch_Id = ', p_Batch_ID);
    END IF;

    IF p_Course_ID IS NOT NULL AND p_Course_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Course_ID = ', p_Course_ID);
        SET @count_query = CONCAT(@count_query, ' AND lc.Course_ID = ', p_Course_ID);
    END IF;

    IF p_Start_Date <> '' AND p_End_Date <> '' THEN
        SET @query = CONCAT(@query, ' AND DATE_FORMAT(lc.Start_Time, ''%Y-%m-%d'') >= ''', p_Start_Date, ''' AND DATE_FORMAT(lc.End_Time, ''%Y-%m-%d'') <= ''', p_End_Date, '''');
        SET @count_query = CONCAT(@count_query, ' AND DATE_FORMAT(lc.Start_Time, ''%Y-%m-%d'') >= ''', p_Start_Date, ''' AND DATE_FORMAT(lc.End_Time, ''%Y-%m-%d'') <= ''', p_End_Date, '''');
    END IF;

    -- Add pagination to the main query
    SET @query = CONCAT(@query, ' LIMIT ', p_PageSize, ' OFFSET ', offset_val);

    -- Execute count query
    PREPARE stmt_count FROM @count_query;
    EXECUTE stmt_count;
    DEALLOCATE PREPARE stmt_count;
    insert into data_log values (81,@query);

    -- Execute main query
    PREPARE stmt FROM @query;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Report_TeacherLiveClasses_By_BatchAndTeacher`(
    IN p_Teacher_ID INT,
    IN p_Batch_ID INT,
    IN p_Course_ID INT,
    IN p_Start_Date VARCHAR(50),
    IN p_End_Date VARCHAR(50),
    IN p_PageNumber INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE offset_val INT;
    SET offset_val = (p_PageNumber - 1) * p_PageSize;

    -- Base query for teacher attendance report
    SET @query = "
        SELECT 
            u.User_ID AS Teacher_ID,
            CONCAT(u.First_Name, ' ', u.Last_Name) AS Teacher_Name,
            b.Batch_ID,
            b.Batch_Name,
            c.Course_ID,
            c.Course_Name,
            DATE_FORMAT(lc.Start_Time, '%d-%M-%Y %h:%i %p') AS Start_Time,
            DATE_FORMAT(lc.End_Time, '%d-%M-%Y %h:%i %p') AS End_Time,
            CONCAT(
                FLOOR(lc.Duration / 3600), ' hr ',
                FLOOR((lc.Duration % 3600) / 60), ' min ',
                lc.Duration % 60, ' sec'
            ) AS Duration
        FROM 
            live_class lc
            JOIN users u ON lc.Teacher_ID = u.User_ID
            JOIN course_batch b ON lc.Batch_Id = b.Batch_ID
            JOIN course c ON lc.Course_ID = c.Course_ID
        WHERE 
            lc.Delete_Status = 0 ";

    -- Count query for total records
    SET @count_query = "
        SELECT COUNT(*) as total_count
        FROM 
            live_class lc
            JOIN users u ON lc.Teacher_ID = u.User_ID
            JOIN course_batch b ON lc.Batch_Id = b.Batch_ID
            JOIN course c ON lc.Course_ID = c.Course_ID
        WHERE 
            lc.Delete_Status = 0 ";

    -- Add filters to both queries
    IF p_Teacher_ID IS NOT NULL AND p_Teacher_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Teacher_ID = ', p_Teacher_ID);
        SET @count_query = CONCAT(@count_query, ' AND lc.Teacher_ID = ', p_Teacher_ID);
    END IF;

    IF p_Batch_ID IS NOT NULL AND p_Batch_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Batch_Id = ', p_Batch_ID);
        SET @count_query = CONCAT(@count_query, ' AND lc.Batch_Id = ', p_Batch_ID);
    END IF;

    IF p_Course_ID IS NOT NULL AND p_Course_ID <> 0 THEN
        SET @query = CONCAT(@query, ' AND lc.Course_ID = ', p_Course_ID);
        SET @count_query = CONCAT(@count_query, ' AND lc.Course_ID = ', p_Course_ID);
    END IF;

    IF p_Start_Date <> '' AND p_End_Date <> '' THEN
        SET @query = CONCAT(@query, " AND DATE_FORMAT(lc.Start_Time, '%Y-%m-%d') >= '", p_Start_Date, "' 
                                 AND DATE_FORMAT(lc.End_Time, '%Y-%m-%d') <= '", p_End_Date, "'");
        SET @count_query = CONCAT(@count_query, " AND DATE_FORMAT(lc.Start_Time, '%Y-%m-%d') >= '", p_Start_Date, "' 
                                             AND DATE_FORMAT(lc.End_Time, '%Y-%m-%d') <= '", p_End_Date, "'");
    END IF;

    -- Add pagination to the main query
    SET @query = CONCAT(@query, ' LIMIT ', p_PageSize, ' OFFSET ', offset_val);
 #select @query;
    -- Execute count query
    PREPARE stmt_count FROM @count_query;
    EXECUTE stmt_count;
    DEALLOCATE PREPARE stmt_count;

    -- Execute main query
    PREPARE stmt FROM @query;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Sections_By_Course`(
    IN p_course_id INT
)
BEGIN
    SELECT 
        s.Section_ID,
        s.ExamType_ID,
        s.Section_Name,
        s.Delete_Status
    FROM course_section cs
    INNER JOIN section s ON cs.Section_ID = s.Section_ID
    WHERE cs.Course_ID = p_course_id
    ORDER BY s.Section_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Specific_Exam_Details`(IN examID INT)
BEGIN
    SELECT
        JSON_OBJECT(
              'examName', cc.Content_Name,
            'totalQuestions', e.Total_Questions,
            'Main_Question', e.Main_Question,
            'Exam_ID', e.Exam_ID,
            'file_name', e.file_name,
            'file_type', e.file_type,
           'Supporting_Document_Name', e.Supporting_Document_Name,
            'Supporting_Document_Path', e.Supporting_Document_Path,
			'Answer_Key_Name', e.Answer_Key_Name,
            'Answer_Key_Path', e.Answer_Key_Path,
            'passingScore', e.Passing_Score,
            'timeLimit', e.Time_Limit,
            'questions', (
                SELECT
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'Question_ID', q.Question_ID,
                            'Answer_Media_Name', q.Answer_Media_Name,
                            'questionText', q.Question_Text,
                            'answerOptions', q.Answer_Options,
                            'correctAnswer', q.Correct_Answer
                        )
                    )
                FROM
                    question q
                WHERE
                    q.Exam_ID = e.Exam_ID
                    AND q.Delete_Status = 0
            )
        ) AS examDetails
    FROM
        exam e
        JOIN
        course_content cc ON e.Exam_ID = cc.Exam_ID
    WHERE
        e.Exam_ID = examID
        AND e.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_student`( In student_Id_ Int, in is_Student tinyInt)
Begin 
 SELECT * From student where student_Id =student_Id_ and Delete_Status=false ;
 
    SELECT 
        sc.Course_ID,
        sc.Batch_ID,
      /*  CASE 
            WHEN sc.Expiry_Date IS NOT NULL AND CURDATE() > sc.Expiry_Date 
                 AND CURDATE() <= DATE_ADD(sc.Expiry_Date, INTERVAL 1 MONTH) THEN 1
            ELSE 0
        END AS Can_Access */
          CASE 
            WHEN  cb.End_Date  IS NOT NULL AND CURDATE() <  cb.End_Date 
                 AND CURDATE() <= DATE_ADD( cb.End_Date , INTERVAL 1 MONTH) THEN 1
            ELSE 0
        END AS Can_Access
        
    FROM 
        student_course sc
    JOIN 
        course c ON sc.Course_ID = c.Course_ID
	LEFT JOIN 
        course_batch cb ON cb.Batch_ID = sc.Batch_ID	
    WHERE 
        sc.Student_ID = student_Id_
        AND sc.Delete_Status = FALSE
        AND c.Delete_Status = FALSE;
       
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_StudentDocuments`(
  IN p_Student_ID INT
)
BEGIN
  SELECT 
    sd.Document_ID,
    sd.Student_ID,
    sd.Document_Type_Id,
    dt.Document_Type_Name,
    sd.Document_Name,
    sd.Document_URL,
    sd.S3_Key,
    sd.fileName,
    sd.Uploaded_At,
    sd.Updated_At
  FROM 
    student_documents sd
  LEFT JOIN 
    document_types dt ON sd.Document_Type_Id = dt.Document_Type_Id
  WHERE 
    sd.Student_ID = p_Student_ID AND sd.Delete_Status = 0
  ORDER BY 
    sd.Uploaded_At DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_ClassRecords`(
    IN p_CourseID INT,
    IN p_Batch_Id INT,
    IN p_StudentID INT,
    IN p_isStudent INT
)
BEGIN
    DECLARE p_BatchID INT;
    
    -- Determine BatchID based on isStudent flag
    IF p_isStudent = 1 THEN
        -- Get BatchID from student_course table for the given student
        SELECT Batch_ID INTO p_BatchID
        FROM student_course
        WHERE Student_ID = p_StudentID
        AND Course_ID = p_CourseID
        AND Delete_Status = 0
        LIMIT 1;
    ELSE
        -- Use provided Batch_Id directly
        SET p_BatchID = p_Batch_Id;
    END IF;
    
    -- Fetch all non-null Record_Class_Link entries ordered by date
    SELECT 
        lc.LiveClass_ID,
        c.Course_Name,
        c.Thumbnail_Path,
        lc.Scheduled_DateTime,
        lc.Record_Class_Link,
        lc.Start_Time
    FROM 
        live_class lc
        INNER JOIN course c ON c.Course_ID = lc.Course_ID 
    WHERE 
        lc.Batch_Id = p_BatchID
        AND lc.Course_ID = p_CourseID
        AND lc.Record_Class_Link IS NOT NULL
        AND lc.Record_Class_Link != ''
        AND lc.Delete_Status = 0
    ORDER BY 
		lc.Scheduled_DateTime DESC;    
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_student_current_followup`( In Student_Id_ Int)
Begin 
 SELECT
        *
From student
 where student.Student_Id =Student_Id_  ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_ExamDetails`( IN p_Student_ID varchar(50),IN p_Exam_ID INT)
BEGIN
      IF p_Student_ID <> '' THEN
        -- Fetch details for a specific student's exam attempt
        SELECT 
          
            q.Question_ID,
            q.Question_Text,
            q.Answer_Media_Name,
            q.Correct_Answer,
            sea.Submitted_Answer
        FROM 
            student_exam se
    
        JOIN 
            student_exam_answer sea ON se.StudentExam_ID = sea.StudentExam_ID
        JOIN 
            question q ON sea.Question_ID = q.Question_ID
        WHERE 
            se.Exam_ID = p_Exam_ID
            AND se.Student_ID = p_Student_ID
            AND se.Delete_Status = 0
      
            AND sea.Delete_Status = 0
            AND q.Delete_Status = 0;
    ELSE
        -- Fetch list of all students who took the exam
        SELECT 
            se.StudentExam_ID,
            se.Student_ID,
            s.First_Name,
            s.Last_Name,
            s.Email,
            s.Phone_Number,
            se.Score,
            se.Attempted_Date
        FROM 
            student_exam se
        inner JOIN 
            student s ON se.Student_ID = s.Student_ID
        WHERE 
            se.Exam_ID = p_Exam_ID
            AND se.Delete_Status = 0
            AND s.Delete_Status = 0;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_Exam_Results`(
    IN p_Student_ID INT,
    IN p_Course_ID INT
)
BEGIN
    SELECT 
       s.*,cc.Content_Name
    FROM 
        student_exam s
        left join course_content cc on cc.Exam_ID =s.Exam_ID
    WHERE 
        Student_ID = p_Student_ID AND s.Course_ID = p_Course_ID AND s.Delete_Status = 0; -- Assuming 0 means not deleted
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_student_fees_details`(
    IN Student_ID_ INT
)
BEGIN
    SELECT 
        r.Receipt_Id,
        r.Student_Id,

        s.First_Name,
        s.Last_Name,
        s.Email,
        s.Phone_Number,
        s.Country_Code,
        s.Branch_Name,
        s.Roll_No,
        s.Entry_Date AS Student_Entry_Date,
        s.Admission_Date,

        r.Amount,
        r.Fine_Amount, -- ✅ Added Fine_Amount
        DATE_FORMAT(r.Entry_Date, "%m-%d-%Y") AS Receipt_Entry_Date,
        r.User_Id,
        r.Branch,
        r.Payment_mode,
        r.Transaction_ID,
        r.Account_Name,
        ah.Account_id,
        r.Voucher_Number,
        r.Tax_Type_Id,
        r.Netvalue,
        r.Gstpers,
        r.Cgstpers,
        r.Sgstpers,
        r.Gst,
        r.Cgst,
        r.Sgst,
        r.Payment_Date,

        tp.Tax_Type_Name,

        -- ✅ Branch Info
        b.Branch_Name AS Branch_Detail_Name,
        b.Address1,
        b.Address2,
        b.Address3,
        b.Address4,
        b.Pincode,
        b.MobileNo,
        b.ContactNo,
        b.Email AS Branch_Email,
        b.Website,
        b.GstNo,

        -- ✅ Fee Details JSON
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'Student_Fees_ID', sd.Student_Fees_ID,
                    'Installment_information_ID', sd.Installment_information_ID,
                    'Course_ID', sd.Course_ID,
                    'Course_Name', sd.Course_Name,
                    'Total_Amount', sd.Total_Amount,
                    'Paid_Amount', sd.Paid_Amount,
                    'Fee_Status', sd.Fee_Status,
                    'Due_Date', DATE_FORMAT(sd.Due_Date, "%Y-%m-%d"),
                    'Installment_Index', sd.Installment_Index
                )
            )
            FROM student_fees_details sd
            WHERE sd.Student_ID = r.Student_ID 
              AND sd.Delete_Status = 0
        ) AS FeeDetails_JSON

    FROM receipts r
    INNER JOIN account_heads ah ON ah.Account_id = r.Account_id
    LEFT JOIN student s ON s.Student_ID = r.Student_ID
    LEFT JOIN tax_type tp ON tp.Tax_Type_Id = r.Tax_Type_Id
    LEFT JOIN branches b ON b.Branch_Id = s.Branch_Id

    WHERE 
        r.Student_ID = Student_ID_
        AND r.DeleteStatus = 0
        AND s.Delete_Status = 0

    ORDER BY r.Receipt_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_student_followup`()
BEGIN
    SELECT 
        Created_Date,
        Student_ID,
        Assigned_Staff_ID, 
        Assigned_Staff_Name,
        Created_By,
        Follow_Up_Status_Name,
        Remark
    FROM 
        student_followup;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_student_followup_history`(IN student_Id_ INT)
BEGIN SELECT sf.Follow_Up_ID, sf.Student_ID, sf.Branch_Id, sf.Branch_Name, sf.Department_Id, sf.Department_Name, sf.Assigned_Staff_ID, sf.Assigned_Staff_Name, sf.Follow_Up_Status_ID, sf.Follow_Up_Status_Name, sf.Next_Follow_Up_Date, sf.Remark, sf.Delete_Status, sf.Created_Date FROM student_followup sf WHERE sf.Student_ID = student_Id_ AND sf.Delete_Status = 0 ORDER BY sf.Created_Date DESC, sf.Follow_Up_ID DESC; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_List_By_Batch`(
    IN p_Batch_ID INT
)
BEGIN
    SELECT 
        sc.StudentCourse_ID, 
        sc.Student_ID, 
        s.First_Name, 
        s.Last_Name, 
        s.Email, 
        s.Phone_Number, 
        s.Social_Provider, 
        s.Social_ID, 
        s.Occupation_Id, 
        s.Profile_Photo_Path, 
        s.Profile_Photo_Name, 
        s.Avatar, 
        s.Last_Online,
        sc.Course_ID, 
        sc.IsStudentModuleLocked,
        CONCAT(u.First_Name, ' ', u.Last_Name) as TeacherName,
        u.User_ID as Teacher_ID,
        tts.Slot_Id,
        tts.start_time as TeacherSlotStartTime,
        tts.end_time as TeacherSlotEndTime
    FROM 
        student_course sc
    INNER JOIN 
        student s ON sc.Student_ID = s.Student_ID
    -- Modified LEFT JOINs to include Delete_Status in the join conditions
    LEFT JOIN teacher_time_slot tts ON tts.Slot_Id = sc.Slot_Id 
        AND tts.Delete_Status = 0 
        AND tts.batch_id IS NULL
    LEFT JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
        AND ct.Course_ID = sc.Course_ID 
        AND ct.Delete_Status = 0
    LEFT JOIN users u ON ct.Teacher_ID = u.User_ID 
        AND u.Delete_Status = 0
    WHERE 
        sc.Batch_ID = p_Batch_ID
        AND sc.Delete_Status = 0
        AND s.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_Status_Report`(
    IN p_from_date DATE,
    IN p_to_date DATE,
    IN p_logged_in_user_id INT
)
BEGIN
    /*
      Assumptions:
      - Students are assigned to users via `To_User_Id`
      - "Team under logged-in user" means:
          either students directly assigned to this user
          OR assigned to subordinates (user_details has a manager_id or similar)
      - For now, I will filter by To_User_Id = p_logged_in_user_id
        If you have a hierarchy table, you can extend it.
    */

    SELECT 
        s.Status_Name AS Status,
        s.To_User_Name AS User_Name,
        COUNT(*) AS Student_Count
    FROM student s
    WHERE s.Delete_Status = 0
      AND s.Entry_Date BETWEEN p_from_date AND p_to_date
      AND (s.To_User_Id = p_logged_in_user_id OR p_logged_in_user_id = 0) -- 0 means all users
    GROUP BY s.Status_Name, s.To_User_Name
    ORDER BY s.To_User_Name, s.Status_Name;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Student_TimeSlots_By_TeacherID`(IN p_teacher_ID INT)
BEGIN
   
  SELECT 
		s.First_Name,s.Last_Name,c.Course_ID,c.Course_Name,sc.StudentCourse_ID,
        tts.start_time,s.Profile_Photo_Path,
        tts.end_time,sc.Student_ID
        ,cb.Batch_Name
    FROM 
        teacher_time_slot tts
    INNER JOIN 
        course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN 
        student_course sc ON sc.Course_ID = ct.Course_ID AND sc.Slot_Id = tts.Slot_Id
    INNER JOIN 
        student s ON sc.Student_ID = s.Student_ID
    INNER JOIN 
        course c ON ct.Course_ID = c.Course_ID
   LEFT JOIN course_batch cb ON cb.Batch_ID = sc.Batch_ID AND cb.Delete_Status =false
    WHERE 
        ct.Teacher_ID = p_teacher_ID
        AND tts.Delete_Status = 0
        AND ct.Delete_Status = 0
        AND sc.Delete_Status = 0
        AND s.Delete_Status = 0
        AND c.Delete_Status = 0
        AND sc.Expiry_Date > CURDATE();
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Tax_Reports`(
    IN p_Student_Id INT,
    IN p_Branch INT,
    IN p_Account_Id INT,
    IN p_From_Date DATE,
    IN p_To_Date DATE,
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
    SELECT COUNT(*) AS totalRecords
    FROM receipts r
    WHERE 
        (r.DeleteStatus IS NULL OR r.DeleteStatus = 0) AND
        (p_Student_Id IS NULL OR p_Student_Id = 0 OR r.Student_Id = p_Student_Id) AND
        (p_Branch IS NULL OR p_Branch = 0 OR r.Branch = p_Branch) AND
        (p_Account_Id IS NULL OR p_Account_Id = 0 OR r.Account_Id = p_Account_Id) AND
        (p_From_Date IS NULL OR DATE(r.Payment_Date) >= p_From_Date) AND
        (p_To_Date IS NULL OR DATE(r.Payment_Date) <= p_To_Date);

    -- Paged result with Course_Name
    SELECT 
        r.Receipt_Id,
        r.Student_Id,
        s.Branch_Name,
        r.Amount,
        r.Entry_Date,
        r.User_Id,
        r.Branch,
        r.Account_Id,
        r.Payment_mode,
        r.Transaction_ID,
        r.Voucher_Number,
        r.Tax_Type_Id,
        r.Netvalue,
        r.Gstpers,
        r.Cgstpers,
        r.Sgstpers,
        r.Gst,
        r.Cgst,
        r.Sgst,
        r.Payment_Date,
        c.Course_Name
    FROM receipts r
     LEFT JOIN student s ON r.Student_Id = s.Student_Id  
    LEFT JOIN student_course sc ON r.Student_Id = sc.Student_Id
    LEFT JOIN course c ON sc.Course_ID = c.Course_ID
    WHERE 
        (r.DeleteStatus IS NULL OR r.DeleteStatus = 0) AND
        (p_Student_Id IS NULL OR p_Student_Id = 0 OR r.Student_Id = p_Student_Id) AND
        (p_Branch IS NULL OR p_Branch = 0 OR r.Branch = p_Branch) AND
        (p_Account_Id IS NULL OR p_Account_Id = 0 OR r.Account_Id = p_Account_Id) AND
        (p_From_Date IS NULL OR DATE(r.Payment_Date) >= p_From_Date) AND
        (p_To_Date IS NULL OR DATE(r.Payment_Date) <= p_To_Date)
    ORDER BY r.Payment_Date DESC
    LIMIT p_PageSize OFFSET v_Offset;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_teacherBatch_of_oneOnOne`(in id_ int)
BEGIN


/*
SELECT 
    sc.Batch_ID,
    c.Course_Name,
    cb.Batch_Name,
    COUNT(sc.Student_ID) AS Student_Count,
    CONCAT(
        SUBSTRING_INDEX(GROUP_CONCAT(s.First_Name SEPARATOR ', '), ', ', 3), 
        IF(COUNT(s.Student_ID) > 3, ', ...', '')
    ) AS Student_Names, -- Shows only the first 5 names followed by "..." if there are more
    MIN(sc.StudentCourse_ID) AS First_StudentCourse_ID,
    MIN(sc.Slot_Id) AS First_Slot_Id,
    GROUP_CONCAT(
        CONCAT(TIME_FORMAT(tts.start_time, '%H:%i'), ' - ', TIME_FORMAT(tts.end_time, '%H:%i'))
        ORDER BY tts.start_time SEPARATOR ', '
    ) AS batchTimings
FROM 
    teacher_time_slot tts
    JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    LEFT JOIN student_course sc ON sc.Slot_Id = tts.Slot_Id
    LEFT JOIN student s ON sc.Student_ID = s.Student_ID
    LEFT JOIN course_batch cb ON cb.Batch_ID = sc.Batch_ID
    LEFT JOIN course c on cb.Course_ID = c.Course_ID
    LEFT JOIN users u ON u.User_ID = ct.Teacher_ID
WHERE 
    u.User_ID = id_
    AND sc.Delete_Status = FALSE
    AND ct.Delete_Status = FALSE
    AND tts.Delete_Status = FALSE
    AND s.Delete_Status = FALSE
    AND (sc.Batch_ID = 0 OR cb.Delete_Status = FALSE)
GROUP BY 
    sc.Batch_ID, cb.Batch_Name
ORDER BY 
    sc.Batch_ID;
    
    */
SELECT DISTINCT
    ct.Course_ID,
    c.Course_Name,
    COALESCE(b.Batch_ID, sc.Batch_ID) AS Batch_IDs,
    GROUP_CONCAT(DISTINCT ct.CourseTeacher_ID) AS CourseTeacher_IDs,
    
    MAX(CASE
        WHEN b.Batch_ID IS NOT NULL THEN 1
        ELSE 0
    END) AS has_batch_wise,
    
    MAX(CASE
        WHEN sc.Batch_ID IS NOT NULL THEN 1
        ELSE 0
    END) AS has_slot_wise,
    
    COALESCE(b.Start_Date, cb.Start_Date) AS Batch_start_Date,
    COALESCE(b.End_Date, cb.End_Date) AS Batch_End_Date,
    COALESCE(b.Batch_Name, cb.Batch_Name) AS Batch_Names,
    GROUP_CONCAT(DISTINCT tts.Slot_Id) AS Slot_Ids,
    GROUP_CONCAT(
        DISTINCT CONCAT(
            TIME_FORMAT(tts.start_time, '%h:%i %p'), 
            '-', 
            TIME_FORMAT(tts.end_time, '%h:%i %p')
        )
        ORDER BY tts.start_time
    ) AS time_slots
FROM
    course_teacher ct
    INNER JOIN teacher_time_slot tts ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN course c ON ct.Course_ID = c.Course_ID
    LEFT JOIN course_batch b ON tts.Batch_ID = b.Batch_ID
    LEFT JOIN student_course sc ON sc.Slot_Id = tts.Slot_Id
    LEFT JOIN course_batch cb ON cb.Batch_ID = sc.Batch_ID
    LEFT JOIN student s ON s.Student_ID = sc.Student_ID
    LEFT JOIN users u ON u.User_ID = ct.Teacher_ID
WHERE
    u.User_ID = id_
    AND ct.Delete_Status = FALSE
    AND tts.Delete_Status = FALSE
    AND c.Delete_Status = FALSE
    AND (
        b.Batch_ID IS NULL
        OR b.Delete_Status = FALSE
        OR sc.Batch_ID IS NOT NULL
    )
    AND (
        sc.Expiry_Date > CURDATE()
        OR sc.Batch_ID IS NULL
    )
    AND (
        s.Delete_Status IS NULL
        OR s.Delete_Status = FALSE
        OR sc.Batch_ID IS NULL
    )
GROUP BY 
    ct.Course_ID, 
    c.Course_Name, 
    COALESCE(b.Batch_ID, sc.Batch_ID),
    COALESCE(b.Start_Date, cb.Start_Date),
    COALESCE(b.End_Date, cb.End_Date),
    COALESCE(b.Batch_Name, cb.Batch_Name)
ORDER BY 
    ct.Course_ID, 
    COALESCE(b.Batch_ID, sc.Batch_ID);

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_teachers`( In course_Id_ Int)
Begin 
 SELECT sc.StudentCourse_ID,sc.Student_ID,sc.Course_ID,s.First_Name,sc.Enrollment_Date,sc.Expiry_Date,sc.Price,sc.Payment_Date,sc.Payment_Status,
 sc.LastAccessed_Content_ID,sc.Transaction_Id,sc.Delete_Status,sc.Payment_Method
 From student_course sc JOIN student s ON sc.Student_ID = s.Student_ID where sc.Course_ID =course_Id_ and sc.Delete_Status=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Teachers_By_Course`( In CourseId_ INT)
Begin 
 
 SELECT
        u.User_ID,
        u.First_Name,
        u.Email,
        u.PhoneNumber
    FROM
        course_teacher ct
        JOIN users u ON ct.Teacher_ID = u.User_ID
    WHERE
        ct.Course_ID = CourseId_
        AND ct.Delete_Status = 0
        AND u.Delete_Status = 0;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Teacher_courses`(IN user_Id_ Int)
BEGIN 
SELECT 
    MIN(ct.CourseTeacher_ID) as CourseTeacher_ID, 
    ct.Course_ID,  
    c.Course_Name,
    c.Thumbnail_Path,
    GROUP_CONCAT(DISTINCT tts.Batch_ID) as Batch_IDs,
    GROUP_CONCAT(DISTINCT b.Batch_Name) as Batch_Names,
    GROUP_CONCAT(DISTINCT tts.Slot_Id) as Slot_Ids,
    GROUP_CONCAT(DISTINCT TIME_FORMAT(tts.start_time, '%h:%i %p')) AS start_times,
    GROUP_CONCAT(DISTINCT TIME_FORMAT(tts.end_time, '%h:%i %p')) AS end_times
FROM 
    course_teacher ct 
    INNER JOIN teacher_time_slot tts 
        ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN course c 
        ON ct.Course_ID = c.Course_ID
    LEFT JOIN course_batch b 
        ON tts.Batch_ID = b.Batch_ID
WHERE 
    ct.Teacher_ID = user_Id_
    AND ct.Delete_Status = FALSE 
    AND tts.Delete_Status = FALSE 
    AND c.Delete_Status = FALSE 
    AND (b.Batch_ID IS NULL OR b.Delete_Status = FALSE)
GROUP BY 
    ct.Course_ID, 
    c.Course_Name
ORDER BY 
    MIN(tts.start_time);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Teacher_courses_With_Batch`(IN user_Id_ INT)
BEGIN 
  SELECT 
    ct.CourseTeacher_ID, 
    ct.Course_ID,  
    c.Course_Name,
    tts.Batch_ID,
    b.Start_Date,
    b.End_Date,
    b.Batch_Name,
    tts.Slot_Id,
    TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
    TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time
FROM 
    course_teacher ct 
    INNER JOIN teacher_time_slot tts 
        ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN course c 
        ON ct.Course_ID = c.Course_ID
    LEFT JOIN course_batch b 
        ON tts.Batch_ID = b.Batch_ID
WHERE 
    ct.Teacher_ID = user_Id_
    AND ct.Delete_Status = FALSE 
    AND tts.Delete_Status = FALSE 
    AND c.Delete_Status = FALSE 
    AND (b.Batch_ID IS NULL OR b.Delete_Status = FALSE)
      ORDER BY tts.start_time;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Teacher_Students`(
    IN user_id_ INT,
    IN course_id_ INT -- New optional parameter
)
BEGIN 
    SELECT 
        sc.StudentCourse_ID,
        sc.Student_ID,
        sc.Course_ID,
        c.Course_Name,
        s.First_Name,
        s.Last_Name,
        sc.Enrollment_Date,
        sc.Expiry_Date,
        sc.Price,
        sc.Payment_Date,
        sc.Payment_Status,
        sc.LastAccessed_Content_ID,
        sc.Transaction_Id,
        sc.Delete_Status,
        sc.Payment_Method,
        cb.Batch_Name,
        tts.start_time,
        tts.end_time
    FROM 
        teacher_time_slot tts
    JOIN 
        course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    LEFT JOIN 
        student_course sc ON sc.Slot_Id = tts.Slot_Id
    LEFT JOIN 
        course c ON c.Course_ID = sc.Course_ID
    LEFT JOIN 
        course_batch cb ON cb.Batch_ID = sc.Batch_ID
    LEFT JOIN 
        student s ON sc.Student_ID = s.Student_ID
    LEFT JOIN 
        users u ON u.User_ID = ct.Teacher_ID
    WHERE 
        u.User_ID = user_id_
        AND sc.Expiry_Date > CURDATE()
        AND sc.Delete_Status = FALSE 
        AND s.Delete_Status = false 
        AND ct.Delete_Status = False 
        AND tts.Delete_Status = false
        AND (course_id_ = 0 OR sc.Course_ID = course_id_); -- Added course filter
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Teacher_Timing`(IN teacherId_ INT)
BEGIN
SELECT 
    ct.Course_ID,
    c.Course_Name,
    cb.Batch_Name,
    tts.batch_id,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'startTime', tts.start_time,
            'endTime', tts.end_time
        )
    ) AS timeSlots
FROM 
    course_teacher ct
INNER JOIN 
    course c ON ct.Course_ID = c.Course_ID
LEFT JOIN 
    teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
LEFT JOIN 
        course_batch cb ON tts.batch_id = cb.Batch_ID
WHERE 
    ct.Teacher_ID = teacherId_ 
    AND ct.Delete_Status = 0 AND c.Delete_Status=0 AND tts.Delete_Status=0 AND( cb.Delete_Status=0 OR cb.Delete_Status IS NULL) AND (cb.End_Date >= CURDATE() OR cb.End_Date IS NULL)
GROUP BY 
    ct.Course_ID, c.Course_Name, cb.Batch_Name, tts.batch_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_upcomming_installments`(
    IN p_Student_ID INT,
    IN p_Branch_Id INT,
    IN p_Course_ID INT,
    IN p_IsActive TINYINT,
    IN p_From_Date DATE,
    IN p_To_Date DATE,
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- ===== TOTAL COUNT AND SUMS =====
    SELECT 
        COUNT(*) AS totalRecords,
        IFNULL(SUM(fee.Remaining_Amount), 0) AS Outstanding_Amount,
        IFNULL(SUM(fee.Paid_Amount), 0) AS Total_Paid_Amount,
        IFNULL(SUM(fee.Total_Amount), 0) AS Total_Amount
    FROM student st
    LEFT JOIN student_course sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN (
        SELECT 
            Student_ID,
            Remaining_Amount,
            Paid_Amount,
            Total_Amount
        FROM (
            SELECT 
                sfd.Student_ID,
                sfd.Remaining_Amount,
                sfd.Paid_Amount,
                sfd.Total_Amount,
                ROW_NUMBER() OVER (PARTITION BY sfd.Student_ID ORDER BY sfd.Due_Date ASC) AS rn
            FROM student_fees_details sfd
            WHERE sfd.Delete_Status = 0 AND sfd.Remaining_Amount > 0
        ) t
        WHERE t.rn = 1
    ) AS fee ON fee.Student_ID = st.Student_ID
    WHERE 
        st.Delete_Status = 0 AND
        fee.Remaining_Amount IS NOT NULL AND
        (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
        (p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
        (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive);

    -- ===== PAGED UPCOMING INSTALLMENTS =====
    SELECT 
        st.Student_ID,
        st.First_Name,
        st.Last_Name,
        st.Email,
        st.Branch_Id,
        st.Branch_Name,
        st.isActive,
        st.Delete_Status,
        st.Entry_Date,
        st.Country_Code,
        st.Phone_Number,
        st.Profile_Photo_Path,
        st.Profile_Photo_Name,
        st.Status_Name,
        st.To_User_Name,
        st.Qualification,
        st.Follow_Up_Date,
        st.Remark,
        st.Is_Registered,
        st.Roll_No,
        st.Registered_On,
        cb.Batch_Name,
        st.Admission_Date,
        sc.Course_ID,
        fee.Next_Due_Date,
        fee.Remaining_Amount AS Upcoming_Amount
    FROM student st
    LEFT JOIN student_course sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN course_batch cb ON cb.Batch_ID = sc.Batch_ID
    LEFT JOIN (
        SELECT 
            Student_ID,
            Due_Date AS Next_Due_Date,
            Remaining_Amount
        FROM (
            SELECT 
                sfd.Student_ID,
                sfd.Due_Date,
                sfd.Remaining_Amount,
                ROW_NUMBER() OVER (PARTITION BY sfd.Student_ID ORDER BY sfd.Due_Date ASC) AS rn
            FROM student_fees_details sfd
            WHERE sfd.Delete_Status = 0 AND sfd.Remaining_Amount > 0
        ) upcoming
        WHERE upcoming.rn = 1
    ) AS fee ON fee.Student_ID = st.Student_ID
    WHERE 
        st.Delete_Status = 0 AND
        fee.Remaining_Amount IS NOT NULL AND
        (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
        (p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
        (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive)
    ORDER BY fee.Next_Due_Date
    LIMIT p_PageSize OFFSET v_Offset;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_upcomming_installments_old`(
    IN p_Student_ID INT,
    IN p_Branch_Id INT,
    IN p_Course_ID INT,
    IN p_IsActive TINYINT,
    IN p_From_Date DATE,
    IN p_To_Date DATE,
    IN p_Page INT,
    IN p_PageSize INT
)
BEGIN
    DECLARE v_Offset INT;
    SET v_Offset = (p_Page - 1) * p_PageSize;

    -- Total count result
   SELECT 
    COUNT(DISTINCT st.Student_ID) AS totalRecords,
    IFNULL(SUM(f.Remaining_Amount), 0) AS Outstanding_Amount,
    IFNULL(SUM(f.Paid_Amount), 0) AS Total_Paid_Amount,
    IFNULL(SUM(f.Total_Amount), 0) AS Total_Amount
FROM student AS st
LEFT JOIN student_course AS sc ON sc.Student_ID = st.Student_ID
LEFT JOIN (
    SELECT Student_ID, Remaining_Amount, Paid_Amount, Total_Amount
    FROM student_fees_details
    WHERE Delete_Status = 0 AND Remaining_Amount > 0
) f ON f.Student_ID = st.Student_ID
WHERE 
    st.Delete_Status = 0 AND
    (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
        (p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
        (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive);


    -- Paged result with upcoming unpaid installment
    SELECT 
        st.Student_ID,
        st.First_Name,
        st.Last_Name,
        st.Email,
        st.Branch_Id,
        st.Branch_Name,
        st.isActive,
        st.Delete_Status,
        st.Entry_Date,
        st.Country_Code,
        st.Phone_Number,
        st.Profile_Photo_Path,
        st.Profile_Photo_Name,
        st.Status_Name,
        st.To_User_Name,
        st.Qualification,
        st.Follow_Up_Date,
        st.Remark,
        st.Is_Registered,
        st.Roll_No,
        st.Registered_On,
        cb.Batch_Name,
        st.Admission_Date,
        sc.Course_ID,
        fee.Next_Due_Date,
        fee.Remaining_Amount AS Upcoming_Amount
    FROM 
        student AS st
    LEFT JOIN 
        student_course AS sc ON sc.Student_ID = st.Student_ID
    LEFT JOIN 
        course_batch AS cb ON cb.Batch_ID = sc.Batch_ID
    LEFT JOIN (
        SELECT 
            sfd.Student_ID,
            sfd.Due_Date AS Next_Due_Date,
            sfd.Remaining_Amount
        FROM (
            SELECT 
                sfd.*,
                ROW_NUMBER() OVER (PARTITION BY Student_ID ORDER BY Due_Date ASC) AS rn
            FROM student_fees_details sfd
            WHERE 
                sfd.Delete_Status = 0 
                AND sfd.Remaining_Amount > 0
        ) sfd
        WHERE sfd.rn = 1
    ) AS fee ON fee.Student_ID = st.Student_ID
    WHERE 
        st.Delete_Status = 0 AND
        fee.Remaining_Amount IS NOT NULL AND
        (p_Student_ID IS NULL OR p_Student_ID = 0 OR st.Student_ID = p_Student_ID) AND
        (p_Branch_Id IS NULL OR p_Branch_Id = 0 OR sc.Batch_ID = p_Branch_Id) AND
        (p_Course_ID IS NULL OR p_Course_ID = 0 OR sc.Course_ID = p_Course_ID) AND
        (p_IsActive IS NULL OR p_IsActive = 0 OR st.isActive = p_IsActive)
   ORDER BY fee.Next_Due_Date
    LIMIT p_PageSize OFFSET v_Offset;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_Upcomming_liveClass`(IN p_teacher_id INT)
BEGIN
    SELECT 
        tts.start_time,  tts.end_time,
        c.Course_Name,
        ct.Course_ID,ct.Teacher_ID,
        cb.Batch_Name,cb.batch_id, tts.CourseTeacher_ID,lc.Live_Link,tts.Slot_Id,lc.LiveClass_ID as onGoing_LiveClass_Id
    FROM 
        teacher_time_slot tts
    INNER JOIN 
        course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
    INNER JOIN 
        course c ON ct.Course_ID = c.Course_ID
    INNER JOIN 
        course_batch cb ON tts.batch_id = cb.Batch_ID
	LEFT JOIN 
		live_class lc on cb.batch_id = lc.Batch_Id and lc.Teacher_ID=p_teacher_id and lc.Course_ID=ct.Course_ID AND lc.Is_Finished=0  AND lc.Slot_Id =tts.Slot_Id
    WHERE 
        ct.Teacher_ID = p_Teacher_ID
        AND ct.Delete_Status = 0
        AND c.Delete_Status=0
        AND tts.Delete_Status = 0
        AND cb.Delete_Status = 0
		AND (cb.End_Date >= CURDATE() OR cb.End_Date IS NULL)
    ORDER BY 
        tts.start_time;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_User`(IN user_Id_ INT)
BEGIN
    SELECT * FROM users
    WHERE User_ID = user_Id_ AND Delete_Status = false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_UserList`()
BEGIN
    SELECT 
        u.User_ID,
        u.First_Name,
        u.Last_Name,
        u.Email,
        u.PhoneNumber,
        u.User_Active_Status,
        u.Profile_Photo_Path,
        u.Profile_Photo_Name,
        u.Branch_Id,
        ur.User_Role_Name,
        ut.User_Type_Name
    FROM 
        users u
    LEFT JOIN 
        user_role ur ON u.User_Role_Id = ur.User_Role_Id
    LEFT JOIN 
        user_type ut ON u.User_Type_Id = ut.User_Type_Id
    WHERE 
        u.Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_User_Cart`(IN user_id INT)
BEGIN
  SELECT c.id, c.created_at, c.updated_at, ci.course_id, ci.quantity,
         cr.Course_Name, cr.Price
  FROM carts c
  LEFT JOIN cart_items ci ON c.id = ci.cart_id
  LEFT JOIN course cr ON ci.course_id = cr.Course_ID
  WHERE c.user_id = user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_User_Email_Number`( IN p_user_ID int)
BEGIN
select Email,PhoneNumber from users  where User_ID = p_user_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Get_user_Menus`(IN User_Id_ INT)
BEGIN
  SELECT 
    m.Menu_ID,
    m.Menu_Name,
    m.Route,
    m.Parent_Menu_ID,
    m.Delete_Status,
    coalesce(ums.IsView,0) as IsView,
    coalesce(ums.IsSave,0) as IsSave,
    coalesce(ums.IsEdit,0) as IsEdit,
   coalesce(ums.IsDelete,0) as IsDelete
  FROM menu m
  inner JOIN user_menu_selection ums 
    ON ums.Menu_ID = m.Menu_ID AND ums.User_Id = User_Id_
  WHERE m.Delete_Status = FALSE and IsView=1 order by Menu_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `gstalltaxtypes`()
BEGIN
    SELECT 
         Tax_Type_Id,Tax_Type_Name from tax_type where DeleteStatus =0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `insert_chat_message`(
    IN in_teacherId INT,
    IN in_studentId INT,
    IN in_message TEXT,
    In Is_Student_Sent_ TinyINT,
    In File_Path_ varchar(150),
     IN in_fileSize INT,
     IN in_thumbUrl  varchar(150)
    
)
BEGIN
    INSERT INTO student_teacher_chat (teacher_id, student_id, message,Is_Student_Sent,File_Path,fileSize,thumbUrl)
    VALUES (in_teacherId, in_studentId, in_message,Is_Student_Sent_,File_Path_,in_fileSize,in_thumbUrl);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `insert_hod_chat_message`(
    IN user_id_ INT,
    IN student_id_ INT,
    IN in_course_id INT,
    IN in_message TEXT,
    IN Is_Student_Sent_ TINYINT,
    IN in_file_path VARCHAR(150),
	IN in_fileSize INT,
     IN in_thumbUrl  varchar(150)
)
BEGIN
    INSERT INTO student_hod_chat (
        user_id, 
        student_id, 
        course_id, 
        message, 
        Is_Student_Sent, 
        File_Path,
        fileSize,
        thumbUrl
    )
    VALUES (
        user_id_, 
        student_id_, 
        in_course_id, 
        in_message, 
        Is_Student_Sent_, 
        in_file_path,
        in_fileSize,
        in_thumbUrl
    );
    
    SELECT LAST_INSERT_ID() AS message_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Insert_Login_User`(
    IN p_User_Id INT,
    IN p_Is_Student TINYINT,
    IN p_User_Type_Id INT,
    IN p_JWT_Token VARCHAR(500)
)
BEGIN
    DECLARE v_Login_Time VARCHAR(45);
    DECLARE v_Existing_Login_ID INT;

    -- Get current timestamp
    SET v_Login_Time = NOW();

    -- Check if the combination of User_Id and Is_Student already exists
    SELECT Login_ID 
    INTO v_Existing_Login_ID 
    FROM login_users 
    WHERE User_Id = p_User_Id 
      AND Is_Student = p_Is_Student limit 1;

    -- If the record exists, update it; otherwise, insert a new record
    IF v_Existing_Login_ID IS NOT NULL THEN
        -- Record exists, so update it
        UPDATE login_users
        SET 
            User_Type_Id = p_User_Type_Id,
            Login_Time = v_Login_Time,
            JWT_Token = p_JWT_Token
        WHERE 
            Login_ID = v_Existing_Login_ID;
    ELSE
        -- Record does not exist, so insert a new one
        INSERT INTO login_users (
            User_Id,
            Is_Student,
            User_Type_Id,
            Login_Time,
            JWT_Token
        ) VALUES (
            p_User_Id,
            p_Is_Student,
            p_User_Type_Id,
            v_Login_Time,
            p_JWT_Token
        );
        
        -- Get the last inserted Login_ID
        SET v_Existing_Login_ID = LAST_INSERT_ID();
    END IF;
    
    
 IF p_Is_Student = 1 THEN
        UPDATE student
        SET Last_Online = NOW()
        WHERE Student_ID = p_User_Id;
    END IF;
    
    
    
    -- Return the Login_ID
    SELECT v_Existing_Login_ID AS Login_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Insert_Student_Exam_Result`(
    IN p_StudentExam_ID INT,
    IN p_Exam_ID INT,
    IN p_Batch_Id INT,
    IN p_Course_Id INT,
    IN p_Student_ID INT,
    IN p_Listening VARCHAR(45),
    IN p_Reading VARCHAR(45),
    IN p_Writing VARCHAR(45),
    IN p_Speaking VARCHAR(45),
    IN p_Overall_Score VARCHAR(45),
    IN p_CEFR_level VARCHAR(45),
    IN p_Result_Date VARCHAR(45),
	IN p_Exam_Name VARCHAR(145)
)
BEGIN
    IF p_StudentExam_ID > 0 THEN
        -- Edit existing record
        UPDATE student_exam
        SET 
            Exam_ID = p_Exam_ID,
            Student_ID = p_Student_ID,
            Course_Id = p_Course_Id,
            Batch_Id = p_Batch_Id,
            Listening = p_Listening,
            Reading = p_Reading,
            Writing = p_Writing,
            Speaking = p_Speaking,
            Overall_Score = p_Overall_Score,
            CEFR_level = p_CEFR_level,
            Result_Date = p_Result_Date,
             Exam_Name   = p_Exam_Name
        WHERE StudentExam_ID = p_StudentExam_ID;
        
        IF ROW_COUNT() = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No exam result found with the given StudentExam_ID';
        ELSE
            SELECT p_StudentExam_ID AS StudentExam_ID;
        END IF;
    ELSE
        -- Insert new record
        INSERT INTO student_exam (
            Exam_ID,
            Student_ID,
            Course_Id,
            Batch_Id,
            Listening,
            Reading,
            Writing,
            Speaking,
            Overall_Score,
            CEFR_level,
            Delete_Status,
            Result_Date,
            Exam_Name
        )
        VALUES (
            p_Exam_ID,
            p_Student_ID,
            p_Course_Id,
            p_Batch_Id,
            p_Listening,
            p_Reading,
            p_Writing,
            p_Speaking,
            p_Overall_Score,
            p_CEFR_level,
            0,
            p_Result_Date,
            p_Exam_Name
        );
        
        SELECT LAST_INSERT_ID() AS StudentExam_ID;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Login_Check`(
                    IN username_ VARCHAR(100),
                    IN Password_ VARCHAR(50),
                    IN Device_ID_ LONGTEXT
                )
BEGIN
                    DECLARE User_Id_ INT;
                    DECLARE User_Type_Id_ INT;

                    -- Update Device_ID for the user (matching First_Name, Full Name, or Email)
                    UPDATE users 
                    SET Device_ID = Device_ID_
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    LIMIT 1;
                    
                    -- Get User_ID for the authenticated user
                    SELECT User_ID, User_Type_Id INTO User_Id_, User_Type_Id_
                    FROM users
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    ORDER BY 
                        CASE 
                            WHEN LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_)) THEN 1
                            WHEN LOWER(TRIM(First_Name)) = LOWER(TRIM(username_)) THEN 2
                            ELSE 3
                        END,
                        User_ID DESC
                    LIMIT 1;
                    
                    -- If user exists (User_Id_ is not NULL), proceed with live_class updates
                    IF User_Type_Id_ = 2
                    THEN
                        UPDATE live_class
                        SET End_Time = Start_Time, Is_Finished = 1
                        WHERE Is_Finished = 0 AND Teacher_ID = User_Id_;
                        
                        UPDATE call_history
                        SET call_end = call_start, Is_Finished = 1
                        WHERE Is_Finished = 0 AND teacher_id = User_Id_ AND Is_Student_Called = 0;
                        
                        UPDATE student_live_class 
                        SET 
                            End_Time = (
                                SELECT Start_Time  
                                FROM live_class 
                                WHERE live_class.LiveClass_ID = student_live_class.LiveClass_ID
                            )
                        WHERE 
                            LiveClass_ID IN (
                                SELECT LiveClass_ID 
                                FROM live_class 
                                WHERE Is_Finished = 1
                            );
                    END IF;
                    
                    -- Return the user details after login
                    SELECT User_ID AS Id, First_Name, Email, PhoneNumber, User_Type_Id
                    FROM users
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    ORDER BY 
                        CASE 
                            WHEN LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_)) THEN 1
                            WHEN LOWER(TRIM(First_Name)) = LOWER(TRIM(username_)) THEN 2
                            ELSE 3
                        END,
                        User_ID DESC
                    LIMIT 1;

                END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `mark_as_read`(
   IN p_user_id INT,
   IN p_student_id INT,
   IN p_isStudent TINYINT,
   IN p_chat_type VARCHAR(20)
)
BEGIN
   IF p_chat_type = 'teacher_student' THEN
       UPDATE student_teacher_chat 
       SET is_read = 1 
       WHERE teacher_id = p_user_id
         AND student_id =p_student_id
         AND Is_Student_Sent = IF(p_isStudent = 1, 0, 1)
         AND is_read = 0;
   ELSE
       UPDATE student_hod_chat 
       SET is_read = 1 
        WHERE user_id = p_user_id
         AND student_id =p_student_id
         AND Is_Student_Sent = IF(p_isStudent = 1, 0, 1)
         AND is_read = 0;
   END IF;
   
   SELECT ROW_COUNT() AS updated_count;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Register_User_Request`(
    IN p_First_Name VARCHAR(50),
    IN p_Last_Name VARCHAR(100),
    IN p_Email VARCHAR(100),
    IN p_PhoneNumber VARCHAR(50),
    IN p_Password VARCHAR(255),
    IN p_Profile_Photo_Path VARCHAR(145),
    IN p_Profile_Photo_Name VARCHAR(145)
)
BEGIN
    INSERT INTO user_request (
        First_Name,
        Last_Name,
        Email,
        PhoneNumber,
        Password,
        Profile_Photo_Path,
        Profile_Photo_Name,
        Delete_Status,
        Created_At,
        Updated_At
    )
    VALUES (
        p_First_Name,
        p_Last_Name,
        p_Email,
        p_PhoneNumber,
        p_Password,
        p_Profile_Photo_Path,
        p_Profile_Photo_Name,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    
    -- Return the inserted record
    SELECT * FROM user_request 
    WHERE user_Request_ID = LAST_INSERT_ID();
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Registration_Using_Student_Branch`(
    IN p_Student_Id INT,
    IN p_IsRegistered BOOLEAN,
    IN p_User_ID INT
)
BEGIN
    DECLARE v_Branch_Id INT;
    DECLARE v_Roll_No VARCHAR(500);
    DECLARE v_Roll_No_Character VARCHAR(50);
    DECLARE Registration_No_ INT;
    DECLARE Registered_By_Name_ VARCHAR(500);    
    SELECT Branch_Id, First_Name INTO v_Branch_Id, Registered_By_Name_ FROM users WHERE User_ID = p_User_ID;
    
    -- Step 2: Check if already registered
    IF p_IsRegistered = 0 THEN
        -- We are registering the user, check if roll number exists
        SELECT Roll_No INTO v_Roll_No FROM student WHERE Student_ID = p_Student_Id;

        IF v_Roll_No IS NULL OR v_Roll_No = '' THEN
            SELECT COALESCE(MAX(CAST(Roll_No AS UNSIGNED)), 0) + 1 INTO Registration_No_ FROM student WHERE Roll_No REGEXP '^[0-9]+$';
            SET v_Roll_No = CAST(Registration_No_ AS CHAR);
        ELSE
            SET Registration_No_ = IF(v_Roll_No REGEXP '^[0-9]+$', CAST(v_Roll_No AS UNSIGNED), NULL);
        END IF;

        IF v_Roll_No IS NOT NULL AND v_Roll_No REGEXP '^[0-9]+$' THEN
            SET v_Roll_No_Character = CONCAT('TEP-', LPAD(v_Roll_No, 2, '0'));
        ELSE
            SET v_Roll_No_Character = v_Roll_No;
        END IF;
        
        -- Update student
        UPDATE student 
        SET Roll_No = v_Roll_No,
            Roll_No_Character = v_Roll_No_Character,
            Registration_No = Registration_No_,
            Is_Registered = 1,
            Registered_By = p_User_ID,
            Registered_Branch_Id = v_Branch_Id,
            Registered_By_Name = Registered_By_Name_,
            Registered_On = NOW() 
        WHERE Student_ID = p_Student_Id;
    ELSE
        -- Unregister
        UPDATE student 
        SET Is_Registered = 0 
        WHERE Student_ID = p_Student_Id;
    END IF;

    -- Step 4: Return result
    SELECT IF(p_IsRegistered, 'Unregistered', 'Registered') AS Status, v_Roll_No AS RollNumber;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Remove_Course_FromCart`(IN user_id_ INT, IN course_id_ INT)
BEGIN
  DECLARE cart_id_ INT;

  -- Select the cart_id for the specified user_id
  SELECT id INTO cart_id_
  FROM carts
  WHERE user_id = user_id_
  LIMIT 1;  -- Limit the result to one row

  -- Check if a cart_id was found
  IF cart_id_ IS NOT NULL THEN
    -- Delete the course from the cart_items table
    DELETE FROM cart_items
    WHERE cart_id = cart_id_ AND course_id = course_id_;
  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Remove_Student_Registration`(
    IN p_Student_Id INT,
    IN p_IsRegistered BOOLEAN,
    IN p_User_ID INT
)
BEGIN
    DECLARE v_Branch_Id INT;
    DECLARE v_Roll_No VARCHAR(500);
	declare Registration_No_ int;
    declare Registered_By_Name_ varchar(500);    
	SELECT Branch_Id,First_Name INTO v_Branch_Id,Registered_By_Name_ FROM users WHERE User_ID = p_User_ID;
    -- Step 2: Check if already registered
	--   set Registration_No_ = (SELECT  COALESCE( MAX(Roll_No ),0)+1 FROM Student where Branch_Id = v_Branch_Id);
       set Registration_No_ = (SELECT  COALESCE( MAX(Roll_No ),0)+1 FROM Student);
	   SET v_Roll_No = Registration_No_;
    -- Step 3: Process based on registration state
	/*	if(p_IsRegistered=0)
  then 
       update student set Roll_No=v_Roll_No,Registration_No=Registration_No_,Is_Registered=1,Registered_By=p_User_ID,Registered_Branch_Id=v_Branch_Id,Registered_By_Name=Registered_By_Name_,Registered_On=now() where Student_ID=p_Student_Id;
		else
		   update student set Is_Registered= 0 where Student_ID=p_Student_Id;
		end if; */
    -- Step 4: Return result
      update student set Is_Registered= p_IsRegistered ,Roll_No=null  where Student_ID=p_Student_Id;
		SELECT IF(p_IsRegistered, 'Unregistered', 'Registered') AS Status, v_Roll_No AS RollNumber;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Report_User`(
    IN p_reporter_id INT,
    IN p_reported_user_id INT,
    IN p_chat_id varchar(50),
    IN p_report_reason TEXT
)
BEGIN
    INSERT INTO reports (reporter_id, reported_user_id, chat_id, report_reason, status, timestamp)
    VALUES (p_reporter_id, p_reported_user_id, p_chat_id, p_report_reason, 'Pending', NOW());
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Review_Course`(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_rating INT,
    IN p_comments TEXT, 
    IN p_review_id INT,
	IN p_delete_status INT

)
BEGIN
    DECLARE is_enrolled INT;
    DECLARE has_reviewed INT;

    -- Check if the student is enrolled in the course
    SELECT COUNT(*) INTO is_enrolled
    FROM student_course 
    WHERE Student_ID = p_student_id AND Course_ID = p_course_id;

 #   IF is_enrolled > 0 THEN
        -- Check if the student has already reviewed the course
        SELECT COUNT(*) INTO has_reviewed
        FROM course_reviews
        WHERE Student_ID = p_student_id AND Course_ID = p_course_id;

        IF p_review_id > 0 THEN
            -- Check if the review exists
         #   IF has_reviewed > 0 THEN
                -- Update the existing review
                UPDATE course_reviews
                SET Rating = p_rating,
                    Comments = p_comments,
                 Delete_Status=p_delete_status
                WHERE Review_ID = p_review_id;
                
                SELECT 'Review updated successfully' AS message,p_review_id,p_student_id;
        #    ELSE
        #        SELECT 'Error: Review does not exist' AS message;
        #    END IF;
        ELSE
         #   IF has_reviewed = 0 THEN 
                -- Insert the review into the course_reviews table
                INSERT INTO course_reviews (Student_ID, Course_ID, Rating, Comments, Created_At)
                VALUES (p_student_id, p_course_id, p_rating, p_comments, CURRENT_TIMESTAMP);
                
                SELECT 'Review added successfully' AS message,p_review_id,p_student_id;
        #    ELSE
          #      SELECT 'Error: Student has already reviewed this course' AS message;
         #   END IF;
        END IF;
    #ELSE
    #    SELECT 'Error: Student is not enrolled in the course' AS message;
  #  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `saveCourseFees`(
   IN p_installment_information_id INT,
    IN p_fee_type VARCHAR(50),
    IN p_duration INT,
    IN p_course_name VARCHAR(255),
    IN p_amount DECIMAL(10,2),
    IN p_course_id INT,
    IN p_Batch_ID INT,
    IN p_Batch_Name VARCHAR(255)
)
BEGIN
    IF p_installment_information_id = 0 THEN
        INSERT INTO installment_information (
            Fee_Type,
            Duration,
            Amount,
            Course_ID,
            Course_Name,
            Batch_ID,
            Batch_Name
        ) VALUES (
            p_fee_type,
            p_duration,
            p_amount,
            p_course_id,
            p_course_name,
            p_Batch_ID,
            p_Batch_Name
        );
    ELSE
        UPDATE installment_information
        SET
            Fee_Type = p_fee_type,
            Duration = p_duration,
            Amount = p_amount,
            Course_ID = p_course_id,
            Course_Name = p_course_name,
             Batch_ID=p_Batch_ID,
             Batch_Name=p_Batch_Name
        WHERE Installment_information_ID = p_installment_information_id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_AppInfo`(
    p_user_id INT,
    p_device_id VARCHAR(255),
    p_app_version VARCHAR(50),
    p_model_name VARCHAR(100),
    p_os_version VARCHAR(50),
    p_sdk_int INT,
    p_manufacturer VARCHAR(100),
    p_is_battery_optimized TINYINT,
    p_isStudent TINYINT,
	p_devicePushTokenVoip VARCHAR(150)

)
BEGIN
    IF EXISTS (SELECT 1 FROM appinfo WHERE user_id = p_user_id) THEN
        UPDATE appinfo
        SET device_id = p_device_id,
            app_version = p_app_version,
            model_name = p_model_name,
            os_version = p_os_version,
            sdk_int = p_sdk_int,
            manufacturer = p_manufacturer,
            is_battery_optimized = p_is_battery_optimized,
            updated_at = CURRENT_TIMESTAMP,
            isStudent=p_isStudent,
            devicePushTokenVoip = p_devicePushTokenVoip
        WHERE user_id = p_user_id;
    ELSE
        INSERT INTO appinfo (
            user_id, 
            device_id, 
            app_version, 
            model_name, 
            os_version, 
            sdk_int, 
            manufacturer, 
            is_battery_optimized,
            isStudent,
            devicePushTokenVoip
        )
        VALUES (
            p_user_id, 
            p_device_id, 
            p_app_version, 
            p_model_name, 
            p_os_version, 
            p_sdk_int, 
            p_manufacturer, 
            p_is_battery_optimized,
            p_isStudent,
            p_devicePushTokenVoip
        );
    END IF;

    SELECT * FROM appinfo WHERE user_id = p_user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Attendance`(
    IN p_attendance_json JSON,
    IN p_marked_by INT
)
BEGIN
    DECLARE v_course_id INT;
    DECLARE v_batch_id INT;
    DECLARE v_course_name VARCHAR(255);
    DECLARE v_batch_name VARCHAR(255);
    DECLARE v_attendance_date DATE;
    DECLARE v_attendance_id INT;
    DECLARE v_marked_by_name VARCHAR(255);
    
    DECLARE i INT DEFAULT 0;
    DECLARE n INT;
    
    SET n = JSON_LENGTH(p_attendance_json);
    
    IF n > 0 THEN
        -- Extract session details from the first record
        SET v_course_id = JSON_EXTRACT(p_attendance_json, '$[0].Course_ID');
        SET v_batch_id = JSON_EXTRACT(p_attendance_json, '$[0].Batch_ID');
        SET v_course_name = JSON_UNQUOTE(JSON_EXTRACT(p_attendance_json, '$[0].Course_Name'));
        SET v_batch_name = JSON_UNQUOTE(JSON_EXTRACT(p_attendance_json, '$[0].Batch_Name'));
        SET v_attendance_date = JSON_UNQUOTE(JSON_EXTRACT(p_attendance_json, '$[0].Attendance_Date'));
        
        -- Fallback to look up course and batch names if they weren't in the JSON
        IF v_course_name IS NULL OR v_course_name = 'null' THEN
            SELECT Course_Name INTO v_course_name FROM course WHERE Course_ID = v_course_id LIMIT 1;
        END IF;
        IF v_batch_name IS NULL OR v_batch_name = 'null' THEN
            SELECT Batch_Name INTO v_batch_name FROM course_batch WHERE Batch_ID = v_batch_id LIMIT 1;
        END IF;
        
        -- Look up the staff name
        SELECT CONCAT(IFNULL(First_Name, ''), ' ', IFNULL(Last_Name, '')) INTO v_marked_by_name 
        FROM users WHERE User_ID = p_marked_by LIMIT 1;
        
        -- Insert or Update Master Table
        INSERT INTO attendance_master (Course_ID, Course_Name, Batch_ID, Batch_Name, Attendance_Date, Marked_By, Marked_By_Name)
        VALUES (v_course_id, v_course_name, v_batch_id, v_batch_name, v_attendance_date, p_marked_by, v_marked_by_name)
        ON DUPLICATE KEY UPDATE 
            Marked_By = p_marked_by,
            Marked_By_Name = v_marked_by_name,
            Course_Name = v_course_name,
            Batch_Name = v_batch_name;
        
        -- Get the Attendance_ID
        SELECT Attendance_ID INTO v_attendance_id 
        FROM attendance_master 
        WHERE Course_ID = v_course_id AND Batch_ID = v_batch_id AND Attendance_Date = v_attendance_date;
        
        -- Iterate and insert/update details
        WHILE i < n DO
            SET @student_id = JSON_EXTRACT(p_attendance_json, CONCAT('$[', i, '].Student_ID'));
            SET @status = JSON_EXTRACT(p_attendance_json, CONCAT('$[', i, '].Status'));
            
            SELECT CONCAT(IFNULL(First_Name, ''), ' ', IFNULL(Last_Name, '')) INTO @student_name 
            FROM student WHERE Student_ID = @student_id;

            INSERT INTO attendance_details (Attendance_ID, Student_ID, Student_Name, Status, Attendance_Date)
            VALUES (v_attendance_id, @student_id, @student_name, @status, v_attendance_date)
            ON DUPLICATE KEY UPDATE 
                Status = @status,
                Student_Name = @student_name,
                Attendance_Date = v_attendance_date;
            
            SET i = i + 1;
        END WHILE;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Batch`(IN Batch_Id_ INT, IN Course_ID_ INT, IN Batch_Name_ VARCHAR(100), IN scheduledTeachers JSON,
  IN Start_Date_ VARCHAR(65),
  IN End_Date_ VARCHAR(65))
BEGIN

    DECLARE TeacherInfo JSON;
    DECLARE TimeSlots JSON;
    DECLARE TeacherID_ INT;
    DECLARE CourseTeacher_ID_ INT;
	DECLARE ctDeleteStatus INT;
	DECLARE TsDeleteStatus INT;
	DECLARE slot_ID_ INT;
    
    DECLARE i INT DEFAULT 0;
    DECLARE j INT;
    DECLARE StartTime VARCHAR(250);
    DECLARE EndTime VARCHAR(250);
	DECLARE temp_start_time VARCHAR(20);
	DECLARE temp_end_time VARCHAR(20);
    insert into  data_log values(5,5);

    insert into  data_log values(1554,JSON_LENGTH(scheduledTeachers));
insert into  data_log values(96511,scheduledTeachers);
  IF Batch_Id_ > 0 THEN 
    UPDATE course_batch 
    SET Batch_Name = Batch_Name_, 
        Delete_Status = 0,
        Course_ID = Course_ID_,
        Start_Date = Start_Date_,
        End_Date = End_Date_
    WHERE Batch_ID = Batch_Id_;
    
    update student_course set Expiry_Date  = End_Date_ where  Batch_ID = Batch_Id_ and Delete_Status = 0;
  ELSE 
    INSERT INTO course_batch (Course_ID, Batch_Name, Delete_Status, Start_Date, End_Date) 
    VALUES (Course_ID_, Batch_Name_, 0, Start_Date_, End_Date_);
    SET Batch_Id_ = LAST_INSERT_ID();
  END IF;

   SET i = 0;



	WHILE i < JSON_LENGTH(scheduledTeachers) DO
    SET TeacherInfo = JSON_EXTRACT(scheduledTeachers, CONCAT('$[', i, ']'));
    SET TeacherID_ = JSON_EXTRACT(TeacherInfo, '$.Teacher_ID');
	SET ctDeleteStatus = JSON_EXTRACT(TeacherInfo, '$.Delete_Status');
	SET TimeSlots = JSON_EXTRACT(TeacherInfo, '$.timeSlots');
	SET CourseTeacher_ID_ = JSON_EXTRACT(TeacherInfo, '$.CourseTeacher_ID');
	IF ctDeleteStatus = 1 THEN
        update course_teacher set Delete_Status =1  WHERE CourseTeacher_ID = CourseTeacher_ID_;
		update  teacher_time_slot   set Delete_Status =1   where CourseTeacher_ID =CourseTeacher_ID_ ;
    ELSE
	   if CourseTeacher_ID_  > 0
				then
				update course_teacher set Teacher_ID=TeacherID_ ,Course_ID=Course_ID_ where CourseTeacher_ID=CourseTeacher_ID_;
 
		ELSE
				
			INSERT INTO course_teacher (Teacher_ID, Course_ID)
			VALUES (TeacherID_, Course_ID_);
			SET CourseTeacher_ID_ = LAST_INSERT_ID();
           END IF; 
	end if;
        SET j = 0;
        
        -- Loop through each time slot
        WHILE j < JSON_LENGTH(TimeSlots) DO
            SET temp_start_time = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].startTime')));
            SET temp_end_time = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].endTime')));
			SET slot_ID_ = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].Slot_Id')));
			SET TsDeleteStatus =  JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].Delete_Status')));
            
            	 SET StartTime = CASE 
									WHEN temp_start_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
									THEN TIME_FORMAT(STR_TO_DATE(temp_start_time, '%l:%i %p'), '%H:%i')
									ELSE TIME_FORMAT(TIME(temp_start_time), '%H:%i')
								END;

				SET EndTime = CASE 
									WHEN temp_end_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
									THEN TIME_FORMAT(STR_TO_DATE(temp_end_time, '%l:%i %p'), '%H:%i')
									ELSE TIME_FORMAT(TIME(temp_end_time), '%H:%i')
								END;
            
            
            -- Insert into teacher_time_slot table
           
            	IF TsDeleteStatus = 1 THEN
		
			update  teacher_time_slot   set Delete_Status =1   where Slot_Id =slot_ID_ ;
		ELSE
		   if slot_ID_  > 0
					then
					update teacher_time_slot set CourseTeacher_ID=CourseTeacher_ID_ ,start_time=StartTime,end_time=EndTime,batch_id=Batch_Id_ where  Slot_Id =slot_ID_;
	 
			ELSE
					
			INSERT INTO teacher_time_slot ( CourseTeacher_ID, start_time, end_time,batch_id)
            VALUES (CourseTeacher_ID_, StartTime, EndTime,Batch_Id_);
				SET slot_ID_ = LAST_INSERT_ID();
			   END IF; 
		end if;
            SET j = j + 1;
        END WHILE;
    SET i = i + 1;
	END WHILE;
    

    SELECT Batch_Id_ AS Batch_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Call_History`(
    in p_id INT,    
    IN p_Teacher_ID INT,
    IN p_Student_ID INT,
    IN p_Call_Start VARCHAR(50),
    IN p_Call_End VARCHAR(50),
    IN p_Call_Duration INT,
    IN p_Call_Type VARCHAR(20),
    IN p_IsstudentCalled TinyINT,
    IN p_Live_Link VARCHAR(50),
    IN p_is_call_rejected TINYINT
)
BEGIN
    DECLARE last_insert_id INT;
        if p_id >0 then
     /*   update call_history set   call_end = NOW(),   
        call_duration=p_Call_Duration,
        call_duration = CONCAT(
       FLOOR(TIMESTAMPDIFF(SECOND, call_start, NOW()) / 60), '.', 
        LPAD(MOD(TIMESTAMPDIFF(SECOND, call_start, NOW()), 60), 2, '0')),
        Is_Finished=1 ,Call_Rejected =p_is_call_rejected where id=p_id;*/
        
        
		UPDATE call_history 
		SET 
			call_end = NOW(), 
			call_duration=p_Call_Duration, 
			Call_Rejected = CASE 
				WHEN Call_Rejected IS NULL OR Call_Rejected = 0 THEN p_is_call_rejected
				ELSE Call_Rejected 
			END,
			Is_Finished = 1
		WHERE id = p_id;

        set last_insert_id = p_id;

else
/*
    IF p_IsstudentCalled=1 THEN 
            update call_history set Is_Finished=1 where student_id=p_Student_ID AND Is_Student_Called = 1 and Is_Finished =0;
    else
            update call_history set Is_Finished=1 where teacher_id=p_Teacher_ID AND Is_Student_Called = 0 and Is_Finished=0;
    END IF;
*/    
    INSERT INTO call_history (teacher_id, student_id, Call_Start, call_end,call_duration, call_type,Is_Student_Called,Live_Link)
    VALUES (p_Teacher_ID, p_Student_ID,  now() ,  now() ,0, p_Call_Type,p_IsstudentCalled,p_Live_Link);
    SELECT LAST_INSERT_ID() INTO last_insert_id;
end if ;
    SELECT last_insert_id AS id ,Is_Finished from  call_history where id= last_insert_id ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Campaign`(
                IN Campaign_ID_ INT,
                IN Campaign_Name_ VARCHAR(255),
                IN Campaign_Number_ VARCHAR(100),
                IN Lead_Source_Type_ VARCHAR(50),
                IN FB_Page_ID_ VARCHAR(100),
                IN FB_Page_AccessToken_ TEXT,
                IN FB_Form_ID_ VARCHAR(100),
                IN User_IDs_ JSON
            )
BEGIN
                DECLARE campaignId INT;
                DECLARE userIndex INT DEFAULT 0;
                DECLARE userCount INT;

                IF Campaign_ID_ > 0 THEN
                    UPDATE campaign
                    SET Campaign_Name = Campaign_Name_, 
                        Campaign_Number = Campaign_Number_,
                        Lead_Source_Type = Lead_Source_Type_,
                        FB_Page_ID = FB_Page_ID_,
                        FB_Page_AccessToken = FB_Page_AccessToken_,
                        FB_Form_ID = FB_Form_ID_
                    WHERE Campaign_ID = Campaign_ID_;
                    SET campaignId = Campaign_ID_;
                    
                    -- Remove existing users for this campaign
                    DELETE FROM campaign_user WHERE Campaign_ID = campaignId;
                ELSE
                    INSERT INTO campaign (Campaign_Name, Campaign_Number, Lead_Source_Type, FB_Page_ID, FB_Page_AccessToken, FB_Form_ID)
                    VALUES (Campaign_Name_, Campaign_Number_, Lead_Source_Type_, FB_Page_ID_, FB_Page_AccessToken_, FB_Form_ID_);
                    SET campaignId = LAST_INSERT_ID();
                END IF;

                -- Insert new users from JSON array
                SET userCount = JSON_LENGTH(User_IDs_);
                WHILE userIndex < userCount DO
                    INSERT INTO campaign_user (Campaign_ID, User_ID)
                    VALUES (campaignId, CAST(JSON_EXTRACT(User_IDs_, CONCAT('$[', userIndex, ']')) AS UNSIGNED));
                    SET userIndex = userIndex + 1;
                END WHILE;

                SELECT campaignId AS Campaign_ID;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`basil`@`localhost` PROCEDURE `Save_chatBot_message`( Student_ID_ int,Chat_Message_ text,IsReply_ tinyint, Chat_DateTime_ datetime, Delete_Status_ tinyint)
Begin 
 INSERT INTO chatbot_history(Student_ID ,Chat_Message ,IsReply, Chat_DateTime ,Delete_Status ) values 
 (Student_ID_ ,Chat_Message_ ,IsReply_, Chat_DateTime_ ,Delete_Status_ );
 select LAST_INSERT_ID();
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `save_course`(    IN CourseDetails JSON)
BEGIN
	/*course  */
    DECLARE CourseName VARCHAR(200);
    DECLARE CategoryID INT;
    DECLARE Validity INT;
    DECLARE Price DECIMAL(10,2);
    DECLARE LiveClassEnabled TINYINT;
    DECLARE SectionIDs JSON;
	DECLARE BatchDetails JSON;
	DECLARE TeacherDetails JSON;
	DECLARE TeacherInfo JSON;
	DECLARE TimeSlots JSON;
	DECLARE TsDeleteStatus INT;
	DECLARE ctDeleteStatus INT;
    DECLARE DisableStatus INT;
    
	DECLARE slot_ID_ INT;
    DECLARE CourseTeacher_ID_ INT;
	DECLARE Batch_ID_ INT;
	DECLARE TeacherID_ INT;
	DECLARE StartTime varchar(250);
	DECLARE EndTime varchar(250);
    DECLARE SectionID INT;
	DECLARE newCourseID INT;
	DECLARE newContentID INT;
	DECLARE Thumbnail_Path_ longtext;
    Declare Thumbnail_Name_ longtext;
	Declare Description_ longtext;
    Declare Things_To_Learn_ longtext;
	DECLARE i INT;
	DECLARE existing_course INT;
	DECLARE ThumbnailVideo_Name_ longtext;
    DECLARE ThumbnailVideo_Path_ longtext;
    
	DECLARE temp_start_time VARCHAR(20);
	DECLARE temp_end_time VARCHAR(20);
    DECLARE CreatedAt_ VARCHAR(50);
    
	DECLARE j INT;
    
#course  


    -- Extract values from JSON
    SET CourseName = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Course_Name'));
	SET Thumbnail_Name_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Thumbnail_Name'));
    SET Thumbnail_Path_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Thumbnail_Path'));
	SET ThumbnailVideo_Name_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.ThumbnailVideo_Name'));
    SET ThumbnailVideo_Path_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.ThumbnailVideo_Path'));
	SET Description_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Description'));
    SET CategoryID = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Category_ID'));
    SET Validity = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Validity'));
    SET Price = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Price'));
    SET LiveClassEnabled = IF(JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Live_Class_Enabled')) = 'true', 1, 0);
	/* SET BatchDetails = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.scheduledBatch')); */
    SET TeacherDetails = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.scheduledTeachers'));
    SET SectionIDs = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Sections'));
	SET	newCourseID=JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Course_ID'));
    SET	Things_To_Learn_=JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Things_To_Learn'));
    SET CreatedAt_ = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.created_at'));
    SET DisableStatus = JSON_UNQUOTE(JSON_EXTRACT(CourseDetails, '$.Disable_Status'));
    
    
    if newCourseID > 0
		then
        UPDATE course
		SET Course_Name = CourseName,
		Category_ID = CategoryID,
		Validity = Validity,
		Price = Price,Description=Description_,
		Live_Class_Enabled = LiveClassEnabled,Thumbnail_Path=Thumbnail_Path_,Thumbnail_Name=Thumbnail_Name_,Things_To_Learn=Things_To_Learn_,ThumbnailVideo_Path=ThumbnailVideo_Path_,ThumbnailVideo_Name=ThumbnailVideo_Name_,
		created_at = IF(CreatedAt_ IS NOT NULL AND CreatedAt_ <> '' AND CreatedAt_ <> 'null', STR_TO_DATE(CreatedAt_, '%Y-%m-%d'), created_at),
		Disable_Status = DisableStatus
		WHERE Course_ID = newCourseID;

        else
        SELECT COUNT(*) INTO existing_course
		FROM course
		WHERE Course_Name = CourseName and Delete_Status =0 ;
        IF existing_course = 0 THEN

			-- Insert into the course table
			INSERT INTO course (Course_Name, Category_ID, Validity, Price, Live_Class_Enabled,Thumbnail_Path,Thumbnail_Name,Description,Things_To_Learn,ThumbnailVideo_Path,ThumbnailVideo_Name, created_at, Disable_Status)
			VALUES (CourseName, CategoryID, Validity, Price, LiveClassEnabled,Thumbnail_Path_,Thumbnail_Name_,Description_,Things_To_Learn_,ThumbnailVideo_Path_,ThumbnailVideo_Name_,
				IF(CreatedAt_ IS NOT NULL AND CreatedAt_ <> '' AND CreatedAt_ <> 'null', STR_TO_DATE(CreatedAt_, '%Y-%m-%d'), CURRENT_TIMESTAMP), DisableStatus);
              -- Get the last inserted course ID
			SET newCourseID = LAST_INSERT_ID();
		ELSE
			-- If the course name already exists, return an error
			SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'Duplicate course name';
		END IF;
	end if;

       
 
   # Teacher Section 
   
	SET i = 0;




	WHILE i < JSON_LENGTH(TeacherDetails) DO
    SET TeacherInfo = JSON_EXTRACT(TeacherDetails, CONCAT('$[', i, ']'));
    SET TeacherID_ = JSON_EXTRACT(TeacherInfo, '$.Teacher_ID');
	SET ctDeleteStatus = JSON_EXTRACT(TeacherInfo, '$.Delete_Status');
	SET TimeSlots = JSON_EXTRACT(TeacherInfo, '$.timeSlots');
	SET CourseTeacher_ID_ = JSON_EXTRACT(TeacherInfo, '$.CourseTeacher_ID');
	IF ctDeleteStatus = 1 THEN
        update course_teacher set Delete_Status =1  WHERE CourseTeacher_ID = CourseTeacher_ID_;
		update  teacher_time_slot   set Delete_Status =1   where CourseTeacher_ID =CourseTeacher_ID_ ;
    ELSE
	   if CourseTeacher_ID_  > 0
				then
				update course_teacher set Teacher_ID=TeacherID_ ,Course_ID=newCourseID where CourseTeacher_ID=CourseTeacher_ID_;
 
		ELSE
				
			INSERT INTO course_teacher (Teacher_ID, Course_ID)
			VALUES (TeacherID_, newCourseID);
			SET CourseTeacher_ID_ = LAST_INSERT_ID();
           END IF; 
	end if;
        SET j = 0;
        
        -- Loop through each time slot
        WHILE j < JSON_LENGTH(TimeSlots) DO
			 SET temp_start_time = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].startTime')));
			SET temp_end_time = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].endTime')));
	  
			SET slot_ID_ = JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].Slot_Id')));
			SET TsDeleteStatus =  JSON_UNQUOTE(JSON_EXTRACT(TimeSlots, CONCAT('$[', j, '].Delete_Status')));
            -- Insert into teacher_time_slot table
           
					 SET StartTime = CASE 
				WHEN temp_start_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
				THEN TIME_FORMAT(STR_TO_DATE(temp_start_time, '%l:%i %p'), '%H:%i')
				ELSE TIME_FORMAT(TIME(temp_start_time), '%H:%i')
			END;

			SET EndTime = CASE 
				WHEN temp_end_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
				THEN TIME_FORMAT(STR_TO_DATE(temp_end_time, '%l:%i %p'), '%H:%i')
				ELSE TIME_FORMAT(TIME(temp_end_time), '%H:%i')
			END;


           
            	IF TsDeleteStatus = 1 THEN
		
			update  teacher_time_slot   set Delete_Status =1   where Slot_Id =slot_ID_ ;
		ELSE
		   if slot_ID_  > 0
					then
					update teacher_time_slot set CourseTeacher_ID=CourseTeacher_ID_ ,start_time=StartTime,end_time=EndTime,batch_id=NULL where  Slot_Id =slot_ID_;
	 
			ELSE
					
			INSERT INTO teacher_time_slot ( CourseTeacher_ID, start_time, end_time,batch_id)
            VALUES (CourseTeacher_ID_, StartTime, EndTime,null);
				SET slot_ID_ = LAST_INSERT_ID();
			   END IF; 
		end if;
            SET j = j + 1;
        END WHILE;
    SET i = i + 1;
	END WHILE;
    
    
		#Section
        

    SET i = 0;
    	delete from course_section where Course_ID =newCourseID;
        WHILE i < JSON_LENGTH(SectionIDs) DO
		SET SectionID = JSON_EXTRACT(SectionIDs, CONCAT('$[', i, ']'));
        INSERT INTO course_section (Course_ID, Section_ID) VALUES (newCourseID, SectionID);
        SET i = i + 1;
    END WHILE;

 
# course content 
/*
    SET i = 0;
    WHILE i < JSON_LENGTH(ContentDetails) DO
        SET ContentName = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].contentName')));
        SET ExternalLink = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].externalLink')));
        SET SectionIDContent = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].sectionId')));
		SET  @newContentID = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].Content_ID')));
		SET Module_ID_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].Module_ID')));
		SET Is_Exam_Test_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].Is_Exam_Test')));
        SET Days_Id_ = CASE 
		WHEN JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].Days_Id'))) = 'null' THEN 0
		ELSE CAST(JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].Days_Id'))) AS SIGNED)
		END;
		SET FilePath = IF(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].file')) IS NOT NULL AND JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].file')) != 'null', JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].file'))), NULL);
        SET FileName = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].file_name'))), NULL);
		SET file_type = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].file_type'))), NULL);
        SET contentThumbnail_Path_ = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].contentThumbnail_Path'))), NULL);
        SET contentThumbnail_name_ = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].contentThumbnail_name'))), NULL);
		SET @deleteStatus = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].deleteStatus')));
		SET @visibilities = JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].visibilities'));  -- Extracting visibilities

    -- Check if the content needs to be deleted
    IF @deleteStatus = 1 THEN
        DELETE FROM course_content WHERE Content_ID = @newContentID;
		delete from exam where Exam_ID =( select  Exam_ID FROM course_content WHERE Content_ID = @newContentID) ;
    ELSE
       
        -- Check if exams array is empty
        IF JSON_LENGTH(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams'))) > 0 THEN
			if @newContentID  > 0
			then
				UPDATE course_content
				SET Course_Id = newCourseID,
				Section_ID = SectionIDContent,
				Content_Name = ContentName,
                External_Link = ExternalLink,
				Delete_Status = 0,
				Exam_ID = NULL,
				File_Path = NULL,
				File_Name = NULL,
                Is_Exam_Test=Is_Exam_Test_,
                contentThumbnail_name=contentThumbnail_name_,
                contentThumbnail_Path=contentThumbnail_Path_,Module_ID=Module_ID_,Days_Id = Days_Id_,
				Visibilities = @visibilities 
				WHERE Content_ID = @newContentID ;
        else
            INSERT INTO course_content (Course_Id, Section_ID, Content_Name,External_Link, Content_Order, Delete_Status, Exam_ID, File_Path, File_Name,contentThumbnail_Path,contentThumbnail_name,Module_ID,Visibilities,Days_Id,Is_Exam_Test)
            VALUES (newCourseID, SectionIDContent, ContentName,ExternalLink, NULL, 0, null, NULL, NULL,contentThumbnail_Path_,contentThumbnail_name_,Module_ID_, @visibilities, Days_Id_,Is_Exam_Test_);
			SET @newContentID = LAST_INSERT_ID();
		end if ;
        ELSE
			if  @newContentID > 0
				then
					UPDATE course_content
					SET Course_Id = newCourseID,
					Section_ID = SectionIDContent,
					Content_Name = ContentName,
                    External_Link = ExternalLink,
					Delete_Status = 0,
					Exam_ID = null,
					File_Path = FilePath,
					File_Name = FileName,
                    file_type=file_type,
                    Is_Exam_Test=Is_Exam_Test_,
					contentThumbnail_name=contentThumbnail_name_,
					contentThumbnail_Path=contentThumbnail_Path_,Module_ID=Module_ID_, Visibilities = @visibilities  , Days_Id = Days_Id_
					WHERE Content_ID = @newContentID ;
			else
					INSERT INTO course_content (Course_Id, Section_ID, Content_Name,External_Link, Content_Order, Delete_Status, File_Path, File_Name,file_type,contentThumbnail_Path,contentThumbnail_name,Module_ID,Visibilities, Days_Id,Is_Exam_Test)
					VALUES (newCourseID, SectionIDContent, ContentName,ExternalLink, 0, 0, FilePath, FileName,file_type,contentThumbnail_Path_,contentThumbnail_name_,Module_ID_, @visibilities, Days_Id_,Is_Exam_Test_);
			end if;
        END IF;
    
        -- Insert exams details into separate table if exams array is not empty
        
        if JSON_LENGTH(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams'))) > 0 THEN
            SET TotalQuestions = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].totalQuestions')));
            SET MainQuestion = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Main_Question')));
            SET ExamFileName = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].file_name')));
			SET Examfile_type = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].file_type')));
			SET Supporting_Document_Name_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Supporting_Document_Name')));
			SET Supporting_Document_Path_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Supporting_Document_Path')));
            SET Answer_Key_Name_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Answer_Key_Name')));
			SET Answer_Key_Path_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Answer_Key_Path')));
			set @newExamID =JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].Exam_ID')));
            SET PassingScore = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[',0, '].passingScore')));
            SET TimeLimit = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].timeLimit')));
            
            -- Insert exams details into exams table
            if  @newExamID  > 0 then
            
            UPDATE exam
				SET Total_Questions = TotalQuestions,
				Main_Question = MainQuestion,
				Passing_Score = PassingScore,
				Time_Limit = TimeLimit,
				file_name = ExamFileName,
				file_type = Examfile_type,
				Section_ID = SectionIDContent,Supporting_Document_Name=Supporting_Document_Name_,Supporting_Document_Path=Supporting_Document_Path_,Answer_Key_Path=Answer_Key_Path_,Answer_Key_Name=Answer_Key_Name_,
				Course_ID = newCourseID where Exam_ID= @newExamID ;
			else
            
            INSERT INTO exam ( Section_ID,Course_ID ,Total_Questions, Main_Question, Passing_Score, Time_Limit,file_name,file_type,Supporting_Document_Name,Supporting_Document_Path,Answer_Key_Path,Answer_Key_Name)
            VALUES ( SectionIDContent,newCourseID,TotalQuestions, MainQuestion, PassingScore, TimeLimit,ExamFileName,Examfile_type,Supporting_Document_Name_,Supporting_Document_Path_,Answer_Key_Path_,Answer_Key_Name_);
               SET @newExamID = LAST_INSERT_ID();
            end if;
            -- Get the last inserted exam ID
         
            
            -- Update the exam ID in course_content table
            UPDATE course_content SET Exam_ID = @newExamID WHERE Content_ID = @newContentID;
             SET j = 0;
             #delete from  question where Exam_ID=@newExamID;
            WHILE j < JSON_LENGTH(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions'))) DO
                SET QuestionText = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].questionText')));
                SET QuestionID = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].question_ID')));
                SET QnDeleteStatus = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].deleteStatus')));
               SET Question_Answer_Media_Name = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].Answer_Media_Name')));
                SET CorrectAnswer = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].correctAnswer')));
				insert into data_log values (4,CorrectAnswer);
                IF Question_Answer_Media_Name = 'text' THEN
					SET AnswerOptions = JSON_ARRAY();
				ELSE
					SET AnswerOptions = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, CONCAT('$[', i, '].exams[', 0, '].questions[', j, '].answerOptions')));

				END IF;
                IF QuestionID >0 then
					IF QnDeleteStatus = 1 then
						DELETE FROM question WHERE Question_ID = QuestionID;
                    else
						UPDATE question	SET Question_Text = QuestionText,
						Answer_Options = AnswerOptions,
						Correct_Answer = CorrectAnswer,
						Delete_Status = 0,
						Answer_Media_Name = Question_Answer_Media_Name where Question_ID= QuestionID ;
                    end if;
                else
					INSERT INTO question (Exam_ID, Question_Text, Answer_Options, Correct_Answer, Delete_Status,Answer_Media_Name)
					VALUES (@newExamID, QuestionText, AnswerOptions, CorrectAnswer, 0,Question_Answer_Media_Name);
                END IF;
                SET j = j + 1;
            END WHILE;
		ELSE 
        
        delete from exam where Section_ID= SectionIDContent  AND Course_ID=@newContentID ;
         END IF
         ;
	END IF;

        SET i = i + 1;
     
    END WHILE;  
    
    */

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_course_category`( In Category_ID_ int,
Category_Name_ varchar(100))
Begin 

 if  Category_ID_>0
 THEN 
 UPDATE course_category set 
Category_Name = Category_Name_, Delete_Status = 0 , Enabled_Status =1  Where Category_ID = Category_ID_ ;
 ELSE 
 
 INSERT INTO course_category(
Category_Name ,
Delete_Status, Enabled_Status ) values (
Category_Name_ ,
0, 1 );
SET Category_ID_ = LAST_INSERT_ID();
 End If ;
 
 select Category_ID_ as Category_ID;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `save_course_content`(In ContentDetails JSON)
BEGIN
   /*course content */
	DECLARE ContentName VARCHAR(200);
    DECLARE ExternalLink LONGTEXT;
    DECLARE SectionIDContent INT;
	DECLARE Module_ID_ INT;
	DECLARE Is_Exam_Test_ INT;
    DECLARE Days_Id_ INT;
	DECLARE file_type VARCHAR(40);
    DECLARE FilePath longtext;
    DECLARE FileName longtext;
	DECLARE Supporting_Document_Path_ longtext;
    DECLARE Supporting_Document_Name_ longtext;
	DECLARE Answer_Key_Path_ longtext;
    DECLARE Answer_Key_Name_ longtext;
	DECLARE contentThumbnail_name_ longtext;
    DECLARE contentThumbnail_Path_ longtext;
    DECLARE ExamName VARCHAR(200);
    DECLARE TotalQuestions INT; 
    DECLARE ExamFileName longtext;
	DECLARE Examfile_type VARCHAR(40);
    DECLARE MainQuestion TEXT;
    DECLARE PassingScore INT;
    DECLARE TimeLimit INT;
    DECLARE j INT;
	DECLARE newCourseID INT;
	DECLARE newContentID INT;
-- Set content details from JSON
SET ContentName = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.contentName'));
SET ExternalLink = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.externalLink'));
SET SectionIDContent = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Section_ID'));
SET @newContentID = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Content_ID'));
SET Module_ID_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Module_ID'));
SET Is_Exam_Test_ = CASE 
    WHEN JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Is_Exam_Test')) = 'true' THEN 1 
    ELSE 0 
END;

SET newCourseID = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Course_ID'));
SET Days_Id_ = CASE 
    WHEN JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Days_Id')) = 'null' THEN 0
    ELSE CAST(JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.Days_Id')) AS SIGNED)
END;
SET FilePath = IF(JSON_EXTRACT(ContentDetails, '$.file') IS NOT NULL AND JSON_EXTRACT(ContentDetails, '$.file') != 'null', JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.file')), NULL);
SET FileName = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.file_name')), NULL);
SET file_type = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.file_type')), NULL);
SET contentThumbnail_Path_ = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.contentThumbnail_Path')), NULL);
SET contentThumbnail_name_ = IF(FilePath IS NOT NULL, JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.contentThumbnail_name')), NULL);
SET @deleteStatus = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.deleteStatus'));
SET @visibilities = JSON_EXTRACT(ContentDetails, '$.visibilities'); -- Extracting visibilities

-- Check if the content needs to be deleted
IF @deleteStatus = 1 THEN
    DELETE FROM course_content WHERE Content_ID = @newContentID;
    DELETE FROM exam WHERE Exam_ID = (SELECT Exam_ID FROM course_content WHERE Content_ID = @newContentID);
ELSE
    -- Content update/insert logic
    IF @newContentID > 0 THEN
        UPDATE course_content
        SET Course_Id = newCourseID,
            Section_ID = SectionIDContent,
            Content_Name = ContentName,
            External_Link = ExternalLink,
            Delete_Status = 0,
            Exam_ID = NULL,
            File_Path = FilePath,
            File_Name = FileName,
            file_type = file_type,
            Is_Exam_Test = Is_Exam_Test_,
            contentThumbnail_name = contentThumbnail_name_,
            contentThumbnail_Path = contentThumbnail_Path_,
            Module_ID = Module_ID_,
            Days_Id = Days_Id_,
            Visibilities = @visibilities
        WHERE Content_ID = @newContentID;
    ELSE
        INSERT INTO course_content (Course_Id, Section_ID, Content_Name, External_Link, Content_Order, Delete_Status, File_Path, File_Name, file_type, contentThumbnail_Path, contentThumbnail_name, Module_ID, Visibilities, Days_Id, Is_Exam_Test)
        VALUES (newCourseID, SectionIDContent, ContentName, ExternalLink, 0, 0, FilePath, FileName, file_type, contentThumbnail_Path_, contentThumbnail_name_, Module_ID_, @visibilities, Days_Id_, Is_Exam_Test_);
        SET @newContentID = LAST_INSERT_ID();
    END IF;

    -- Exam processing
    IF JSON_EXTRACT(ContentDetails, '$.exam') IS NOT NULL THEN
        SET TotalQuestions = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.totalQuestions'));
        SET MainQuestion = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Main_Question'));
        SET ExamFileName = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.file_name'));
        SET Examfile_type = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.file_type'));
        SET Supporting_Document_Name_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Supporting_Document_Name'));
        SET Supporting_Document_Path_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Supporting_Document_Path'));
        SET Answer_Key_Name_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Answer_Key_Name'));
        SET Answer_Key_Path_ = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Answer_Key_Path'));
        SET @newExamID = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.Exam_ID'));
        SET PassingScore = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.passingScore'));
        SET TimeLimit = JSON_UNQUOTE(JSON_EXTRACT(ContentDetails, '$.exam.timeLimit'));

        -- Insert/Update exam
        IF @newExamID > 0 THEN
            UPDATE exam
            SET Total_Questions = TotalQuestions,
                Main_Question = MainQuestion,
                Passing_Score = PassingScore,
                Time_Limit = TimeLimit,
                file_name = ExamFileName,
                file_type = Examfile_type,
                Section_ID = SectionIDContent,
                Supporting_Document_Name = Supporting_Document_Name_,
                Supporting_Document_Path = Supporting_Document_Path_,
                Answer_Key_Path = Answer_Key_Path_,
                Answer_Key_Name = Answer_Key_Name_,
                Course_ID = newCourseID
            WHERE Exam_ID = @newExamID;
        ELSE
            INSERT INTO exam (Section_ID, Course_ID, Total_Questions, Main_Question, Passing_Score, Time_Limit, file_name, file_type, Supporting_Document_Name, Supporting_Document_Path, Answer_Key_Path, Answer_Key_Name)
            VALUES (SectionIDContent, newCourseID, 0, MainQuestion, 0,0, ExamFileName, Examfile_type, Supporting_Document_Name_, Supporting_Document_Path_, Answer_Key_Path_, Answer_Key_Name_);
            SET @newExamID = LAST_INSERT_ID();
        END IF;

        -- Update exam ID in course_content
        UPDATE course_content SET Exam_ID = @newExamID WHERE Content_ID = @newContentID;
    ELSE
        DELETE FROM exam WHERE Section_ID = SectionIDContent AND Course_ID = newCourseID;
    END IF;
END IF;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_course_module`(
    IN Module_ID_ int,
    IN Module_Name_ varchar(100)
)
BEGIN
    DECLARE duplicate_count INT;
    
    -- Check if the module name already exists (ignoring the current module when updating)
    IF Module_ID_ > 0 THEN
        SELECT COUNT(*)
        INTO duplicate_count
        FROM course_module
        WHERE Module_Name = Module_Name_
        AND Module_ID != Module_ID_ AND      Delete_Status = 0;
    ELSE
        SELECT COUNT(*)
        INTO duplicate_count
        FROM course_module
        WHERE Module_Name = Module_Name_  AND    Delete_Status = 0;
    END IF;
    
    -- If a duplicate is found, return -1
    IF duplicate_count > 0 THEN
        SELECT -1 AS Module_ID;
    ELSE
        IF Module_ID_ > 0 THEN
            -- Update the existing module
            UPDATE course_module
            SET 
                Module_Name = Module_Name_,
                Delete_Status = 0,
                Enabled_Status = 1
            WHERE Module_ID = Module_ID_;
        ELSE
            -- Insert a new module
            INSERT INTO course_module(
                Module_Name,
                Delete_Status,
                Enabled_Status
            ) VALUES (
                Module_Name_,
                0,
                1
            );
            SET Module_ID_ = LAST_INSERT_ID();
        END IF;

        -- Return the Module_ID (either the updated or newly inserted one)
        SELECT Module_ID_ AS Module_ID;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Document`(
  IN p_Document_ID INT,
  IN p_Student_ID INT,
  IN p_Document_Type_Id VARCHAR(100),
  IN p_Document_Name VARCHAR(255),
  IN p_Document_URL TEXT,
  IN p_S3_Key VARCHAR(255),
  IN fileName VARCHAR(255)
)
BEGIN
  IF p_Document_ID = 0 THEN
    -- INSERT new document
    INSERT INTO student_documents (
      Student_ID,
      Document_Type_Id,
      Document_Name,
      Document_URL,
      S3_Key,
      fileName,
      Uploaded_At
    )
    VALUES (
      p_Student_ID,
      p_Document_Type_Id,
      p_Document_Name,
      p_Document_URL,
      p_S3_Key,
      fileName,
      NOW()
    );
  ELSE
    -- UPDATE existing document
    UPDATE student_documents
    SET 
      Student_ID = p_Student_ID,
      Document_Type_Id = p_Document_Type_Id,
      Document_Name = p_Document_Name,
      Document_URL = p_Document_URL,
      S3_Key = p_S3_Key,
      fileName = fileName,
      Updated_At = NOW()
    WHERE Document_ID = p_Document_ID;
  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Email_Log`(
        IN p_Student_ID INT,
        IN p_Template_ID INT,
        IN p_Email_Address VARCHAR(255),
        IN p_Subject VARCHAR(255),
        IN p_Message_ID VARCHAR(255),
        IN p_Body TEXT,
        IN p_Status VARCHAR(50),
        IN p_Error_Message TEXT
    )
BEGIN
        INSERT INTO Email_Logs (Student_ID, Template_ID, Email_Address, Subject, Message_ID, Body, Status, Error_Message)
        VALUES (p_Student_ID, p_Template_ID, p_Email_Address, p_Subject, p_Message_ID, p_Body, p_Status, p_Error_Message);
        SELECT LAST_INSERT_ID() AS Log_ID;
    END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Email_Template`(
    IN p_Template_ID INT,
    IN p_Template_Name VARCHAR(255),
    IN p_Subject VARCHAR(255),
    IN p_Body TEXT,
    IN p_Attendance_Count INT,
    IN p_Is_Active TINYINT(1)
)
BEGIN
    IF p_Template_ID = 0 THEN
        INSERT INTO email_templates (Template_Name, Subject, Body, Attendance_Count, Is_Active)
        VALUES (p_Template_Name, p_Subject, p_Body, IFNULL(p_Attendance_Count, 0), IFNULL(p_Is_Active, 1));
        SELECT LAST_INSERT_ID() AS InsertId;
    ELSE
        UPDATE email_templates
        SET Template_Name = p_Template_Name,
            Subject = p_Subject,
            Body = p_Body,
            Attendance_Count = IFNULL(p_Attendance_Count, 0),
            Is_Active = IFNULL(p_Is_Active, 1),
            Updated_At = CURRENT_TIMESTAMP
        WHERE Template_ID = p_Template_ID;
        SELECT p_Template_ID AS InsertId;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Enquiry_Source`(
                IN p_Enquiry_Source_Id INT,
                IN p_Enquiry_Source_Name VARCHAR(255)
            )
BEGIN
                IF p_Enquiry_Source_Id > 0 THEN
                    UPDATE enquiry_source 
                    SET Enquiry_Source_Name = p_Enquiry_Source_Name
                    WHERE Enquiry_Source_Id = p_Enquiry_Source_Id;
                    
                    SELECT p_Enquiry_Source_Id AS Enquiry_Source_Id, 'Updated Successfully' AS message;
                ELSE
                    INSERT INTO enquiry_source (Enquiry_Source_Name, Delete_Status)
                    VALUES (p_Enquiry_Source_Name, 0);
                    
                    SELECT LAST_INSERT_ID() AS Enquiry_Source_Id, 'Saved Successfully' AS message;
                END IF;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Exam_Questions`(IN questionsData JSON)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE numRecords INT;

    -- Question fields
    DECLARE Question_ID_ INT;
    DECLARE Exam_ID_ INT;
    DECLARE Course_ID_ INT;
    DECLARE Question_Text_ TEXT;
    DECLARE Answer_Options_ JSON;
    DECLARE Correct_Answer_ VARCHAR(100);
    DECLARE Answer_Media_Name_ VARCHAR(25);
    
    -- Exam metadata
    DECLARE Time_Limit_ INT DEFAULT NULL;
    DECLARE Passing_Score_ INT DEFAULT NULL;
    DECLARE Main_Question_ TEXT;

    -- Log main question to data_log (FIXED: only insert 2 columns)
    SET Main_Question_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, '$[0].Main_Question'));
    INSERT INTO data_log (id, value) VALUES (0, Main_Question_);

    -- Get number of questions
    SET numRecords = JSON_LENGTH(questionsData);

    -- Extract shared metadata from first question
    SET Exam_ID_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, '$[0].Exam_ID'));
    SET Course_ID_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, '$[0].Course_ID'));
    SET Time_Limit_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, '$[0].Time_Limit'));
    SET Passing_Score_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, '$[0].Passing_Score'));

    -- INSERT or UPDATE exam
    IF Exam_ID_ IS NULL OR Exam_ID_ = 0 THEN
        SET Exam_ID_ = (SELECT COALESCE(MAX(Exam_ID), 0) + 1 FROM exam);
        
        INSERT INTO exam (
            Exam_ID, Course_ID, Main_Question, Time_Limit, Passing_Score, Delete_Status, Total_Questions
        ) VALUES (
            Exam_ID_, Course_ID_, Main_Question_, Time_Limit_, Passing_Score_, 0, 0
        );
    ELSE
        UPDATE exam
        SET 
            Course_ID = Course_ID_,
            Main_Question = Main_Question_,
            Time_Limit = Time_Limit_,
            Passing_Score = Passing_Score_
        WHERE Exam_ID = Exam_ID_;
    END IF;

    -- Loop through questions and insert/update each
    WHILE i < numRecords DO
        SET Question_ID_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, CONCAT('$[', i, '].Question_ID')));
        SET Question_Text_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, CONCAT('$[', i, '].Question_Text')));
        SET Answer_Options_ = JSON_EXTRACT(questionsData, CONCAT('$[', i, '].Answer_Options'));
        SET Correct_Answer_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, CONCAT('$[', i, '].Correct_Answer')));
        SET Answer_Media_Name_ = JSON_UNQUOTE(JSON_EXTRACT(questionsData, CONCAT('$[', i, '].Answer_Media_Name')));

        IF Question_ID_ IS NOT NULL AND Question_ID_ > 0 THEN
            -- Update existing question
            UPDATE question
            SET 
                Exam_ID = Exam_ID_,
                Question_Text = Question_Text_,
                Answer_Options = Answer_Options_,
                Correct_Answer = Correct_Answer_,
                Answer_Media_Name = Answer_Media_Name_
            WHERE Question_ID = Question_ID_;
        ELSE
            -- Insert new question
            INSERT INTO question (
                Exam_ID,
                Question_Text,
                Answer_Options,
                Correct_Answer,
                Answer_Media_Name,
                Delete_Status
            ) VALUES (
                Exam_ID_,
                Question_Text_,
                CAST(Answer_Options_ AS JSON),
                Correct_Answer_,
                Answer_Media_Name_,
                0
            );
        END IF;

        SET i = i + 1;
    END WHILE;

    -- Update total questions count
    UPDATE exam
    SET 
        Total_Questions = (
            SELECT COUNT(*) FROM question WHERE Exam_ID = Exam_ID_ AND Delete_Status = 0
        )
    WHERE Exam_ID = Exam_ID_;

    -- Final response
    SELECT 'Questions saved and exam updated successfully' AS Status, Exam_ID_ AS Exam_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Expense`(
    IN p_Expense_Id INT,
    IN p_Expense_Type_Id INT,
    IN p_User_Id INT,
    IN p_Amount DECIMAL(10,2),
    IN p_Description VARCHAR(200),
    IN p_Account_Id INT,
    IN p_Account_Name VARCHAR(100),
    IN p_Student_ID INT,
    IN p_StudentName VARCHAR(100)
)
BEGIN
    DECLARE new_expense_id INT;

    IF p_Expense_Id = 0 THEN
        -- Insert new expense
        INSERT INTO Expense (
            Expense_Type_Id,
            User_Id,
            Entry_Date,
            Amount,
            Description,
            Account_Id,
            Account_Name,
            Student_ID,
            StudentName
        ) VALUES (
            p_Expense_Type_Id,
            p_User_Id,
            NOW(),
            p_Amount,
            p_Description,
            p_Account_Id,
            p_Account_Name,
            p_Student_ID,
            p_StudentName
        );

        SET new_expense_id = LAST_INSERT_ID();
    ELSE
        -- Update existing expense
        UPDATE Expense
        SET 
            Expense_Type_Id = p_Expense_Type_Id,
            User_Id = p_User_Id,
            Amount = p_Amount,
            Description = p_Description,
            Account_Id = p_Account_Id,
            Account_Name = p_Account_Name
        WHERE Expense_Id = p_Expense_Id;

        SET new_expense_id = p_Expense_Id;
    END IF;

    -- Return the ID of the affected row
    SELECT new_expense_id AS Expense_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Expense_Category`(
    IN p_Expense_Category_Id INT,
    IN p_Expense_Category_Name VARCHAR(100)
)
BEGIN
    IF p_Expense_Category_Id = 0 THEN
        INSERT INTO Expense_Category (Expense_Category_Name)
        VALUES (p_Expense_Category_Name);

        -- Return the newly inserted ID
        SELECT LAST_INSERT_ID() AS Expense_Category_Id;
    ELSE
        UPDATE Expense_Category
        SET Expense_Category_Name = p_Expense_Category_Name
        WHERE Expense_Category_Id = p_Expense_Category_Id;

        -- Return the updated ID
        SELECT p_Expense_Category_Id AS Expense_Category_Id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Expense_Type`(
    IN p_Expense_Type_Id INT,
    IN p_Expense_Type_Name VARCHAR(100),
    IN p_Expense_Category_Id INT
)
BEGIN
    IF p_Expense_Type_Id = 0 THEN
        INSERT INTO Expense_Type (Expense_Type_Name, Expense_Category_Id)
        VALUES (p_Expense_Type_Name, p_Expense_Category_Id);

        -- Return the newly inserted row
        SELECT 
            Expense_Type_Id, 
            Expense_Type_Name, 
            Expense_Category_Id
        FROM Expense_Type
        WHERE Expense_Type_Id = LAST_INSERT_ID();
    ELSE
        UPDATE Expense_Type
        SET 
            Expense_Type_Name = p_Expense_Type_Name,
            Expense_Category_Id = p_Expense_Category_Id
        WHERE Expense_Type_Id = p_Expense_Type_Id;

        -- Return the updated row
        SELECT 
            Expense_Type_Id, 
            Expense_Type_Name, 
            Expense_Category_Id
        FROM Expense_Type
        WHERE Expense_Type_Id = p_Expense_Type_Id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Followup_Status`(IN Status_Id_ INT, IN Status_Name_ VARCHAR(100), IN Status_Color_ VARCHAR(20), IN Description_ VARCHAR(500), IN Display_Order_ INT, IN Is_Active_ TINYINT(1))
BEGIN IF Status_Id_ > 0 THEN UPDATE followup_status SET Status_Name = Status_Name_, Status_Color = Status_Color_, Description = Description_, Display_Order = Display_Order_, Is_Active = Is_Active_ WHERE Status_Id = Status_Id_; SELECT 1 AS success, 'Updated' AS message; ELSE INSERT INTO followup_status (Status_Name, Status_Color, Description, Display_Order, Is_Active) VALUES (Status_Name_, Status_Color_, Description_, Display_Order_, Is_Active_); SELECT LAST_INSERT_ID() AS id, 'Inserted' AS message; END IF; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Income`(
            IN p_Income_Id INT,
            IN p_Expense_Type_Id INT,
            IN p_User_Id INT,
            IN p_Amount DECIMAL(10,2),
            IN p_Description VARCHAR(200),
            IN p_Account_Id INT,
            IN p_Account_Name VARCHAR(100)
        )
BEGIN
            IF p_Income_Id = 0 THEN
                INSERT INTO income (Expense_Type_Id, User_Id, Amount, Description, Account_Id, Account_Name, Entry_Date)
                VALUES (p_Expense_Type_Id, p_User_Id, p_Amount, p_Description, p_Account_Id, p_Account_Name, NOW());
            ELSE
                UPDATE income SET 
                    Expense_Type_Id = p_Expense_Type_Id,
                    User_Id = p_User_Id,
                    Amount = p_Amount,
                    Description = p_Description,
                    Account_Id = p_Account_Id,
                    Account_Name = p_Account_Name
                WHERE Income_Id = p_Income_Id;
            END IF;
            SELECT 1 AS success;
        END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Income_Category`(
                IN p_Income_Category_Id INT,
                IN p_Income_Category_Name VARCHAR(100)
            )
BEGIN
                IF p_Income_Category_Id = 0 THEN
                    INSERT INTO income_category (Income_Category_Name) VALUES (p_Income_Category_Name);
                ELSE
                    UPDATE income_category SET Income_Category_Name = p_Income_Category_Name WHERE Income_Category_Id = p_Income_Category_Id;
                END IF;
                SELECT 1 AS success;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Income_Type`(
                IN p_Income_Type_Id INT,
                IN p_Income_Type_Name VARCHAR(100),
                IN p_Income_Category_Id INT
            )
BEGIN
                IF p_Income_Type_Id = 0 THEN
                    INSERT INTO income_type (Income_Type_Name, Income_Category_Id) VALUES (p_Income_Type_Name, p_Income_Category_Id);
                ELSE
                    UPDATE income_type SET Income_Type_Name = p_Income_Type_Name, Income_Category_Id = p_Income_Category_Id WHERE Income_Type_Id = p_Income_Type_Id;
                END IF;
                SELECT 1 AS success;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Leave`(
                IN Leave_Id_ INT,
                IN User_Id_ INT,
                IN From_Date_ DATE,
                IN To_Date_ DATE,
                IN Reason_ TEXT,
                IN Status_ VARCHAR(50)
            )
BEGIN
                IF Leave_Id_ > 0 THEN
                    UPDATE Leaves
                    SET From_Date = From_Date_, To_Date = To_Date_, Reason = Reason_, Status = Status_
                    WHERE Leave_Id = Leave_Id_;
                    SELECT Leave_Id_ AS Leave_Id;
                ELSE
                    INSERT INTO Leaves (User_Id, From_Date, To_Date, Reason, Status)
                    VALUES (User_Id_, From_Date_, To_Date_, Reason_, Status_);
                    SELECT LAST_INSERT_ID() AS Leave_Id;
                END IF;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_LiveClass`(
   IN p_LiveClass_ID INT,
    IN p_Course_ID INT,
    IN p_Teacher_ID INT,
    IN p_Batch_Id INT,
    IN p_Scheduled_DateTime VARCHAR(50),
    IN p_Duration INT,
    IN p_Start_Time VARCHAR(50),
    IN p_End_Time VARCHAR(50),
    IN p_Live_Link VARCHAR(250),
	IN p_Record_Class_Link VARCHAR(250),
	IN p_Slot_Id INT 
)
BEGIN
    DECLARE unfinished_count INT;

    -- Check for unfinished classes with the same Course_ID and Batch_Id
    SELECT COUNT(*) INTO unfinished_count
    FROM live_class
    WHERE Course_ID = p_Course_ID
    AND Batch_Id = p_Batch_Id
    AND Is_Finished = 0
    AND (p_LiveClass_ID = 0 OR LiveClass_ID != p_LiveClass_ID);

    -- If unfinished classes exist, throw an error
    IF unfinished_count > 0 THEN
				 UPDATE live_class  SET 
				Is_Finished = 1 WHERE Course_ID = p_Course_ID
				AND Batch_Id = p_Batch_Id; 

     #   SIGNAL SQLSTATE '45000'
      #  SET MESSAGE_TEXT = 'An unfinished class already exists for this course and batch.';
    END IF;
        IF p_LiveClass_ID = 0 And  !isnull(p_Live_Link) THEN
            -- Insert new record
            INSERT INTO live_class (
                Course_ID, 
                Teacher_ID, 
                Batch_Id,
                Scheduled_DateTime, 
                Duration, 
                Delete_Status, 
                Start_Time, 
                Live_Link,
                Is_Finished,
                Slot_Id
            ) VALUES (
                p_Course_ID, 
                p_Teacher_ID, 
                p_Batch_Id,
                p_Scheduled_DateTime, 
                p_Duration, 
                0, 
                p_Start_Time, 
                p_Live_Link,
                0 ,-- Set Is_Finished to 0 for new classes 
                p_Slot_Id
            );
            SET p_LiveClass_ID = LAST_INSERT_ID();
        ELSE
            -- Update existing record
            UPDATE live_class
            SET 
                Duration = p_Duration,
                End_Time =  now() ,
                Is_Finished = 1,Record_Class_Link=p_Record_Class_Link
            WHERE LiveClass_ID = p_LiveClass_ID;
            update student_live_class 
            set End_Time =  now()  where LiveClass_ID = p_LiveClass_ID;
            
        END IF;
        
        SELECT p_LiveClass_ID AS LiveClass_ID,Is_Finished  from  live_class WHERE LiveClass_ID = p_LiveClass_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_MockTestPackage`(
    IN Package_ID_ INT,
    IN Package_Name_ VARCHAR(255)
)
BEGIN
    IF Package_ID_ > 0 THEN
        UPDATE mock_test_packages
        SET Package_Name = Package_Name_
        WHERE Package_ID = Package_ID_;
        
        SELECT Package_ID_ AS Package_ID;
    ELSE
        INSERT INTO mock_test_packages (Package_Name, Delete_Status)
        VALUES (Package_Name_, 0);
        
        SELECT LAST_INSERT_ID() AS Package_ID;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Occupation`(
    IN p_Student_ID INT,
    IN p_Occupation_Id INT,
    IN p_Preferred_Course JSON
)
BEGIN
    DECLARE v_StudentExists INT;
    DECLARE v_OccupationExists INT;
    DECLARE v_CourseId INT;
    DECLARE v_JsonLength INT;
    DECLARE v_JsonIndex INT DEFAULT 0;

    -- Check if the student exists
    SELECT COUNT(*) INTO v_StudentExists FROM student WHERE Student_ID = p_Student_ID;

    -- Check if the occupation exists
    SELECT COUNT(*) INTO v_OccupationExists FROM occupation WHERE Occupation_Id = p_Occupation_Id;

    IF v_StudentExists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Student doess not exist';
    ELSEIF v_OccupationExists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error: Occupation does not exist';
    ELSE
        -- Update occupation details
        UPDATE student SET Occupation_Id = p_Occupation_Id WHERE Student_ID = p_Student_ID;

        -- Save preferred courses
        DELETE FROM student_interested_course WHERE student_id = p_Student_ID;

        SET v_JsonLength = JSON_LENGTH(p_Preferred_Course);

        WHILE v_JsonIndex < v_JsonLength DO
            SET v_CourseId = JSON_EXTRACT(p_Preferred_Course, CONCAT('$[', v_JsonIndex, ']'));
            INSERT INTO student_interested_course (student_id, course_id) VALUES (p_Student_ID, v_CourseId);
            SET v_JsonIndex = v_JsonIndex + 1;
        END WHILE;
        select p_Student_ID as Student_Id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_OneToOne_Record_By_Link`(
    IN p_Live_Link VARCHAR(250),
    IN p_Record_Class_Link VARCHAR(250)
)
BEGIN
    UPDATE call_history
    SET Record_Class_Link = p_Record_Class_Link
    WHERE Live_Link = p_Live_Link;
    
    SELECT id
    FROM call_history
    WHERE Live_Link = p_Live_Link;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `save_payment_request`(
    IN p_order_id VARCHAR(100),
    IN p_amount DECIMAL(10,2),
    IN p_payment_page_client_id VARCHAR(100),
    IN p_customer_id VARCHAR(100),
    IN p_action VARCHAR(50),
    IN p_return_url VARCHAR(255),
    IN p_currency VARCHAR(10),
	IN p_Request_Id VARCHAR(100),
    IN p_status VARCHAR(50),
    IN p_CourseId VARCHAR(50)
)
BEGIN
    -- Check if order_id already exists
    IF EXISTS (SELECT 1 FROM payment_request WHERE order_id = p_order_id) THEN
        -- Update existing record
        UPDATE payment_request 
        SET 
            status = p_status,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = p_order_id;
        
        -- Return the updated record
        SELECT * FROM payment_request 
        WHERE order_id = p_order_id;
    ELSE
        -- Insert new record
        INSERT INTO payment_request (
            order_id,
            amount,
            payment_page_client_id,
            customer_id,
            action,
            return_url,
            currency,
            status,
            requestId,
            course_Id
        )
        VALUES (
            p_order_id,
            p_amount,
            p_payment_page_client_id,
            p_customer_id,
            p_action,
            p_return_url,
            p_currency,
            p_status,
            p_Request_Id,
            p_CourseId
        );
        
        -- Return the inserted record
        SELECT * FROM payment_request 
        WHERE payment_request_id = LAST_INSERT_ID();
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_student`( 
    IN Student_ID_ INT,
    IN First_Name_ VARCHAR(50),
    IN Last_Name_ VARCHAR(100),
    IN Email_ VARCHAR(100),
    IN Phone_Number_ VARCHAR(50),
    IN Social_Provider_ VARCHAR(50),
    IN Social_ID_ VARCHAR(100),
    IN Delete_Status_ TINYINT,
    IN Profile_Photo_Name_ LONGTEXT,
    IN Profile_Photo_Path_ LONGTEXT,
    IN Avatar_ VARCHAR(40),
    IN Country_Code_ VARCHAR(45),
    IN Country_Code_Name_ VARCHAR(45),
    IN Roll_No_ VARCHAR(50),
    IN Branch_Name_ VARCHAR(255),
    IN Branch_Id_ INT,
    IN Follow_Up_Date_ DATE,
    IN Admission_Date_ VARCHAR(100),
    IN Status_Id_ INT,
    IN Status_Name_ VARCHAR(100),
    IN To_User_Id_ INT,
    IN To_User_Name_ VARCHAR(100),
    IN By_User_Id_ INT,
    IN Remark_ VARCHAR(1000),
    IN Followup_Status_ BOOLEAN,
    IN Department_Id_ INT,
    IN Department_Name_ VARCHAR(100),
    IN Age_ INT,
    IN Qualification_ VARCHAR(100),
    IN Qualification_Description_ VARCHAR(255),
    IN Alt_Phone_Number_ VARCHAR(50),
    IN Address_ VARCHAR(255),
    IN Guardian_Type_ VARCHAR(50),
    IN Guardian_Name_ VARCHAR(100),
    IN Guardian_Phone_ VARCHAR(50),
    IN Guardian_Alt_Phone_ VARCHAR(50),
    IN Height_cm_ INT,
    IN Weight_kg_ INT,
    IN Active_Status_ VARCHAR(50),
    IN Enquiry_Source_Id_ INT,
    IN Created_By_ INT,
    IN Installments_JSON TEXT,
    IN Student_Fees_IDs_JSON TEXT,
    IN isRegistering_ INT,
    IN Registered_By_ INT,
    IN Registered_On_ datetime,
    IN Mock_Test_Subscribed_ TINYINT,
    IN Mock_Test_Package_ VARCHAR(255),
    IN Priority_ VARCHAR(50)
)
BEGIN
    DECLARE existing_student_id INT DEFAULT NULL;
    DECLARE existing_user_id INT DEFAULT NULL;
    DECLARE student_action_source VARCHAR(10);
    DECLARE was_existing TINYINT DEFAULT 0;
    DECLARE v_isActive TINYINT DEFAULT 0;
    DECLARE v_Status_Name VARCHAR(100);
    DECLARE v_Admission_Date DATE;
    DECLARE v_Roll_No VARCHAR(500);
    DECLARE v_Roll_No_Character VARCHAR(50);

    -- Auto-generate Roll_No when registering
    IF isRegistering_ = 1 THEN
        IF Student_ID_ > 0 THEN
            SELECT Roll_No INTO v_Roll_No FROM student WHERE Student_ID = Student_ID_;
        ELSE
            SET v_Roll_No = NULL;
        END IF;

        IF v_Roll_No IS NULL OR v_Roll_No = '' THEN
            SELECT COALESCE(MAX(CAST(Roll_No AS UNSIGNED)), 0) + 1 INTO v_Roll_No
            FROM student 
            WHERE Roll_No REGEXP '^[0-9]+$';
        END IF;
    ELSE
        IF Student_ID_ > 0 THEN
            SELECT Roll_No INTO v_Roll_No FROM student WHERE Student_ID = Student_ID_;
        ELSE
            SET v_Roll_No = NULL;
        END IF;
    END IF;

    IF v_Roll_No IS NOT NULL AND v_Roll_No != '' AND v_Roll_No REGEXP '^[0-9]+$' THEN
        SET v_Roll_No_Character = CONCAT('TEP-', LPAD(v_Roll_No, 2, '0'));
    ELSE
        SET v_Roll_No_Character = v_Roll_No;
    END IF;

    -- Date parsing logic
    IF Admission_Date_ IS NULL OR Admission_Date_ = '' OR Admission_Date_ = '0000-00-00' THEN
        SET v_Admission_Date = NULL;
    ELSE
        SET v_Admission_Date = STR_TO_DATE(SUBSTRING_INDEX(Admission_Date_, 'T', 1), '%Y-%m-%d');
    END IF;

    -- Map Active_Status_ to isActive and potentially override Status_Name
    SET v_Status_Name = Status_Name_;
    
    IF LOWER(Active_Status_) = 'active' THEN
        SET v_isActive = 1;
    ELSE
        SET v_isActive = 0;
        IF LOWER(Active_Status_) = 'completed' THEN
            SET v_Status_Name = 'completed';
        ELSEIF LOWER(Active_Status_) = 'dropout' THEN
            SET v_Status_Name = 'dropout';
        END IF;
    END IF;

    main_block: BEGIN
        -- Check if email exists in users
        IF Email_ != '' THEN
            SELECT User_ID INTO existing_user_id
            FROM users
            WHERE LOWER(Email) = LOWER(Email_) AND Delete_Status = 0
            LIMIT 1;
        END IF;

        IF existing_user_id IS NOT NULL THEN
            SELECT existing_user_id AS Student_ID, 'User' AS Source, 1 AS existingUser, 1 AS duplicateEmail, 0 AS duplicatePhone, v_Roll_No AS RollNumber;
            LEAVE main_block;
        END IF;

        -- Update or Insert student
        IF Student_ID_ > 0 THEN
            IF Email_ != '' THEN
                SELECT Student_ID INTO existing_student_id
                FROM student
                WHERE LOWER(Email) = LOWER(Email_) AND Delete_Status = 0 AND Student_ID != Student_ID_
                LIMIT 1;
                
                IF existing_student_id IS NOT NULL THEN
                    SELECT existing_student_id AS Student_ID, 'Student' AS Source, 1 AS existingUser, 1 AS duplicateEmail, 0 AS duplicatePhone, v_Roll_No AS RollNumber;
                    LEAVE main_block;
                END IF;
            END IF;

            IF Phone_Number_ != '' THEN
                SELECT Student_ID INTO existing_student_id
                FROM student
                WHERE Phone_Number = Phone_Number_ AND Country_Code = Country_Code_ AND Delete_Status = 0 AND Student_ID != Student_ID_
                LIMIT 1;
                
                IF existing_student_id IS NOT NULL THEN
                    SELECT existing_student_id AS Student_ID, 'Student' AS Source, 1 AS existingUser, 0 AS duplicateEmail, 1 AS duplicatePhone, v_Roll_No AS RollNumber;
                    LEAVE main_block;
                END IF;
            END IF;

            -- If no duplicates, proceed with update
            UPDATE student 
            SET First_Name = First_Name_,
                Last_Name = Last_Name_,
                Email = Email_,
                Phone_Number = Phone_Number_,
                Social_Provider = Social_Provider_,
                Social_ID = Social_ID_,
                Profile_Photo_Name = Profile_Photo_Name_,
                Profile_Photo_Path = Profile_Photo_Path_,
                Delete_Status = Delete_Status_,
                Avatar = Avatar_,
                Country_Code = Country_Code_,
                Country_Code_Name = Country_Code_Name_,
                Roll_No = v_Roll_No,
                Roll_No_Character = v_Roll_No_Character,
                Branch_Name = Branch_Name_,
                Branch_Id = Branch_Id_,
                Follow_Up_Date = Follow_Up_Date_,
                Admission_Date = v_Admission_Date,
                Status_Id = Status_Id_,
                Status_Name = v_Status_Name,
                To_User_Id = To_User_Id_,
                To_User_Name = To_User_Name_,
                By_User_Id = By_User_Id_,
                Remark = Remark_,
                Followup_Status = Followup_Status_,
                Department_Id = Department_Id_,
                Department_Name = Department_Name_,
                Age = Age_,
                Qualification = Qualification_,
                Qualification_Description = Qualification_Description_,
                Alt_Phone_Number = Alt_Phone_Number_,
                Address = Address_,
                Guardian_Type = Guardian_Type_,
                Guardian_Name = Guardian_Name_,
                Guardian_Phone = Guardian_Phone_,
                Guardian_Alt_Phone = Guardian_Alt_Phone_,
                Height_cm = Height_cm_,
                Weight_kg = Weight_kg_,
                isActive = v_isActive,
                Enquiry_Source_Id = Enquiry_Source_Id_,
                Is_Registered = isRegistering_,
                Registered_By = Registered_By_,
                Registration_No = IF(v_Roll_No REGEXP '^[0-9]+$', CAST(v_Roll_No AS UNSIGNED), NULL),
                Registered_On = Registered_On_,
                Mock_Test_Subscribed = Mock_Test_Subscribed_,
                Mock_Test_Package = Mock_Test_Package_,
                Priority = Priority_
            WHERE Student_ID = Student_ID_;

            SET existing_student_id = Student_ID_;
            SET student_action_source = 'Student';
            SET was_existing = 0;
        ELSE
            IF Email_ != '' THEN
                SELECT Student_ID INTO existing_student_id
                FROM student
                WHERE LOWER(Email) = LOWER(Email_) AND Delete_Status = 0
                LIMIT 1;
                
                IF existing_student_id IS NOT NULL THEN
                    SELECT existing_student_id AS Student_ID, 'Student' AS Source, 1 AS existingUser, 1 AS duplicateEmail, 0 AS duplicatePhone, v_Roll_No AS RollNumber;
                    LEAVE main_block;
                END IF;
            END IF;

            IF Phone_Number_ != '' THEN
                SELECT Student_ID INTO existing_student_id
                FROM student
                WHERE Phone_Number = Phone_Number_ AND Country_Code = Country_Code_ AND Delete_Status = 0
                LIMIT 1;
                
                IF existing_student_id IS NOT NULL THEN
                    SELECT existing_student_id AS Student_ID, 'Student' AS Source, 1 AS existingUser, 0 AS duplicateEmail, 1 AS duplicatePhone, v_Roll_No AS RollNumber;
                    LEAVE main_block;
                END IF;
            END IF;

            -- If no duplicates, proceed with insert
            INSERT INTO student (
                First_Name, Last_Name, Email, Phone_Number, Social_Provider, Social_ID,
                Delete_Status, Profile_Photo_Name, Profile_Photo_Path, Avatar,
                Country_Code, Country_Code_Name, Roll_No, Roll_No_Character, Branch_Name, Branch_Id,
                Follow_Up_Date, Admission_Date, Status_Id, Status_Name, To_User_Id, To_User_Name,
                By_User_Id, Remark, Followup_Status, Department_Id, Department_Name, Age, Qualification, Qualification_Description, Alt_Phone_Number,
                Address, Guardian_Type, Guardian_Name, Guardian_Phone, Guardian_Alt_Phone,
                Height_cm, Weight_kg, isActive, Enquiry_Source_Id, Is_Registered, Registered_By, Registration_No, Registered_On,
                Mock_Test_Subscribed, Mock_Test_Package, Priority
            )
            VALUES (
                First_Name_, Last_Name_, Email_, Phone_Number_, Social_Provider_, Social_ID_,
                Delete_Status_, Profile_Photo_Name_, Profile_Photo_Path_, Avatar_,
                Country_Code_, Country_Code_Name_, v_Roll_No, v_Roll_No_Character, Branch_Name_, Branch_Id_,
                Follow_Up_Date_, v_Admission_Date, Status_Id_, v_Status_Name, To_User_Id_, To_User_Name_,
                By_User_Id_, Remark_, Followup_Status_, Department_Id_, Department_Name_, Age_, Qualification_, Qualification_Description_, Alt_Phone_Number_,
                Address_, Guardian_Type_, Guardian_Name_, Guardian_Phone_, Guardian_Alt_Phone_,
                Height_cm_, Weight_kg_, v_isActive, Enquiry_Source_Id_, isRegistering_, Registered_By_, IF(v_Roll_No REGEXP '^[0-9]+$', CAST(v_Roll_No AS UNSIGNED), NULL), Registered_On_,
                Mock_Test_Subscribed_, Mock_Test_Package_, Priority_
            );

            SET existing_student_id = LAST_INSERT_ID();
            SET student_action_source = 'Student';
            SET was_existing = 0;
        END IF;

        -- Insert installments if provided
        IF Installments_JSON IS NOT NULL AND JSON_LENGTH(Installments_JSON) > 0 THEN
            INSERT INTO installments (
                student_id, Installment_information_ID,
                amount, tax_applied, tax_amount,
                payment_mode, cheque_date, payment_status,
                details, created_by, Delete_Status,
                installment_date, batch_id, batch_name,
                course_id, course_name
            )
            SELECT
                existing_student_id,
                JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Installment_information_ID')),
                CAST(JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Amount')) AS DECIMAL(10,2)),
                0.00, 0.00,
                NULL, NULL, 'NOT PAID',
                JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Details')),
                Registered_By_, 0,
                STR_TO_DATE(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.DueDate')), 'T', 1), '%Y-%m-%d'),
                NULL, NULL,
                CAST(JSON_EXTRACT(j.inst, '$.Course_ID') AS UNSIGNED),
                JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Course_Name'))
            FROM JSON_TABLE(Installments_JSON, '$[*]' COLUMNS (
                inst JSON PATH '$'
            )) AS j;

            INSERT INTO student_fees_details (
                Student_ID,
                Installment_information_ID,
                Course_ID,
                Course_Name,
                Total_Amount,
                Paid_Amount,
                Fee_Status,
                Due_Date,
                Delete_Status,
                Installment_Index
            )
            SELECT
                existing_student_id,
                JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Installment_information_ID')),
                CAST(JSON_EXTRACT(j.inst, '$.Course_ID') AS UNSIGNED),
                JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Course_Name')),
                CAST(JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.Amount')) AS DECIMAL(10,2)),
                0.00,
                'Pending',
                CAST(JSON_UNQUOTE(JSON_EXTRACT(j.inst, '$.DueDate')) AS DATE),
                0,
                1
            FROM JSON_TABLE(Installments_JSON, '$[*]' COLUMNS (
                inst JSON PATH '$'
            )) AS j;
        END IF;

        -- Soft delete student_fees_details if IDs are provided
        IF Student_Fees_IDs_JSON IS NOT NULL AND JSON_LENGTH(Student_Fees_IDs_JSON) > 0 THEN
            UPDATE student_fees_details
            SET Delete_Status = 1
            WHERE Student_Fees_ID IN (
                SELECT CAST(j.id AS UNSIGNED)
                FROM JSON_TABLE(Student_Fees_IDs_JSON, '$[*]' COLUMNS (
                    id INT PATH '$'
                )) AS j
            );
        END IF;
        
        -- Update fee balance
        CALL Update_Fee_Balance(existing_student_id);

        -- Final result
        SELECT existing_student_id AS Student_ID, student_action_source AS Source, was_existing AS existingUser, v_Roll_No AS RollNumber;

    END main_block;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_StudentLiveClass`(
	IN p_StudentLiveClass_ID INT,
    IN p_Student_ID INT,
    IN p_LiveClass_ID INT,
    IN p_Start_Time VARCHAR(50),
    IN p_End_Time VARCHAR(50),
    IN p_Attendance_Duration INT
)
BEGIN
    DECLARE v_RecordCount INT;
if p_StudentLiveClass_ID >0 
then
  UPDATE student_live_class
        SET
            End_Time = p_End_Time,
			Attendance_Duration = Attendance_Duration + p_Attendance_Duration, -- Add the current Attendance_Duration to the existing one
            Update_Time = CURRENT_TIMESTAMP

        WHERE
            StudentLiveClass_ID = p_StudentLiveClass_ID;
else
    -- Check if the record exists for the given StudentLiveClass_ID
    SELECT COUNT(*) INTO v_RecordCount
    FROM student_live_class
    WHERE LiveClass_ID = p_LiveClass_ID and Student_ID= p_Student_ID;

		IF v_RecordCount > 0 THEN
			-- Record exists, update Start_Time, End_Time, Attendance_Duration, and Update_Time
			UPDATE student_live_class
			SET
				Start_Time = p_Start_Time,
				End_Time = p_End_Time,
				Attendance_Duration = Attendance_Duration + p_Attendance_Duration, -- Add the current Attendance_Duration to the existing one
				Update_Time = CURRENT_TIMESTAMP
			WHERE
				LiveClass_ID = p_LiveClass_ID 
				AND Student_ID = p_Student_ID;

			-- Retrieve the StudentLiveClass_ID
			SELECT StudentLiveClass_ID INTO p_StudentLiveClass_ID 
			FROM student_live_class
			WHERE LiveClass_ID = p_LiveClass_ID 
			AND Student_ID = p_Student_ID;
	

            
    ELSE
     UPDATE student_live_class
        SET 
            End_Time = Start_Time
       
        WHERE
            Student_ID = p_Student_ID  AND isnull(End_Time) ; 
        -- Record does not exist, insert new record
        INSERT INTO student_live_class (Student_ID, LiveClass_ID, Start_Time, Attendance_Duration, Delete_Status, Update_Time)
        VALUES (p_Student_ID, p_LiveClass_ID, p_Start_Time, p_Attendance_Duration, 0, Start_Time);
		SET p_StudentLiveClass_ID = LAST_INSERT_ID();

    END IF;
    
    end if;
    select p_StudentLiveClass_ID as StudentLiveClass_ID ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Student_Exam`(
    IN p_Student_ID INT,
    IN p_Exam_ID INT,
    IN p_Score INT,
    IN p_Attempted_Date DATE,
    IN p_Answers JSON
)
BEGIN
    DECLARE v_StudentExam_ID INT;
    DECLARE v_JSON_Length INT;
    DECLARE v_Question_ID INT;
    DECLARE v_Submitted_Answer VARCHAR(250);
    DECLARE v_Index INT DEFAULT 0;
    DECLARE v_ExistingRecord INT;

    -- Check if a record already exists for the given Student_ID and Exam_ID
    SELECT COUNT(*) INTO v_ExistingRecord
    FROM student_exam
    WHERE Student_ID = p_Student_ID AND Exam_ID = p_Exam_ID AND Delete_Status = 0;

    IF v_ExistingRecord = 0 THEN
        -- Insert into student_exam table
        INSERT INTO student_exam (Student_ID, Exam_ID, Score, Attempted_Date, Delete_Status)
        VALUES (p_Student_ID, p_Exam_ID, p_Score, p_Attempted_Date, 0);

        -- Get the auto-generated StudentExam_ID
        SET v_StudentExam_ID = LAST_INSERT_ID();

        -- Get the length of the JSON array
        SET v_JSON_Length = JSON_LENGTH(p_Answers);

        -- Loop through the JSON array and insert data into student_exam_answer table
        WHILE v_Index < v_JSON_Length DO
            SET v_Question_ID = JSON_EXTRACT(p_Answers, CONCAT('$[', v_Index, '].questionId'));
            SET v_Submitted_Answer = JSON_EXTRACT(p_Answers, CONCAT('$[', v_Index, '].submittedAnswer'));

            INSERT INTO student_exam_answer (StudentExam_ID, Question_ID, Submitted_Answer, Delete_Status)
            VALUES (v_StudentExam_ID, v_Question_ID, v_Submitted_Answer, 0);

            SET v_Index = v_Index + 1;
        END WHILE;
    ELSE
        -- Raise an error if a record already exists
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A record already exists for the given Student_ID and Exam_ID';
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_Student_Fees_Details`(
    IN p_Student_Fees_ID INT,
    IN p_Student_ID INT,
    IN p_Installment_information_ID INT,
    IN p_Course_ID INT,
    IN p_Course_Name VARCHAR(255),
    IN p_Total_Amount DECIMAL(10,2),
    IN p_Paid_Amount DECIMAL(10,2),
    IN p_Fee_Status VARCHAR(20),
    IN p_Payment_Date DATE,
    IN p_Due_Date DATE,
    IN p_Payment_Mode VARCHAR(50),
    IN p_Transaction_ID VARCHAR(100),
    IN P_Account_id INT,
    IN P_Receipt_Id INT,
    IN P_User_Id INT,
    IN p_Tax_Type_Id INT,
    IN p_Netvalue DECIMAL(18,2),
    IN p_Gstpers DECIMAL(18,2),
    IN p_Cgstpers DECIMAL(18,2),
    IN p_Sgstpers DECIMAL(18,2),
    IN p_Gst DECIMAL(18,2),
    IN p_Cgst DECIMAL(18,2),
    IN p_Sgst DECIMAL(18,2),
    IN p_Fine_Amount DECIMAL(10,2)
)
BEGIN
    DECLARE Branch_Id_ INT;
    DECLARE Voucher_Number_ INT;
    DECLARE Account_Name_ VARCHAR(200);
    DECLARE Old_Input_Tax_Type_Id INT;

    SET Account_Name_ = (
        SELECT Account_Name
        FROM account_heads
        WHERE Account_Id = P_Account_id
        LIMIT 1
    );
    SET Branch_Id_ = (SELECT Branch_Id FROM users WHERE User_ID = P_User_Id);

    IF P_Receipt_Id = 0 THEN
        SET Voucher_Number_ = (SELECT COALESCE(MAX(Voucher_Number), 0) + 1 FROM receipts WHERE Branch = Branch_Id_ AND Tax_Type_Id = p_Tax_Type_Id);
        INSERT INTO receipts (
            Student_Id, Amount, Entry_Date, User_Id, Branch, Account_Id, Account_Name, 
            Transaction_ID, Payment_mode, Voucher_Number, DeleteStatus, Tax_Type_Id, 
            Netvalue, Gstpers, Cgstpers, Sgstpers, Gst, Cgst, Sgst, Payment_Date, Fine_Amount
        )   
        VALUES (
            p_Student_ID, p_Paid_Amount, NOW(), P_User_Id, Branch_Id_, P_Account_id, Account_Name_, 
            p_Transaction_ID, p_Payment_Mode, Voucher_Number_, 0, p_Tax_Type_Id, 
            p_Netvalue, p_Gstpers, p_Cgstpers, p_Sgstpers, p_Gst, p_Cgst, p_Sgst, p_Payment_Date, p_Fine_Amount
        );
    ELSE
        SET Old_Input_Tax_Type_Id = (SELECT Tax_Type_Id FROM receipts WHERE Receipt_Id = P_Receipt_Id);
        IF (p_Tax_Type_Id <> Old_Input_Tax_Type_Id) THEN
            SET Voucher_Number_ = (SELECT COALESCE(MAX(Voucher_Number), 0) + 1 FROM receipts WHERE Branch = Branch_Id_ AND Tax_Type_Id = p_Tax_Type_Id);
        ELSE
            SET Voucher_Number_ = (SELECT Voucher_Number FROM receipts WHERE Receipt_Id = P_Receipt_Id);
        END IF;

        UPDATE receipts
        SET
            Student_Id = p_Student_ID,
            Amount = p_Paid_Amount,
            Entry_Date = NOW(),
            User_Id = P_User_Id,
            Branch = Branch_Id_,
            Account_Id = P_Account_id,
            Account_Name = Account_Name_,
            Payment_mode = p_Payment_Mode,
            Transaction_ID = p_Transaction_ID,
            Voucher_Number = Voucher_Number_,
            Tax_Type_Id = p_Tax_Type_Id,
            Netvalue = p_Netvalue,
            Gstpers = p_Gstpers,
            Cgstpers = p_Cgstpers,
            Sgstpers = p_Sgstpers, 
            Gst = p_Gst,
            Cgst = p_Cgst,
            Sgst = p_Sgst,
            Payment_Date = p_Payment_Date,
            Fine_Amount = p_Fine_Amount
        WHERE
            Receipt_Id = P_Receipt_Id;
    END IF;

    UPDATE receipts r
    JOIN student s ON r.Student_Id = s.Student_ID
    SET r.Roll_No = s.Roll_No
    WHERE r.Roll_No IS NULL OR r.Roll_No != s.Roll_No;

    CALL Update_Fee_Balance(p_Student_ID);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_student_followup`(
    IN Follow_Up_ID_ INT, 
    IN Student_ID_ INT, 
    IN Branch_ID_ INT, 
    IN Branch_Name_ VARCHAR(255), 
    IN Department_ID_ INT, 
    IN Department_Name_ VARCHAR(255), 
    IN Assigned_Staff_ID_ INT, 
    IN Assigned_Staff_Name_ VARCHAR(255), 
    IN Follow_Up_Status_ID_ INT, 
    IN Follow_Up_Status_Name_ VARCHAR(100), 
    IN Next_Follow_Up_Date_ DATE, 
    IN Remark_ TEXT, 
    IN Created_Date_ DATE, 
    IN Created_By_ INT, 
    IN Delete_Status_ TINYINT
)
BEGIN 
    DECLARE _Follow_up_Status int; 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END; 
    
    START TRANSACTION; 
    
    IF Follow_Up_ID_ > 0 THEN 
        UPDATE student_followup SET 
            Branch_ID = Branch_ID_, 
            Branch_Name = Branch_Name_, 
            Department_ID = Department_ID_, 
            Department_Name = Department_Name_, 
            Assigned_Staff_ID = Assigned_Staff_ID_, 
            Assigned_Staff_Name = Assigned_Staff_Name_, 
            Follow_Up_Status_ID = Follow_Up_Status_ID_, 
            Follow_Up_Status_Name = Follow_Up_Status_Name_, 
            Next_Follow_Up_Date = Next_Follow_Up_Date_, 
            Remark = Remark_, 
            Updated_Date = NOW(), 
            Updated_By = Created_By_, 
            Delete_Status = Delete_Status_ 
        WHERE Follow_Up_ID = Follow_Up_ID_; 
    ELSE 
        INSERT INTO student_followup (
            Student_ID, Branch_ID, Branch_Name, Department_ID, Department_Name, 
            Assigned_Staff_ID, Assigned_Staff_Name, Follow_Up_Status_ID, 
            Follow_Up_Status_Name, Next_Follow_Up_Date, Remark, Created_Date, 
            Created_By, Delete_Status
        ) VALUES (
            Student_ID_, Branch_ID_, Branch_Name_, Department_ID_, Department_Name_, 
            Assigned_Staff_ID_, Assigned_Staff_Name_, Follow_Up_Status_ID_, 
            Follow_Up_Status_Name_, Next_Follow_Up_Date_, Remark_, Created_Date_, 
            Created_By_, Delete_Status_
        ); 
        SET Follow_Up_ID_ = LAST_INSERT_ID(); 
    END IF; 
    
    SET _Follow_up_Status = (SELECT Is_Active FROM followup_status WHERE Status_Id = Follow_Up_Status_ID_ LIMIT 1); 
    
    UPDATE student SET 
        Followup_Status = COALESCE(_Follow_up_Status, 1), 
        Status_Id = Follow_Up_Status_ID_,
        Branch_Id = Branch_ID_, 
        Branch_Name = Branch_Name_, 
        Department_Id = Department_ID_, 
        Department_Name = Department_Name_, 
        Status_Name = Follow_Up_Status_Name_, 
        Remark = Remark_, 
        To_User_Id = Assigned_Staff_ID_, 
        To_User_Name = Assigned_Staff_Name_, 
        Follow_Up_Date = Next_Follow_Up_Date_ 
    WHERE Student_ID = Student_ID_; 
    
    COMMIT; 
    
    SELECT Follow_Up_ID_ AS Follow_Up_ID, 'Success' AS Status; 
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_User`(
 IN User_ID_ INT,
    IN First_Name_ VARCHAR(50),
    IN Last_Name_ VARCHAR(100),
    IN Email_ VARCHAR(100),
    IN PhoneNumber_ VARCHAR(50),
    IN Delete_Status_ TINYINT,
    IN User_Type_Id_ INT,
    IN User_Role_Id_ INT,
    IN Branch_Id_ INT,
    IN User_Status_ VARCHAR(50),
    IN password_ VARCHAR(50),
    IN Device_ID_ LONGTEXT,
    IN Profile_Photo_Name_ LONGTEXT,
    IN Profile_Photo_Path_ LONGTEXT,
    IN Course_IDs_ JSON,  -- JSON array of course IDs
    IN Hod_ BOOLEAN,
	IN teacherCourses JSON,
    IN Basic_Pay_ DECIMAL(10,2)
)
BEGIN
    DECLARE emailExists INT;
    DECLARE phoneExists INT;
    DECLARE emailExistsInStudent INT;
    DECLARE courseIndex INT DEFAULT 0;
    DECLARE HodtotalCourses INT;

#for time slots
	DECLARE temp_start_time VARCHAR(20);
	DECLARE temp_end_time VARCHAR(20);
    
    DECLARE v_TimeSlotcourseIndex INT DEFAULT 0;
    DECLARE v_totalCourses INT;
    DECLARE v_totalSlots INT;
    DECLARE v_slotIndex INT;
    DECLARE v_course JSON;
    DECLARE v_courseTeacher_ID INT;
    DECLARE v_Course_ID INT;
    DECLARE v_Delete_Status TINYINT;
    DECLARE v_slot JSON;
    DECLARE v_Slot_Id INT;
    DECLARE v_start_time VARCHAR(50);
    DECLARE v_end_time VARCHAR(50);
    DECLARE v_Batch_ID INT;
    
    -- Check for existing email in users table (case-insensitive)
    SELECT COUNT(*)
    INTO emailExists
    FROM users
    WHERE LOWER(Email) = LOWER(Email_) AND User_ID <> User_ID_ AND Delete_Status = 0;

    -- Check for existing phone number in users table
    SELECT COUNT(*)
    INTO phoneExists
    FROM users
    WHERE PhoneNumber = PhoneNumber_ AND User_ID <> User_ID_ AND Delete_Status = 0;

    -- Check if email exists in the student table (case-insensitive)
    SELECT COUNT(*)
    INTO emailExistsInStudent
    FROM student
    WHERE LOWER(Email) = LOWER(Email_) AND Delete_Status = 0;

    -- If email or phone number exists in users table, or email exists in student table, signal an error
    IF emailExists > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists in users';
    ELSEIF phoneExists > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Phone number already exists in users';
    ELSEIF emailExistsInStudent > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already exists in students';
    ELSE
        -- Update existing user
        IF User_ID_ > 0 THEN
            insert into data_log values (442,User_Type_Id_);

            UPDATE users
            SET First_Name = First_Name_,
                Last_Name = Last_Name_,
                Email = Email_,
                PhoneNumber = PhoneNumber_,
                Delete_Status = Delete_Status_,
                User_Type_Id = User_Type_Id_,
                User_Role_Id = User_Role_Id_,
                Branch_Id = Branch_Id_,
                Device_ID = Device_ID_,
                Profile_Photo_Name = Profile_Photo_Name_,
                Profile_Photo_Path = Profile_Photo_Path_,
                password = password_,
                Basic_Pay = Basic_Pay_
            WHERE User_ID = User_ID_;
        ELSE
            -- Insert new user
            INSERT INTO users (First_Name, Last_Name, Email, PhoneNumber, Delete_Status, User_Type_Id, User_Role_Id,Branch_Id, password, Profile_Photo_Name, Profile_Photo_Path, Device_ID, Basic_Pay)
            VALUES (First_Name_, Last_Name_, Email_, PhoneNumber_, Delete_Status_, User_Type_Id_, User_Role_Id_,Branch_Id_, password_, Profile_Photo_Name_, Profile_Photo_Path_, Device_ID_, Basic_Pay_);
            SET User_ID_ = LAST_INSERT_ID();
        END IF;

        -- Additional logic for course and user type handling
        IF User_Type_Id_ = 2 THEN
            DELETE FROM course_hod WHERE User_ID = User_ID_;
            
            SET v_totalCourses = JSON_LENGTH(teacherCourses);
            insert into data_log values (2,v_TimeSlotcourseIndex);
            insert into data_log values (3,v_totalCourses);
            WHILE v_TimeSlotcourseIndex < v_totalCourses DO
                insert into data_log values (256,v_TimeSlotcourseIndex);

                -- Extract each teacherCourse
                SET v_course = JSON_EXTRACT(teacherCourses, CONCAT('$[', v_TimeSlotcourseIndex, ']'));
                insert into data_log values (73,v_course);

                SET v_CourseTeacher_ID = JSON_UNQUOTE(JSON_EXTRACT(v_course, '$.CourseTeacher_ID'));
                insert into data_log values (64,v_CourseTeacher_ID);

                SET v_Course_ID = JSON_UNQUOTE(JSON_EXTRACT(v_course, '$.Course_ID'));
                insert into data_log values (65,v_Course_ID);

                SET v_Delete_Status = JSON_UNQUOTE(JSON_EXTRACT(v_course, '$.Delete_Status'));

                IF v_CourseTeacher_ID IS NULL or v_CourseTeacher_ID <= 0 THEN
                    -- Insert new course_teacher
                    INSERT INTO course_teacher (Course_ID, Teacher_ID, Delete_Status)
                    VALUES (v_Course_ID, User_ID_, v_Delete_Status);
                    SET v_CourseTeacher_ID = LAST_INSERT_ID();
                ELSE
                    -- Update existing course_teacher
                    UPDATE course_teacher
                    SET Course_ID = v_Course_ID,
                        Teacher_ID = User_ID_,
                        Delete_Status = v_Delete_Status
                    WHERE CourseTeacher_ID = v_CourseTeacher_ID;
                END IF;

                -- Process timeSlots within this teacherCourse
                SET v_totalSlots = JSON_LENGTH(JSON_EXTRACT(v_course, '$.timeSlots'));
                SET v_slotIndex = 0;

                WHILE v_slotIndex < v_totalSlots DO
                    SET v_slot = JSON_EXTRACT(v_course, CONCAT('$.timeSlots[', v_slotIndex, ']'));
                    SET v_Slot_Id = JSON_UNQUOTE(JSON_EXTRACT(v_slot, '$.Slot_Id'));
                    SET temp_start_time = JSON_UNQUOTE(JSON_EXTRACT(v_slot, '$.start_time'));
                    SET temp_end_time = JSON_UNQUOTE(JSON_EXTRACT(v_slot, '$.end_time'));
                    SET v_Batch_ID = JSON_UNQUOTE(JSON_EXTRACT(v_slot, '$.Batch_ID'));
                    SET v_Delete_Status = JSON_UNQUOTE(JSON_EXTRACT(v_slot, '$.Delete_Status'));
                    
                    SET v_start_time = CASE 
                        WHEN temp_start_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
                        THEN TIME_FORMAT(STR_TO_DATE(temp_start_time, '%l:%i %p'), '%H:%i')
                        ELSE TIME_FORMAT(TIME(temp_start_time), '%H:%i')
                    END;

                    SET v_end_time = CASE 
                        WHEN temp_end_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
                        THEN TIME_FORMAT(STR_TO_DATE(temp_end_time, '%l:%i %p'), '%H:%i')
                        ELSE TIME_FORMAT(TIME(temp_end_time), '%H:%i')
                    END;

                    IF v_Slot_Id IS NULL OR v_Slot_Id <= 0 THEN
                        -- Insert new teacher_time_slot
                        IF v_Batch_ID > 0 THEN
                            INSERT INTO teacher_time_slot (CourseTeacher_ID, start_time, end_time, batch_id, Delete_Status)
                            VALUES (v_CourseTeacher_ID, v_start_time, v_end_time, v_Batch_ID, v_Delete_Status);
                        ELSE
                            INSERT INTO teacher_time_slot (CourseTeacher_ID, start_time, end_time, Delete_Status)
                            VALUES (v_CourseTeacher_ID, v_start_time, v_end_time, v_Delete_Status);
                        END IF;
                    ELSE
                        -- Update existing teacher_time_slot (skip batch_id update if NULL)
                        IF v_Batch_ID > 0 THEN
                            UPDATE teacher_time_slot
                            SET start_time = v_start_time,
                                end_time = v_end_time,
                                batch_id = v_Batch_ID,
                                Delete_Status = v_Delete_Status
                            WHERE Slot_Id = v_Slot_Id;
                        ELSE
                            UPDATE teacher_time_slot
                            SET start_time = v_start_time,
                                end_time = v_end_time,
                                batch_id = Null,
                                Delete_Status = v_Delete_Status
                            WHERE Slot_Id = v_Slot_Id;
                        END IF;
                    END IF;

                    SET v_slotIndex = v_slotIndex + 1;
                END WHILE;

                SET v_TimeSlotcourseIndex = v_TimeSlotcourseIndex + 1;
            END WHILE;

        ELSEIF User_Type_Id_ = 3 THEN
            IF EXISTS (SELECT 1 FROM course_teacher WHERE Teacher_ID = User_ID_ AND Delete_Status = 0) THEN
                UPDATE users SET User_Type_Id = 2 WHERE User_ID = User_ID_;
                SET User_ID_ = -1;
            ELSE
                DELETE FROM course_hod WHERE User_ID = User_ID_;
                
                -- Get total number of items in the Course_IDs_ JSON array
                SET HodtotalCourses = JSON_LENGTH(Course_IDs_);
 
                -- Loop through each Course_ID in the JSON array and insert into course_hod
                WHILE courseIndex < HodtotalCourses DO
                    INSERT INTO course_hod (Course_ID, User_ID, Delete_Status)
                    VALUES (CAST(JSON_EXTRACT(Course_IDs_, CONCAT('$[', courseIndex, ']')) AS UNSIGNED), User_ID_, 0);
                    SET courseIndex = courseIndex + 1;
                END WHILE;
            END IF;
        END IF;
    END IF;
    insert into data_log values (2546,v_TimeSlotcourseIndex);

    -- Return User_ID
    SELECT User_ID_ AS User_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_User_Invoice`(
    IN p_Invoice_Id INT,
    IN p_invoice_date VARCHAR(50),
    IN p_name VARCHAR(100),
    IN p_position VARCHAR(50),
    IN p_course_name VARCHAR(100),
    IN p_payment_period VARCHAR(50),
    IN p_class_hours VARCHAR(20),
    IN p_total_amount VARCHAR(20),
    IN p_approved_by VARCHAR(100),
    IN p_user_Id INT,
    IN p_Course_Id INT
)
BEGIN
    -- Check if Invoice_Id exists
    IF p_Invoice_Id > 0 THEN
        -- Update existing record
        UPDATE invoices 
        SET 
            invoice_date = p_invoice_date,
            name = p_name,
            position = p_position,
            course_name = p_course_name,
            payment_period = p_payment_period,
            class_hours = p_class_hours,
            total_amount = p_total_amount,
            approved_by = p_approved_by,
            user_Id = p_user_Id,
            Course_Id = p_Course_Id
        WHERE Invoice_Id = p_Invoice_Id;
        
        -- Return the updated Invoice_Id
        SELECT p_Invoice_Id AS Invoice_Id;
    ELSE
        -- Insert new record
        INSERT INTO invoices (
            invoice_date,
            name,
            position,
            course_name,
            payment_period,
            class_hours,
            total_amount,
            approved_by,
            user_Id,
            Course_Id
        )
        VALUES (
            p_invoice_date,
            p_name,
            p_position,
            p_course_name,
            p_payment_period,
            p_class_hours,
            p_total_amount,
            p_approved_by,
            p_user_Id,
            p_Course_Id
        );
        
        -- Return the newly inserted Invoice_Id
        SELECT LAST_INSERT_ID() AS Invoice_Id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Save_User_Permission`(
  
   p_json_data JSON
)
BEGIN
  Declare p_User_Id INT;
  DECLARE v_exists INT;
  DECLARE p_Menu_Id INT;
  DECLARE v_index INT default 0;
  DECLARE p_IsView TINYINT;
  DECLARE p_IsSave TINYINT;
  DECLARE p_IsEdit TINYINT;
  DECLARE p_IsDelete TINYINT;
  DECLARE v_current_record JSON;
  DECLARE v_total_count INT DEFAULT JSON_LENGTH(p_json_data);
  
 WHILE v_index < v_total_count DO
        SET v_current_record = JSON_EXTRACT(p_json_data, CONCAT('$[', v_index, ']'));
		SET p_User_Id = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.User_Id'));
        SET p_Menu_Id = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.Menu_ID'));
        SET p_IsView = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.View'));
        SET p_IsEdit = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.Edit'));
        SET p_IsSave = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.Save'));
        SET p_IsDelete = JSON_UNQUOTE(JSON_EXTRACT(v_current_record, '$.Delete'));
        if v_index=0 then
			delete from user_menu_selection where User_Id=p_User_Id;
		end if;
        INSERT INTO user_menu_selection
    (User_Id, Menu_Id, IsView, IsSave, IsEdit, IsDelete, DeleteStatus)
    VALUES (p_User_Id, p_Menu_Id, p_IsView, p_IsSave, p_IsEdit, p_IsDelete, 0);
        SET v_index = v_index + 1;
END WHILE;
select p_User_Id as User_Id;
  
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_all_course`(
    IN course_Name_ VARCHAR(100),
    IN course_type_ VARCHAR(100),
    IN student_ID_ VARCHAR(100),
    IN priceFrom DECIMAL(10,2),
    IN priceTo DECIMAL(10,2)
)
BEGIN
    SET @query = 'SELECT c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Delete_Status, c.Disable_Status, c.Live_Class_Enabled, 
                         c.Thumbnail_Path, c.Thumbnail_Name, c.created_at, COUNT(cc.Course_Id) AS total_content_count
                  FROM course c 
                  LEFT JOIN course_content cc ON cc.Course_Id = c.Course_ID AND cc.Delete_Status = 0 
                  WHERE c.Delete_Status = 0';

    IF course_Name_ <> '' THEN
        SET course_Name_ = CONCAT('%', course_Name_, '%');
        SET @query = CONCAT(@query, ' AND c.Course_Name LIKE ''', course_Name_, '''');
    END IF;

    IF priceFrom > 0 OR priceTo > 0 THEN
        SET @query = CONCAT(@query, ' AND (c.Price BETWEEN ', priceFrom, ' AND ', priceTo, ')');
    END IF;

    SET @query = CONCAT(@query, ' GROUP BY c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Delete_Status, c.Disable_Status, 
                           c.Live_Class_Enabled, c.Thumbnail_Path, c.Thumbnail_Name, c.created_at 
                           ORDER BY c.Course_ID DESC');

    PREPARE stmt FROM @query;
    EXECUTE stmt;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Attendance_Summary`(
    IN p_fromDate VARCHAR(20),
    IN p_toDate VARCHAR(20),
    IN p_teacherId INT,
    IN p_status INT
)
BEGIN
    -- Result set 1: Detailed records
    SELECT 
        am.Attendance_Date as Date,
        CONCAT(s.First_Name, ' ', IFNULL(s.Last_Name, '')) as Student_Name,
        c.Course_Name,
        b.Batch_Name,
        CONCAT(u.First_Name, ' ', IFNULL(u.Last_Name, '')) as Teacher_Name,
        CASE WHEN ad.Status = 1 THEN 'Present' ELSE 'Absent' END as Status
    FROM attendance_master am
    JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
    JOIN student s ON ad.Student_ID = s.Student_ID
    JOIN course c ON am.Course_ID = c.Course_ID
    JOIN course_batch b ON am.Batch_ID = b.Batch_ID
    JOIN users u ON am.Marked_By = u.User_ID
    WHERE (p_fromDate = '' OR am.Attendance_Date >= p_fromDate)
    AND (p_toDate = '' OR am.Attendance_Date <= p_toDate)
    AND (p_teacherId = 0 OR am.Marked_By = p_teacherId)
    AND (p_status = -1 OR ad.Status = p_status)
    ORDER BY am.Attendance_Date DESC;

    -- Result set 2: Summary counts
    SELECT 
        SUM(CASE WHEN ad.Status = 1 THEN 1 ELSE 0 END) as Total_Present,
        SUM(CASE WHEN ad.Status = 0 THEN 1 ELSE 0 END) as Total_Absent,
        COUNT(*) as Total_Count
    FROM attendance_master am
    JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
    WHERE (p_fromDate = '' OR am.Attendance_Date >= p_fromDate)
    AND (p_toDate = '' OR am.Attendance_Date <= p_toDate)
    AND (p_teacherId = 0 OR am.Marked_By = p_teacherId)
    AND (p_status = -1 OR ad.Status = p_status);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Batch`(
    IN p_Batch_Name VARCHAR(200)
)
BEGIN
    SET p_Batch_Name = IFNULL(p_Batch_Name, '');
    
    SELECT 
        cb.*,
        c.Course_Name,
        CASE 
            WHEN cb.End_Date < CURDATE() THEN TRUE
            ELSE FALSE
        END AS is_expired
    FROM course_batch cb
    INNER JOIN course c ON c.Course_ID = cb.Course_ID
    WHERE cb.Delete_Status = FALSE AND cb.Batch_Name LIKE CONCAT('%', p_Batch_Name, '%')
    ORDER BY 
        is_expired ASC,
        CASE 
            WHEN cb.End_Date < CURDATE() THEN cb.End_Date
            ELSE cb.Start_Date
        END DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Campaign`(IN Campaign_Name_ VARCHAR(255))
BEGIN
                SELECT 
                    c.*, 
                    (
                        SELECT GROUP_CONCAT(CONCAT(u.First_Name, ' ', u.Last_Name) SEPARATOR ', ')
                        FROM campaign_user cu
                        JOIN users u ON cu.User_ID = u.User_ID
                        WHERE cu.Campaign_ID = c.Campaign_ID
                    ) AS User_Names,
                    (
                        SELECT JSON_ARRAYAGG(cu.User_ID)
                        FROM campaign_user cu
                        WHERE cu.Campaign_ID = c.Campaign_ID
                    ) AS User_IDs
                FROM campaign c
                WHERE (Campaign_Name_ = '' OR c.Campaign_Name LIKE CONCAT('%', Campaign_Name_, '%'))
                AND c.Delete_Status = 0
                ORDER BY c.Created_At DESC;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_course`(
    IN course_Name_ VARCHAR(100),
    IN course_type_ VARCHAR(100),
    IN student_ID_ VARCHAR(100),
    IN priceFrom DECIMAL(10,2),
    IN priceTo DECIMAL(10,2)
)
BEGIN
    -- Initialize the base query for the 'course' table search
    SET @query = 'SELECT c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Delete_Status, c.Disable_Status, c.Live_Class_Enabled, 
                         c.Thumbnail_Path, c.Thumbnail_Name, c.created_at, COUNT(cc.Course_Id) AS total_content_count
                  FROM course c 
                  LEFT JOIN course_content cc ON cc.Course_Id = c.Course_ID AND cc.Delete_Status = 0 
                  WHERE c.Delete_Status = 0 
                  AND c.Disable_Status = 0';

    -- Append condition for course name if provided
    IF course_Name_ <> '' THEN
        SET course_Name_ = CONCAT('%', course_Name_, '%');
        SET @query = CONCAT(@query, ' AND c.Course_Name LIKE ''', course_Name_, '''');
    END IF;

    -- Append the price range condition if provided
    IF priceFrom > 0 OR priceTo > 0 THEN
        SET @query = CONCAT(@query, ' AND (c.Price BETWEEN ', priceFrom, ' AND ', priceTo, ')');
    END IF;

    -- Append the ORDER BY clause (this is common for all)
    SET @query = CONCAT(@query, ' GROUP BY c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Delete_Status, c.Disable_Status, 
                           c.Live_Class_Enabled, c.Thumbnail_Path, c.Thumbnail_Name, c.created_at 
                           ORDER BY c.Course_ID DESC');

    -- Execute different queries based on course_type_
    IF course_type_ = 'popular' THEN
        SET @query = CONCAT('
                SELECT cr.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Live_Class_Enabled, AVG(cr.Rating) AS AverageRating, 
                       c.Thumbnail_Path, c.Thumbnail_Name, c.created_at, COUNT(cc.Course_Id) AS total_content_count
                FROM course_reviews cr
                JOIN course c ON cr.Course_ID = c.Course_ID
                LEFT JOIN course_content cc ON cc.Course_Id = c.Course_ID AND cc.Delete_Status = 0
                WHERE cr.Delete_Status = 0 AND c.Delete_Status = 0');

        -- Append the group by for popular courses (rating)
        SET @query = CONCAT(@query, ' GROUP BY cr.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Live_Class_Enabled, 
                               c.Thumbnail_Path, c.Thumbnail_Name, c.created_at ORDER BY AverageRating DESC');
    
    ELSEIF course_type_ = 'recommended' THEN
        SET @query = CONCAT('
                SELECT c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Live_Class_Enabled, c.Thumbnail_Path, 
                       c.Thumbnail_Name, c.created_at, COUNT(cc.Course_Id) AS total_content_count
                FROM student_interested_course sc
                JOIN course c ON sc.course_id = c.Course_ID
                LEFT JOIN course_content cc ON cc.Course_Id = c.Course_ID AND cc.Delete_Status = 0
                WHERE c.Delete_Status = 0 AND sc.student_id = ', student_ID_);

        -- Add the necessary GROUP BY for recommended courses as well
        SET @query = CONCAT(@query, ' GROUP BY c.Course_ID, c.Course_Name, c.Category_ID, c.Validity, c.Price, c.Live_Class_Enabled, 
                               c.Thumbnail_Path, c.Thumbnail_Name, c.created_at');
    END IF;

    -- Prepare and execute the final dynamic query for course details with course content count
    PREPARE stmt FROM @query;
    EXECUTE stmt;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_course_category`(
    IN course_category_Name_ VARCHAR(100),
    IN allCategoryNeeded VARCHAR(100)
)
BEGIN
    SET course_category_Name_ = CONCAT('%', course_category_Name_, '%');
    
    IF allCategoryNeeded = 'false' THEN
        SELECT Category_ID,
               Category_Name,
               Delete_Status,
               Enabled_Status
        FROM course_category
        WHERE Category_Name LIKE course_category_Name_
          AND Delete_Status = false
          AND Enabled_Status = true;
    ELSE
        SELECT Category_ID,
               Category_Name,
               Delete_Status,
               Enabled_Status
        FROM course_category
        WHERE Category_Name LIKE course_category_Name_
          AND Delete_Status = false;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_course_module`(
    IN course_module_Name_ VARCHAR(100),
    IN allModuleNeeded VARCHAR(100)
)
BEGIN
    SET course_module_Name_ = CONCAT('%', course_module_Name_, '%');
    
    IF allModuleNeeded = 'false' THEN
        SELECT Module_ID,
               Module_Name,
               Delete_Status,
               Enabled_Status,View_Order
        FROM course_module
        WHERE Module_Name LIKE course_module_Name_
          AND Delete_Status = false
          AND Enabled_Status = true order by View_Order ,Module_ID desc;
    ELSE
        SELECT Module_ID,
               Module_Name,
               Delete_Status,
               Enabled_Status,View_Order
        FROM course_module
        WHERE Module_Name LIKE course_module_Name_
          AND Delete_Status = false  order by View_Order  ,Module_ID desc;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Email_Template`(
                IN p_Search_Term VARCHAR(100)
            )
BEGIN
                SET p_Search_Term = CONCAT('%', IFNULL(p_Search_Term, ''), '%');
                SELECT * FROM email_templates 
                WHERE Template_Name LIKE p_Search_Term 
                AND Delete_Status = 0;
            END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Expense_Type`(
    IN p_Search_Term VARCHAR(100)
)
BEGIN
    SELECT 
        Expense_Type_Id,
        Expense_Type_Name
    FROM 
        Expense_Type
    WHERE 
        Expense_Type_Name LIKE CONCAT(p_Search_Term, '%')
        AND Delete_Status = 0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_menu`( In menu_Name_ varchar(100))
Begin 
 set menu_Name_ = Concat( '%',menu_Name_ ,'%');
 SELECT Menu_ID,
Menu_Name,
Route,
Parent_Menu_ID,
Delete_Status From menu where menu_Name like menu_Name_ and DeleteStatus=false ;
 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Occupations`()
BEGIN
    SELECT 
        Occupation_Id,
        occupation
        
    FROM 
        occupation where Delete_Status=false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Receipts_and_Expense`(
    IN p_User_Id INT,
    IN p_Account_Name VARCHAR(255),
    IN p_Type VARCHAR(50),
    IN p_FromDate DATE,
    IN p_ToDate DATE
)
BEGIN
    -- Results Query
    SELECT *, COUNT(*) OVER() AS TotalCount FROM (
        SELECT 
            r.Receipt_Id AS Id,
            'Receipt' AS Type,
            r.Payment_Date AS Date,
            r.Account_Name,
            r.Amount AS Amount,
            r.Fine_Amount AS Fine_Amount,
            '-' AS Expense_Type,
            r.Transaction_ID AS Description,
            u.First_Name AS User_Name,
            b.Branch_Name,
            r.User_Id,
            r.Entry_Date
        FROM receipts r
        LEFT JOIN users u ON r.User_Id = u.User_ID
        LEFT JOIN branches b ON r.Branch = b.Branch_Id
        WHERE (r.DeleteStatus = 0 OR r.DeleteStatus IS NULL)

        UNION ALL

        SELECT 
            e.Expense_Id AS Id,
            'Expense' AS Type,
            e.Entry_Date AS Date,
            e.Account_Name,
            e.Amount,
            0 AS Fine_Amount,
            et.Expense_Type_Name AS Expense_Type,
            e.Description,
            u.First_Name AS User_Name,
            NULL AS Branch_Name,
            e.User_Id,
            e.Entry_Date
        FROM Expense e
        LEFT JOIN users u ON e.User_Id = u.User_ID
        LEFT JOIN expense_type et ON e.Expense_Type_Id = et.Expense_Type_Id
        WHERE e.Delete_Status = 0

        UNION ALL

        SELECT 
            i.Income_Id AS Id,
            'Income' AS Type,
            i.Entry_Date AS Date,
            i.Account_Name,
            i.Amount,
            0 AS Fine_Amount,
            et.Expense_Type_Name AS Expense_Type,
            i.Description,
            u.First_Name AS User_Name,
            NULL AS Branch_Name,
            i.User_Id,
            i.Entry_Date
        FROM income i
        LEFT JOIN users u ON i.User_Id = u.User_ID
        LEFT JOIN expense_type et ON i.Expense_Type_Id = et.Expense_Type_Id
        WHERE i.Delete_Status = 0
    ) AS combined
    WHERE 
        (p_User_Id IS NULL OR User_Id = p_User_Id) AND
        (p_Account_Name IS NULL OR Account_Name = p_Account_Name) AND
        (p_Type IS NULL OR p_Type = '' OR Type = p_Type) AND
        (p_FromDate IS NULL OR DATE(Date) >= p_FromDate) AND
        (p_ToDate IS NULL OR DATE(Date) <= p_ToDate)
    ORDER BY Date DESC;

    -- Summary Totals
    SELECT 
        IFNULL(SUM(CASE WHEN Type IN ('Receipt', 'Income') THEN Amount ELSE 0 END), 0) AS Total_Amount,
        IFNULL(SUM(CASE WHEN Type = 'Expense' THEN Amount ELSE 0 END), 0) AS Expense_Amount,
        IFNULL(SUM(CASE WHEN Type = 'Receipt' THEN Fine_Amount ELSE 0 END), 0) AS Total_Fine,
        (IFNULL(SUM(CASE WHEN Type IN ('Receipt', 'Income') THEN Amount ELSE 0 END), 0) + 
         IFNULL(SUM(CASE WHEN Type = 'Receipt' THEN Fine_Amount ELSE 0 END), 0) - 
         IFNULL(SUM(CASE WHEN Type = 'Expense' THEN Amount ELSE 0 END), 0)) AS Closing_Amount
    FROM (
        SELECT 'Receipt' AS Type, Amount, Fine_Amount, User_Id, Account_Name, Payment_Date AS Date FROM receipts WHERE (DeleteStatus = 0 OR DeleteStatus IS NULL)
        UNION ALL
        SELECT 'Expense' AS Type, Amount, 0 AS Fine_Amount, User_Id, Account_Name, Entry_Date AS Date FROM Expense WHERE Delete_Status = 0
        UNION ALL
        SELECT 'Income' AS Type, Amount, 0 AS Fine_Amount, User_Id, Account_Name, Entry_Date AS Date FROM income WHERE Delete_Status = 0
    ) AS summary
    WHERE 
        (p_User_Id IS NULL OR User_Id = p_User_Id) AND
        (p_Account_Name IS NULL OR Account_Name = p_Account_Name) AND
        (p_Type IS NULL OR p_Type = '' OR Type = p_Type) AND
        (p_FromDate IS NULL OR DATE(Date) >= p_FromDate) AND
        (p_ToDate IS NULL OR DATE(Date) <= p_ToDate);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_Section`()
BEGIN
select * from section ;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_student`(
                    IN search_term VARCHAR(100),
                    IN page_number INT,
                    IN page_size INT,
                    IN filter_course_id INT,
                    IN filter_batch_id INT,
                    IN enrollment_status VARCHAR(50),
                    IN active_status VARCHAR(20),
                    IN filter_subscribed VARCHAR(20),
                    IN filter_roll_number VARCHAR(100),
                    IN p_user_id INT,
                    IN p_user_type_id INT
                )
BEGIN
                    DECLARE offset_value INT;
                    DECLARE v_is_special_admin INT DEFAULT 0;
                    DECLARE v_allowed_staff_list TEXT;

                    SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
                    SET search_term = CONCAT('%', IFNULL(search_term, ''), '%');
                    SET offset_value = (IFNULL(page_number, 1) - 1) * IFNULL(page_size, 10);

                    IF enrollment_status IS NULL THEN SET enrollment_status = 'all'; END IF;
                    IF active_status IS NULL THEN SET active_status = 'all'; END IF;
                    IF filter_subscribed IS NULL THEN SET filter_subscribed = 'all'; END IF;

                    IF p_user_type_id = 1 OR p_user_id = 1 THEN
                        SET v_is_special_admin = 1;
                    ELSEIF p_user_id IS NOT NULL AND p_user_id > 0 THEN
                        SELECT IF(COUNT(*) > 0, 1, 0) INTO v_is_special_admin 
                        FROM users 
                        WHERE User_ID = p_user_id 
                          AND (Email = 'admin_user@G.COM' OR Email = 'cs.mgr@testprepinenglish.com' OR User_ID = 1 OR User_Type_Id = 1);

                        WITH RECURSIVE staff_hierarchy AS (
                            SELECT p_user_id as staff_id
                            UNION ALL
                            SELECT sta.staff_user_id as staff_id
                            FROM staff_team_assignment sta
                            INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
                            WHERE sta.staff_user_id <> 1
                        )
                        SELECT GROUP_CONCAT(DISTINCT staff_id) INTO v_allowed_staff_list FROM staff_hierarchy;

                        IF v_allowed_staff_list IS NULL THEN
                            SET v_allowed_staff_list = CAST(p_user_id AS CHAR);
                        END IF;
                    ELSE
                        SET v_is_special_admin = 1;
                    END IF;

                    -- Get total count
                    SELECT COUNT(DISTINCT s.Student_ID) AS total_count
                    FROM student s
                    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
                    WHERE
                        s.Delete_Status = false
                        AND (
                            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
                            s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term OR
                            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR
                            s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
                        )
                        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
                        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
                        AND (
                            enrollment_status = 'all'
                            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
                            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
                        )
                        AND (
                            (active_status = 'active' AND s.isActive = 1) OR
                            (active_status = 'deactivated' AND s.isActive = 0) OR
                            (active_status = 'all')
                        )
                        AND (
                            (filter_subscribed = 'yes' AND s.Mock_Test_Subscribed = 1) OR
                            (filter_subscribed = 'no' AND (s.Mock_Test_Subscribed = 0 OR s.Mock_Test_Subscribed IS NULL)) OR
                            (filter_subscribed = 'all')
                        )
                        AND (filter_roll_number IS NULL OR filter_roll_number = '' OR s.Roll_No LIKE CONCAT('%', filter_roll_number, '%') OR s.Roll_No_Character LIKE CONCAT('%', filter_roll_number, '%'))
                        AND (
                            v_is_special_admin = 1
                            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
                            OR COALESCE(NULLIF(sc.Slot_Id, 0), sc.Requested_Slot_Id) IN (
                                SELECT tts.Slot_Id 
                                FROM teacher_time_slot tts 
                                JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                                WHERE FIND_IN_SET(ct.Teacher_ID, v_allowed_staff_list) > 0 
                                  AND IFNULL(tts.Delete_Status, 0) = 0 
                                  AND IFNULL(ct.Delete_Status, 0) = 0
                            )
                        );

                    -- Get paginated data
                    SELECT
                        s.Student_ID,
                        s.First_Name,
                        s.Last_Name,
                        s.Email,
                        s.Country_Code,
                        s.Phone_Number,
                        s.Profile_Photo_Path,
                        s.Profile_Photo_Name,
                        s.Branch_Id,
                        s.Branch_Name,
                        s.Status_Name,
                        s.To_User_Name,
                        s.Qualification,
                        s.Follow_Up_Date,
                        s.Remark,
                        s.isActive,
                        s.Is_Registered,
                        s.Roll_No,
                        s.Roll_No_Character,
                        s.Entry_Date,
                        s.Registered_On,
                        s.Delete_Status,
                        s.Mock_Test_Subscribed,
                        s.Mock_Test_Package,
                        s.Admission_Date,
                        s.Enquiry_Source_Id,
                        s.Guardian_Type,
                        s.Guardian_Name,
                        s.Address,
                        MAX(c.Course_Name) AS Course_Name,
                        MAX(cb.Batch_Name) AS Batch_Name,
                        CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM student_course sc2
                                JOIN course c2 ON sc2.Course_ID = c2.Course_ID
                                WHERE sc2.Student_ID = s.Student_ID
                                AND IFNULL(sc2.Delete_Status, 0) = 0
                                AND c2.Delete_Status = 0
                            ) THEN true
                            ELSE false
                        END AS is_enrolled
                    FROM
                        student s
                    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    LEFT JOIN course c ON sc.Course_ID = c.Course_ID
                    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
                    WHERE
                        s.Delete_Status = false
                        AND (
                            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
                            s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term OR
                            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
                        )
                        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
                        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
                        AND (
                            enrollment_status = 'all'
                            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
                            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
                        )
                        AND (
                            (active_status = 'active' AND s.isActive = 1) OR
                            (active_status = 'deactivated' AND s.isActive = 0) OR
                            (active_status = 'all')
                        )
                        AND (
                            (filter_subscribed = 'yes' AND s.Mock_Test_Subscribed = 1) OR
                            (filter_subscribed = 'no' AND (s.Mock_Test_Subscribed = 0 OR s.Mock_Test_Subscribed IS NULL)) OR
                            (filter_subscribed = 'all')
                        )
                        AND (filter_roll_number IS NULL OR filter_roll_number = '' OR s.Roll_No LIKE CONCAT('%', filter_roll_number, '%') OR s.Roll_No_Character LIKE CONCAT('%', filter_roll_number, '%'))
                        AND (
                            v_is_special_admin = 1
                            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
                            OR COALESCE(NULLIF(sc.Slot_Id, 0), sc.Requested_Slot_Id) IN (
                                SELECT tts.Slot_Id 
                                FROM teacher_time_slot tts 
                                JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                                WHERE FIND_IN_SET(ct.Teacher_ID, v_allowed_staff_list) > 0 
                                  AND IFNULL(tts.Delete_Status, 0) = 0 
                                  AND IFNULL(ct.Delete_Status, 0) = 0
                            )
                        )
                    GROUP BY s.Student_ID
                    ORDER BY s.Roll_No DESC
                    LIMIT page_size OFFSET offset_value;
                END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_student_lead`(
    IN search_term VARCHAR(100),
    IN page_number INT,
    IN page_size INT,
    IN filter_course_id INT,
    IN filter_batch_id INT,
    IN enrollment_status VARCHAR(50),
    IN followUpStatus VARCHAR(100),
    IN filter_branch_id INT,
    IN filter_assigned_staff_id INT,
    IN filter_enquiry_source_id INT,
    IN p_user_id INT,
    IN p_user_type_id INT,
    IN filter_priority VARCHAR(50)
)
BEGIN
    DECLARE offset_value INT;
    DECLARE v_is_special_admin INT DEFAULT 0;
    DECLARE v_allowed_staff_list TEXT;
    
    SET search_term = CONCAT('%', search_term, '%');
    SET offset_value = (page_number - 1) * page_size;

    IF enrollment_status IS NULL THEN SET enrollment_status = 'all'; END IF;
    IF followUpStatus IS NULL THEN SET followUpStatus = 'all'; END IF;

    SELECT 1 INTO v_is_special_admin 
    FROM users 
    WHERE User_ID = p_user_id AND (Email = 'admin_user@G.COM' OR Email = 'cs.mgr@testprepinenglish.com' OR User_ID = 1) LIMIT 1;

    WITH RECURSIVE staff_hierarchy AS (
        SELECT p_user_id as staff_id
        UNION ALL
        SELECT sta.staff_user_id as staff_id
        FROM staff_team_assignment sta
        INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
        WHERE sta.staff_user_id <> 1
    )
    SELECT GROUP_CONCAT(DISTINCT staff_id) INTO v_allowed_staff_list FROM staff_hierarchy;

    IF v_allowed_staff_list IS NULL THEN
        SET v_allowed_staff_list = CAST(p_user_id AS CHAR);
    END IF;

    DROP TEMPORARY TABLE IF EXISTS ranked_fu;
    CREATE TEMPORARY TABLE ranked_fu AS
    SELECT *
    FROM (
        SELECT
            sf.*,
            ROW_NUMBER() OVER (PARTITION BY sf.Student_ID ORDER BY sf.Created_Date DESC, sf.Follow_Up_ID DESC) AS rn
        FROM student_followup sf
        JOIN followup_status fs ON fs.Status_Id = sf.Follow_Up_Status_ID
        WHERE sf.Delete_Status = 0 AND fs.Delete_Status = 0
    ) t
    WHERE rn = 1;

    SELECT COUNT(DISTINCT s.Student_ID) AS total_count
    FROM student s
    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID
    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
    LEFT JOIN ranked_fu rf ON rf.Student_ID = s.Student_ID
    LEFT JOIN followup_status fs ON fs.Status_Id = rf.Follow_Up_Status_ID
    WHERE
		s.Is_Registered = 0 AND
        (s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term
        OR s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term
        OR CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term)
        AND s.Delete_Status = 0
        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
        AND (
            enrollment_status IS NULL
            OR enrollment_status = 'all'
            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
        )
        AND (
            followUpStatus IS NULL
            OR followUpStatus = 'all'
            OR COALESCE(fs.Status_Name, s.Status_Name) = CONVERT(followUpStatus USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )
        AND (filter_branch_id IS NULL OR s.Branch_Id = filter_branch_id)
        AND (
            filter_assigned_staff_id IS NULL
            OR COALESCE(rf.Assigned_Staff_ID, s.To_User_Id) = filter_assigned_staff_id
        )
        AND (filter_enquiry_source_id IS NULL OR s.Enquiry_Source_Id = filter_enquiry_source_id)
        AND (
            v_is_special_admin = 1 
            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
            OR FIND_IN_SET(COALESCE(rf.Assigned_Staff_ID, s.To_User_Id), v_allowed_staff_list) > 0
            OR FIND_IN_SET(s.Registered_By, v_allowed_staff_list) > 0
            OR FIND_IN_SET(s.By_User_Id, v_allowed_staff_list) > 0
            OR EXISTS (
                SELECT 1 FROM student_followup sf_user 
                WHERE sf_user.Student_ID = s.Student_ID 
                  AND (FIND_IN_SET(sf_user.Created_By, v_allowed_staff_list) > 0 
                       OR FIND_IN_SET(sf_user.Assigned_Staff_ID, v_allowed_staff_list) > 0)
            )
        )
        AND (
            filter_priority IS NULL
            OR filter_priority = 'All'
            OR s.Priority = filter_priority
        );

    SELECT
        s.Student_ID,
        s.First_Name,
        s.Last_Name,
        s.Email,
        s.Country_Code,
        s.Phone_Number,
        s.Profile_Photo_Path,
        s.Profile_Photo_Name,
        s.Branch_Id,
        s.Branch_Name,
        s.Status_Name,
        s.To_User_Name,
        MAX(COALESCE(rf.Assigned_Staff_ID, s.To_User_Id)) AS Assigned_Staff_ID,
        MAX(COALESCE(NULLIF(rf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '')) AS Assigned_Staff_Name,
        s.Qualification,
        MAX(rf.Next_Follow_Up_Date) AS Next_Follow_Up_Date,
        MAX(rf.Remark) AS Remark,
        COALESCE(MAX(fs.Status_Name), s.Status_Name) AS Followup_Status,
        s.isActive,
        s.Is_Registered,
        s.Roll_No,
        s.Roll_No_Character,
        s.Entry_Date,
        s.Registered_On,
        s.Delete_Status,
        s.Admission_Date,
        s.Enquiry_Source_Id,
        s.Guardian_Type,
        s.Guardian_Name,
        s.Address,
        MAX(c.Course_Name) AS Course_Name,
        MAX(cb.Batch_Name) AS Batch_Name,
        s.Priority,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM student_course sc2
                JOIN course c ON sc2.Course_ID = c.Course_ID
                WHERE sc2.Student_ID = s.Student_ID AND sc2.Delete_Status = 0 AND c.Delete_Status = 0
            ) THEN TRUE ELSE FALSE
        END AS is_enrolled
    FROM student s
    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID
    LEFT JOIN course c ON sc.Course_ID = c.Course_ID
    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
    LEFT JOIN ranked_fu rf ON rf.Student_ID = s.Student_ID
    LEFT JOIN followup_status fs ON fs.Status_Id = rf.Follow_Up_Status_ID
    WHERE
		s.Is_Registered = 0 AND
        (s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term
        OR s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term
        OR CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term)
        AND s.Delete_Status = 0
        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
        AND (
            enrollment_status IS NULL
            OR enrollment_status = 'all'
            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
        )
        AND (
            followUpStatus IS NULL
            OR followUpStatus = 'all'
            OR COALESCE(fs.Status_Name, s.Status_Name) = CONVERT(followUpStatus USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )
        AND (filter_branch_id IS NULL OR s.Branch_Id = filter_branch_id)
        AND (
            filter_assigned_staff_id IS NULL
            OR COALESCE(rf.Assigned_Staff_ID, s.To_User_Id) = filter_assigned_staff_id
        )
        AND (filter_enquiry_source_id IS NULL OR s.Enquiry_Source_Id = filter_enquiry_source_id)
        AND (
            v_is_special_admin = 1 
            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
            OR FIND_IN_SET(COALESCE(rf.Assigned_Staff_ID, s.To_User_Id), v_allowed_staff_list) > 0
            OR FIND_IN_SET(s.Registered_By, v_allowed_staff_list) > 0
            OR FIND_IN_SET(s.By_User_Id, v_allowed_staff_list) > 0
            OR EXISTS (
                SELECT 1 FROM student_followup sf_user 
                WHERE sf_user.Student_ID = s.Student_ID 
                  AND (FIND_IN_SET(sf_user.Created_By, v_allowed_staff_list) > 0 
                       OR FIND_IN_SET(sf_user.Assigned_Staff_ID, v_allowed_staff_list) > 0)
            )
        )
        AND (
            filter_priority IS NULL
            OR filter_priority = 'All'
            OR s.Priority = filter_priority
        )
    GROUP BY s.Student_ID
    ORDER BY s.Student_ID DESC
    LIMIT page_size OFFSET offset_value;

    DROP TEMPORARY TABLE IF EXISTS ranked_fu;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_User`(
    IN First_Name_ VARCHAR(100),
    IN filter_slot_wise BOOLEAN,     
    IN filter_batch_wise BOOLEAN,    
    IN filter_course_id INT,         
    IN filter_hod_only BOOLEAN       
)
BEGIN
    -- Add wildcards to enable partial matching
    SET First_Name_ = CONCAT('%', First_Name_, '%');
    
    SELECT 
        u.*, 
        IF(
            COUNT(CASE WHEN c.Delete_Status = FALSE THEN ch.Course_ID END) > 0,
            JSON_ARRAYAGG(
                CASE 
                    WHEN c.Delete_Status = FALSE THEN ch.Course_ID 
                END
            ),
            JSON_ARRAY()
        ) AS Course_ID,
        GROUP_CONCAT(c.Course_Name) AS Course_Names,
        -- Check for batch-wise courses
        EXISTS (
            SELECT 1 
            FROM course_teacher ct 
            INNER JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
            INNER JOIN course_batch cb on cb.Batch_ID = tts.batch_id
            WHERE ct.Teacher_ID = u.User_ID 
            AND tts.Batch_ID IS NOT NULL 
            AND ct.Delete_Status = FALSE
            AND tts.Delete_Status = FALSE
            AND cb.Delete_Status = false
        ) AS has_batch_wise,
        -- Check for slot-wise courses
        EXISTS (
            SELECT 1 
            FROM course_teacher ct 
            INNER JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
            WHERE ct.Teacher_ID = u.User_ID 
            AND tts.Batch_ID IS NULL 
            AND ct.Delete_Status = FALSE
            AND tts.Delete_Status = FALSE
        ) AS has_slot_wise
    FROM 
        users u
    LEFT JOIN (
        SELECT ch.User_ID, ch.Course_ID
        FROM course_hod ch
        JOIN course c ON c.Course_ID = ch.Course_ID
        WHERE c.Delete_Status = FALSE
    ) ch ON u.User_ID = ch.User_ID
    LEFT JOIN 
        course c ON c.Course_ID = ch.Course_ID AND c.Delete_Status = FALSE
    WHERE  
        (u.First_Name LIKE First_Name_ OR 
         u.Last_Name LIKE First_Name_ OR 
         u.Email LIKE First_Name_ OR
         CONCAT(u.First_Name, ' ', u.Last_Name) LIKE First_Name_ OR
         CONCAT(u.Last_Name, ' ', u.First_Name) LIKE First_Name_) 
        AND u.Delete_Status = FALSE 
        AND u.User_ID !=1
   --     AND u.User_Type_Id != 1
        -- Optional filters
        AND (filter_slot_wise IS NULL OR 
             EXISTS (
                SELECT 1 
                FROM course_teacher ct 
                INNER JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
                WHERE ct.Teacher_ID = u.User_ID 
                AND tts.Batch_ID IS NULL 
                AND ct.Delete_Status = FALSE
                AND tts.Delete_Status = FALSE
             ) = filter_slot_wise)
        AND (filter_batch_wise IS NULL OR 
             EXISTS (
                SELECT 1 
                FROM course_teacher ct 
                INNER JOIN teacher_time_slot tts ON ct.CourseTeacher_ID = tts.CourseTeacher_ID
                INNER JOIN course_batch cb on cb.Batch_ID = tts.batch_id
                WHERE ct.Teacher_ID = u.User_ID 
                AND tts.Batch_ID IS NOT NULL 
                AND ct.Delete_Status = FALSE
                AND tts.Delete_Status = FALSE
                AND cb.Delete_Status = false
             ) = filter_batch_wise)
				AND (filter_course_id = 0 OR 
					EXISTS (
						SELECT 1 
						FROM course_hod ch
						JOIN course c ON c.Course_ID = ch.Course_ID
						WHERE ch.User_ID = u.User_ID 
						AND ch.Course_ID = filter_course_id
						AND c.Delete_Status = FALSE
					) OR
					EXISTS (
						SELECT 1 
						FROM course_teacher ct 
						JOIN teacher_time_slot tts ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
						LEFT JOIN course_batch cb ON cb.Batch_ID = tts.batch_id
						WHERE ct.Teacher_ID = u.User_ID 
						AND ct.Course_ID = filter_course_id
						AND ct.Delete_Status = FALSE
						AND tts.Delete_Status = FALSE
						AND (
							(tts.batch_id IS NOT NULL AND cb.Delete_Status = FALSE)
							OR
							tts.batch_id IS NULL
						)
					)
				)
        AND (filter_hod_only IS NULL OR 
             EXISTS (
                SELECT 1 
                FROM course_hod ch 
                WHERE ch.User_ID = u.User_ID
             ) = filter_hod_only)
    GROUP BY 
        u.User_ID
    ORDER BY 
        u.User_ID DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Search_User_Invoice`(
    IN p_user_Id INT
)
BEGIN
    SELECT 
        Invoice_Id,
        invoice_date,
        name,
        position,
        course_name,
        payment_period,
        class_hours,
        total_amount,
        approved_by,
        user_Id,
        Course_Id
    FROM 
        invoices
    WHERE 
        user_Id = p_user_Id AND Delete_Status =false;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Student_Batch_Change`(
    IN studentList JSON
)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE studentCount INT;
    
    SET studentCount = JSON_LENGTH(studentList);
    

    WHILE i < studentCount DO
    
        UPDATE student_course
        SET Batch_ID = CAST(JSON_UNQUOTE(JSON_EXTRACT(studentList, CONCAT('$[', i, '].BatchId'))) AS UNSIGNED)
        WHERE Student_ID = CAST(JSON_UNQUOTE(JSON_EXTRACT(studentList, CONCAT('$[', i, '].studentId'))) AS UNSIGNED) and Course_ID = CAST(JSON_UNQUOTE(JSON_EXTRACT(studentList, CONCAT('$[', i, '].course_id'))) AS UNSIGNED);
        
        SET i = i + 1;
    END WHILE;
    
    -- Commit the transaction
    
    SELECT studentCount AS result;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `TestBasicLog`()
BEGIN
    INSERT INTO debug_log (message) VALUES('Test message - procedure started');
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `TestJSONParsing`(
    IN p_json_data JSON
)
BEGIN
    DECLARE v_array_length INT;
    
    INSERT INTO debug_log (message) VALUES('JSON Test - procedure started');
    
    SET v_array_length = JSON_LENGTH(p_json_data);
    INSERT INTO debug_log (message) VALUES(CONCAT('JSON Array Length: ', IFNULL(v_array_length, 'NULL')));
    
    IF v_array_length > 0 THEN
        INSERT INTO debug_log (message) VALUES(CONCAT('First record: ', JSON_EXTRACT(p_json_data, '$[0]')));
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `test_sp`(OUT result VARCHAR(100))
BEGIN DECLARE v_Roll_No VARCHAR(100); SELECT COALESCE(MAX(CAST(Roll_No AS UNSIGNED)), 0) + 1 INTO v_Roll_No FROM student WHERE Roll_No REGEXP '^[0-9]+$'; SET result = v_Roll_No; END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Unblock_User`(
    IN blocker_id_ INT,
    IN blocked_user_id_ INT
)
BEGIN
    DELETE FROM blocked_users 
    WHERE blocker_id = blocker_id_ AND blocked_user_id = blocked_user_id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Unlock_Exam`(
    IN p_Content_ID INT,
    IN p_Exam_ID INT,
    IN p_Is_Question_Unlocked TINYINT,
    IN p_Is_Question_Media_Unlocked TINYINT,
	IN p_Batch_ID INT,
	IN p_Is_Answer_Unlocked TINYINT
)
BEGIN
    DECLARE v_Section_ID INT;
    DECLARE v_Count INT;
    DECLARE p_Status_Code INT;
    DECLARE p_Status_Message VARCHAR(255);

    -- Initialize output parameters
    SET p_Status_Code = 0;  -- Default status code (0 for success)
    SET p_Status_Message = 'Operation successful';  -- Default status message

    -- Retrieve the Section_ID from the course_content table based on Content_ID
    SELECT Section_ID
    INTO v_Section_ID
    FROM course_content
    WHERE Content_ID = p_Content_ID;

    -- Check if Section_ID was found
    IF v_Section_ID IS NULL THEN
        SET p_Status_Code = 1;  -- Status code 1 for "Content_ID not found"
        SET p_Status_Message = 'Content_ID not found';
        -- Return the status message
        SELECT p_Status_Code AS StatusCode, p_Status_Message AS StatusMessage;
   
    END IF;

    -- Check the number of existing records in unlocked_exam
    SELECT COUNT(*)
    INTO v_Count
    FROM unlocked_exam
    WHERE Content_ID = p_Content_ID AND Exam_ID = p_Exam_ID AND Batch_ID = p_Batch_ID ;

    -- Case 1: If Section_ID is NOT equal to 1 for listening there is audio 
    IF v_Section_ID <> 1 THEN
        IF p_Is_Question_Unlocked = 0 THEN
            IF v_Count > 0 THEN
                DELETE FROM unlocked_exam
                WHERE Content_ID = p_Content_ID AND Exam_ID = p_Exam_ID  AND Batch_ID = p_Batch_ID;
                SET p_Status_Message = 'Entry deleted successfully';
            ELSE
                SET p_Status_Message = 'No entry found to delete';
            END IF;
        ELSE
            IF v_Count > 0 THEN
                UPDATE unlocked_exam
                SET Is_Question_Unlocked = p_Is_Question_Unlocked,
                    Is_Question_Media_Unlocked = p_Is_Question_Media_Unlocked,Is_Answer_Unlocked=p_Is_Answer_Unlocked
                WHERE Content_ID = p_Content_ID AND Exam_ID = p_Exam_ID AND Batch_ID = p_Batch_ID;
                SET p_Status_Message = 'Entry updated successfully';
            ELSE
                INSERT INTO unlocked_exam (Content_ID, Exam_ID, Is_Question_Unlocked, Is_Question_Media_Unlocked,Batch_ID,Is_Answer_Unlocked)
                VALUES (p_Content_ID, p_Exam_ID, p_Is_Question_Unlocked, p_Is_Question_Media_Unlocked,p_Batch_ID,p_Is_Answer_Unlocked);
                SET p_Status_Message = 'Entry inserted successfully';
            END IF;
        END IF;

    -- Case 2: If Section_ID is equal to 1
    ELSEIF v_Section_ID = 1 THEN
        IF p_Is_Question_Unlocked = 0 AND p_Is_Question_Media_Unlocked = 0 THEN
            IF v_Count > 0 THEN
                DELETE FROM unlocked_exam
                WHERE Content_ID = p_Content_ID AND Exam_ID = p_Exam_ID  AND Batch_ID = p_Batch_ID;
                SET p_Status_Message = 'Entry deleted successfully';
            ELSE
                SET p_Status_Message = 'No entry found to delete';
            END IF;
        ELSE
            IF v_Count > 0 THEN
                UPDATE unlocked_exam
                SET Is_Question_Unlocked = p_Is_Question_Unlocked,
                    Is_Question_Media_Unlocked = p_Is_Question_Media_Unlocked,Is_Answer_Unlocked=p_Is_Answer_Unlocked
                WHERE Content_ID = p_Content_ID AND Exam_ID = p_Exam_ID AND Batch_ID = p_Batch_ID;
                SET p_Status_Message = 'Entry updated successfully';
            ELSE
				INSERT INTO unlocked_exam (Content_ID, Exam_ID, Is_Question_Unlocked, Is_Question_Media_Unlocked,Batch_ID,Is_Answer_Unlocked)
                VALUES (p_Content_ID, p_Exam_ID, p_Is_Question_Unlocked, p_Is_Question_Media_Unlocked,p_Batch_ID,p_Is_Answer_Unlocked);
                SET p_Status_Message = 'Entry inserted successfully';
            END IF;
        END IF;
    END IF; 

    -- Return the status message
    SELECT p_Status_Code AS StatusCode, p_Status_Message AS StatusMessage,v_Section_ID,v_Count;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `UpdateThumbnailsRoundRobin`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE thumbnail_path VARCHAR(255);
    DECLARE content_id INT;
    DECLARE thumbnail_index INT DEFAULT 0;
    DECLARE total_thumbnails INT;
    
    -- Cursor for thumbnails
    DECLARE thumbnail_cursor CURSOR FOR
        SELECT thumbnail_path FROM (
            SELECT 'Briffni/IELTS/de26fa5c-bbc6-4a4f-8f60-9071f63a9124_images.jpg' AS thumbnail_path
            UNION ALL
            SELECT 'Briffni/IELTS/8af95316-f217-487f-84f7-c21a8d0bb2cc_download (1).jpg'
            UNION ALL
            SELECT 'Briffni/IELTS/a59f303d-2f04-4506-a9b3-cc6011a4bcaa_images (1).jpg'
            UNION ALL
            SELECT 'Briffni/IELTS/820e02fa-17ec-4e84-bda6-397a861b1b2e_images (2).jpg'
            UNION ALL
            SELECT 'Briffni/IELTS/1568cd43-96f8-4687-abe9-5dcef1589718_images (3).jpg'
        ) AS thumbnails;
    
    -- Handler for cursor end
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Create a temporary table for course content IDs
    CREATE TEMPORARY TABLE temp_content_ids AS
    SELECT Content_ID
    FROM course_content
    WHERE Course_Id = 92 AND contentThumbnail_Path = '';
    
    -- Get total number of thumbnails
    SET total_thumbnails = (SELECT COUNT(*) FROM (
        SELECT 'Briffni/IELTS/de26fa5c-bbc6-4a4f-8f60-9071f63a9124_images.jpg' AS thumbnail_path
        UNION ALL
        SELECT 'Briffni/IELTS/8af95316-f217-487f-84f7-c21a8d0bb2cc_download (1).jpg'
        UNION ALL
        SELECT 'Briffni/IELTS/a59f303d-2f04-4506-a9b3-cc6011a4bcaa_images (1).jpg'
        UNION ALL
        SELECT 'Briffni/IELTS/820e02fa-17ec-4e84-bda6-397a861b1b2e_images (2).jpg'
        UNION ALL
        SELECT 'Briffni/IELTS/1568cd43-96f8-4687-abe9-5dcef1589718_images (3).jpg'
    ) AS thumbnails);

    -- Open the cursor
    OPEN thumbnail_cursor;

    -- Update course content in round-robin fashion
    read_loop: LOOP
        FETCH thumbnail_cursor INTO thumbnail_path;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- Update the contentThumbnail_Path for the course content
        UPDATE course_content cc
        JOIN (
            SELECT Content_ID
            FROM temp_content_ids
            LIMIT 1 OFFSET thumbnail_index
        ) AS temp
        ON cc.Content_ID = temp.Content_ID
        SET cc.contentThumbnail_Path = thumbnail_path,
            cc.contentThumbnail_name = SUBSTRING_INDEX(thumbnail_path, '/', -1);
        
        -- Increment the index for the next thumbnail
        SET thumbnail_index = (thumbnail_index + 1) % total_thumbnails;
    END LOOP;

    -- Close the cursor
    CLOSE thumbnail_cursor;

    -- Drop the temporary table
    DROP TEMPORARY TABLE temp_content_ids;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Call_Status`(
    IN id_ INT,
    IN type_ VARCHAR(10),
    IN new_Status TINYINT,
    IN User_Id_ INT,
    IN isStudent TINYINT
)
BEGIN
    -- Update Call_Ringed or Call_Connected in call_history based on the type
    IF (type_ = 'ring') THEN
        UPDATE call_history
        SET Call_Ringed = new_Status
        WHERE id = id_;
    ELSEIF (type_ = 'connect') THEN
        UPDATE call_history
        SET Call_Connected = new_Status
        WHERE id = id_;
    ELSEIF (type_ = 'call') THEN  
    #finished

			
				UPDATE call_history 
				SET 
					call_end = NOW(),
					call_duration = CONCAT(
						FLOOR(TIMESTAMPDIFF(SECOND, call_start, NOW()) / 60), '.', 
						LPAD(MOD(TIMESTAMPDIFF(SECOND, call_start, NOW()), 60), 2, '0')
					),
					Is_Finished = new_Status
				WHERE     id = id_;
		
		END IF;

    
    -- Return the updated call history record
    SELECT * FROM call_history WHERE id = id_;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Cart_Course_Quantity`(IN user_id_ INT, IN course_id_ INT, IN new_quantity_ INT)
BEGIN
  DECLARE cart_id_ INT;

  SELECT id INTO cart_id_
  FROM carts
  WHERE user_id = user_id_ limit 1;

  IF cart_id_ IS NOT NULL THEN
    UPDATE cart_items
    SET quantity = new_quantity_
    WHERE cart_id = cart_id AND course_id = course_id_;
  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Email_Opened`(
    IN p_Message_ID VARCHAR(255)
)
BEGIN
    UPDATE email_logs 
    SET Opened_At = COALESCE(Opened_At, CURRENT_TIMESTAMP)
    WHERE (
        Message_ID = p_Message_ID 
        OR Message_ID = CONCAT('<', p_Message_ID, '>')
        OR REPLACE(REPLACE(Message_ID, '<', ''), '>', '') = REPLACE(REPLACE(p_Message_ID, '<', ''), '>', '')
    )
    AND Opened_At IS NULL;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_FeesByReceipt_ID`(
    IN input_Receipt_Id INT,
    IN input_Student_Id INT,
    IN input_Amount DECIMAL(10,2),
    IN input_Entry_Date DATETIME,
    IN input_User_Id INT,
    IN input_Branch INT,
    IN input_Account_Id INT,
    IN input_Payment_mode VARCHAR(100),
    IN input_Transaction_ID VARCHAR(45),
    IN input_Tax_Type_Id INT,
    IN input_Netvalue DECIMAL(18,2),
    IN input_Gstpers DECIMAL(18,2),
    IN input_Cgstpers DECIMAL(18,2),
    IN input_Sgstpers DECIMAL(18,2),
    IN input_Gst DECIMAL(18,2),
    IN input_Cgst DECIMAL(18,2),
    IN input_Sgst DECIMAL(18,2),
    IN input_Payment_Date DATETIME,
    IN input_Fine_Amount DECIMAL(10,2)
)
BEGIN
    DECLARE Account_Name_ VARCHAR(200);
    DECLARE Old_Input_Tax_Type_Id INT;
    DECLARE Voucher_Number_ INT;

    SET Old_Input_Tax_Type_Id = (SELECT Tax_Type_Id FROM receipts WHERE Receipt_Id = input_Receipt_Id);
    IF (input_Tax_Type_Id <> Old_Input_Tax_Type_Id) THEN
        SET Voucher_Number_ = (SELECT COALESCE(MAX(Voucher_Number), 0) + 1 FROM receipts WHERE Branch = input_Branch AND Tax_Type_Id = input_Tax_Type_Id);
    ELSE
        SET Voucher_Number_ = (SELECT Voucher_Number FROM receipts WHERE Receipt_Id = input_Receipt_Id);
    END IF;

    SET Account_Name_ = (
        SELECT Account_Name
        FROM account_heads
        WHERE Account_Id = input_Account_Id
        LIMIT 1
    );

    UPDATE receipts
    SET
        Student_Id = input_Student_Id,
        Amount = input_Amount,
        Entry_Date = input_Entry_Date,
        User_Id = input_User_Id,
        Branch = input_Branch,
        Account_Id = input_Account_Id,
        Account_Name = Account_Name_,
        Payment_mode = input_Payment_mode,
        Transaction_ID = input_Transaction_ID,
        Voucher_Number = Voucher_Number_,
        Tax_Type_Id = input_Tax_Type_Id,
        Netvalue = input_Netvalue,
        Gstpers = input_Gstpers,
        Cgstpers = input_Cgstpers,
        Sgstpers = input_Sgstpers, 
        Gst = input_Gst,
        Cgst = input_Cgst,
        Sgst = input_Sgst,
        Payment_Date = input_Payment_Date,
        Fine_Amount = input_Fine_Amount
    WHERE
        Receipt_Id = input_Receipt_Id;

    CALL Update_Fee_Balance(input_Student_Id);
    SELECT * FROM receipts WHERE Receipt_Id = input_Receipt_Id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Fee_Balance`(IN p_Student_Id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE Total_Paid_For_Fees DECIMAL(10, 2);
    DECLARE Student_Fees_ID_ INT;
    DECLARE Total_Amount_ DECIMAL(10, 2);

    DECLARE Installemnts CURSOR FOR 
        SELECT Student_Fees_ID, Total_Amount 
        FROM student_fees_details 
        WHERE Student_ID = p_Student_Id AND Delete_Status = 0
        ORDER BY Student_Fees_ID ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Simplified to just SUM(Amount) as Amount now only contains core fees
    SET Total_Paid_For_Fees = (
        SELECT COALESCE(SUM(Amount), 0) 
        FROM receipts 
        WHERE Student_Id = p_Student_Id AND DeleteStatus = 0
    );

    OPEN Installemnts;

    read_loop: LOOP
        FETCH Installemnts INTO Student_Fees_ID_, Total_Amount_;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        IF Total_Amount_ <= Total_Paid_For_Fees THEN
            UPDATE student_fees_details 
            SET Remaining_Amount = 0, Paid_Amount = Total_Amount_ 
            WHERE Student_Fees_ID = Student_Fees_ID_;
            SET Total_Paid_For_Fees = Total_Paid_For_Fees - Total_Amount_;
        ELSE
            UPDATE student_fees_details 
            SET Remaining_Amount = Total_Amount_ - Total_Paid_For_Fees, Paid_Amount = Total_Paid_For_Fees 
            WHERE Student_Fees_ID = Student_Fees_ID_;
            SET Total_Paid_For_Fees = 0;
        END IF;
        
        IF Total_Paid_For_Fees < 0 THEN 
            SET Total_Paid_For_Fees = 0;
        END IF;
    END LOOP;

    CLOSE Installemnts;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_LastAccessed_Content`(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_last_accessed_content_id INT
)
BEGIN
    -- Update the LastAccessed_Content_ID in the student_course table only if the new ID is greater than the current one
    UPDATE student_course
    SET LastAccessed_Content_ID = p_last_accessed_content_id
    WHERE Student_ID = p_student_id 
      AND Course_ID = p_course_id
      AND (LastAccessed_Content_ID IS NULL OR p_last_accessed_content_id > LastAccessed_Content_ID);

    -- Delete the entry from the recent_student_course table
    DELETE FROM recent_student_course
    WHERE student_id = p_student_id AND course_id = p_course_id;

    -- Insert a new entry in the recent_student_course table
    INSERT INTO recent_student_course (student_id, course_id)
    VALUES (p_student_id, p_course_id);
    
    -- Return the course ID
    SELECT p_course_id AS course_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_LiveClass_RecordLink`(    IN p_LiveClass_ID INT)
BEGIN
UPDATE live_class SET Record_Class_Link = NULL WHERE LiveClass_ID = p_LiveClass_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Record_ClassLink`(
    IN p_LiveClass_ID INT,
    IN p_Record_Class_Link VARCHAR(250)
)
BEGIN
    UPDATE live_class
    SET Record_Class_Link = p_Record_Class_Link
    WHERE LiveClass_ID = p_LiveClass_ID;
        SELECT ROW_COUNT() AS AffectedRows;

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Record_Class_By_Link`(
    IN p_LiveClass_Link VARCHAR(250),
    IN p_Record_Class_Link VARCHAR(250)
)
BEGIN
    UPDATE live_class
    SET Record_Class_Link = p_Record_Class_Link
    WHERE Live_Link = p_LiveClass_Link;
    
    SELECT LiveClass_ID
    FROM live_class
    WHERE Live_Link = p_LiveClass_Link;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Student_LastOnline`(
    IN p_Student_ID INT,
    IN p_Last_Online VARCHAR(45)
)
BEGIN
    UPDATE student
    SET Last_Online = p_Last_Online
    WHERE Student_ID = p_Student_ID;
    select ROW_COUNT() as Update_Count;
    
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_Time_Slot`(IN Student_ID_ INT, Course_ID_ INT,IN Slot_Id_ INT )
BEGIN
 
    UPDATE student_course SET Slot_Id = Slot_Id_  WHERE Student_ID = Student_ID_ and Course_ID = Course_ID_;
  
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `Update_User_OTP`(
    IN p_Email VARCHAR(50),
    IN otp_ INT,
    IN token_  VARCHAR(50)
)
BEGIN
            UPDATE users SET OTP = otp_ ,token = token_ WHERE Email = p_Email;
         

	
        SELECT Email, User_ID from users WHERE Email = p_Email and Delete_Status=false ; 

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `update_user_status`(in User_ID_ int,IN status_ INT)
BEGIN

            UPDATE users
            SET User_Active_Status =status_
            WHERE User_ID = User_ID_;

select User_ID_ as User_ID;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Dropdown`()
BEGIN
select * from users where Delete_Status=0 ;

 End$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Hierarchy_Dropdown`(
    IN p_user_id INT
)
BEGIN
    DECLARE v_is_special_admin INT DEFAULT 0;

    SELECT 1 INTO v_is_special_admin
    FROM users
    WHERE User_ID = p_user_id AND Email = 'admin_user@G.COM' LIMIT 1;

    IF v_is_special_admin = 1 THEN
        SELECT * FROM users WHERE Delete_Status = 0;
    ELSE
        WITH RECURSIVE staff_hierarchy AS (
            SELECT p_user_id as staff_id
            UNION ALL
            SELECT sta.staff_user_id as staff_id
            FROM staff_team_assignment sta
            INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
        )
        SELECT *
        FROM users
        WHERE Delete_Status = 0 AND User_ID IN (SELECT staff_id FROM staff_hierarchy);
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `ValidateTimeSlots`(
    IN Course_ID_ INT,
    IN json_data JSON,
    IN Batch_Start_Date VARCHAR(65),
	IN Batch_End_Date VARCHAR(65)
)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE j INT DEFAULT 0;
    DECLARE num_teachers INT;
    DECLARE num_slots INT;
    DECLARE current_teacher_id INT;
    DECLARE current_course_teacher_id INT;
    DECLARE current_start_time TIME;
    DECLARE current_end_time TIME;
    DECLARE current_slot_id INT;   
    DECLARE current_Delete_Status INT;
    
    DECLARE overlap_count INT;
    DECLARE validationMessage VARCHAR(1000);
    DECLARE course_name VARCHAR(200);
    DECLARE teacher_name VARCHAR(150);
    DECLARE conflict_start_time TIME;
    DECLARE conflict_end_time TIME;
    DECLARE conflict_batch_name VARCHAR(50);
    DECLARE conflict_batch_id INT;
    DECLARE conflict_slot_id INT;
    DECLARE teacher_Delete_Status INT;
    DECLARE teacher_Course_ID INT;
    
    DECLARE conflict_batch_start_date VARCHAR(65);
    DECLARE conflict_batch_end_date VARCHAR(65);
	DECLARE is_date_conflict tinyInt ;

    
    DECLARE temp_start_time VARCHAR(20);
    DECLARE temp_end_time VARCHAR(20);
	SET validationMessage='';
    SET num_teachers = JSON_LENGTH(json_data);
    SEt is_date_conflict=0;
    WHILE i < num_teachers DO
        SET current_teacher_id = JSON_EXTRACT(json_data, CONCAT('$[', i, '].Teacher_ID'));
        SET current_course_teacher_id = JSON_EXTRACT(json_data, CONCAT('$[', i, '].CourseTeacher_ID'));
        SET num_slots = JSON_LENGTH(JSON_EXTRACT(json_data, CONCAT('$[', i, '].timeSlots')));
        SET teacher_Delete_Status = JSON_EXTRACT(json_data, CONCAT('$[', i, '].Delete_Status'));
		
        SET j = 0;
        WHILE j < num_slots DO
			SET temp_start_time = JSON_UNQUOTE(JSON_EXTRACT(json_data, CONCAT('$[', i, '].timeSlots[', j, '].startTime')));
            SET temp_end_time = JSON_UNQUOTE(JSON_EXTRACT(json_data, CONCAT('$[', i, '].timeSlots[', j, '].endTime')));
            SET current_slot_id = JSON_EXTRACT(json_data, CONCAT('$[', i, '].timeSlots[', j, '].Slot_Id'));
            SET current_Delete_Status = JSON_EXTRACT(json_data, CONCAT('$[', i, '].timeSlots[', j, '].Delete_Status'));
            SET current_start_time = CASE 
                WHEN temp_start_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
                THEN STR_TO_DATE(temp_start_time, '%l:%i %p')
                ELSE TIME(temp_start_time)
            END;

            SET current_end_time = CASE 
                WHEN temp_end_time REGEXP '^[0-9]{1,2}:[0-9]{2} [AP]M$' 
                THEN STR_TO_DATE(temp_end_time, '%l:%i %p')
                ELSE TIME(temp_end_time)
            END;


	
            -- Check for overlaps and get conflicting time slot if exists
            SELECT COUNT(*), 
                   MAX(tts.start_time), 
                   MAX(tts.end_time), 
                   MAX(tts.batch_id), 
                   MAX(tts.Slot_Id), 
                   MAX(tts.CourseTeacher_ID),
					MAX(cb.Start_Date),
                   MAX(cb.End_Date)
                   
            INTO overlap_count, 
                 conflict_start_time, 
                 conflict_end_time, 
                 conflict_batch_id, 
                 conflict_slot_id, 
                 current_course_teacher_id,
				conflict_batch_start_date,
                 conflict_batch_end_date
            FROM teacher_time_slot tts
            JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
            LEFT JOIN course c ON ct.Course_ID = c.Course_ID
            LEFT JOIN course_batch cb ON tts.batch_id = cb.Batch_ID
            WHERE tts.Delete_Status = 0
              AND ct.Teacher_ID = current_teacher_id
              AND (
                  (TIME(current_start_time) < TIME(tts.end_time) AND TIME(current_end_time) > TIME(tts.start_time))
                  OR (TIME(current_start_time) = TIME(tts.start_time) AND TIME(current_end_time) = TIME(tts.end_time))
              )
              AND (current_slot_id = 0 OR tts.Slot_Id != current_slot_id)
				# AND (Course_ID_ = 0 OR c.Course_ID != Course_ID_)
              AND current_Delete_Status = 0
              AND teacher_Delete_Status = 0  
              AND c.Delete_Status = 0
              AND tts.Delete_Status =0
              AND ct.Delete_Status =0
			  AND (cb.End_Date >= CURDATE() OR cb.End_Date IS NULL ) AND (cb.Delete_Status = 0 OR cb.Delete_Status IS NULL);
		            		

            SELECT c.Course_Name, 
                   CONCAT(IFNULL(u.First_Name, ''), ' ', IFNULL(u.Last_Name, '')), 
                   c.Course_ID
            INTO course_name, teacher_name, teacher_Course_ID
            FROM course_teacher ct
            JOIN course c ON ct.Course_ID = c.Course_ID
            JOIN users u ON ct.Teacher_ID = u.User_ID
            WHERE ct.CourseTeacher_ID = current_course_teacher_id AND c.Delete_Status = 0;
            
                   		            			
            IF overlap_count > 0 THEN
         
				
                
                SET is_date_conflict = (
                    STR_TO_DATE(Batch_End_Date, '%Y-%m-%d') >= STR_TO_DATE(conflict_batch_start_date, '%Y-%m-%d') AND 
                    STR_TO_DATE(Batch_Start_Date, '%Y-%m-%d') <= STR_TO_DATE(conflict_batch_end_date, '%Y-%m-%d')
                );
                   		            		insert into data_log values (1,conflict_batch_id);
                                            		insert into data_log values (22,conflict_slot_id);
											insert into data_log values (333,current_course_teacher_id);
                                
                   		            			insert into data_log values (4444,current_slot_id);
                                                 	insert into data_log values (66666666,current_Delete_Status);

                                         
                IF conflict_batch_id IS NOT NULL THEN

                IF is_date_conflict =1 THEN
					
                    SELECT Batch_Name
                    INTO conflict_batch_name
                    FROM course_batch
                    WHERE Batch_ID = conflict_batch_id;

                   SET validationMessage = CONCAT(
                        'Time Slot Already Booked: ', 
						teacher_name,
                        ' is teaching  ', 
                         course_name, 
                         '( ',
                         conflict_batch_name,
                         ' )'
                        ' from ', 
                        conflict_start_time, 
                        ' - ', 
                        conflict_end_time
					
                    );
                           SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = validationMessage;
				End if;
            
                  
                ELSE

                    SET validationMessage = CONCAT(
						'Time Slot Already Booked: ', 
						teacher_name,
                        ' is teaching  ', 
                         course_name, 
                        ' from ', 
                        conflict_start_time, 
                        ' - ', 
                        conflict_end_time
                    );
					SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = validationMessage;

                END IF;
         
            END IF;

            SET j = j + 1;
        END WHILE;
        SET i = i + 1;
    END WHILE;

    -- If no overlaps were found
    SET validationMessage = CONCAT('No overlaps for Course "', 
                                   course_name, 
                                   '" by ', 
                                   teacher_name,
                                   ' (CourseTeacher_ID: ', 
                                   current_course_teacher_id, 
                                   ')');
    SELECT validationMessage;
    
    


    
END$$
DELIMITER ;
