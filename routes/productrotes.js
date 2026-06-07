const express = require("express");
const router = express.Router();
const sequelize = require('../config/db');
const multer = require("multer");
const axios = require("axios");
const { Op } = require('sequelize');
const path = require("path");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { getProducts } = require("../controller/getproducts");
const { seedCatalog } = require("../services/productSeeder");
const { buildCategoryWhere } = require("../services/categoryQuery");
const {
  buildProductListWhere,
  buildProductListOrder,
  mergeWithCategoryWhere,
} = require("../services/productListQuery");
const { Product } = require("../models/Product");
const { uploadBuffer } = require("../config/supabaseStorage");
const cache = require('../config/cache');

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

function generateFilename(originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = path.extname(originalName);
  return `${timestamp}_${randomString}${extension}`;
}

router.get(
  "/scrape-products",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
  try {
    const mode = req.query.mode || "dummyjson";
    if (mode === "catalog" || mode === "seed") {
      const perCategory = Math.min(parseInt(req.query.perCategory, 10) || 500, 600);
      const clearSeeded = req.query.clear === "true";
      const result = await seedCatalog({ perCategory, clearSeeded, batchSize: 500 });
      cache.flushAll();
      return res.status(200).json({
        message: "Catalog seeded successfully (fast mock + picsum images)",
        data: result,
      });
    }

    const result = await getProducts();
    cache.flushAll();
    return res.status(200).json({
      message:
        "Imported up to 100 products from DummyJSON (limited API). For 5k+ catalog use ?mode=catalog",
      data: result,
      hint: "GET /api/product/scrape-products?mode=catalog&perCategory=500",
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      message: "Error scraping products",
      error: error.message,
    });
  }
});

router.get(
  "/seed-catalog",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
  try {
    const perCategory = Math.min(parseInt(req.query.perCategory, 10) || 500, 600);
    const clearSeeded = req.query.clear === "true";
    const result = await seedCatalog({ perCategory, clearSeeded, batchSize: 500 });
    cache.flushAll();
    return res.status(200).json({
      message: "Catalog seeded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Seed catalog error:", error);
    return res.status(500).json({
      message: "Failed to seed catalog",
      error: error.message,
    });
  }
});

