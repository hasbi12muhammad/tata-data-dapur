import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Factory,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

/* ── Types ── */
export type Feature = { icon: string; title: string; body: ReactNode };
export type GalleryImage = { src: string; caption: string };
export type TourBlock =
  | { type: "p"; node: ReactNode }
  | { type: "shot"; label: string; src?: string; gallery?: GalleryImage[] }
  | { type: "subhead"; node: ReactNode }
  | { type: "features"; items: Feature[] }
  | { type: "callout"; variant: "tip" | "info"; node: ReactNode };
export type TourSection = {
  id: string;
  icon: LucideIcon;
  title: string;
  route: string;
  screenshot?: string;
  blocks: TourBlock[];
};
export type FaqItem = { q: string; a: ReactNode };
export type FaqGroup = { title: string; items: FaqItem[] };
export type VideoCard = {
  title: string;
  meta: string;
  duration?: string;
  badge?: string;
  src?: string;
};
export type VideoSection = { title: string; cards: VideoCard[] };

/* ════════════ TAB 1 — TUR MENU ════════════ */
export const TOUR: TourSection[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    route: "Menu utama saat buka app",
    blocks: [
      { type: "p", node: <>Dashboard halaman pertama yang kamu lihat tiap buka app. Di sini langsung ketahuan kondisi bisnis hari ini — tanpa hitung manual.</> },
      { type: "p", node: <>Standarnya Dashboard menampilkan data <strong>hari ini</strong>. Tapi kamu bisa pilih tanggal lain buat lihat rekap hari kemarin. Pas banget kalau lupa input dan mau cek semua sudah tercatat.</> },
      { type: "shot", label: "Screenshot Dashboard", src: "/help/dashboard-desktop.png",
        gallery: [
          { src: "/help/dashboard-desktop.png", caption: "Dashboard — ringkasan hari ini" },
        ],
      },
      { type: "features", items: [
        { icon: "banknote", title: "Total Penjualan", body: "Total uang masuk dari semua transaksi di tanggal yang dipilih." },
        { icon: "trending-down", title: "Total Pengeluaran", body: "Total biaya operasional yang tercatat — listrik, gas, gaji, kemasan, dan lainnya." },
        { icon: "shopping-cart", title: "Total Pembelian", body: "Total uang keluar untuk pembelian bahan baku di tanggal yang dipilih." },
        { icon: "check-circle", title: "Laba Bersih", body: "Penjualan dikurangi total pengeluaran dan pembelian bahan baku — angka ini yang paling mencerminkan untung bersih hari itu." },
      ] },
      { type: "p", node: <>Di bawah kartu ringkasan ada tiga daftar aktivitas: <strong>Penjualan terbaru</strong>, <strong>Pengeluaran terbaru</strong>, dan <strong>Pembelian terbaru</strong> — semua entri hari itu langsung tampil di sini.</> },
      { type: "callout", variant: "tip", node: <>Mau lihat performa per periode (minggu, bulan, custom)? Buka menu <strong>Laporan</strong> — lebih lengkap dengan grafik tren dan daftar top produk.</> },
    ],
  },
  {
    id: "items",
    icon: Package,
    title: "Bahan Baku",
    route: "Setup awal — isi ini dulu sebelum yang lain",
    blocks: [
      { type: "p", node: <>Bahan Baku adalah daftar semua bahan mentah yang kamu pakai buat produksi. Di sini kamu cukup daftarkan nama dan satuannya — <strong>harga dan stok nggak perlu diisi manual</strong>, dua-duanya terisi sendiri begitu kamu catat pembelian.</> },
      { type: "shot", label: "Screenshot halaman Bahan Baku", src: "/help/items-desktop.png",
        gallery: [
          { src: "/help/items-desktop.png", caption: "Halaman Bahan Baku — daftar semua bahan" },
          { src: "/help/items-modal-desktop.png", caption: "Form Tambah Bahan — nama, satuan, tandai add-on" },
        ],
      },
      { type: "features", items: [
        { icon: "circle-plus", title: "Tambah Bahan Manual", body: "Isi nama bahan, pilih satuan (gr, ml, pcs, kg, liter), simpan. Selesai. Harga dan stok kosong dulu, nanti terisi pas pembelian pertama dicatat." },
        { icon: "clipboard-list", title: "Import via Template Excel", body: "Bahannya banyak? Download template, isi di Excel, upload sekaligus. Enak buat setup awal biar nggak input satu-satu." },
        { icon: "line-chart", title: "Harga Rata-rata Otomatis", body: <>Kolom AVG PRICE dihitung sendiri dari riwayat pembelian pakai metode <em>weighted average</em>. Harga inilah yang dipakai buat menghitung HPP resep.</> },
        { icon: "cake", title: "Add-on Penjualan", body: "Bahan seperti topper kue, lilin ulang tahun, atau kemasan khusus bisa ditandai sebagai add-on. Nanti bisa dipilih sebagai tambahan pas mencatat penjualan produk." },
      ] },
      { type: "callout", variant: "tip", node: <><strong>Mulai dari sini.</strong> Sebelum bisa bikin resep atau catat pembelian, kamu perlu daftarkan bahan baku dulu. Ini langkah pertama setup app.</> },
    ],
  },
  {
    id: "purchases",
    icon: ShoppingCart,
    title: "Pembelian",
    route: "Catat tiap kali beli bahan baku",
    blocks: [
      { type: "p", node: <>Tiap kali beli bahan baku — entah di pasar, supplier, atau toko — catat di sini. Pembelian bukan sekadar catatan keluar uang; dia punya dua peran penting:</> },
      { type: "p", node: <>Pertama, <strong>nambah stok</strong> bahan baku otomatis. Kedua, <strong>memperbarui harga rata-rata</strong> bahan pakai weighted average — jadi HPP resep selalu ikut harga beli terbaru, bukan harga lama.</> },
      { type: "shot", label: "Screenshot halaman Pembelian", src: "/help/purchases-desktop.png",
        gallery: [
          { src: "/help/purchases-desktop.png", caption: "Halaman Pembelian — riwayat pembelian bahan" },
          { src: "/help/purchases-modal-desktop.png", caption: "Form Tambah Pembelian — beli per satuan dasar" },
          { src: "/help/purchases-modal-pkg-desktop.png", caption: "Beli per kemasan — centang untuk tampilkan field Jenis kemasan, Jumlah, dan Isi per kemasan" },
        ],
      },
      { type: "features", items: [
        { icon: "ruler", title: "Beli per Satuan Dasar", body: "Misal beli Tepung Terigu 5 kg seharga Rp 65.000. Pilih bahan, isi qty (5) dan satuan (kg), isi total harga, simpan." },
        { icon: "package", title: "Beli per Kemasan", body: "Belinya per dus atau pack? Isi jumlah kemasan dan isi per kemasan — app yang konversi ke satuan dasar. Misal: 2 dus × 24 botol." },
        { icon: "calendar", title: "Backdate Pembelian", body: "Lupa catat kemarin? Tinggal pilih tanggal yang lewat pas input. Stok dan harga rata-rata menyesuaikan urutan tanggalnya." },
      ] },
      { type: "callout", variant: "info", node: <>Yang dicatat di sini cuma <strong>pembelian bahan baku</strong>. Buat biaya operasional seperti gas, listrik, atau ongkir, catatnya di menu <strong>Pengeluaran</strong>.</> },
    ],
  },
  {
    id: "expenses",
    icon: Receipt,
    title: "Pengeluaran",
    route: "Biaya operasional di luar bahan baku",
    blocks: [
      { type: "p", node: <>Pengeluaran adalah semua biaya buat menjalankan usaha, tapi <strong>bukan buat beli bahan baku</strong>. Data ini yang dipakai buat menghitung <em>laba bersih</em> di halaman Laporan.</> },
      { type: "shot", label: "Screenshot halaman Pengeluaran", src: "/help/expenses-desktop.png",
        gallery: [
          { src: "/help/expenses-desktop.png", caption: "Halaman Pengeluaran — riwayat biaya operasional" },
          { src: "/help/expenses-modal-desktop.png", caption: "Form Tambah Pengeluaran — pilih kategori, isi nominal" },
        ],
      },
      { type: "features", items: [
        { icon: "hard-hat", title: "Gaji & Upah", body: "Gaji karyawan harian atau bulanan, upah lembur, honor asisten dapur." },
        { icon: "package", title: "Kemasan & Perlengkapan", body: "Plastik, stiker label, kotak, pita, dan semua perlengkapan packaging." },
        { icon: "flame", title: "Bahan Bakar & Gas", body: "Gas LPG, bensin, bahan bakar operasional dapur." },
        { icon: "zap", title: "Listrik & Air", body: "Tagihan listrik, air, dan utilitas dapur lainnya." },
        { icon: "wrench", title: "Perawatan & Lainnya", body: "Perbaikan alat, biaya tak terduga, dan pengeluaran lain yang belum masuk kategori di atas." },
      ] },
      { type: "callout", variant: "tip", node: <>Bingung sesuatu masuk Pembelian atau Pengeluaran? Patokannya gampang: kalau itu <strong>bahan yang dipakai buat bikin produk</strong>, masuk Pembelian. Kalau itu <strong>biaya menjalankan usaha</strong>, masuk Pengeluaran.</> },
    ],
  },
  {
    id: "recipes",
    icon: BookOpen,
    title: "Produk",
    route: "Tempat mendefinisikan semua produk yang kamu jual",
    blocks: [
      { type: "p", node: <>Di sini kamu mendefinisikan produk yang kamu jual beserta komposisi bahannya. Begitu komposisi diisi, <strong>HPP (Harga Pokok Produksi) terhitung sendiri dan real-time</strong> — tanpa perlu kalkulator.</> },
      { type: "shot", label: "Screenshot halaman Produk", src: "/help/recipes-desktop.png",
        gallery: [
          { src: "/help/recipes-desktop.png", caption: "Halaman Produk — daftar semua produk + HPP" },
          { src: "/help/recipes-modal-desktop.png", caption: "Form Produk Baru — Produk Jadi (langsung dijual)" },
          { src: "/help/recipes-modal-ingredient-desktop.png", caption: "Produk Setengah Jadi — centang untuk tampilkan pilihan Unit stok" },
        ],
      },
      { type: "subhead", node: <strong>Ada dua tipe produk:</strong> },
      { type: "features", items: [
        { icon: "check-circle", title: "Produk Jadi", body: "Produk yang langsung dijual ke pelanggan. Contoh: Croissant, Kue Ulang Tahun, Brownies Panggang. HPP-nya dihitung dari bahan baku yang dipakai." },
        { icon: "repeat", title: "Produk Setengah Jadi", body: "Produk yang diproses dulu sebelum jadi produk akhir, dan bisa jadi bahan di produk lain. Contoh: Strawberry Jam yang dipakai di Strawberry Cake, atau Adonan Dasar Croissant buat berbagai varian croissant. Punya stok sendiri yang diatur lewat menu Produksi." },
      ] },
      { type: "shot", label: "Screenshot form tambah produk — HPP real-time", src: "/help/recipes-modal-desktop.png" },
      { type: "features", items: [
        { icon: "bar-chart", title: "Batch Yield & Estimasi Waste", body: <>Kalau 1 resep menghasilkan beberapa porsi (misal 1 resep = 12 cupcake), isi <em>batch yield</em>. Kalau ada bahan yang menyusut waktu dimasak, isi <em>estimasi waste</em> dalam persen. Dua-duanya bikin HPP per unit lebih akurat.</> },
        { icon: "cake", title: "Add-on Produk", body: "Produk bisa ditandai sebagai add-on — artinya bisa dipilih sebagai tambahan pas pelanggan beli produk lain. Contoh: topper kue, lilin ulang tahun, kotak khusus." },
      ] },
      { type: "callout", variant: "tip", node: <>HPP di produk <strong>otomatis berubah</strong> kalau harga bahan baku berubah gara-gara pembelian baru. Nggak perlu update resep manual.</> },
    ],
  },
  {
    id: "produksi",
    icon: Factory,
    title: "Produksi",
    route: "Catat saat kamu memproduksi stok produk",
    blocks: [
      { type: "p", node: <>Produksi dipakai pas kamu bikin produk dalam jumlah tertentu buat disimpan jadi stok — bukan langsung jual. Misal bakery yang tiap pagi bikin 50 pcs roti, atau dapur yang tiap minggu bikin stok selai.</> },
      { type: "p", node: <>Pas kamu catat produksi, dua hal terjadi sendiri: <strong>stok produk nambah</strong> sesuai batch yang dibuat, dan <strong>stok bahan baku berkurang</strong> sesuai komposisi resep.</> },
      { type: "shot", label: "Screenshot halaman Produksi", src: "/help/produksi-desktop.png",
        gallery: [
          { src: "/help/produksi-desktop.png", caption: "Halaman Produksi — log produksi stok" },
          { src: "/help/produksi-modal-desktop.png", caption: "Form Catat Produksi — tab Produk Jadi" },
          { src: "/help/produksi-modal-ingredient-desktop.png", caption: "Tab Setengah Jadi — dropdown berubah jadi pilih Bahan Setengah Jadi" },
        ],
      },
      { type: "features", items: [
        { icon: "factory", title: "Produksi Produk Jadi", body: "Catat berapa batch produk jadi yang kamu buat hari ini. Stok produk naik, stok bahan turun." },
        { icon: "repeat", title: "Produksi Bahan Setengah Jadi", body: "Misal hari ini bikin 3 batch Strawberry Jam. Stok selai naik, stok stroberi dan gula turun. Selai ini lalu bisa dipakai di produk lain." },
        { icon: "pencil", title: "Edit & Hapus Log", body: "Salah input? Bisa diedit atau dihapus. Semua efek ke stok ikut menyesuaikan otomatis — nggak perlu hitung manual." },
      ] },
      { type: "callout", variant: "info", node: <>Kalau langsung jual tanpa produksi stok dulu (langsung buat, langsung jual), menu ini nggak perlu dipakai. Cukup catat di Penjualan — stok bahan baku berkurang sendiri.</> },
    ],
  },
  {
    id: "sales",
    icon: TrendingUp,
    title: "Penjualan",
    route: "Catat tiap transaksi penjualan",
    blocks: [
      { type: "p", node: <>Tiap ada penjualan, catat di sini. Satu transaksi bisa berisi beberapa produk sekaligus. HPP otomatis diambil dari data resep saat itu — kamu tinggal isi harga jual dan qty.</> },
      { type: "shot", label: "Screenshot halaman Penjualan", src: "/help/sales-desktop.png",
        gallery: [
          { src: "/help/sales-desktop.png", caption: "Halaman Penjualan — riwayat transaksi" },
          { src: "/help/sales-modal-desktop.png", caption: "Form Tambah Penjualan — pilih produk, qty, harga jual" },
        ],
      },
      { type: "features", items: [
        { icon: "banknote", title: "Harga Jual Diingat Otomatis", body: "Pernah jual produk ini sebelumnya? Harga jualnya muncul sendiri di transaksi berikutnya. Tetap bisa kamu ubah kalau ada kenaikan harga atau alasan lain." },
        { icon: "tag", title: "Kategori Penjualan", body: "Tiap transaksi bisa ditandai kategori: Offline, GoFood, GrabFood, ShopeeFood, dan lainnya. Berguna buat analisis channel penjualan di Laporan." },
        { icon: "cake", title: "Add-on per Produk", body: "Pas input item, bisa tambahin add-on (topper, lilin, box khusus) yang stok dan HPP-nya ikut ter-update." },
        { icon: "calendar", title: "Backdate Transaksi", body: "Lupa catat penjualan kemarin? Pilih tanggal yang lewat — datanya masuk ke laporan tanggal yang benar." },
      ] },
      { type: "callout", variant: "tip", node: <>HPP yang tersimpan di tiap transaksi itu <strong>snapshot saat transaksi terjadi</strong>. Jadi kalau besok harga bahan naik, profit transaksi hari ini nggak ikut berubah — sudah terkunci.</> },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Laporan",
    route: "Analisis performa bisnis per periode",
    blocks: [
      { type: "p", node: <>Laporan tempat kamu lihat gambaran besar bisnis — bukan per hari seperti Dashboard, tapi per minggu, bulan, atau periode yang kamu tentukan sendiri.</> },
      { type: "shot", label: "Screenshot halaman Laporan — periode 30 hari", src: "/help/reports-desktop.png" },
      { type: "features", items: [
        { icon: "calendar", title: "Pilih Periode", body: "Ada Hari ini, 7 Hari, 30 Hari, Bulan ini, Bulan lalu, dan Custom (pilih sendiri tanggal mulai & selesai)." },
        { icon: "trending-up", title: "Grafik Tren", body: "Grafik bar nunjukin revenue dan profit per hari. Arahkan kursor ke bar mana pun buat lihat angka detail hari itu." },
        { icon: "trophy", title: "Top Produk", body: "Daftar produk yang paling banyak ngasih profit di periode itu. Berguna buat tahu mana produk andalan." },
        { icon: "download", title: "Unduh PDF & Excel", body: "Laporan bisa diunduh sebagai PDF buat dibagikan atau diarsipkan, atau sebagai Excel (.xlsx) buat diolah lagi di spreadsheet." },
      ] },
      { type: "callout", variant: "info", node: <>Laporan cocok buat analisis per periode dan lihat tren. Dashboard lebih ke <strong>rekap harian cepat</strong> — Laporan ke <strong>gambar besar bisnis</strong> mingguan/bulanan.</> },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Pengaturan",
    route: "Icon gear di pojok kanan atas",
    blocks: [
      { type: "p", node: <>Pengaturan bisa dibuka lewat icon gear di pojok kanan atas. Di sini kamu bisa ubah informasi akun dan kelola data master.</> },
      { type: "shot", label: "Screenshot halaman Pengaturan", src: "/help/settings-desktop.png" },
      { type: "features", items: [
        { icon: "store", title: "Ganti Nama Toko", body: "Nama yang muncul di header app. Bisa diganti kapan pun." },
        { icon: "mail", title: "Ganti Email", body: "Email buat login. Setelah kamu simpan, sistem kirim link konfirmasi ke email baru — klik link itu buat menyelesaikan perubahan." },
        { icon: "key", title: "Ganti Password", body: "Masukkan password baru dua kali buat konfirmasi. Langsung berlaku setelah disimpan." },
        { icon: "ruler", title: "Satuan Custom & Jenis Kemasan", body: 'Ada satuan yang belum tersedia (misal "lbr", "roll")? Tambah di sini. Begitu juga jenis kemasan buat pembelian per-kemasan.' },
      ] },
    ],
  },
];

/* ════════════ TAB 2 — FAQ ════════════ */
export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "HPP & Produk",
    items: [
      {
        q: "Gimana cara menghitung HPP otomatis?",
        a: (
          <>
            HPP dihitung sendiri dari komposisi bahan yang kamu isi di menu <strong>Produk</strong>. Caranya gampang: buat produk, masukin bahan-bahannya beserta qty, HPP langsung muncul.
            <pre className="help-example">{`Contoh: Croissant
- Tepung Terigu 100gr × Rp 12/gr  = Rp 1.200
- Mentega        80gr × Rp 55/gr  = Rp 4.400
- Telur           1pcs × Rp 2.500 = Rp 2.500
                        ──────────────────────
Total biaya 1 resep               = Rp 8.100`}</pre>
            Nah, di sinilah <strong>Batch Yield</strong> ambil peran. Coba bandingkan dua skenario:
            <br /><br />
            <strong>Tanpa Batch Yield:</strong> App nganggep 1 resep = 1 pcs. Jadi HPP-mu tercatat Rp 8.100/pcs — padahal sekali bikin kamu dapat 6 croissant, bukan 1. HPP-nya jadi kelihatan jauh lebih mahal dari kenyataan, dan profit yang tercatat pun ikut lebih kecil dari yang sebenarnya.
            <br /><br />
            <strong>Dengan Batch Yield = 6:</strong> Kamu kasih tahu app kalau &ldquo;1 resep ini menghasilkan 6 pcs&rdquo;. App langsung bagi otomatis: Rp 8.100 ÷ 6 = Rp 1.350/pcs — inilah HPP asli per produk yang kamu jual.
            <br /><br />
            Intinya: isi Batch Yield sesuai jumlah pcs yang keluar dari sekali masak. Kalau 1 resep cuma menghasilkan 1 pcs, biarin kosong aja (default-nya memang 1).
          </>
        ),
      },
      {
        q: "Kenapa HPP produk saya berubah sendiri?",
        a: (
          <>
            Ini bukan bug — ini memang fiturnya. HPP dihitung real-time dari harga rata-rata bahan baku saat ini. Begitu kamu catat pembelian bahan dengan harga berbeda, harga rata-rata bahan itu berubah, dan HPP semua produk yang memakainya ikut menyesuaikan.
            <br /><br />
            Tujuannya supaya HPP kamu selalu mencerminkan biaya yang benar-benar kamu keluarkan — bukan harga lama yang sudah nggak relevan.
          </>
        ),
      },
      {
        q: "Apa bedanya Produk Jadi dan Produk Setengah Jadi?",
        a: (
          <>
            <strong>Produk Jadi</strong> itu produk yang langsung dijual ke pelanggan — nggak diolah lagi. Contoh: Croissant, Kue Tart, Brownies.
            <br /><br />
            <strong>Produk Setengah Jadi</strong> diproses dulu, baru dijadikan bahan buat produk lain. Contoh: Strawberry Jam yang dipakai di Strawberry Cake, atau Adonan Puff Pastry buat berbagai varian pastri.
            <br /><br />
            Produk Setengah Jadi punya stok sendiri yang diatur lewat menu <strong>Produksi</strong>. HPP-nya juga ikut masuk ke perhitungan produk yang memakainya.
          </>
        ),
      },
      {
        q: "Estimasi waste itu buat apa?",
        a: (
          <>
            Waste itu persentase bahan yang hilang atau terbuang waktu proses produksi — entah karena penguapan, sisa nggak terpakai, atau produk gagal. Dengan mengisi estimasi waste, HPP per unit jadi lebih akurat karena sudah memperhitungkan kerugian produksi.
            <pre className="help-example">{`Contoh: 1 batch adonan = 10 roti, tapi biasanya 1 roti gagal
Waste = 10% → HPP per roti dihitung dari 9 roti yang berhasil, bukan 10.`}</pre>
            Kalau belum yakin angka waste-nya, isi 0 dulu, update belakangan.
          </>
        ),
      },
    ],
  },
  {
    title: "Stok & Pembelian",
    items: [
      {
        q: "Gimana cara mencatat stok dan memantaunya?",
        a: (
          <>
            Stok bahan baku nggak diisi manual — dia bergerak sendiri dari dua arah:
            <ul className="my-2.5 ml-4 list-disc space-y-1">
              <li><strong>Bertambah</strong> saat kamu catat Pembelian</li>
              <li><strong>Berkurang</strong> saat kamu catat Penjualan (atau Produksi)</li>
            </ul>
            Buat memantau stok, buka menu <strong>Bahan Baku</strong> — kolom STOCK nunjukin stok terkini tiap bahan.
          </>
        ),
      },
      {
        q: "Apa bedanya Pembelian dan Pengeluaran?",
        a: (
          <>
            Patokannya sederhana:
            <br /><br />
            <strong>Pembelian</strong> = beli sesuatu yang dipakai buat <em>bikin produk</em>. Masuk ke stok bahan baku, mempengaruhi HPP. Contoh: tepung, telur, gula, mentega, susu.
            <br /><br />
            <strong>Pengeluaran</strong> = biaya <em>menjalankan usaha</em> yang nggak masuk ke produk secara langsung. Contoh: bayar listrik, beli gas LPG buat kompor, gaji karyawan, ongkos kirim, beli kemasan plastik.
          </>
        ),
      },
      {
        q: "Fitur Produksi itu buat apa? Kapan saya perlu pakai?",
        a: (
          <>
            Produksi dipakai kalau kamu <strong>bikin stok dulu, baru jual belakangan</strong>. Misal bakery yang tiap pagi produksi 50 roti buat dijual sepanjang hari — mereka nggak langsung jual pas bikin.
            <br /><br />
            Kalau kamu <strong>bikin langsung pas ada pesanan</strong>, menu Produksi nggak perlu. Cukup catat di Penjualan — stok bahan berkurang sendiri.
            <br /><br />
            Produksi juga wajib buat <strong>Produk Setengah Jadi</strong> — kamu perlu catat produksi selai/adonan dulu sebelum bisa dipakai di produk lain.
          </>
        ),
      },
    ],
  },
  {
    title: "Pengeluaran & Kategori",
    items: [
      {
        q: "Gaji karyawan, gas, dan listrik masuk ke mana?",
        a: (
          <>
            Semuanya masuk ke menu <strong>Pengeluaran</strong>. Pilih atau buat kategori yang sesuai:
            <pre className="help-example">{`Gaji karyawan → Kategori: Gaji & Upah
Gas LPG → Kategori: Bahan Bakar & Gas
Listrik → Kategori: Listrik & Air
Plastik kemasan → Kategori: Kemasan & Perlengkapan
Servis alat / tak terduga → Kategori: Perawatan & Lainnya`}</pre>
            Semua pengeluaran ini otomatis dipotong dari profit kotor di halaman <strong>Laporan</strong> buat menghasilkan angka laba bersih.
          </>
        ),
      },
    ],
  },
  {
    title: "Penjualan & Laporan",
    items: [
      {
        q: "Mencatat penjualan dan pembelian hari ini — urutan yang benar?",
        a: (
          <>
            Urutan yang disarankan buat hari pertama setup:
            <pre className="help-example">{`1. Bahan Baku: daftar semua bahan
2. Pembelian: catat beli bahan → stok & harga terisi
3. Produk: buat resep dari bahan yang ada → HPP muncul
4. Penjualan: catat transaksi hari ini
5. Pengeluaran: catat biaya operasional hari ini
6. Dashboard: lihat hasilnya`}</pre>
            Buat hari-hari berikutnya, biasanya cukup langkah 2, 4, 5, dan 6 yang rutin.
          </>
        ),
      },
      {
        q: "Gimana cara print / export laporan?",
        a: (
          <>
            Buka menu <strong>Laporan</strong>, pilih periode yang kamu mau, scroll ke bawah, klik tombol <strong>Unduh PDF</strong> atau <strong>Unduh Excel</strong>.
            <br /><br />
            <strong>PDF</strong> — buat dibagikan lewat WhatsApp, dikirim ke akuntan, atau diarsipkan sebagai dokumen siap cetak.
            <br />
            <strong>Excel (.xlsx)</strong> — buat diolah lagi di spreadsheet, buat pivot table, atau dianalisis lebih lanjut.
          </>
        ),
      },
      {
        q: "Cara print struk penjualan?",
        a: (
          <>
            Fitur struk ada di modul <strong>Kasir</strong> — ini add-on berbayar yang terpisah dari paket dasar. Kalau belum punya dan tertarik, hubungi kami buat info lebih lanjut.
            <br /><br />
            Kalau sudah punya akses Kasir, buka menu Kasir, proses transaksi, lalu pilih &ldquo;Print Struk&rdquo; setelah transaksi selesai.
          </>
        ),
      },
    ],
  },
];

