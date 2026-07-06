import 'dotenv/config';
import { supabaseAdmin } from '../../backend/database/db';

export default async function handler(req: any, res: any) {
  try {
    console.log('[WinGo Cron] Starting game result generation...');

    // Generate results for different periods
    const periods = ['30s', '1m', '3m', '5m'];
    const results: any[] = [];

    for (const period of periods) {
      const result = Math.floor(Math.random() * 10);
      const color = result % 2 === 0 ? 'red' : 'green';
      const size = result >= 5 ? 'big' : 'small';

      results.push({ period, result, color, size });

      // Store in database
      const { error: insertError } = await supabaseAdmin
        .from('game_records')
        .insert({
          game_type: 'wingo',
          period: period,
          result: result,
          color: color,
          size: size,
          rtp: 96.0,
          created_at: new Date().toISOString(),
          status: 'completed'
        });

      if (insertError) {
        console.error(`[WinGo Cron] Error for ${period}:`, insertError);
      } else {
        console.log(`[WinGo Cron] Generated ${period}: ${result} ${color} ${size}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'WinGo results generated',
      results: results
    });

  } catch (error: any) {
    console.error('[WinGo Cron] Error:', error?.message);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error'
    });
  }
}
