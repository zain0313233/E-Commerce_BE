# 🔐 Environment Variables Setup Guide

This guide explains all environment variables required for the E-Commerce Backend.

## 📋 Quick Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`

3. **NEVER** commit `.env` to version control (already in `.gitignore`)

---

## 🔧 Required Environment Variables

### 1. Server Configuration

#### `PORT` (Optional)
- **Default**: `3001`
- **Description**: Port number where the Express server will run
- **Example**: `PORT=3001`

#### `NODE_ENV` (Required)
- **Values**: `development`, `production`, `test`
- **Description**: Application environment mode
- **Example**: `NODE_ENV=development`
- **Impact**: 
  - Controls logging verbosity
  - Enables/disables error stack traces
  - Affects CORS policies

#### `LOG_LEVEL` (Optional)
- **Default**: `info`
- **Values**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- **Description**: Pino logger level
- **Example**: `LOG_LEVEL=info`

---

### 2. Neon Database (PostgreSQL)

#### `POSTGRE_HOST` (Required)
- **Description**: Neon PostgreSQL server hostname
- **Example**: `ep-cool-darkness-123456.us-east-2.aws.neon.tech`
- **How to get**:
  1. Go to [Neon Console](https://console.neon.tech)
  2. Select your project
  3. Go to Dashboard → Connection Details
  4. Copy the hostname

#### `POSTGRE_PORT` (Required)
- **Default**: `5432`
- **Description**: PostgreSQL server port
- **Example**: `POSTGRE_PORT=5432`

#### `POSTGRE_DATABASE` (Required)
- **Description**: Database name (Neon default is `neondb`)
- **Example**: `POSTGRE_DATABASE=neondb`
- **Note**: Neon creates a default database automatically

#### `POSTGRE_USER` (Required)
- **Description**: Database username
- **Example**: `POSTGRE_USER=your_neon_username`
- **How to get**: Neon Console → Connection Details

#### `POSTGRE_PASSWORD` (Required)
- **Description**: Database password
- **Example**: `POSTGRE_PASSWORD=your_neon_password`
- **How to get**: Neon Console → Connection Details
- **Security**: Neon generates secure passwords automatically

#### `POSTGRE_SSL` (Required)
- **Value**: `true` (always for Neon)
- **Description**: Enable SSL for database connection
- **Example**: `POSTGRE_SSL=true`
- **Note**: Neon requires SSL connections

#### Alternative: Connection String
You can also use a single connection string:
```env
DATABASE_URL=postgresql://user:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### Database Pool Settings (Optional)
- `DB_MAX_CONNECTIONS=20` - Maximum connections in pool
- `DB_IDLE_TIMEOUT=10000` - Idle connection timeout (ms)
- `DB_CONNECTION_TIMEOUT=2000` - Connection timeout (ms)

---

### 3. Supabase (Authentication + File Storage)

#### `SUPABASE_URL` (Required)
- **Description**: Your Supabase project URL
- **Example**: `https://abcdefghijklmnop.supabase.co`
- **How to get**:
  1. Go to [Supabase Dashboard](https://app.supabase.com)
  2. Select your project
  3. Go to Settings → API
  4. Copy "Project URL"

#### `SUPABASE_SERVICE_ROLE_KEY` (Required)
- **Description**: Supabase service role key (admin access)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **How to get**:
  1. Supabase Dashboard → Settings → API
  2. Copy "service_role" key (NOT anon key)
- **Security**: 
  - ⚠️ NEVER expose this in frontend
  - ⚠️ Has admin privileges
  - Keep it secret!

#### `SUPABASE_ANON_KEY` (Required)
- **Description**: Supabase anonymous/public key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **How to get**:
  1. Supabase Dashboard → Settings → API
  2. Copy "anon" key
- **Note**: Safe to use in frontend

#### `SUPABASE_STORAGE_BUCKET` (Required)
- **Description**: Supabase Storage bucket name for product images
- **Default**: `product-images`
- **Example**: `SUPABASE_STORAGE_BUCKET=product-images`
- **How to set up**:
  1. Supabase Dashboard → Storage
  2. Create new bucket: `product-images`
  3. Set bucket to **Public** (for product images)
  4. Configure policies:
     ```sql
     -- Allow public read access
     CREATE POLICY "Public Access"
     ON storage.objects FOR SELECT
     USING ( bucket_id = 'product-images' );
     
     -- Allow authenticated users to upload
     CREATE POLICY "Authenticated Upload"
     ON storage.objects FOR INSERT
     WITH CHECK ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );
     ```

---

### 4. Stripe Payment Gateway

#### `STRIPE_SECRET_KEY` (Required)
- **Description**: Stripe secret API key
- **Example**: `sk_test_51Abc...` (test) or `sk_live_51Abc...` (production)
- **How to get**:
  1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
  2. Developers → API keys
  3. Copy "Secret key"
- **Note**: Use test keys in development

#### `STRIPE_WEBHOOK_SECRET` (Required)
- **Description**: Webhook signing secret for verifying Stripe events
- **Example**: `whsec_abc123...`
- **How to get**:
  1. Stripe Dashboard → Developers → Webhooks
  2. Add endpoint: `https://yourdomain.com/api/payment/webhook`
  3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
  4. Copy "Signing secret"
- **Local Testing**: Use Stripe CLI
  ```bash
  stripe listen --forward-to localhost:3001/api/payment/webhook
  ```

---

### 5. Image Storage (Optional Alternatives)

**Note**: You're currently using Supabase Storage (configured above). These are alternative options if you want to switch.

#### Cloudinary (Optional)
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

#### BunnyCDN (Optional)
- `BUNNY_STORAGE_ZONE_NAME` - BunnyCDN storage zone
- `BUNNY_STORAGE_PASSWORD` - Storage password
- `BUNNY_PULL_ZONE_URL` - Pull zone URL

**Current Setup**: The app is configured to use Cloudinary, but you should migrate to Supabase Storage since you're already using Supabase for auth.

---

### 6. Google Drive API (For Bulk Product Import)

#### `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Required for CSV import)
- **Description**: Google service account email
- **Example**: `ecommerce-import@project-123.iam.gserviceaccount.com`
- **How to get**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Create a project
  3. Enable Google Drive API
  4. Create Service Account
  5. Copy email address

#### `GOOGLE_PRIVATE_KEY` (Required for CSV import)
- **Description**: Google service account private key
- **Example**: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...==\n-----END PRIVATE KEY-----\n"`
- **How to get**:
  1. Google Cloud Console → Service Accounts
  2. Create key (JSON format)
  3. Copy private_key field
- **Important**: 
  - Keep the quotes and newline characters (`\n`)
  - Entire key should be on one line in .env

#### `GOOGLE_DRIVE_FOLDERID` (Required for CSV import)
- **Description**: Google Drive folder ID containing product CSV files
- **Example**: `1a2b3c4d5e6f7g8h9i0j`
- **How to get**:
  1. Open folder in Google Drive
  2. Copy ID from URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`
- **Note**: Share folder with service account email

---

### 7. Frontend URL

#### `NEXT_PUBLIC_DOMAIN` (Required)
- **Description**: Frontend application URL (for Stripe redirects)
- **Example**: 
  - Development: `http://localhost:3000`
  - Production: `https://yourstore.com`
- **Used for**:
  - Stripe success/cancel URLs
  - CORS configuration
  - Email links

#### `ALLOWED_ORIGINS` (Optional)
- **Description**: Comma-separated list of allowed CORS origins
- **Example**: `http://localhost:3000,http://localhost:3001,https://yourstore.com`
- **Default**: Uses `NEXT_PUBLIC_DOMAIN` if not set

---

## 🚀 Setup Instructions by Service

### Neon Database Setup

1. **Create Neon Account**:
   - Go to [neon.tech](https://neon.tech)
   - Sign up (free tier available)

2. **Create Project**:
   - Click "New Project"
   - Choose region closest to your users
   - Note: Neon creates database automatically

3. **Get Connection Details**:
   - Dashboard → Connection Details
   - Copy all credentials to `.env`
   - Or copy the full connection string

4. **Create Schema**:
   ```sql
   CREATE SCHEMA IF NOT EXISTS ecommerce;
   ```

5. **Run Migrations** (if you have them):
   ```bash
   npm run migrate
   ```

**Neon Benefits**:
- ✅ Serverless PostgreSQL
- ✅ Auto-scaling
- ✅ Branching (like Git for databases)
- ✅ Free tier: 0.5 GB storage, 100 hours compute/month

### Supabase Setup

1. **Create Account**: [supabase.com](https://supabase.com)

2. **Create Project**:
   - New Project → Choose region
   - Set database password (for direct DB access)

3. **Get API Keys**:
   - Settings → API
   - Copy URL, anon key, and service_role key

4. **Configure Authentication**:
   - Authentication → Providers
   - Enable Email/Password (enabled by default)
   - Optional: Enable OAuth (Google, GitHub, etc.)

5. **Set Up Storage**:
   ```sql
   -- Go to Storage → Create bucket
   -- Name: product-images
   -- Public: Yes
   
   -- Then go to Policies and add:
   
   -- Allow public read
   CREATE POLICY "Public Access"
   ON storage.objects FOR SELECT
   USING ( bucket_id = 'product-images' );
   
   -- Allow authenticated upload
   CREATE POLICY "Authenticated Upload"
   ON storage.objects FOR INSERT
   WITH CHECK ( 
     bucket_id = 'product-images' 
     AND auth.role() = 'authenticated' 
   );
   
   -- Allow users to update their uploads
   CREATE POLICY "User Update Own Files"
   ON storage.objects FOR UPDATE
   USING ( auth.uid()::text = owner )
   WITH CHECK ( bucket_id = 'product-images' );
   
   -- Allow users to delete their uploads
   CREATE POLICY "User Delete Own Files"
   ON storage.objects FOR DELETE
   USING ( auth.uid()::text = owner );
   ```

6. **Configure CORS** (if needed):
   - Settings → API → CORS
   - Add your frontend URL

**Supabase Benefits**:
- ✅ Authentication built-in
- ✅ File storage included
- ✅ Real-time subscriptions
- ✅ Auto-generated REST API
- ✅ Free tier: 500 MB database, 1 GB file storage

### Stripe Setup

1. Create account at [stripe.com](https://stripe.com)
2. Get test API keys from dashboard
3. Set up webhook endpoint
4. Test with Stripe CLI:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3001/api/payment/webhook
   ```

### Cloudinary Setup (Optional - if not using Supabase Storage)

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Free tier: 25 GB storage, 25 GB bandwidth/month
3. Copy credentials from dashboard
4. Create upload preset (optional)

**Note**: Consider using Supabase Storage instead since you're already using Supabase for auth.

### Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project
3. Enable Google Drive API
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create
   - Download JSON key
5. Share Drive folder with service account email
6. Copy folder ID from URL

---

## 🔒 Security Best Practices

1. **Never commit `.env` file**
   - Already in `.gitignore`
   - Use `.env.example` for documentation

2. **Use different keys for development/production**
   - Test keys in development
   - Live keys only in production

3. **Rotate secrets regularly**
   - Change passwords every 90 days
   - Rotate API keys if compromised

4. **Use environment-specific values**
   ```bash
   # Development
   NODE_ENV=development
   STRIPE_SECRET_KEY=sk_test_...
   
   # Production
   NODE_ENV=production
   STRIPE_SECRET_KEY=sk_live_...
   ```

5. **Restrict service account permissions**
   - Google: Read-only access to specific folder
   - Supabase: Use service_role only in backend
   - Stripe: Restrict webhook IPs if possible

---

## 🐳 Docker Setup

If using Docker, create `.env` file and use in `docker-compose.yml`:

```yaml
services:
  backend:
    env_file:
      - .env
    environment:
      - POSTGRE_HOST=postgres
```

---

## ✅ Verification Checklist

Before running the app, verify:

- [ ] `.env` file created from `.env.example`
- [ ] Neon database project created
- [ ] Neon connection details copied to `.env`
- [ ] `POSTGRE_SSL=true` set for Neon
- [ ] Supabase project created
- [ ] Supabase URL and keys copied to `.env`
- [ ] Supabase Storage bucket `product-images` created
- [ ] Storage bucket set to public with proper policies
- [ ] Stripe account set up with test keys
- [ ] Google Drive folder shared with service account (if using import)
- [ ] All required variables filled in `.env`
- [ ] No syntax errors in `.env` (no spaces around `=`)

---

## 🧪 Testing Your Setup

Run this command to test database connection:

```bash
node -e "require('./database/index').testConnection()"
```

Start the server:

```bash
npm run dev
```

Check logs for any missing environment variables.

---

## 🆘 Troubleshooting

### "Supabase URL and Key must be provided"
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Ensure no extra spaces or quotes

### "Database connection error"
- Verify Neon project is active (not paused)
- Check credentials in `.env`
- Ensure `POSTGRE_SSL=true` is set
- Check if your IP is allowed (Neon allows all by default)
- Verify connection string format

### "Stripe webhook verification failed"
- Use Stripe CLI for local testing
- Check `STRIPE_WEBHOOK_SECRET` matches webhook endpoint
- Verify webhook endpoint is accessible

### "Cloudinary upload error"
- If using Supabase Storage, ignore Cloudinary errors
- Check Supabase Storage bucket exists
- Verify bucket is public
- Check storage policies are configured

---

## 📞 Support

For issues:
1. Check logs: `npm run dev`
2. Verify all environment variables are set
3. Test each service individually
4. Check service status pages (Stripe, Supabase, Cloudinary)

---

**Last Updated**: 2026-04-02
