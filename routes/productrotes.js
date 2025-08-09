const express = require("express");
const router = express.Router();
const sequelize = require('../config/db');
const multer = require("multer");
const axios = require("axios");
const { Op } = require('sequelize');
const path = require("path");
const { authenticateToken } = require("../middleware/auth");
const { getProducts } = require("../controller/getproducts");
const { Product } = require("../models/product");
const { headers } = require("../config/subpass");
const cloudinary = require("cloudinary").v2;
const cache = require('../config/cache');



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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImageTocloudinary = async (buffer, fileName) => {
  try {
    const base64Data = buffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: fileName,
      resource_type: "image"
    });
    console.log("Cloudinary upload successful:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    
    return null;
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
    cache.flushAll();
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

router.get("/get-products", authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const cacheKey = `products_all_${limit}_${offset}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        message: "Products found successfully",
        data: cachedData.products,
        total: cachedData.total,
        cached: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found",
        data: []
      });
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData);

    return res.status(200).json({
      message: "Products found successfully",
      data: products,
      total: count
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

router.get("/user-products/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const cacheKey = `products_user_${id}_${limit}_${offset}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        message: "Products found successfully",
        data: cachedData.products,
        total: cachedData.total,
        cached: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { user_id: id },
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found",
        data: []
      });
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData);

    return res.status(200).json({
      message: "Products found successfully",
      data: products,
      total: count
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

router.post("/create-product", authenticateToken, upload.single('image'), async (req, res) => {
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
    
    let image_url = null;
if (req.file) {
  const fileName = await generateFilename(req.file.originalname);
  console.log("Attempting to upload file:", fileName);
  
  image_url = await uploadImageTocloudinary(req.file.buffer, fileName);
  
  if (!image_url) {
    console.error('Image upload failed - no URL returned');
  } else {
    console.log('Image uploaded successfully:', image_url);
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

    cache.flushAll();

    return res.status(201).json({
      message: "Product Created Successfully",
      product: newProduct
    });
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

router.get('/product-by-tag', authenticateToken, async (req, res) => {
  try {
    const { tag, limit = 20, offset = 0 } = req.query;
    
    if (!tag) {
      return res.status(400).json({
        message: "Tag is required"
      });
    }

    const cacheKey = `products_tag_${tag}_${limit}_${offset}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.status(200).json({
        message: "Products found successfully",
        data: cachedData.products,
        total: cachedData.total,
        cached: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: sequelize.where(
        sequelize.cast(sequelize.col('tags'), 'text'),
        {
          [Op.like]: `%${tag}%`
        }
      ),
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });
    
    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "No products found for the specified tag",
        data: []
      });
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData);

    return res.status(200).json({
      message: "Products found successfully",
      data: products,
      total: count
    });
  } catch (error) {
    console.error("Error fetching products by tag:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

router.get('/product-by-id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        message: "Product ID is required"
      });
    }

    const cacheKey = `product_${id}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.status(200).json({
        message: "Product found successfully",
        data: cachedData,
        cached: true
      });
    }

    const product = await Product.findByPk(id, {
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at','user_id']
    });
    
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        data: null
      });
    }

    cache.set(cacheKey, product);

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

router.get('/get-by-category/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category name'
      });
    }

    const searchTerm = name.trim().toLowerCase();
    const cacheKey = `products_category_${searchTerm}_${limit}_${offset}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: cachedData.products.length > 0 
          ? `Found ${cachedData.total} products for category: ${name}`
          : `No products found for category: ${name}`,
        data: cachedData.products,
        count: cachedData.total,
        searchTerm: name,
        cached: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
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
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ['created_at', 'DESC'],
        ['rating', 'DESC']
      ]
    });

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData);

    res.status(200).json({
      success: true,
      message: products.length > 0 
        ? `Found ${count} products for category: ${name}`
        : `No products found for category: ${name}`,
      data: products,
      count: count,
      searchTerm: name
    });

  } catch (error) {
    console.error('Error occurred while fetching products by category:', error);
    
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

router.get('/get-new-products', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const cacheKey = `products_new_${limit}_${offset}`;
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        message: "Products found successfully",
        data: cachedData.products,
        total: cachedData.total,
        cached: true
      });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at'],
      limit: parseInt(limit),
      offset: parseInt(offset),
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

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData);

    return res.status(200).json({
      message: "Products found successfully",
      data: products,
      total: count
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;