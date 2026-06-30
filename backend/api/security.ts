import crypto from 'crypto';
import { supabase } from '../database/db';

export type SecurityContext = {
  ip: string;
  deviceId: string;
  userAgent: string;
  fingerprint: string;
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const getClientIp = (req: any) => {
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || 'unknown';
};

export const getDeviceContext = (req: any, body: Record<string, any> = {}) => {
  const ip = getClientIp(req);
  const deviceId = String(
    body?.deviceId ||
      body?.deviceFingerprint ||
      body?.device_id ||
      req.headers?.['x-device-id'] ||
      req.headers?.['x-device-fingerprint'] ||
      req.headers?.['x-device'] ||
      ''
  ).trim();
  const userAgent = String(req.headers?.['user-agent'] || '').trim();
  const fingerprint = sha256(`${ip}|${deviceId || 'unknown'}|${userAgent}`);

  return {
    ip,
    deviceId,
    userAgent,
    fingerprint,
  } satisfies SecurityContext;
};

export const logSecurityEvent = async (
  eventType: string,
  phone: string,
  context: SecurityContext,
  details: Record<string, any> = {}
) => {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      phone_number: phone,
      ip_address: context.ip,
      device_id: context.deviceId || null,
      device_fingerprint: context.fingerprint,
      user_agent: context.userAgent,
      metadata: details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to persist security event:', error);
  }
};

export const enforceRegistrationAbuseGuards = async (context: SecurityContext, phone: string) => {
  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    const { data: recentAttempts, error } = await supabase
      .from('registration_attempts')
      .select('id')
      .or(`ip.eq.${context.ip},device_fingerprint.eq.${context.fingerprint}`)
      .gte('attempted_at', since)
      .limit(5);

    if (error) {
      return { ok: true as const };
    }

    if (recentAttempts && recentAttempts.length >= 3) {
      return { ok: false as const, reason: 'suspicious_activity' as const };
    }

    await supabase.from('registration_attempts').insert({
      ip: context.ip,
      phone_number: phone,
      device_fingerprint: context.fingerprint,
      device_id: context.deviceId || null,
      user_agent: context.userAgent,
      attempted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to persist registration attempt audit:', error);
  }

  return { ok: true as const };
};
