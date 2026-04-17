import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F2EBD9] p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#7C563D] flex items-center justify-center mb-3">
            <div className="w-6 h-6 rounded bg-[#A05035] flex items-center justify-center">
              <span className="text-[#E9DFC6] text-[9px] font-bold">TDD</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#2C1810]">Tata Data Dapur</h1>
        </div>

        <div className="bg-[#FBF8F2] rounded-2xl border border-[#D9CCAF] shadow-sm p-6 text-center">
          <h2 className="text-lg font-semibold text-[#2C1810] mb-2">
            Akses Ditolak
          </h2>
          <p className="text-sm text-[#7C6352] mb-6">
            Akun Anda tidak memiliki akses ke aplikasi ini. Hubungi
            administrator.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-[#7C563D] text-[#E9DFC6] text-sm font-medium hover:bg-[#6B4832] transition-colors"
          >
            Kembali ke Login
          </Link>
        </div>

        <p className="text-center text-xs text-[#B88D6A] mt-6">
          Tata Data Dapur &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
