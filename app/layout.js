import "./globals.css";
import "./conversion.css";
export const metadata = {
  title: "Negotiation · Merchant workspace",
  description:
    "Connect your business. Set your boundaries. Negotiate with confidence.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
