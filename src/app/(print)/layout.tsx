export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-soft">{children}</div>;
}
