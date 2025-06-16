
const express = require('express');
const router = express.Router();
const { getProducts } = require('../controller/getproducts');
const Product = require('../models/product');
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
module.exports=router;