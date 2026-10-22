import "./globals.css";

export const metadata = {
  title: "ChurchSmart — Church Management Platform",
  description: "The all-in-one church management platform built for African churches. Manage members, attendance, giving, and communicate with your congregation.",
  keywords: "church management, church software, member management, attendance tracking, tithe management, African churches",
  authors: [{ name: "DigiSmart Africa" }],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "ChurchSmart — Church Management Platform",
    description: "The all-in-one church management platform built for African churches.",
    url: "https://app.churchsmartnow.com",
    siteName: "ChurchSmart",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Branded splash screen — visible before JS bundle loads */}
        <div id="splash-screen" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#ffffff', flexDirection: 'column', gap: '24px',
          transition: 'opacity 0.3s ease-out'
        }}>
          <span style={{
            fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px',
            color: '#4F46E5'
          }}>ChurchSmart</span>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid #e0e7ff', borderTopColor: '#4F46E5',
            borderRadius: '50%',
            animation: 'cs-splash-spin 0.7s linear infinite'
          }} />
          <style dangerouslySetInnerHTML={{ __html:
            '@keyframes cs-splash-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'
          }} />
        </div>
        <script dangerouslySetInnerHTML={{ __html:
          `window.__dismissSplash=function(){var s=document.getElementById('splash-screen');if(s){s.style.opacity='0';setTimeout(function(){s.remove()},300)}};setTimeout(window.__dismissSplash,8000)`
        }} />
        {children}
      </body>
    </html>
  );
}
