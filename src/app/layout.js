import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navegacao from "../components/Navegacao";

// Import condicional: em produção o widget de deploy nem entra no bundle.
const DeployWidget = process.env.NODE_ENV === "development" ? (await import("../components/DeployWidget")).default : null;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Reserva de Salas",
  description: "Reserva de salas de reunião",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navegacao />
        {children}
        {DeployWidget && <DeployWidget />}
      </body>
    </html>
  );
}
