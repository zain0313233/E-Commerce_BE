# 🚀 Quick Setup Summary

## Your Tech Stack

- **Database**: Neon (Serverless PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage (recommended) or Cloudinary (current)
- **Payment**: Stripe
- **Backend**: Node.js + Express
- **Frontend**: Next.js 15

## 📝 Required Environment Variables

### Minimum Required (Must Have)

```env
# Neon Database (Option 1 - Recommended)
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xxx-pooler.us-east-1.aws.neon.tech/your_database?sslmode=require

# OR (Option 2 - Individual variables)
# POSTGRE_HOST=your-project.neon.tech
# POSTGRE_PORT=5432
# POSTGRE_DATABASE=neondb
# POSTGRE_USER=your_username
# POSTGRE_PASSWORD=your_password
# POSTGRE_SSL=true

# Supabase (Auth + Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_STORAGE_BUCKET=product-images

# Stripe Payment
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Frontend URL
NEXT_PUBLIC_DOMAIN=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

### Optional (For Specific Features)

```env
# Google Drive Import (if using bulk import)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDERID=your_folder_id

# Cloudinary (if not using Supabase Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 🎯 Quick Start (5 Minutes)

### 1. Set Up Neon Database (2 min)

```bash
# 1. Go to https://neon.tech
# 2. Sign up (free)
# 3. Create project
# 4. Copy connection details to .env
# 5. Set POSTGRE_SSL=true
```

### 2. Set Up Supabase (2 min)

```bash
# 1. Go to https://supabase.com
# 2. Create project
# 3. Copy URL and keys to .env
# 4. Create storage bucket: "product-images"
# 5. Set bucket to public
```

### 3. Set Up Stripe (1 min)

```bash
# 1. Go to https://stripe.com
# 2. Get test API keys
# 3. Copy to .env
# 4. Set up webhook (later)
```

### 4. Install & Run

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env

# Install dependencies
npm install

# Start server
npm run dev
```

## 📚 Documentation Files

1. **`.env.example`** - Template with all variables
2. **`ENV_SETUP_GUIDE.md`** - Detailed guide for each variable
3. **`MIGRATE_TO_SUPABASE_STORAGE.md`** - How to switch from Cloudinary to Supabase Storage
4. **`SETUP_SUMMARY.md`** - This file (quick reference)

## 🔧 Common Issues

### "Database connection error"
- Check Neon credentials
- Ensure `POSTGRE_SSL=true`
- Verify Neon project is active

### "Supabase authentication failed"
- Check URL and keys are correct
- Verify no extra spaces in .env
- Ensure using service_role key (not anon)

### "Stripe webhook failed"
- Use Stripe CLI for local testing
- Check webhook secret matches
- Verify endpoint is accessible

## 🎓 Next Steps

1. ✅ Set up environment variables
2. ✅ Test database connection
3. ✅ Create Supabase storage bucket
4. ✅ Configure storage policies
5. 📝 Consider migrating to Supabase Storage (see MIGRATE_TO_SUPABASE_STORAGE.md)
6. 🧪 Test product upload
7. 💳 Set up Stripe webhook
8. 🚀 Deploy to production

## 💰 Free Tier Limits

| Service | Storage | Bandwidth | Other |
|---------|---------|-----------|-------|
| **Neon** | 0.5 GB | Unlimited | 100 hours compute/month |
| **Supabase** | 1 GB | 2 GB/month | 50,000 auth users |
| **Stripe** | N/A | N/A | Unlimited test transactions |
| **Cloudinary** | 25 GB | 25 GB/month | 25k transformations |

## 🔐 Security Checklist

- [ ] `.env` file in `.gitignore`
- [ ] Using test keys in development
- [ ] Service role key never exposed to frontend
- [ ] SSL enabled for Neon (`POSTGRE_SSL=true`)
- [ ] Supabase storage policies configured
- [ ] Strong passwords for all services
- [ ] Different credentials for dev/prod

## 📞 Support Links

- **Neon**: https://neon.tech/docs
- **Supabase**: https://supabase.com/docs
- **Stripe**: https://stripe.com/docs
- **Node.js**: https://nodejs.org/docs

---

**Ready to start?** Run `cp .env.example .env` and fill in your credentials!
