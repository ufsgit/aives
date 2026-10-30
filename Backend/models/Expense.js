const fs = require("fs");
const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const db = require("../config/dbconnection");
const Expense = {
  Save_Expense_Type: async (data) => {
    console.log("data", data);

    const result = await executeTransaction("Save_Expense_Type", [
      data.Expense_Type_Id ||0,
      data.Expense_Type_Name,
      data.Expense_Category_Id,
    ]);

    return result;
  },
  Save_Expense: async (data) => {
    const result = await executeTransaction("Save_Expense", [
      data.Expense_Id || 0,
      data.Expense_Type_Id || 0,
      data.User_Id,                     // Logged-in user ID
      data.Amount,
      data.Description || '',
      data.Account_Id,
      data.Account_Name,
      data.Student_ID || 0,
      data.StudentName || ''
    ]);
console.log('To check Account ID',data);

    return result;
  },

Save_Expense_Category: async (data) => {
    console.log("data", data);

    const result = await executeTransaction("Save_Expense_Category", [
      data.Expense_Category_Id ||0,
      data.Expense_Category_Name,
    ]);

    return result;
  },

    Get_Expense_Category: async () => {
    const result = await getmultipleSP("Get_Expense_Category", []);
    return result;
  },

    Delete_Expense_Category: async (id) => {
    const result = await executeTransaction("Delete_Expense_Category", [id]);
    return result;
  },
  

  Get_Expense: async () => {
    const result = await getmultipleSP("Get_Expense_Type", []);
    return result;
  },

  Get_ExpenseList: async (page = 1, pageSize = 10, filters = {}) => {
    const offset = (page - 1) * pageSize;
    const { fromDate, toDate, accountId, expenseTypeId } = filters;

    let whereClause = `WHERE e.Delete_Status = 0`;
    let params = [];

    if (fromDate) {
      whereClause += ` AND DATE(e.Entry_Date) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      whereClause += ` AND DATE(e.Entry_Date) <= ?`;
      params.push(toDate);
    }
    if (accountId) {
      whereClause += ` AND e.Account_Id = ?`;
      params.push(accountId);
    }
    if (expenseTypeId) {
      whereClause += ` AND e.Expense_Type_Id = ?`;
      params.push(expenseTypeId);
    }

    const countSql = `SELECT COUNT(*) as total_count FROM Expense e ${whereClause}`;
    const dataSql = `
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
        ${whereClause}
        ORDER BY 
            Entry_Date DESC
        LIMIT ? OFFSET ?
    `;

    const [countRes] = await db.promise().query(countSql, params);
    const [dataRes] = await db.promise().query(dataSql, [...params, pageSize, offset]);

    return [countRes, dataRes];
  },
  Get_ExpenseList_Student_ID: async (Student_ID) => {
    const result = await getmultipleSP("Get_ExpenseList_Student_ID", [Student_ID]);
    return result;
  },
  Delete_Expense_Type: async (id) => {
    const result = await executeTransaction("Delete_Expense_Type", [id]);
    return result;
  },
  Search_Expense: async (Expense_Type_Name) => {
    const result = await getmultipleSP("Search_Expense_Type", [Expense_Type_Name]);
    return result;
  },
  Delete_Expense: async function (Expense_Id) {
    return executeTransaction("Delete_Expense", [
      Expense_Id,
    ]);
  }
};

module.exports = Expense;
