const axios = require("axios");
const { Product } = require("../models/Product");
const { getGoogleDriveAuth } = require("../config/googledrive");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cloudinary = require("cloudinary").v2;

const BUNNY_CONFIG = {
  storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || "1083770",
  storagePassword: process.env.BUNNY_STORAGE_PASSWORD,
  storageUrl: "https://storage.bunnycdn.com",
  pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL
};
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImageTocloudinary = async (imageUrl, fileName) => {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });
    if (imageResponse.status === 404) {
      console.log(`Image ${imageUrl} returned 404 - skipping upload`);
      return 404;
    }
    const imageBuffer = Buffer.from(imageResponse.data);
    const base64Data = imageBuffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: fileName,
      resource_type: "image"
    });
    return result.secure_url;
  } catch (error) {
    if (error.http_code === 404) {
      return 404;
    }
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

const uploadImageToBunny = async (imageUrl, fileName) => {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });
    if (imageResponse.status === 404) {
      console.log(`Image ${imageUrl} returned 404 - skipping upload`);
      return 404;
    }
    const imageBuffer = Buffer.from(imageResponse.data);

    const uploadResponse = await axios.put(
      `${BUNNY_CONFIG.storageUrl}/${BUNNY_CONFIG.storageZoneName}/${fileName}`,
      imageBuffer,
      {
        headers: {
          AccessKey: BUNNY_CONFIG.storagePassword,
          "Content-Type": "application/octet-stream"
        }
      }
    );

    return `${BUNNY_CONFIG.pullZoneUrl}/${fileName}`;
  } catch (error) {
    console.error(`Error uploading image ${fileName}:`, error.message);
    if (error.response && error.response.status === 404) {
      console.log(
        `Source image ${imageUrl} not found (404) - skipping product`
      );
      return 404;
    }
    return null;
  }
};
const getProducts = async () => {
  try {
    const response = await axios.get(
      "https://dummyjson.com/products?limit=100"
    );
    const products = response.data.products;
    console.log(`Found ${products.length} products from API`);

    for (const product of products) {
      const existingProduct = await Product.findOne({
        where: { id: product.id }
      });

      if (existingProduct) {
        console.log(`Product ${product.id} already exists, skipping...`);
        continue;
      }

      let mainImageUrl = null;
      let thumbnailUrl = null;

      if (product.images && product.images.length > 0) {
        const mainImageFileName = `product_${
          product.id
        }_main.${product.images[0].split(".").pop()}`;
        mainImageUrl = await uploadImageToBunny(
          product.images[0],
          mainImageFileName
        );
      }

      if (product.thumbnail) {
        const thumbnailFileName = `product_${
          product.id
        }_thumb.${product.thumbnail.split(".").pop()}`;
        thumbnailUrl = await uploadImageToBunny(
          product.thumbnail,
          thumbnailFileName
        );
      }

      await Product.create({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        discount_percentage: product.discount_percentage,
        category: product.category,
        brand: product.brand,
        image_url: mainImageUrl,
        thumbnail_url: thumbnailUrl,
        stock_quantity: product.stock_quantity,
        rating: product.rating,
        tags: product.tags,
        created_at: Date.now()
      });

      console.log(`Product ${product.id} saved successfully`);
    }

    return { success: true, message: `Processed ${products.length} products` };
  } catch (error) {
    console.error(`Error saving product`, error.errors || error);
    throw error;
  }
};
const downloadCSVFromDrive = async () => {
  try {
    const auth = getGoogleDriveAuth();
    const folderName = "EcommerceProducts";
    const drive = google.drive({ version: "v3", auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDERID;

    const filesresponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='text/csv'`,
      fields: "files(id, name)"
    });
    if (filesresponse.data.files.length === 0) {
      throw new Error(`No CSV files found in folder ${folderName}`);
    }
    console.log(
      `CSV files found in folder ${folderName} are ${filesresponse.data.files.length}`
    );
    const csvfiles = [];
    for (const file of filesresponse.data.files) {
      console.log("Downloading files");
      const dest = path.join(__dirname, "../productfiles", file.name);
      if (!fs.existsSync(path.dirname(dest))) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
      }
      const response = await drive.files.get({
        fileId: file.id,
        alt: "media"
      });
      fs.writeFileSync(dest, response.data);
      csvfiles.push(dest);
      console.log("files are", csvfiles);
      console.log(`Downloaded ${file.name} successfully`);
    }
    return csvfiles;
  } catch (error) {
    console.error("Error occure", error);
  }
};
const getproductfromcsv = async () => {
  try {
    console.log("Starting CSV download from Google Drive...");
    const downloadedFiles = await downloadCSVFromDrive();
    // const downloadedFiles = [
    //   // 'C:\\Users\\HP\\Documents\\App Development\\My Projects\\E-Commerce_BE\\productfiles\\Procuct3.csv',
    //   // "C:\\Users\\HP\\Documents\\App Development\\My Projects\\E-Commerce_BE\\productfiles\\productone.csv"
    //   "C:\\Users\\HP\\Documents\\App Development\\My Projects\\E-Commerce_BE\\productfiles\\producttwo.csv"
    // ];

    for (const filePath of downloadedFiles) {
      const fileName = path.basename(filePath);
      console.log(`Processing ${fileName}...`);
      const products = await processCSVFile(filePath);
      console.log(`Found ${products.length} products in ${fileName}`);

      for (const product of products) {
        let mainImageUrl = null;
        let thumbnailUrl = null;
        let skipProduct = false;

        if (product.image_url) {
          console.log(`Processing main image: ${product.image_url}`);
          const mainImageFileName = `product_${
            product.title
          }_main.${product.image_url.split(".").pop()}`;
          mainImageUrl = await uploadImageTocloudinary(
            product.image_url,
            mainImageFileName
          );
          if (mainImageUrl === undefined || mainImageUrl === null) {
            console.log(
              `Skipping product ${product.title} - main image not found (404)`
            );
            skipProduct = true;
          }
        }

        if (!skipProduct && product.thumbnail_url) {
          console.log(`Processing thumbnail: ${product.thumbnail_url}`);
          const thumbnailFileName = `product_${
            product.title
          }_thumb.${product.thumbnail_url.split(".").pop()}`;
          thumbnailUrl = await uploadImageTocloudinary(
            product.thumbnail_url,
            thumbnailFileName
          );
          if (thumbnailUrl === undefined || thumbnailUrl === null) {
            console.log(
              `Skipping product ${product.title} - thumbnail not found (404)`
            );
            skipProduct = true;
          }
        }
        if (skipProduct) {
          console.log(`Product ${product.title} skipped due to missing images`);
          continue;
        }

        console.log("product is", product);
        console.log("mainImageUrl:", mainImageUrl);
        console.log("thumbnailUrl:", thumbnailUrl);

        try {
          await Product.create({
            title: product.title,
            description: product.description,
            price: product.price,
            discount_percentage: product.discount_percentage,
            category: product.category,
            brand: product.category,
            image_url: mainImageUrl,
            thumbnail_url: thumbnailUrl,
            stock_quantity: product.stock_quantity,
            rating: product.rating,
            tags: product.tags
          });

          console.log(`Product ${product.title} saved successfully`);
        } catch (dbError) {
          console.error(
            `Error saving product ${product.title}:`,
            dbError.message
          );
        }
      }
    }
  } catch (error) {
    console.error("error occure", error);
  }
};
const processCSVFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    const Product = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const cleanedProduct = {
          title: row.title?.trim(),
          description: row.description?.trim(),
          price: parseFloat(row.price) || 0,
          discount_percentage: parseFloat(row.discount_percentage) || 0,
          category: row.category?.trim(),
          brand: row.brand?.trim(),
          image_url: row.image_url?.trim(),
          thumbnail_url: row.thumbnail_url?.trim(),
          stock_quantity: parseInt(row.stock_quantity) || 0,
          rating: parseFloat(row.rating) || 0,
          tags: row.tags ? JSON.parse(row.tags.replace(/'/g, '"')) : [],
          created_at: new Date(row.created_at) || new Date()
        };

        if (cleanedProduct.title && cleanedProduct.description) {
          Product.push(cleanedProduct);
        }
      })
      .on("end", () => {
        resolve(Product);
      })
      .on("error", (error) => {
        reject(Product);
      });
  });
};

module.exports = {
  getproductfromcsv,
  getProducts
};
