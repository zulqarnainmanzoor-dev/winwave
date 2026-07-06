# How to Fix the 500 Error - Step by Step

## Step 1: Access Vercel Function Logs

1. Go to https://vercel.com/dashboard
2. Click on **winwave-w8gb** project
3. Click **Deployments** tab
4. Click on the **latest deployment** (should show a checkmark or X)
5. Click **Function Logs** button (top right area)
6. You should see logs appearing

## Step 2: Trigger the Error

In your browser console, run:
```javascript
fetch("https://winclub-officiall.vercel.app/api/payout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    withdrawal_id: "test-id", 
    adminSecretToken: "ww-admin-mutation-key-2025-secure-change-in-production" 
  })
})
```

## Step 3: Check the Logs

In the Vercel Function Logs, you should see error messages like:
- `Cannot find module...`
- `ReferenceError: ... is not defined`
- `TypeError: ... is not a function`
- `Error: ... failed`

## Step 4: Share the Error

Copy the error message from the Function Logs and share it with me. It will look something like:

```
[ERROR] Error: Cannot find module '../backend/api/api'
    at Module._load (internal/modules/commonjs/loader.js:...)
    at Function.Module._load (...)
```

Or:

```
[ERROR] TypeError: supabaseAdmin.from is not a function
    at Object.<anonymous> (/var/task/backend/api/payout.ts:...)
```

## Common Errors and Fixes

### Error: "Cannot find module"
**Cause:** Import path is wrong
**Fix:** Check the import statement in the file

### Error: "is not a function"
**Cause:** Function doesn't exist or wasn't imported
**Fix:** Check if the function is exported correctly

### Error: "Cannot read property of undefined"
**Cause:** Variable is undefined
**Fix:** Check if environment variables are set

### Error: "ENOENT: no such file or directory"
**Cause:** File doesn't exist
**Fix:** Check file paths

---

## What to Do Right Now

1. **Go to Vercel dashboard**
2. **Click on your project**
3. **Go to Deployments**
4. **Click latest deployment**
5. **Click Function Logs**
6. **Run the payout fetch in browser console**
7. **Copy the error message**
8. **Share it with me**

Once you share the error, I can fix it immediately!

---

## Alternative: Check Build Logs

If Function Logs don't show anything:

1. Go to Vercel dashboard
2. Click **winwave-w8gb**
3. Click **Deployments**
4. Click the latest deployment
5. Scroll down to see **Build Logs**
6. Look for errors during build

---

## Quick Checklist

- [ ] All 16 environment variables are set in Vercel
- [ ] Latest code is deployed (check git commit hash)
- [ ] No TypeScript errors in build
- [ ] Function Logs show actual error message
- [ ] Error message is shared with me

Once you complete these, we can fix the issue!
