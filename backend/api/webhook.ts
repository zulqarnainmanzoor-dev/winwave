import { Router } from 'express';
import crypto from 'crypto';
import { supabase, isServiceRoleKey } from '../database/db';
import { logSecurityEvent, getDeviceContext } from './security';

const router = Router();

const MERCHANT_ID = process.env.MERCHANT_ID || '';
const PAY_IN_KEY = process.env.PAY_IN_KEY || '';

/**
 * Verifies the gateway notification signature.
 *
 * NOTE: The exact signature scheme must be confirmed against PKPay's webhook
 * documentation. The common pattern (and what this implements) is an MD5 hash
 * of `merchant_id + order_id + amount + status + PAY_IN_KEY`. Adjust the
 * concatenation order/fields here once the official spec is available.
 */
function isValidSignature(payload: Record<string, unknown>): boolean {
  if (!PAY_IN_KEY || !MERCHANT_ID) return false;

  const provided = String(payload.sign ?? payload.signature ?? '');
  if (!provided) return false;

  const raw = [
    MERCHANT_ID,
    String(payload.order_id ?? payload.orderId ?? ''),
    String(payload.amount ?? ''),
    String(payload.status ?? ''),
    PAY_IN_KEY,
  ].join('');

  const expected = crypto.createHash('md5').update(raw).digest('hex');

  // Constant-time compare to avoid timing attacks.
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(provided.toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isSuccessStatus(status: unknown): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return ['success', 'completed', 'paid', 'ok', '1', 'true'].includes(normalized);
}

/**
 * Resolves the WinWave user id a gateway notification belongs to. Tries, in
 * order: an explicit user id, a pending transaction matched by gateway_ref,
 * then the payer phone number.
 */
async function resolveUserId(payload: Record<string, unknown>): Promise<string | null> {
  const explicit = String(payload.user_id ?? payload.userId ?? '').trim();
  if (explicit) return explicit;

  const ref = String(payload.order_id ?? payload.orderId ?? payload.reference ?? '').trim();
  if (ref) {
    const { data } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('gateway_ref', ref)
      .maybeSingle();
    if (data?.user_id) return data.user_id as string;
  }

  const phone = String(payload.phone ?? payload.msisdn ?? '').replace(/\D/g, '');
  if (phone) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

// Pay-In notification: credits the user's wallet and records a completed
// "move_in" transaction. Designed to be idempotent on gateway_ref.
router.post('/jazzcash', async (req, res) => {
  const context = getDeviceContext(req, req.body);
  try {
    const payload = (req.body ?? {}) as Record<string, unknown>;

    if (!isServiceRoleKey()) {
      console.error('Webhook rejected: backend is not using a service-role key.');
      return res.status(500).json({ ok: false, error: 'Server not configured for webhooks' });
    }

    if (!isValidSignature(payload)) {
      await logSecurityEvent('webhook_invalid_signature', String(payload.phone ?? ''), context, {
        order_id: payload.order_id ?? payload.orderId ?? null,
      });
      return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }

    const gatewayRef = String(payload.order_id ?? payload.orderId ?? payload.reference ?? '').trim() || null;

    if (!isSuccessStatus(payload.status)) {
      // Record the failed attempt for the audit trail, but do not credit.
      const userId = await resolveUserId(payload);
      if (userId) {
        await supabase.from('transactions').insert({
          user_id: userId,
          type: 'move_in',
          amount,
          status: 'failed',
          gateway_ref: gatewayRef,
        });
      }
      return res.json({ ok: true, credited: false });
    }

    const userId = await resolveUserId(payload);
    if (!userId) {
      await logSecurityEvent('webhook_user_not_found', String(payload.phone ?? ''), context, {
        order_id: gatewayRef,
      });
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Idempotency: if this gateway_ref was already completed, do nothing.
    if (gatewayRef) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('gateway_ref', gatewayRef)
        .maybeSingle();
      if (existing?.status === 'completed') {
        return res.json({ ok: true, credited: false, duplicate: true });
      }
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('main_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError || !wallet) {
      return res.status(404).json({ ok: false, error: 'Wallet not found' });
    }

    const newBalance = Number(wallet.main_balance ?? 0) + amount;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ main_balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Webhook wallet update failed:', updateError);
      return res.status(500).json({ ok: false, error: 'Wallet update failed' });
    }

    const { error: txError } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'move_in',
      amount,
      status: 'completed',
      gateway_ref: gatewayRef,
    });

    if (txError) {
      console.error('Webhook transaction log failed:', txError);
    }

    await logSecurityEvent('webhook_move_in_completed', String(payload.phone ?? ''), context, {
      userId,
      amount,
      order_id: gatewayRef,
    });

    return res.json({ ok: true, credited: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('jazzcash webhook failed', message);
    return res.status(500).json({ ok: false, error: 'webhook_failed' });
  }
});

export default router;
