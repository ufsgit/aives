var fs = require('fs');
const { executeTransaction } = require('../helpers/sp-caller');


const getCart = async (userId) => {
    return executeTransaction('Get_User_Cart', [userId]);
  };
  
  const addToCart = async (userId, courseId) => {
    return executeTransaction('Add_Course_ToCart', [userId, courseId]);
  };
  
  const removeFromCart = async (userId, courseId) => {
    return executeTransaction('Remove_Course_FromCart', [userId, courseId]);
  };
  
  const updateCartQuantity = async (userId, courseId, quantity) => {
    return executeTransaction('Update_Cart_Course_Quantity', [userId, courseId, quantity]);
  };

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  updateCartQuantity,
};