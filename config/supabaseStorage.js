const path = require('path');
const axios = require('axios');
const supabase = require('./subpass');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

function getContentType(fileName, fallback = 'image/jpeg') {
  const ext = path.extname(fileName).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };
  return types[ext] || fallback;
}

async function uploadBuffer(buffer, filePath, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: contentType || getContentType(filePath),
    cacheControl: '3600',
    upsert: true
  });

  if (error) {
    console.error('Supabase upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadFromUrl(imageUrl, filePath) {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      validateStatus: (status) => status < 500
    });

    if (imageResponse.status === 404) {
      return 404;
    }

    const buffer = Buffer.from(imageResponse.data);
    const contentType =
      imageResponse.headers['content-type'] || getContentType(filePath);

    return await uploadBuffer(buffer, filePath, contentType);
  } catch (error) {
    if (error.response?.status === 404) {
      return 404;
    }
    console.error(`Error uploading from URL ${imageUrl}:`, error.message);
    return null;
  }
}

module.exports = {
  uploadBuffer,
  uploadFromUrl,
  getBucket: () => BUCKET
};
