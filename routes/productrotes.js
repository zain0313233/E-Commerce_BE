const express = require("express");
const router = express.Router();
const multer = require("multer");
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
    if (file.mimetype.startWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
});

async function uploadToBunny(buffer, fileName){
  try {
    const response  = await axiox.put(
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
router.get("/get-products", authenticateToken, async (req, res) => {
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
module.exports = router;
