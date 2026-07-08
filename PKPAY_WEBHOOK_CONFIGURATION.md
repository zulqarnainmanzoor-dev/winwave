# PKPay Webhook Configuration - CRITICAL

## PROBLEM IDENTIFIED

**PKPay Dashboard shows:**
- Callback Attempts = 0
- Callback Delivered = 0

**This means**: PKPay has NO WEBHOOK URL configured and is NOT attempting to send callbacks.

---

## SOLUTION

### Step 1: Configure Webhook URL in PKPay Dashboard

**Go to PKPay Dashboard:**
1. Login to PKPay merchant account
2. Navigate to: Settings → Webhooks OR Notifications → Callback Settings
3. Add webhook URL:

```
https://winclub-officiall.vercel.app/api/webhook/deposit
```

**Configure:**
- **URL**: `https://winclub-officiall.vercel.app/api/webhook/deposit`
- **Method**: POST
- **Content-Type**: application/json
- **Retry**: Enable (3-5 attempts)
- **Timeout**: 30 seconds

---

### Step 2: Webhook Payload Format

PKPay will send POST request with JSON body:

```json
{
  "out_trade_no": "payment_link_id_from_pkpay",
  "status": "success",
  "amount": 300,
  "user_id": "optional_user_id",
  "sign": "signature_hash"
}
```

**Our endpoint will:**
1. Verify signature
2. Look up deposit_history by `out_trade_no` (payment_link_id)
3. Update status to "completed"
4. Trigger automatic balance credit

---

### Step 3: Test Webhook

**Manual Test:**
```bash
curl -X POST https://winclub-officiall.vercel.app/api/webhook/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "out_trade_no": "test-order-123",
    "status": "success",
    "amount": 300
  }'
```

**Expected Response:**
```json
{
  "code": 0,
  "msg": "success_completed"
}
```

---

### Step 4: Verify in PKPay Dashboard

After configuring:
1. Make a test deposit
2. Complete payment
3. Check PKPay Dashboard:
   - Callback Attempts should increase
   - Callback Delivered should show success
   - Our database should update automatically

---

## REQUIRED ENVIRONMENT VARIABLES

```env
# .env or Vercel Environment Variables

# PKPay Webhook Secret (for signature verification)
WEBHOOK_SECRET=your_pkpay_webhook_secret

# Supabase (already configured)
VITE_SUPABASE_URL=...
SERVICE_ROLE_KEY=...
```

---

## WEBHOOK ENDPOINT DETAILS

**URL**: `/api/webhook/deposit`
**Method**: POST
**Content-Type**: application/json
**Response**: 200 OK with JSON body

**Response Codes:**
- `200` - Webhook received and processed
- `200` - Even if error (PKPay expects 200 for all responses)

**Response Body:**
```json
{
  "code": 0,
  "msg": "success_completed"
}
```

---

## DEPOSIT FLOW (AFTER WEBHOOK CONFIGURED)

```
1. User selects amount
   ↓
2. Frontend creates pending deposit_history
   ↓
3. Frontend redirects to PKPay checkout
   ↓
4. User completes payment on PKPay
   ↓
5. PKPay marks payment as SUCCESS
   ↓
6. PKPay sends callback to /api/webhook/deposit
   ↓
7. Our webhook receives callback
   ↓
8. Webhook looks up deposit_history by payment_link_id
   ↓
9. Webhook updates status to "completed"
   ↓
10. Database trigger fires automatically
    ↓
11. Balance credited with amount + 2% bonus
    ↓
12. Recharge History shows "Completed"
    ↓
13. Admin Dashboard shows "Completed"
    ↓
14. User sees updated balance
```

---

## CHECKLIST

- [ ] Login to PKPay merchant dashboard
- [ ] Navigate to Webhooks/Notifications settings
- [ ] Add webhook URL: `https://winclub-officiall.vercel.app/api/webhook/deposit`
- [ ] Set method to POST
- [ ] Set content-type to application/json
- [ ] Enable retry attempts
- [ ] Set timeout to 30 seconds
- [ ] Save configuration
- [ ] Make test deposit
- [ ] Verify callback attempts increase
- [ ] Verify callback delivered shows success
- [ ] Check database for updated deposit_history
- [ ] Verify balance credited automatically
- [ ] Check Recharge History shows "Completed"

---

## TROUBLESHOOTING

### Callback Attempts = 0
**Problem**: Webhook URL not configured in PKPay
**Solution**: Add webhook URL in PKPay dashboard

### Callback Delivered = 0
**Problem**: Webhook URL is wrong or endpoint is down
**Solution**: 
1. Verify URL is correct
2. Test endpoint manually with curl
3. Check Vercel logs

### Deposit still shows "Pending"
**Problem**: Webhook received but didn't update database
**Solution**:
1. Check Vercel logs for errors
2. Verify deposit_history record exists
3. Verify payment_link_id matches

### Balance not credited
**Problem**: Webhook updated status but trigger didn't fire
**Solution**:
1. Verify trigger `trg_deposit_approved` exists
2. Check Supabase logs
3. Manually run trigger if needed

---

## PRODUCTION CHECKLIST

- [ ] Webhook URL configured in PKPay
- [ ] WEBHOOK_SECRET environment variable set
- [ ] Endpoint responds with 200 OK
- [ ] Signature verification working
- [ ] Database updates working
- [ ] Trigger fires automatically
- [ ] Balance credited correctly
- [ ] Recharge History updates
- [ ] Admin Dashboard updates
- [ ] No manual approval needed
- [ ] Duplicate callbacks handled
- [ ] Error logging working

---

**Status**: READY FOR CONFIGURATION
**Action Required**: Configure webhook URL in PKPay dashboard
**Impact**: Automatic deposit processing
