# Vercel Deployment Guide - WinWave

## ✅ Persistent Data Implementation (Complete)
Your app now persistently saves:
- ✅ User account data (phone, username, balance)
- ✅ Login session (survives page refresh & browser close)
- ✅ Avatar selection
- ✅ Payment method selection (Jazzcash, Easypaisa, USDT)
- ✅ Withdrawal PIN (6-digit code)
- ✅ Bound withdrawal accounts (cannot be removed once set)
- ✅ Deposit/withdrawal history
- ✅ Balance updates

## Step-by-Step Vercel Deployment

### 1. **Push to GitHub**
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "WinWave: Auth, persistence, and Vercel deployment ready"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/winwave.git
git branch -M main
git push -u origin main
```

### 2. **Create Vercel Account**
- Go to https://vercel.com
- Sign up with GitHub (recommended for auto-deploy)
- Click "Authorize Vercel"

### 3. **Deploy to Vercel**
- Go to https://vercel.com/new
- Select "Import Git Repository"
- Paste: `https://github.com/YOUR_USERNAME/winwave.git`
- Select "Import"

### 4. **Configure Project**
In the Vercel settings:
- **Root Directory**: Leave as `./` (default)
- **Build Command**: `npm run build` (already set in Vite)
- **Output Directory**: `dist`

### 5. **Environment Variables** (Critical!)
Add in Vercel dashboard under Settings > Environment Variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_SECRET_ID=3399944
```

Get these from your Supabase dashboard:
1. Go to https://app.supabase.com
2. Select your project
3. Settings > API
4. Copy URL and keys

### 6. **Deploy**
- Click "Deploy"
- Wait for build to complete (2-5 minutes)

### 7. **Access Your App**
Your URLs will be:
- **Main App**: `https://your-project-name.vercel.app`
- **Admin Dashboard**: `https://your-project-name.vercel.app/api/admin/3399944`
- **Login Page**: `https://your-project-name.vercel.app`

## Features After Deployment

### User Account Persistence
- User registers → Account saved to browser storage
- Same device + same phone = same account
- Cannot create duplicate account on same device
- Balance persists across sessions

### Payment Methods
- User selects payment method (Jazzcash, Easypaisa, USDT)
- Selection saved and persists
- Can change anytime

### Withdrawal Security
- 6-digit withdrawal PIN stored securely
- Cannot withdraw without PIN
- PIN cannot be changed without verification

### Withdrawal Accounts
- User binds ONE account per payment method
- Cannot remove once set (security feature)
- Network selection for USDT (TRC20, ERC20, BEP20)

## Troubleshooting

### Admin Page Shows Blank
✅ Fixed! Now handled by Vercel serverless function

### Page Doesn't Load on Refresh
✅ Fixed! Session persisted in browser storage

### Balance Resets on Refresh
✅ Fixed! Now persists in localStorage + Supabase

### Payment Method Not Saving
✅ Fixed! Now stored in UserContext + browser storage

### "Page Not Found" Error
Check that your Vercel deployment is complete (see "Deployments" tab)

## Local Testing Before Deploy

```bash
# Test locally with Vercel CLI
npm install -g vercel
vercel dev  # Runs on localhost:3000

# Test API endpoints
curl http://localhost:4000/api/status

# Test registration
curl -X POST http://localhost:4000/api/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"3001234567","password":"Test1234","confirmPassword":"Test1234","invitationCode":""}'
```

## Auto-Deployment
After pushing to GitHub:
- Vercel automatically builds and deploys on every push
- Previous deployments stay available
- Can revert to any previous version

## Performance Tips
- Keep bundle under 500KB (warning in build output)
- Consider code splitting for games
- Cache assets aggressively

---
**Questions? Check Vercel Docs**: https://vercel.com/docs
