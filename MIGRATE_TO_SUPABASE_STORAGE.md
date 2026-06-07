# 🔄 Migrate from Cloudinary to Supabase Storage

Since you're using Supabase for authentication, it makes sense to also use Supabase Storage for file uploads. This guide shows you how to migrate.

## 📋 Current Setup

Your code currently uses **Cloudinary** for image uploads in:
- `routes/productrotes.js` - Product image uploads
- `controller/getproducts.js` - Bulk product import

## ✅ Benefits of Supabase Storage

1. **Unified Platform**: Auth + Storage in one place
2. **Cost Effective**: Free tier includes 1 GB storage
3. **Built-in CDN**: Fast global delivery
4. **Row Level Security**: Fine-grained access control
5. **Simpler Setup**: No additional API keys needed

## 🚀 Migration Steps

### Step 1: Set Up Supabase Storage Bucket

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Storage** in sidebar
4. Click **New bucket**
5. Create bucket:
   - Name: `product-images`
   - Public: ✅ Yes (for product images)
   - File size limit: 5 MB (or your preference)

### Step 2: Configure Storage Policies

Go to **Storage** → **Policies** → **New Policy**

```sql
-- Allow anyone to view product images (public read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated' 
);

-- Allow users to update their own uploads
CREATE POLICY "User Update Own Files"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK ( bucket_id = 'product-images' );

-- Allow users to delete their own uploads
CREATE POLICY "User Delete Own Files"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Step 3: Update Environment Variables

Add to your `.env`:
```env
SUPABASE_STORAGE_BUCKET=product-images
```

### Step 4: Update Code

#### A. Update `routes/productrotes.js`

Replace Cloudinary upload function with Supabase:

```javascript
// At the top, add Supabase client
const supabase = require('../config/subpass');

// Replace uploadImageTocloudinary function with:
const uploadImageToSupabase = async (buffer, fileName, userId) => {
  try {
    const filePath = `${userId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'product-images')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'product-images')
      .getPublicUrl(filePath);

    console.log('Supabase upload successful:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Supabase upload error:', error);
    return null;
  }
};

// In the upload route, replace:
// const imageUrl = await uploadImageTocloudinary(req.file.buffer, fileName);
// With:
const imageUrl = await uploadImageToSupabase(req.file.buffer, fileName, user_id);
```

#### B. Update `controller/getproducts.js`

Replace Cloudinary function:

```javascript
const supabase = require('../config/subpass');

const uploadImageToSupabase = async (imageUrl, fileName) => {
  try {
    // Download image from source
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });
    
    if (imageResponse.status === 404) {
      console.log(`Image ${imageUrl} returned 404 - skipping upload`);
      return 404;
    }

    const imageBuffer = Buffer.from(imageResponse.data);
    const filePath = `imports/${fileName}`;
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'product-images')
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'product-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return 404;
    }
    console.error(`Error uploading image ${fileName}:`, error.message);
    return null;
  }
};

// Replace all calls to uploadImageTocloudinary with uploadImageToSupabase
```

### Step 5: Remove Cloudinary Dependencies

1. Remove from `package.json`:
   ```bash
   npm uninstall cloudinary
   ```

2. Remove Cloudinary config from code:
   ```javascript
   // Delete these lines:
   const cloudinary = require("cloudinary").v2;
   
   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET
   });
   ```

3. Remove from `.env`:
   ```env
   # Remove these:
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

### Step 6: Test the Migration

1. **Test Upload**:
   ```bash
   # Use Postman or curl to test product creation
   curl -X POST http://localhost:3001/api/product/create-product \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "title=Test Product" \
     -F "price=99.99" \
     -F "image=@/path/to/image.jpg"
   ```

2. **Verify in Supabase**:
   - Go to Storage → product-images
   - Check if file uploaded
   - Click file to get public URL
   - Open URL in browser to verify

3. **Test Bulk Import**:
   ```bash
   curl http://localhost:3001/api/product/scrape-products
   ```

## 🔄 Rollback Plan

If you need to rollback:

1. Keep Cloudinary credentials in `.env`
2. Revert code changes
3. Run `npm install cloudinary`

## 📊 Comparison

| Feature | Cloudinary | Supabase Storage |
|---------|-----------|------------------|
| Free Tier | 25 GB storage | 1 GB storage |
| Bandwidth | 25 GB/month | 2 GB/month |
| Transformations | ✅ Yes | ❌ No (use external) |
| CDN | ✅ Yes | ✅ Yes |
| Integration | Separate service | Same as auth |
| Setup | Extra API keys | Already configured |

## 💡 Best Practices

1. **Organize by User**: Store images in user folders (`userId/filename.jpg`)
2. **Use Unique Names**: Add timestamp to prevent conflicts
3. **Set Size Limits**: Configure in bucket settings
4. **Enable Caching**: Set `cacheControl` header
5. **Handle Errors**: Always check for upload errors
6. **Clean Up**: Delete old images when products are deleted

## 🗑️ Delete Images (Bonus)

Add delete functionality when products are removed:

```javascript
const deleteImageFromSupabase = async (imageUrl) => {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/storage/v1/object/public/product-images/');
    if (urlParts.length < 2) return false;
    
    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

// Use in delete product route:
router.delete('/delete-product/:id', authenticateToken, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (product && product.image_url) {
    await deleteImageFromSupabase(product.image_url);
  }
  await product.destroy();
  res.json({ message: 'Product deleted' });
});
```

## ✅ Migration Complete!

After completing these steps:
- ✅ All new uploads go to Supabase Storage
- ✅ Images are served via Supabase CDN
- ✅ No additional API keys needed
- ✅ Unified platform for auth + storage

---

**Need Help?** Check [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
