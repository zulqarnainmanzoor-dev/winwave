# Environment Setup & Secrets

## Required Supabase Variables

Get these from your Supabase project dashboard:

### 1. **SUPABASE_URL**
- Location: Supabase Dashboard > Settings > API
- Format: `https://xxxxx.supabase.co`
- Copy the "Project URL"

### 2. **SUPABASE_ANON_KEY** (Public Key)
- Location: Supabase Dashboard > Settings > API
- Format: Long alphanumeric string
- Copy the "anon" key (safe to expose in frontend)

### 3. **SUPABASE_SERVICE_ROLE_KEY** (Private Key)
- Location: Supabase Dashboard > Settings > API
- Format: Long alphanumeric string starting with `eyJ...`
- ⚠️ **KEEP SECRET** - Never commit to GitHub
- Only use in backend/server environment

### 4. **ADMIN_SECRET_ID** (Application Secret)
- Current value: `3399944`
- Used for admin route protection: `/api/admin/3399944`
- Can change to any string you want
- Should be long and random in production

---

## Local Development (.env.example)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin Dashboard Secret
ADMIN_SECRET_ID=3399944

# Server Configuration
PORT=4000
NODE_ENV=development
```

## Vercel Deployment

Add these environment variables in Vercel Dashboard:

**Settings > Environment Variables**

### For All Environments (Production, Preview, Development)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_SECRET_ID=3399944
```

## Docker Environment (Future)

```dockerfile
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV ADMIN_SECRET_ID=${ADMIN_SECRET_ID}
```

---

## Security Checklist

- [ ] SUPABASE_SERVICE_ROLE_KEY never committed to GitHub
- [ ] .env file in .gitignore
- [ ] .env.example contains dummy values only
- [ ] Vercel env vars are set for all environments
- [ ] ADMIN_SECRET_ID changed from default (3399944)
- [ ] No secrets logged in console output
- [ ] API keys rotated regularly (monthly recommended)
- [ ] Supabase Row Level Security (RLS) enabled
- [ ] Database backups configured

---

## Getting Supabase Keys

1. **Sign up/Login**: https://app.supabase.com
2. **Create Project**:
   - Organization: New or existing
   - Project name: "winwave"
   - Database password: Strong password
   - Region: Closest to users
   - Pricing: Free tier (start with this)

3. **After Creation**:
   - Go to **Settings** (gear icon)
   - Click **API**
   - Copy **Project URL**
   - Copy **anon public key**
   - Copy **service_role key**

4. **Save to .env.example**:
   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

---

## Environment Variable Usage in Code

### Frontend (Safe - Public)
```javascript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Backend (Server-Only - Private)
```javascript
// backend/database/db.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

### Admin Route Protection
```javascript
// backend/admin/admin.ts
if (req.params.secret !== process.env.ADMIN_SECRET_ID) {
  return res.status(403).json({ error: 'Unauthorized' })
}
```

---

## Troubleshooting

### "SUPABASE_URL is undefined"
- Check .env file exists
- Restart dev server after adding .env
- Verify variable name matches exactly

### "Invalid API Key"
- Ensure you copied the full key
- Check for extra spaces or line breaks
- Verify key is for correct Supabase project

### "Unauthorized" on Admin Route
- Check ADMIN_SECRET_ID in .env
- Verify URL format: `/api/admin/3399944`
- Ensure .env loaded before server starts

### API Returns 401
- Check SUPABASE_ANON_KEY is correct
- Verify Row Level Security (RLS) is not too restrictive
- Check Supabase auth token is valid

---

## Production Secrets Management

### Using Vercel Secrets Manager
```bash
# Install Vercel CLI
npm i -g vercel

# Set secret
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Automatically loaded in production
```

### Using AWS Secrets Manager (Enterprise)
```javascript
// backend/database/db.ts
const secret = await getSecretFromAWS('winwave/supabase')
```

### Using HashiCorp Vault (Enterprise)
```javascript
// backend/database/db.ts
const secret = await vault.read('secret/winwave/supabase')
```

---

**Keep environment variables secure and rotate regularly!** 🔐
