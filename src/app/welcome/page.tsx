export const dynamic = 'force-static'

import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F4EDE0] p-6">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#B5532A]/10 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B5532A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        <h1
          className="text-3xl font-bold text-[#1B1208] mb-3"
          style={{ fontFamily: 'var(--font-fraunces), serif' }}
        >
          Pembayaran berhasil!
        </h1>

        <p className="text-[#5A3D25] text-base leading-relaxed mb-2">
          Akun kamu sedang disiapkan. Kredensial login akan dikirim ke email
          yang kamu daftarkan dalam beberapa menit.
        </p>

        <p className="text-[#8B7060] text-sm mb-8">
          Jika belum muncul, cek folder <strong>Spam</strong> ya.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#B5532A] text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-[#8B3D1A] transition-colors"
        >
          Buka App
        </Link>

        <p className="text-xs text-[#8B7060] mt-6">
          Butuh bantuan?{' '}
          <a
            href="https://wa.me/6287850755050"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#B5532A] underline"
          >
            Hubungi kami via WhatsApp
          </a>
        </p>
      </div>
    </div>
  )
}
