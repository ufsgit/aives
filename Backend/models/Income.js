const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const db = require("../config/dbconnection");
const Income = {
  Save_Income_Type: async (data) => {
    const result = await executeTransaction("Save_Income_Type", [
      data.Income_Type_Id || 0,
      data.Income_Type_Name,
      data.Income_Category_Id,
    ]);
    return result;
  },
  Save_Income: async (data) => {
    const result = await executeTransaction("Save_Income", [
      data.Income_Id || 0,
      data.Expense_Type_Id || 0,
      data.User_Id,
      data.Amount,
      data.Description || '',
      data.Account_Id,
      data.Account_Name
    ]);
    return result;
  },
  Save_Income_Category: async (data) => {
    const result = await executeTransaction("Save_Income_Category", [
      data.Income_Category_Id || 0,
      data.Income_Category_Name,
    ]);
    return result;
  },
  getmultipleSP: async (sp, params) => {
      return await getmultipleSP(sp, params);
  },
  Get_Income_Category: async () => {
    const result = await getmultipleSP("Get_Income_Category", []);
    return result;
  },
  Delete_Income_Category: async (id) => {
    const result = await executeTransaction("Delete_Income_Category", [id]);
    return result;
  },
  Get_Income_Type: async () => {
    const result = await getmultipleSP("Get_Income_Type", []);
    return result;
  },
  Get_IncomeList: async (page = 1, pageSize = 10, filters = {}) => {
    const offset = (page - 1) * pageSize;
    const { fromDate, toDate, accountId, expenseTypeId } = filters;

    let whereClause = `WHERE i.Delete_Status = 0`;
    let params = [];

    if (fromDate) {
      whereClause += ` AND DATE(i.Entry_Date) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      whereClause += ` AND DATE(i.Entry_Date) <= ?`;
      params.push(toDate);
    }
    if (accountId) {
      whereClause += ` AND i.Account_Id = ?`;
      params.push(accountId);
    }
    if (expenseTypeId) {
      whereClause += ` AND i.Expense_Type_Id = ?`;
      params.push(expenseTypeId);
    }

    const countSql = `SELECT COUNT(*) as total_count FROM income i ${whereClause}`;
    const dataSql = `
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
        ${whereClause}
        ORDER BY i.Entry_Date DESC
        LIMIT ? OFFSET ?
    `;

    const [countRes] = await db.promise().query(countSql, params);
    const [dataRes] = await db.promise().query(dataSql, [...params, pageSize, offset]);

    return [countRes, dataRes];
  },
  Delete_Income_Type: async (id) => {
    const result = await executeTransaction("Delete_Income_Type", [id]);
    return result;
  },
  Delete_Income: async (id) => {
    const result = await executeTransaction("Delete_Income", [id]);
    return result;
  }
};

module.exports = Income;
