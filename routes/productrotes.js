
const express = require('express');
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { getProducts } = require('../controller/getproducts');
const {Product} = require("../models/product");
router.get('/scrape-products', async (req, res) => {
  try {
    const result = await getProducts();
    return res.status(200).json({
      message: "Products scraped and stored successfully",
      data: result
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      message: "Error scraping products",
      error: error.message
    });
  }
});
router.get('/get-products',authenticateToken, async (req, res) => {
  try {
    const products = await Product.findAll();
    
    if (!products || products.length === 0) {
      return res.status(404).json({
        message: 'No products found',
        data: []
      });
    }
    
    return res.status(200).json({
      message: 'Products found successfully',
      data: products
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});
router.get('/user-products', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id || req.user.user_id;
    
    const products = await Product.findAll({
      where: { userid: user_id }
    });
    
    if (!products || products.length === 0) {
      return res.status(404).json({
        message: 'No products found',
        data: []
      });
    }
    
    return res.status(200).json({
      message: 'Products found successfully',
      data: products
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});
module.exports=router;