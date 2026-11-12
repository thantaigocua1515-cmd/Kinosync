import type {Metadata, Viewport} from 'next';
import {Be_Vietnam_Pro, Playfair_Display, JetBrains_Mono} from 'next/font/google';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body-face',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-display-face',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-face',
  display: 'swap',
});

const tagline =
  'Biến truyện chữ thành phim đọc truyện có giọng đọc AI, phụ đề khớp từng câu và hình ảnh minh họa — dài 60–90 phút, xuất MP4 ngay trên trình duyệt.';

export const metadata: Metadata = {
  title: {
    default: 'Kinosync — Truyện chữ thành phim đọc truyện',
    template: '%s · Kinosync',
  },
  description: tagline,
  applicationName: 'Kinosync Studio',
  keywords: [
    'đọc truyện',
    'video đọc truyện',
    'truyện audio',
    'text to speech',
    'truyenok',
    'kinosync',
  ],
  openGraph: {
    title: 'Kinosync — Truyện chữ thành phim đọc truyện',
    description: tagline,
    type: 'website',
    locale: 'vi_VN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kinosync — Truyện chữ thành phim đọc truyện',
    description: tagline,
  },
  robots: {index: true, follow: true},
};

export const viewport: Viewport = {
  themeColor: '#090a0c',
  colorScheme: 'dark',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${playfair.variable} ${jetbrains.variable} dark`}
    >
      <body className="film-grain min-h-dvh antialiased">{children}</body>
    </html>
  );
}