router.get("/get-products", async (req, res) => {
  try {
    const {
      limit = 48,
      offset = 0,
      category,
      sort,
      minPrice,
      maxPrice,
      onSale,
      search,
    } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 48, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const where = buildProductListWhere({ category, minPrice, maxPrice, onSale, search });
    const order = buildProductListOrder(sort);
    const cacheKey = `products_all_${parsedLimit}_${parsedOffset}_${JSON.stringify(where)}_${sort || "newest"}`;
    const listAttributes = [
      'id', 'title', 'description', 'price', 'discount_percentage',
      'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'created_at',
    ];

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Products found successfully",
        data: cachedData.products,
        count: cachedData.total,
        total: cachedData.total,
        cached: true
      });
    }

    const products = await Product.findAll({
      attributes: listAttributes,
      where,
      limit: parsedLimit,
      offset: parsedOffset,
      order,
    });

    const countCacheKey = `products_all_count_${JSON.stringify(where)}`;
    let count = cache.get(countCacheKey);
    if (count === undefined) {
      count = await Product.count({ where });
      cache.set(countCacheKey, count, 300);
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData, 120);

    return res.status(200).json({
      success: true,
      message: products.length ? "Products found successfully" : "No products found",
      data: products,
      count,
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
    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
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
      attributes: ['id', 'title', 'description', 'price', 'discount_percentage', 'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'tags', 'created_at', 'user_id'],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    if (!products || products.length === 0) {
      return res.status(200).json({
        message: "No products found",
        data: [],
        total: 0,
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

router.post("/create-product", authenticateToken, requireRole("seller"), upload.single('image'), async (req, res) => {
  try {
    const sellerId = req.user.id;
    const {
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
    
    if (!title || !price) {
      return res.status(400).json({
        message: 'Title and price are required fields'
      });
    }
    
    let image_url = null;
if (req.file) {
  const fileName = await generateFilename(req.file.originalname);
  console.log("Attempting to upload file:", fileName);
  
  const filePath = `sellers/${sellerId}/${fileName}`;
  image_url = await uploadBuffer(req.file.buffer, filePath, req.file.mimetype);
  
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
      user_id: sellerId,
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

router.get('/product-by-tag', async (req, res) => {
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

router.get('/product-by-id', async (req, res) => {
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

router.get('/get-by-category/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 48, offset = 0, sort, minPrice, maxPrice, onSale } = req.query;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category name'
      });
    }

    const searchTerm = name.trim().toLowerCase();
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 48, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const categoryWhere = buildCategoryWhere(name);
    const where = mergeWithCategoryWhere(categoryWhere, { minPrice, maxPrice, onSale });
    const order = buildProductListOrder(sort || "newest");
    const cacheKey = `products_category_${searchTerm}_${parsedLimit}_${parsedOffset}_${sort || "newest"}_${JSON.stringify(where)}`;
    
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

    const listAttributes = [
      'id', 'title', 'description', 'price', 'discount_percentage',
      'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'created_at',
    ];

    const countCacheKey = `products_category_count_${searchTerm}_${JSON.stringify(where)}`;

    const products = await Product.findAll({
      where,
      attributes: listAttributes,
      limit: parsedLimit,
      offset: parsedOffset,
      order,
      subQuery: false,
    });

    let count = cache.get(countCacheKey);
    if (count === undefined) {
      count = await Product.count({ where });
      cache.set(countCacheKey, count, 600);
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData, 120);

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

router.get('/get-new-products', async (req, res) => {
  try {
    const {
      limit = 48,
      offset = 0,
      sort,
      category,
      minPrice,
      maxPrice,
      onSale,
      search,
    } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 48, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const where = buildProductListWhere({ category, minPrice, maxPrice, onSale, search });
    const order = buildProductListOrder(sort || "newest");
    const cacheKey = `products_new_${parsedLimit}_${parsedOffset}_${sort || "newest"}_${JSON.stringify(where)}`;
    const listAttributes = [
      'id', 'title', 'description', 'price', 'discount_percentage',
      'category', 'brand', 'image_url', 'stock_quantity', 'rating', 'created_at',
    ];

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        message: "Products found successfully",
        data: cachedData.products,
        count: cachedData.total,
        total: cachedData.total,
        cached: true
      });
    }

    const products = await Product.findAll({
      attributes: listAttributes,
      where,
      limit: parsedLimit,
      offset: parsedOffset,
      order,
    });

    const countCacheKey = `products_new_count_${JSON.stringify(where)}`;
    let count = cache.get(countCacheKey);
    if (count === undefined) {
      count = await Product.count({ where });
      cache.set(countCacheKey, count, 300);
    }

    const responseData = { products, total: count };
    cache.set(cacheKey, responseData, 120);

    return res.status(200).json({
      success: true,
      message: products.length ? "Products found successfully" : "No products found",
      data: products,
      count,
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

router.put(
  "/update-product/:id",
  authenticateToken,
  requireRole("seller"),
  upload.single("image"),
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (String(product.user_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "You can only edit your own products" });
      }

      const {
        title,
        description,
        price,
        discount_percentage,
        category,
        brand,
        stock_quantity,
        rating,
        tags,
      } = req.body;

      let parsedTags = product.tags;
      if (tags !== undefined) {
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
        } catch {
          parsedTags = Array.isArray(tags) ? tags : [tags];
        }
      }

      let image_url = product.image_url;
      if (req.file) {
        const fileName = generateFilename(req.file.originalname);
        const filePath = `sellers/${req.user.id}/${fileName}`;
        image_url = await uploadBuffer(req.file.buffer, filePath, req.file.mimetype);
      }

      await product.update({
        title: title ?? product.title,
        description: description ?? product.description,
        price: price != null ? parseFloat(price) : product.price,
        discount_percentage:
          discount_percentage != null && discount_percentage !== ""
            ? parseFloat(discount_percentage)
            : product.discount_percentage,
        category: category ?? product.category,
        brand: brand ?? product.brand,
        stock_quantity:
          stock_quantity != null ? parseInt(stock_quantity, 10) : product.stock_quantity,
        rating: rating != null && rating !== "" ? parseFloat(rating) : product.rating,
        tags: parsedTags,
        image_url,
      });

      cache.flushAll();
      return res.status(200).json({
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      console.error("Update product error:", error);
      return res.status(500).json({ message: "Failed to update product", error: error.message });
    }
  }
);

router.delete(
  "/delete-product/:id",
  authenticateToken,
  requireRole("seller"),
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (String(product.user_id) !== String(req.user.id)) {
        return res.status(403).json({ message: "You can only delete your own products" });
      }
      await product.destroy();
      cache.flushAll();
      return res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Delete product error:", error);
      return res.status(500).json({ message: "Failed to delete product", error: error.message });
    }
  }
);

module.exports = router;