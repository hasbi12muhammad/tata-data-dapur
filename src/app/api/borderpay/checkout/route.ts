import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'

// Landing (tatadatadapur.my.id) memanggil endpoint ini lintas origin.
const ALLOWED_ORIGINS = ['https://tatadatadapur.my.id', 'https://www.tatadatadapur.my.id']
const RETURN_URL = 'https://app.tatadatadapur.my.id/welcome'

function cors(req: NextRequest) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

/**
 * Bikin checkout session BorderPay untuk order yang sudah ada di tabel orders.
 * Nominal diambil dari DB, bukan dari request. return_url hanya didukung REST API
 * (pay-link mengabaikannya), makanya lewat server — API key tidak boleh di frontend.
 */
export async function POST(req: NextRequest) {
  const headers = cors(req)
  let body: { order_id?: unknown; test?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers })
  }
  const orderId = body.order_id
  if (typeof orderId !== 'string' || !/^TDD-\d+-\d{4}$/.test(orderId)) {
    return NextResponse.json({ error: 'invalid order_id' }, { status: 400, headers })
  }

  const test = body.test === true
  // Jangan diam-diam jatuh ke live kalau sandbox dimatikan
  if (test && process.env.BORDERPAY_ALLOW_TEST !== '1') {
    return NextResponse.json({ error: 'test mode disabled' }, { status: 403, headers })
  }
  const apiKey = test ? process.env.BORDERPAY_API_KEY_TEST : process.env.BORDERPAY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'payment not configured' }, { status: 503, headers })
  }

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('orders')
    .select('order_id, amount, status')
    .eq('order_id', orderId)
    .single()
  if (!order) {
    return NextResponse.json({ error: 'order not found' }, { status: 404, headers })
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'order not payable' }, { status: 409, headers })
  }

  let res: Response
  try {
    res = await fetch('https://borderpay.id/api/v1/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: order.amount, reference_id: orderId, return_url: RETURN_URL }),
    })
  } catch {
    return NextResponse.json({ error: 'gateway unreachable' }, { status: 502, headers })
  }
  const pay = (await res.json().catch(() => ({}))) as { pay_url?: string; checkout_url?: string | null }
  const url = pay.checkout_url || pay.pay_url
  if (!res.ok || !url) {
    console.error('BorderPay create payment failed:', orderId, res.status)
    return NextResponse.json({ error: 'gateway error' }, { status: 502, headers })
  }
  return NextResponse.json({ url }, { headers })
}
