import type {Metadata} from 'next';
import {Plus_Jakarta_Sans, Public_Sans, JetBrains_Mono} from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const publicSans = Public_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'KinoSync Studio — Trình Dựng Video Tự Động',
  description:
    'Studio dựng video tự động khớp nhạc MP3, hình ảnh, phụ đề thông minh và xuất video MP4 độ phân giải cao.',
  openGraph: {
    title: 'KinoSync Studio — Trình Dựng Video Tự Động',
    description:
      'Studio dựng video tự động khớp nhạc MP3, hình ảnh, phụ đề thông minh và xuất video MP4 độ phân giải cao.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinoSync Studio — Trình Dựng Video Tự Động',
    description:
      'Studio dựng video tự động khớp nhạc MP3, hình ảnh, phụ đề thông minh và xuất video MP4 độ phân giải cao.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="vi"
      className={`${plusJakarta.variable} ${publicSans.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200"
        style={{fontFamily: 'var(--font-sans), sans-serif'}}
      >
        {children}
      </body>
    </html>
  );
}
