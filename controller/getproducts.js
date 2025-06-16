const axios = require("axios");
const Product = require("../models/product");

const BUNNY_CONFIG = {
  storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || "1083770",
  storagePassword: process.env.BUNNY_STORAGE_PASSWORD,
  storageUrl: "https://storage.bunnycdn.com",
  pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL
};

const uploadImageToBunny = async (imageUrl, fileName) => {
  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    
    const uploadResponse = await axios.put(
      `${BUNNY_CONFIG.storageUrl}/${BUNNY_CONFIG.storageZoneName}/${fileName}`,
      imageBuffer,
      {
        headers: {
          'AccessKey': BUNNY_CONFIG.storagePassword,
          'Content-Type': 'application/octet-stream'
        }
      }
    );
    
    return `${BUNNY_CONFIG.pullZoneUrl}/${fileName}`;
  } catch (error) {
    console.error(`Error uploading image ${fileName}:`, error.message);
    return null;
  }
};
const getProducts = async () => {
  try {
    const response = await axios.get("https://dummyjson.com/products?limit=100");
    const products = response.data.products;
    console.log(`Found ${products.length} products from API`);
    
    for (const product of products) {
      const existingProduct = await Product.findOne({ where: { id: product.id } });
      
      if (existingProduct) {
        console.log(`Product ${product.id} already exists, skipping...`);
        continue;
      }
      
      let mainImageUrl = null;
      let thumbnailUrl = null;
      
      if (product.images && product.images.length > 0) {
        const mainImageFileName = `product_${product.id}_main.${product.images[0].split('.').pop()}`;
        mainImageUrl = await uploadImageToBunny(product.images[0], mainImageFileName);
      }
      
      if (product.thumbnail) {
        const thumbnailFileName = `product_${product.id}_thumb.${product.thumbnail.split('.').pop()}`;
        thumbnailUrl = await uploadImageToBunny(product.thumbnail, thumbnailFileName);
      }
      
      await Product.create({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        discount_percentage: product.discountPercentage,
        category: product.category,
        brand: product.brand,
        image_url: mainImageUrl,
        thumbnail_url: thumbnailUrl,
        stock_quantity: product.stock,
        rating: product.rating,
        tags: product.tags
      });
      
      console.log(`Product ${product.id} saved successfully`);
    }
    
    return { success: true, message: `Processed ${products.length} products` };
  } catch (error) {
    console.error("Error occurred:", error);
    throw error;
  }
};
module.exports = {
  getProducts
};
