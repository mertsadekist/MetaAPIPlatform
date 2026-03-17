// Bare layout — overrides the AdminSidebar layout for the OAuth popup success page
export default function OAuthSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
