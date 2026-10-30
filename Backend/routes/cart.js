const express = require('express');
const router = express.Router();
const cartModel = require('../models/cart');

router.route('/')
  .get(async (req, res) => {
    try {
      const userId = req.userId; // Assuming you have user authentication set up
      console.log('userId: ', userId);
      const cart = await cartModel.getCart(userId);
      res.json(cart);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve cart' });
    }
  })
  .post(async (req, res) => {
    try {
      const userId = req.userId; // Assuming you have user authentication set up
      const { courseId } = req.body;

      const result=await cartModel.addToCart(userId, courseId);
      res.json({ message: 'Course added to cart',result });
    } catch (error) {
      console.error(error);
      res.status(500).json({  message: 'Failed to Enrolle a Course', error: error.message });    }
  })
  .put(async (req, res) => {
    try {
      const userId = req.userId; // Assuming you have user authentication set up
      const { courseId, quantity } = req.body;

    const result=  await cartModel.updateCartQuantity(userId, courseId, quantity);
      res.json({ message: 'Course quantity updated',result });
    } catch (error) {
      console.error(error);
      res.status(500).json({  message: 'Failed to Update a Course', error: error.message });    
    }
  })
  .delete(async (req, res) => {
    try {
      const userId = req.userId; // Assuming you have user authentication set up
      const { courseId } = req.body;

      await cartModel.removeFromCart(userId, courseId);
      res.json({ message: 'Course removed from cart' });
    } catch (error) {
      console.error(error);
      res.status(500).json({  message: 'Failed to Delete a Course', error: error.message });    
    }
  });

module.exports = router;