/* ════════════ TAB 3 — VIDEO ════════════ */
export const VIDEO_SECTIONS: VideoSection[] = [
  {
    title: "Ikut tur fitur aplikasi kami ✨",
    cards: [
      { title: "Panduan Login & Ganti Password", meta: "Setup Awal · 2 menit", badge: "Mulai di sini", src: "/videos/panduan-login.mp4" },
      { title: "Tur Singkat Semua Menu App", meta: "Orientasi · 3-4 menit" },
    ],
  },
  {
    title: "Bagaimana cara...?",
    cards: [
      { title: "Membuat HPP otomatis untuk produkmu?", meta: "Produk & Resep · 4-5 menit" },
      { title: "Mengelola bahan baku & menghitung HPP", meta: "Bahan Baku & HPP · 4-5 menit", src: "/videos/panduan-bahan-baku-hpp.mp4" },
      { title: "Menambahkan pembelian bahan baku", meta: "Pembelian · 3-4 menit", src: "/videos/panduan-pembelian.mp4" },
      { title: "Mencatat penjualan dan pembelian hari ini?", meta: "Operasional Harian · 3-4 menit" },
      { title: "Gaji karyawan, gas, dan utilitas masuk ke mana?", meta: "Pengeluaran · 2-3 menit" },
      { title: "Apa bedanya Produk Jadi dan Setengah Jadi?", meta: "Produk · 3-4 menit" },
      { title: "Membaca laporan dan export ke Excel?", meta: "Laporan · 3-4 menit" },
      { title: "Fitur Sub-Recipe: dari Strawberry Jam ke Strawberry Cake", meta: "Fitur Lanjutan · 4-5 menit" },
    ],
  },
];
