const express = require('express');
const router = express.Router();
const Fees =require('../models/fees.js');

// Get_All_installment_information
router.get('/Get_All_installment_information/:Course_ID', async (req, res) => {
  try {
    const Course_ID = parseInt(req.params.Course_ID);
    const result = await Fees.Get_All_installment_information(Course_ID);
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch installments', error: e.message });
  }
});

// saveMultipleInstallments
router.post('/Save_Student_Fees_Details/', async (req, res) => {
  try {
    const rows = await Fees.Save_Student_Fees_Details(req.body,req.userId);
    console.log(req.body, "req.body");
    res.json({ success: true, inserted: rows }); // ✅ rows is now a real array
  } catch (e) {
    console.error('e: ', e);
    res.status(500).json({
      success: false,
      message: 'Failed to save fees',
      error: e.message
    });
  }
});

// Get_FeesByStudentCourse
router.get('/Get_FeesByStudentCourse/:studentId/:courseId', async (req, res) => {
  const { studentId, courseId } = req.params;
   try {
    console.log("studentId, courseId",studentId, courseId);
    
    const result = await Fees.Get_FeesByStudentCourse(studentId, courseId);
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch fees by student course', error: e.message });
  }
});

// Get_FeesByStudentId
router.get('/Get_FeesByStudentId/:studentId', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const result = await Fees.Get_FeesByStudentId(studentId);
    // console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch fees by student id', error: e.message });
  }
});


router.get('/Get_Accounts/', async (req, res) => {
  try {
    const User_Id = parseInt(req.userId);
    let result = await Fees.Get_Accounts(User_Id);
    console.log("Get_Accounts result[0]:", result ? result[0] : null);
    
    // Fallback: If user's specific branch has no accounts, fetch all available accounts
    if (!result || !result[0] || result[0].length === 0) {
      result = await Fees.Get_All_Accounts();
      console.log("Fallback all accounts result[0]:", result ? result[0] : null);
    }

    res.json(result && result[0] ? result[0] : []); // Return the result set
  } catch (e) {
    console.error('Get Accounts Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch accounts', error: e.message });
  }
});
// Get_All_PaymentMode
router.get('/Get_All_PaymentMode/', async (req, res) => {
  try {
    // const User_Id = parseInt(req.userId);
    const result = await Fees.Get_All_PaymentMode();
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch payment modes', error: e.message });
  }
});

router.get('/gstalltaxtypes/', async (req, res) => {
  try {
    //const User_Id = parseInt(req.userId);
    const result = await Fees.gstalltaxtypes();
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch tax types', error: e.message });
  }
});


// Get_FeesByStudent_Fees_ID
router.get('/Get_FeesByStudent_Fees_ID/:Student_Fees_ID', async (req, res) => {
  try {
    const Student_Fees_ID = parseInt(req.params.Student_Fees_ID);
    const result = await Fees.Get_FeesByStudent_Fees_ID(Student_Fees_ID);
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch fees by fee id', error: e.message });
  }
});

router.get('/Edit_FeesByReceipt_ID/:Receipt_Id', async (req, res) => {
  try {
    const Receipt_Id = parseInt(req.params.Receipt_Id);
    const result = await Fees.Edit_FeesByReceipt_ID(Receipt_Id);
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to edit fees by receipt id', error: e.message });
  }
});

router.get('/Delete_FeesByReceipt_ID/:Receipt_Id', async (req, res) => {
  try {
    const Receipt_Id = parseInt(req.params.Receipt_Id);
    const result = await Fees.Delete_FeesByReceipt_ID(Receipt_Id);
    console.log("result[0]",result[0]);
    
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to delete fees by receipt id', error: e.message });
  }
});

// Get_FeesByReceipt_ID
router.get('/Get_FeesByReceipt_ID/:Receipt_Id', async (req, res) => {
  try {
    const Receipt_Id = parseInt(req.params.Receipt_Id);
    const result = await Fees.Get_FeesByReceipt_ID(Receipt_Id);
    console.log("result[0]",result[0]);

    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch fees by receipt id', error: e.message });
  }
});
// Get_Tax_Reports
router.get('/Get_Tax_Reports', async (req, res, next) => {
  try {
    const {
      Student_Id,
      Branch,
      Account_Id,
      Start_Date,
      End_Date,
      PageNumber = 1,
      PageSize = 25
    } = req.query;

    console.log(">>>>>>>>>>>",  Student_Id,
      Branch,
      Account_Id,
      Start_Date,
      End_Date, parseInt(PageNumber),
      parseInt(PageSize));
    
    const rows = await Fees.Get_Tax_Reports(
      Student_Id,
      Branch,
      Account_Id,
      Start_Date,
      End_Date,
      parseInt(PageNumber),
      parseInt(PageSize)
    );

    console.log("rows",rows);
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ errors: { message: 'An error occurred while processing your request.' } });
  }
});

// Update_Fee[]
router.post('/Update_FeesByReceipt_ID', async (req, res) => {
  try {
    console.log("Update_FeesByReceipt_ID - req.body:", JSON.stringify(req.body, null, 2));
    
    const { updatedData } = req.body;
    const result = await Fees.Update_FeesByReceipt_ID(updatedData, req.userId);
    console.log("Update_FeesByReceipt_ID - Result:", result);

    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Update Fee Error Detail:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update fee', 
      error: e.message,
      detail: e.sqlMessage || e.code // Include SQL error if available
    });
  }
});

module.exports = router;
