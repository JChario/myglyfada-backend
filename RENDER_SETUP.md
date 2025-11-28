# Render.com Backend Deployment Guide

## Overview
This guide will help you deploy the myGlyfada backend to Render.com's free tier.

## Prerequisites
- Render.com account (sign up at https://render.com - free)
- GitHub account (to push your code)
- Basic understanding of Git

## Part 1: Prepare Your Repository

### Option A: Push to GitHub (Recommended)

1. **Create a new GitHub repository:**
   - Go to https://github.com/new
   - Name: `myglyfada-backend` (or your preferred name)
   - Visibility: Private (recommended) or Public
   - Don't initialize with README
   - Click "Create repository"

2. **Push the backend code:**
   ```bash
   cd "E:\Hard Drive M\Work\Personal\glyfada-my-city\deployment\render-backend"
   git init
   git add .
   git commit -m "Initial commit for Render deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/myglyfada-backend.git
   git push -u origin main
   ```

### Option B: Use Render's Git Integration

You can also upload the code directly through Render's interface, but GitHub integration is recommended for easier updates.

## Part 2: Create PostgreSQL Database on Render

1. **Login to Render:**
   - Go to https://dashboard.render.com
   - Sign in with GitHub, Google, or email

2. **Create a new PostgreSQL database:**
   - Click "New +" button in the top right
   - Select "PostgreSQL"
   - Fill in the details:
     - **Name:** `myglyfada-db`
     - **Database:** `myglyfada`
     - **User:** `myglyfada` (auto-generated)
     - **Region:** Frankfurt (or closest to your users)
     - **Plan:** Free
   - Click "Create Database"

3. **Wait for database creation:**
   - This takes 1-2 minutes
   - You'll see "Available" status when ready

4. **Save the database credentials:**
   - Click on your database name
   - You'll see:
     - **Internal Database URL** (use this for Render services)
     - **External Database URL** (use for external access)
   - Copy the Internal Database URL - you'll need it

## Part 3: Deploy Backend Service

1. **Create a new Web Service:**
   - Click "New +" button
   - Select "Web Service"
   - Connect your GitHub repository or use "Public Git repository"

2. **Configure the service:**
   - **Name:** `myglyfada-backend`
   - **Region:** Frankfurt (same as database)
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```
     npx prisma migrate deploy && npm start
     ```
   - **Plan:** Free

3. **Advanced settings:**
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** Yes (recommended)

4. **Add Environment Variables:**
   Click "Advanced" and add these environment variables:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `DATABASE_URL` | (paste Internal Database URL) | From Part 2, step 4 |
   | `NODE_ENV` | `production` | |
   | `JWT_SECRET` | (click "Generate") | Auto-generate a secure secret |
   | `JWT_EXPIRES_IN` | `7d` | |
   | `PORT` | `10000` | Default for Render |
   | `ALLOWED_ORIGINS` | `https://yourdomain.com` | Your Hostinger domain |
   | `MAX_FILE_SIZE` | `5242880` | 5MB in bytes |
   | `UPLOAD_PATH` | `./uploads` | |
   | `GOOGLE_MAPS_API_KEY` | (optional) | If you have one |

5. **Add Persistent Disk (for file uploads):**
   - Scroll to "Disks" section
   - Click "Add Disk"
   - **Name:** `myglyfada-uploads`
   - **Mount Path:** `/opt/render/project/src/uploads`
   - **Size:** 1 GB (free tier)
   - Click "Save"

6. **Create the service:**
   - Click "Create Web Service"
   - Wait for the initial build and deployment (5-10 minutes)

## Part 4: Run Database Migrations

After the first deployment succeeds:

1. **The migrations run automatically** during the start command
   - Command: `npx prisma migrate deploy && npm start`
   - This creates all tables in your PostgreSQL database

2. **Verify database setup:**
   - In Render dashboard, go to your backend service
   - Click "Logs" tab
   - You should see migration success messages

## Part 5: Seed the Database (Optional)

To add demo data (admin account, categories, etc.):

1. **Connect to your Render Shell:**
   - In your backend service, click "Shell" tab
   - Wait for shell to connect

2. **Run the seed command:**
   ```bash
   npm run db:seed
   ```

3. **Verify seed data:**
   - Check logs for success messages
   - You should see users, categories created

**Note:** The seed script might need modification to work with enums. If it fails, see the "Manual Database Setup" section below.

## Part 6: Test Your Backend

1. **Get your backend URL:**
   - In service dashboard, you'll see your URL
   - Example: `https://myglyfada-backend.onrender.com`

2. **Test the health endpoint:**
   ```bash
   curl https://myglyfada-backend.onrender.com/api/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2023-11-28T12:00:00.000Z"
   }
   ```

3. **Test login endpoint:**
   - First, make sure you seeded the database
   - Then test login:

   ```bash
   curl -X POST https://myglyfada-backend.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@glyfada.gr","password":"admin123"}'
   ```

4. **Update frontend configuration:**
   - Edit `deployment/hostinger-frontend/.env.production`
   - Change `VITE_API_URL` to your Render backend URL
   - Example: `VITE_API_URL=https://myglyfada-backend.onrender.com/api`
   - Rebuild and redeploy frontend

## Manual Database Setup

If the seed script doesn't work with PostgreSQL enums, you can manually create an admin user:

1. **Connect to database using Render Shell:**
   - Go to your PostgreSQL database in Render dashboard
   - Click "Connect" → "External Connection"
   - Use a PostgreSQL client (pgAdmin, TablePlus, or psql)

2. **Create admin user manually:**
   ```sql
   -- First, generate a hashed password for 'admin123'
   -- Use bcrypt online tool: https://bcrypt-generator.com/
   -- Rounds: 10
   -- Copy the hash

   INSERT INTO users (id, email, username, password, "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
   VALUES (
     'admin-001',
     'admin@glyfada.gr',
     'admin',
     '$2a$10$YourBcryptHashHere', -- Replace with actual bcrypt hash
     'Admin',
     'User',
     'ADMIN',
     true,
     NOW(),
     NOW()
   );
   ```

3. **Create categories:**
   ```sql
   INSERT INTO categories (id, name, "nameEn", description, color, icon, "isActive", "createdAt", "updatedAt")
   VALUES
     ('cat-001', 'Καθαριότητα', 'Cleanliness', 'Ζητήματα καθαριότητας', '#10B981', 'trash', true, NOW(), NOW()),
     ('cat-002', 'Φωτισμός', 'Lighting', 'Προβλήματα φωτισμού', '#F59E0B', 'lightbulb', true, NOW(), NOW()),
     ('cat-003', 'Οδοποιία', 'Roads', 'Προβλήματα οδών', '#3B82F6', 'road', true, NOW(), NOW());
   ```

## Part 7: Configure CORS for Hostinger Domain

After deploying your frontend to Hostinger:

1. **Update ALLOWED_ORIGINS:**
   - Go to your backend service in Render
   - Click "Environment" tab
   - Find `ALLOWED_ORIGINS` variable
   - Update to: `https://yourdomain.com,https://www.yourdomain.com`
   - Click "Save Changes"

2. **Service will auto-redeploy** with new CORS settings

## Monitoring and Maintenance

### View Logs
- Dashboard → Your service → "Logs" tab
- Shows real-time logs
- Filter by error, warn, info

### Monitor Performance
- Dashboard → Your service → "Metrics" tab
- Shows CPU, memory, request rate
- Free tier has basic metrics

### Free Tier Limitations
- **Sleeps after 15 minutes of inactivity**
  - First request after sleep takes ~30-60 seconds (cold start)
  - Subsequent requests are fast
  - To keep it awake, use a uptime monitoring service (see below)

- **750 hours/month** (enough for 1 service 24/7)

- **PostgreSQL: 1GB storage, 90 days expiry**
  - Database expires after 90 days of inactivity
  - You'll get email warnings before expiry
  - Simply visit dashboard to extend for another 90 days

### Keep Service Awake (Optional)

Use a free uptime monitoring service to ping your backend every 10 minutes:

1. **UptimeRobot (Free):**
   - Sign up at https://uptimerobot.com
   - Add new monitor
   - Type: HTTP(s)
   - URL: `https://myglyfada-backend.onrender.com/api/health`
   - Interval: 5 minutes (free tier allows this)

2. **This will:**
   - Keep your service from sleeping
   - Alert you if service goes down
   - Free tier: 50 monitors

## Troubleshooting

### Build Fails: "Cannot find module @prisma/client"
**Solution:**
- Make sure build command includes: `npx prisma generate`
- Full command: `npm install && npx prisma generate && npm run build`

### Database Connection Error
**Solution:**
- Check DATABASE_URL environment variable
- Make sure it's the "Internal Database URL" from your Render PostgreSQL
- Format: `postgresql://user:password@host:5432/database`

### Migration Fails: "Enum already exists"
**Solution:**
- This happens if you try to migrate multiple times
- In Render Shell, run:
  ```bash
  npx prisma migrate reset --force
  npx prisma migrate deploy
  npm run db:seed
  ```

### CORS Errors in Frontend
**Solution:**
- Update ALLOWED_ORIGINS to include your Hostinger domain
- Make sure it includes both `https://domain.com` and `https://www.domain.com`
- Remember to redeploy after changing environment variables

### Uploads Not Persisting
**Solution:**
- Make sure you added a Persistent Disk
- Mount path must be: `/opt/render/project/src/uploads`
- Size: At least 1GB

### Service Sleeping Too Often
**Solution:**
- Free tier sleeps after 15 min inactivity
- Use UptimeRobot to ping every 5-10 minutes (see above)
- Or upgrade to paid plan ($7/month for always-on)

### High Response Times (Cold Starts)
**Solution:**
- Normal on free tier after sleep
- First request: 30-60 seconds
- Subsequent requests: Fast
- Consider paid plan for production use

## Updating Your Deployment

### Update Code
1. Make changes in your local repository
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update backend"
   git push
   ```
3. Render auto-deploys (if enabled)
4. Check deployment logs in Render dashboard

### Update Environment Variables
1. Dashboard → Your service → "Environment"
2. Edit variables
3. Click "Save Changes"
4. Service redeploys automatically

### Update Database Schema
1. Make changes to `prisma/schema.prisma`
2. Create migration locally:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```
3. Commit and push migration files
4. Render runs `npx prisma migrate deploy` on next deployment

## Costs and Limits

### Free Tier Includes:
- ✅ 1 PostgreSQL database (1GB, 90 days)
- ✅ 1 web service (750 hours/month)
- ✅ 100GB bandwidth/month
- ✅ 1GB persistent disk
- ✅ SSL certificates
- ✅ DDoS protection
- ⚠️ Services sleep after 15 min inactivity
- ⚠️ Cold start time: ~30-60 seconds

### Paid Plans (if needed):
- **Starter:** $7/month
  - No sleeping
  - Faster builds
  - More resources

- **PostgreSQL Starter:** $7/month
  - 10GB storage
  - No expiry
  - Daily backups

### Total Cost:
- **Free tier:** $0/month (perfect for testing/demo)
- **Production ready:** $14/month (backend + database)

## Support

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **Render Status:** https://status.render.com

## Next Steps

After successful backend deployment:
1. ✅ Note your backend URL
2. ✅ Update frontend `.env.production` with this URL
3. ✅ Build and deploy frontend to Hostinger
4. ✅ Test the complete application
5. ✅ Set up uptime monitoring (optional)
6. ✅ Monitor logs for any issues

Your backend is now live at: `https://myglyfada-backend.onrender.com` 🎉
