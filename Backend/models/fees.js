const fs = require("fs");
const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const Fees = {
  Get_All_installment_information: async function (Course_ID) {
    return getmultipleSP("Get_All_installment_information", [Course_ID]);
  },
  Save_Student_Fees_Details: async function (CourseFeesList, userId) {
    try {
      // console.log("CourseFeesList", CourseFeesList);
      let paidAssignedMap = {};

      // Step 1: Insert all fee rows
      const insertResults = await Promise.all(
        CourseFeesList.map((fee) => {
          let paidAmountToUse = fee.Paid_Amount;
          // if (fee.Student_Fees_ID === 0) {
          //   if (!paidAssignedMap[fee.Student_ID]) {
          //     paidAssignedMap[fee.Student_ID] = true;
          //   } else {
          //     paidAmountToUse = 0;
          //   }
          // }
          console.log(fee, "fee.Paid_Amount");
          return executeTransaction(`Save_Student_Fees_Details`, [
            fee.Student_Fees_ID || 0,
            fee.Student_ID,
            fee.Installment_information_ID,
            fee.Course_ID,
            fee.Course_Name,
            fee.Total_Amount,
            fee.Paid_Amount,
            fee.Fee_Status,
            fee.Payment_Date,
            toMySQLDateTime_Due_Date(fee.Due_Date),
            fee.Payment_Mode,
            fee.Transaction_ID,
            fee.Account_Id,
            fee.Receipt_Id,
            userId,
            fee.Tax_Type_Id,
            fee.Netvalue,
            fee.Gstpers,
            fee.Cgstpers,
            fee.Sgstpers,
            fee.Gst,
            fee.Cgst,
            fee.Sgst,
            fee.Fine_Amount || 0

          ]);
        })
      );

      function toMySQLDateTime_Due_Date(dateStr) {
        if (!dateStr) return null;

        // Handle 'dd/MM/yyyy' format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          const d = new Date(+year, +month - 1, +day);

          const pad = (n) => (n < 10 ? '0' + n : n);
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }

        return null;
      }

      function toMySQLDateTime(isoDate) {
        if (!isoDate) return null;
        const d = new Date(isoDate);
        const pad = (n) => (n < 10 ? '0' + n : n);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }

      // Step 2: Call adjustment once per unique Student_ID
      const uniqueStudentIds = [
        ...new Set(CourseFeesList.map((fee) => fee.Student_ID)),
      ];

      console.log("Unique Student IDs for adjustment:", uniqueStudentIds);

      for (const studentId of uniqueStudentIds) {
        console.log(`Adjusting fees for Student ID: ${studentId}`);

        await executeTransaction("AdjustNegativeRemainingAmount", [studentId]);
      }

      return insertResults;
    } catch (err) {
      console.error("Error with parallel fee inserts:", err);
      throw err;
    }
  },
  Update_FeesByReceipt_ID: async function (updatedData, userId) {
    console.log("Update_FeesByReceipt_ID called with data:", JSON.stringify(updatedData, null, 2), "and userId:", userId);

    const {
      Receipt_Id,
      Student_Id,
      Amount,
      Entry_Date,
      User_Id,
      Branch,
      Account_Id,
      Payment_mode,
      Transaction_ID,
      Tax_Type_Id,
      Netvalue,
      Gstpers,
      Cgstpers,
      Sgstpers,
      Gst,
      Cgst,
      Sgst,
      Payment_Date,
      Fine_Amount
    } = updatedData;

    function toMySQLDateTime(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const pad = (n) => (n < 10 ? '0' + n : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const formattedEntryDate = toMySQLDateTime(Entry_Date);
    const formattedPaymentDate = toMySQLDateTime(Payment_Date);

    const params = [
      Receipt_Id,
      Student_Id,
      Amount,
      formattedEntryDate,
      User_Id || userId,
      Branch,
      Account_Id,
      Payment_mode,
      Transaction_ID,
      Tax_Type_Id,
      Netvalue,
      Gstpers,
      Cgstpers,
      Sgstpers,
      Gst,
      Cgst,
      Sgst,
      formattedPaymentDate,
      Fine_Amount || 0
    ];

    console.log("Update_FeesByReceipt_ID - Final Parameters:", params);

    return executeTransaction("Update_FeesByReceipt_ID", params);
  },
  Get_FeesByStudentCourse: async function (studentId, courseId) {
    return getmultipleSP("Get_FeesByStudentCourse", [studentId, courseId]);
  },
  Get_FeesByStudentId: async function (studentId) {
    return getmultipleSP("Get_FeesByStudentId", [studentId]);
  },
  Get_FeesByStudent_Fees_ID: async function (Student_Fees_ID) {
    return getmultipleSP("Get_FeesByStudent_Fees_ID", [Student_Fees_ID]);
  },
  Get_FeesByReceipt_ID: async function (Receipt_Id) {
    return getmultipleSP("Get_FeesByReceipt_ID", [Receipt_Id]);
  },
  Get_Tax_Reports: async function (
  Student_Id,
  Branch,
  Account_Id,
  Start_Date,
  End_Date,
  page,
  pageSize
) {
  Student_Id = Student_Id || 0;
  Branch = Branch || 0;
  Account_Id = Account_Id || 0;
  Start_Date = Start_Date || '';
  End_Date = End_Date || '';
  page = page || 1;
  pageSize = pageSize || 25;

  console.log("final",Student_Id,
    Branch,
    Account_Id,Start_Date,
    End_Date,
    page,
    pageSize);
  
  return getmultipleSP('Get_Tax_Reports', [
    Student_Id,
    Branch,
    Account_Id,
    Start_Date,
    End_Date,
    page,
    pageSize
  ]);
}
,
 
  Edit_FeesByReceipt_ID: async function (Receipt_Id) {
    return getmultipleSP("Edit_FeesByReceipt_ID", [Receipt_Id]);
  },

  Delete_FeesByReceipt_ID: async function (Receipt_Id) {
    return getmultipleSP("Delete_FeesByReceipt_ID", [Receipt_Id]);
  },

  Get_Accounts: async function (User_Id) {
    return getmultipleSP("Get_Accounts", [User_Id]);
  },
  Get_All_Accounts: async function () {
    const db = require('../config/dbconnection');
    const [rows] = await db.promise().query(
      "SELECT Account_id, Account_Name, Payment_Id FROM account_heads"
    );
    return [rows];
  },
  Get_All_PaymentMode: async function () {
    return getmultipleSP("Get_All_PaymentMode", []);
  },

  gstalltaxtypes: async function () {
    return getmultipleSP("gstalltaxtypes", []);
  },

};

module.exports = Fees;
