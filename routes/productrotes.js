const express = require("express");
const router = express.Router();
const sequelize = require('../config/db');
const multer = require("multer");
const  axios=require("axios");
const { Op } = require('sequelize');
const path = require("path");
const { authenticateToken } = require("../middleware/auth");
const { getProducts } = require("../controller/getproducts");
const { Product } = require("../models/product");
const { headers } = require("../config/subpass");
const BUNNY_CONFIG = {
  storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || "1083770",
  storagePassword: process.env.BUNNY_STORAGE_PASSWORD,
  storageUrl: "https://storage.bunnycdn.com",
  pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL
};

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
});

async function uploadToBunny(buffer, fileName){
  try {
    const response  = await axios.put(
      `${BUNNY_CONFIG.storageUrl}/${BUNNY_CONFIG.storageZoneName}/${fileName}`,
      buffer,
      {
        headers: {
          AccessKey: BUNNY_CONFIG.storagePassword,
          "Content-Type": "application/octet-stream"
        }
      }
    );
    if (response.status===201){
      return `${BUNNY_CONFIG.pullZoneUrl}/${fileName}`;
    } else {
      throw new Error('Failed to upload to Bunny CDN');
    }
  } catch (error) {
    console.error("Bunny CDN upload error:", error);
    throw error;
  }
};

function generateFilename(originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = path.extname(originalName);
  return `${timestamp}_${randomString}${extension}`;
}

router.get("/scrape-products", async (req, res) => {
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
router.get("/get-products", async (req, res) => {
  try {
    const products = await Product.findAll();

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found",
        data: []
      });
    }

    return res.status(200).json({
      message: "Products found successfully",
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
router.get("/user-products", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id || req.user.user_id;

    const products = await Product.findAll({
      where: { userid: user_id }
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found",
        data: []
      });
    }

    return res.status(200).json({
      message: "Products found successfully",
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
router.post("/create-product", upload.single('image'), async (req, res) => {
  try {
    const {
      user_id,
      title,
      description,
      price,
      discount_percentage,
      category,
      brand,
      stock_quantity,
      rating,
      tags
    } = req.body;
    if (!title || !price || !user_id) {
      return res.status(400).json({
        message: 'Title and price and User id are required fields'
      });
    }
    let image_url;
   if (req.file){
    const fileName= await generateFilename(req.file.originalname);
    try{
         image_url = await uploadToBunny(req.file.buffer, fileName);
    }catch (uploadError) {   
        console.error('Image upload failed:', uploadError);
        return res.status(500).json({
          message: 'Failed to upload image',
          error: uploadError.message
        });
      }
    }
     let parsedTags = null;
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (parseError) {
        parsedTags = Array.isArray(tags) ? tags : [tags];
      }
    }
    const newProduct = await Product.create({
      title,
      description,
      price: parseFloat(price),
      discount_percentage: discount_percentage ? parseFloat(discount_percentage) : null,
      category,
      brand,
      stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
      rating: rating ? parseFloat(rating) : null,
      tags: parsedTags,
      image_url,
      thumbnail_url: null, 
      user_id
    });
    return res.status(201).json({
      message:"Product Created S uccessfully",
      product:newProduct
    })
  } catch (error) {
      console.error('Error creating product:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
});
router.get('/product-by-tag',async (req,res)=>{
  try{
    const  {tag}= req.query;
    if (!tag) {
      return res.status(400).json({
        message: "Tag is required"
      });
    }
     const products = await Product.findAll({
      where: sequelize.where(
        sequelize.cast(sequelize.col('tags'), 'text'),
        {
          [Op.like]: `%${tag}%`
        }
      )
    });
    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found for the specified tag",
        data: []
      });
    }
    return res.status(200).json({
      message: "Products found successfully",
      data: products
    });
  }catch(error){
    console.error("Error fetching products by tag:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
})
router.get('/product-by-id', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({
        message: "Product ID is required"
      });
    }
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        data: null
      });
    }
    return res.status(200).json({
      message: "Product found successfully",
      data: product
    });
  } catch (error) {
    console.error("Error fetching products by id:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});
router.get('/get-by-category/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    console.log(`Received request for category: ${name}`);
  
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category name'
      });
    }

    const searchTerm = name.trim().toLowerCase();
    console.log(`Searching for: ${searchTerm}`);

  
    if (!Product) {
      throw new Error('Product model is not defined');
    }

 
    await Product.findOne({ limit: 1 });
    console.log('Database connection successful');

  
    const products = await Product.findAll({
      where: {
        [Op.or]: [
          
          {
            category: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
         
          {
            title: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
         
          {
            brand: {
              [Op.iLike]: `%${searchTerm}%`
            }
          }
        
        ]
      },
      order: [
        ['created_at', 'DESC'],
        ['rating', 'DESC']
      ]
    });

    console.log(`Found ${products.length} products`);
  
    
    res.status(200).json({
      success: true,
      message: products.length > 0 
        ? `Found ${products.length} products for category: ${name}`
        : `No products found for category: ${name}`,
      data: products,
      count: products.length,
      searchTerm: name
    });

  } catch (error) {
  
    console.error('Error occurred while fetching products by category:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
  
    if (error.name === 'SequelizeConnectionError') {
      console.error('Database connection error');
    } else if (error.name === 'SequelizeDatabaseError') {
      console.error('Database query error');
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching products',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : undefined
    });
  }
});

router.get('/get-new-products', async (req, res) => {
  try {
    const products = await Product.findAll({
     order: [
        ['created_at', 'DESC'],
        ['rating', 'DESC']
      ]
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found",
        data: []
      });
    }

    return res.status(200).json({
      message: "Products found successfully",
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
})

module.exports = router;
