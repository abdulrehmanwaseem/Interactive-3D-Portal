import { Geist_Mono } from "next/font/google"
import "./globals.css"

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fontMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  )
}
