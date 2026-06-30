# Vercel Deployment Checklist

## ✅ Pre-Deployment (Local Testing)

- [ ] `npm install` - Install all dependencies
- [ ] `npm run build` - Verify production build works
- [ ] `npm run dev` & `npm run Serve:server` - Test locally
- [ ] Test registration with new phone
- [ ] Test login with saved account
- [ ] Test payment method persistence
- [ ] Test withdrawal PIN persistence
- [ ] Test balance persistence
- [ ] Visit http://localhost:3000 - Frontend loads
- [ ] Visit http://localhost:4000/api/status - Backend responds with 200
- [ ] Check that NO ERRORS appear in build output

---

## 📦 GitHub Setup

### Step 1: Create GitHub Account
- [ ] Go to https://github.com
- [ ] Sign up if needed
- [ ] Verify email

### Step 2: Create Repository
- [ ] Log in to GitHub
- [ ] Click **New** (top left)
- [ ] Repository name: `winwave`
- [ ] Description: "Gaming platform with persistent storage"
- [ ] Select **Public** (free tier requires public)
- [ ] Click **Create repository**
- [ ] Note the URL: `https://github.com/YOUR_USERNAME/winwave.git`

### Step 3: Push Code to GitHub
```bash
cd "c:\Users\zulqa\Downloads\MY PC\WinWave Projects\ww"

# Configure git (first time only)
git config --global user.email "your.email@gmail.com"
git config --global user.name "Your Name"

# Initialize and push
git init
git add .
git commit -m "WinWave: Complete auth, persistence, and Vercel-ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/winwave.git
git push -u origin main
```

- [ ] Code pushed successfully
- [ ] Check GitHub repo at https://github.com/YOUR_USERNAME/winwave

---

## 🚀 Vercel Deployment

### Step 1: Sign Up to Vercel
- [ ] Go to https://vercel.com
- [ ] Click **Sign Up**
- [ ] Choose **Continue with GitHub** (recommended)
- [ ] Authorize Vercel
- [ ] Email confirmed

### Step 2: Import Project
- [ ] Go to https://vercel.com/new
- [ ] Click **Import Git Repository**
- [ ] Paste: `https://github.com/YOUR_USERNAME/winwave.git`
- [ ] Click **Import**

### Step 3: Configure Build Settings
- [ ] Framework: Should auto-detect as "Vite"
- [ ] Root Directory: `.` (default)
- [ ] Build Command: `npm run build` (keep default)
- [ ] Output Directory: `dist` (should auto-fill)
- [ ] Install Command: `npm install` (keep default)

### Step 4: Add Environment Variables
- [ ] Click **Environment Variables** section
- [ ] Add each variable individually:

```
Variable Name: SUPABASE_URL
Value: https://xxxxx.supabase.co
Environment: Production, Preview, Development (select all)
✓ Click Add
```

```
Variable Name: SUPABASE_ANON_KEY
Value: eyJhbGc... (copy from Supabase)
Environment: Production, Preview, Development (select all)
✓ Click Add
```

```
Variable Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGc... (copy from Supabase)
Environment: Production, Preview, Development (select all)
⚠️ This is SECRET - be careful!
✓ Click Add
```

```
Variable Name: ADMIN_SECRET_ID
Value: 3399944
Environment: Production, Preview, Development (select all)
✓ Click Add
```

- [ ] All 4 variables added
- [ ] Verify each variable shows in the list

### Step 5: Deploy
- [ ] Click **Deploy**
- [ ] Wait for build (2-5 minutes)
- [ ] ✅ Watch for "Deployment successful" message
- [ ] Click your project name to view

---

## ✅ Post-Deployment Testing

### Step 1: Check Deployment Status
- [ ] Visit https://vercel.com/dashboard
- [ ] Select `winwave` project
- [ ] Status shows **Ready** (green checkmark)
- [ ] Click **Visit** or use URL shown

### Step 2: Test Main App
- [ ] Visit: https://winwave-xxxxx.vercel.app
- [ ] See login page with "WinWave" header
- [ ] Language selector shows EN/UR flags
- [ ] No errors in browser console (F12)

### Step 3: Test API Health
- [ ] Visit: https://winwave-xxxxx.vercel.app/api/status
- [ ] Response: `{"status":"ok","timestamp":"2026-06-29T..."}`
- [ ] Status code: 200 OK
- [ ] (If you see blank page, check Vercel deployment log)

### Step 4: Test Admin Route
- [ ] Visit: https://winwave-xxxxx.vercel.app/api/admin/3399944
- [ ] Should load admin dashboard
- [ ] Check browser console for any errors

### Step 5: Test Registration
- [ ] Go to main app URL
- [ ] Click **Register** tab
- [ ] Enter phone: 3001234567
- [ ] Enter password: Test1234
- [ ] Enter invitation code: (if required)
- [ ] Click Register
- [ ] Should show success message
- [ ] Should redirect to home
- [ ] Balance should appear
- [ ] Click on deposit → select payment method
- [ ] Refresh page → payment method should persist
- [ ] ✅ All working = Deployment successful!

---

## 🔧 Troubleshooting

### Build Failed
```
Error: Cannot find module 'xxx'
```
**Fix**: 
- [ ] Run `npm install` locally and push again
- [ ] Check Vercel build log for specific error

### Environment Variables Not Working
```
Error: process.env.SUPABASE_URL is undefined
```
**Fix**:
- [ ] Verify all 4 variables added in Vercel
- [ ] Redeploy after adding variables (usually auto-redeployed)
- [ ] Check variable names match exactly (case-sensitive)
- [ ] No extra spaces or quotes in values

### API Returns 401 Unauthorized
```
{"error": "Unauthorized"}
```
**Fix**:
- [ ] Verify SUPABASE_ANON_KEY is correct
- [ ] Check Supabase Row Level Security (RLS) settings
- [ ] Confirm database exists and is accessible

### Admin Page Blank
**Fix**:
- [ ] Check Vercel deployment logs
- [ ] Verify ADMIN_SECRET_ID variable is set
- [ ] Try `/api/admin/3399944` exactly
- [ ] Clear browser cache (Ctrl+Shift+Del)

### "Failed to fetch" on Registration
```
Error: Failed to fetch
```
**Fix**:
- [ ] Check API endpoint is working: `/api/status`
- [ ] Verify environment variables are set
- [ ] Check browser console (F12) for exact error
- [ ] Review Vercel logs at https://vercel.com

---

## 📊 Deployment Status Dashboard

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | ✅ | https://winwave-xxxxx.vercel.app |
| API Health | ✅ | https://winwave-xxxxx.vercel.app/api/status |
| Admin Dashboard | ✅ | https://winwave-xxxxx.vercel.app/api/admin/3399944 |
| Supabase | ✅ | https://app.supabase.com |
| Database | ✅ | PostgreSQL (Supabase) |

---

## 🔄 After Deployment

### Update Code
```bash
# Make changes locally
git add .
git commit -m "Update: Add new feature"
git push origin main

# Vercel auto-deploys!
```

### Check Deployment Status
- Visit https://vercel.com
- Select project
- View recent deployments
- Click any deployment to see logs

### Rollback to Previous Version
- Go to https://vercel.com
- Select project
- Go to **Deployments** tab
- Find previous working version
- Click **Promote to Production**

### View Analytics
- Go to project in Vercel
- Click **Analytics**
- View:
  - Response times
  - Bandwidth usage
  - Error rates
  - Visitor count

---

## 🎯 Success Criteria

✅ All items below must be complete:

- [ ] Code pushed to GitHub
- [ ] Vercel imported and deployed
- [ ] 4 environment variables set
- [ ] Frontend loads on main URL
- [ ] API status returns 200
- [ ] Registration works
- [ ] Persistence works (payment method stays after refresh)
- [ ] No console errors
- [ ] Admin page accessible
- [ ] Can login multiple times with same phone
- [ ] Different phones get different accounts

**If all checked: 🎉 DEPLOYMENT SUCCESSFUL! 🎉**

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| Build failed | Check npm logs, ensure all dependencies installed |
| API 404 | Verify routes exist in backend |
| CORS errors | Check Vercel serverless configuration |
| Database errors | Verify Supabase credentials and network access |
| Slow performance | Check bundle size, consider code splitting |

---

## 📅 Next Steps After Launch

1. **Monitor**: Watch error logs on Vercel dashboard
2. **Test**: Have users test on different devices/browsers
3. **Optimize**: Analyze performance, optimize slow pages
4. **Scale**: Add features based on user feedback
5. **Secure**: Enable 2FA, add rate limiting, rotate keys
6. **Growth**: Add marketing, improve user retention

---

**Estimated Time to Deployment**: 30-45 minutes ⏱️
**Estimated Cost**: Free (Vercel + Supabase free tiers)

**Good luck! 🚀**
