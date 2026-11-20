"use client";

// app/global-error.tsx
// Last-resort boundary: catches errors thrown by app/layout.tsx itself, which
// app/error.tsx cannot cover. Next.js replaces the whole document here, so this
// file must render its own <html> and <body> and cannot rely on the root
// layout, providers, fonts or global CSS being present.
//
// It is deliberately dependency-free and self-styled — no imports beyond React.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#f4f8ff",
          color: "#0f172a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <main
          style={{             width: "100%",
            maxWidth: "30rem",
            textAlign: "center",
            background: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(226,232,240,0.9)",
            borderRadius: "1.5rem",
            padding: "2.5rem",
            boxShadow: "0 24px 60px -32px rgba(15,23,42,0.35)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Lỗi hệ thống
          </p>
          <h1 style={{ margin: "0.5rem 0 0.75rem", fontSize: "1.5rem", fontWeight: 800 }}>
            Belwee đang gặp sự cố
          </h1>
          {/* The paw is the only branding available here: this boundary replaces
              the entire document, so the font, palette and logo from the root
              layout are all gone. Inline text is the honest minimum. */}
          <p style={{ margin: "0 0 1rem", fontSize: "2.5rem", lineHeight: 1 }} aria-hidden="true">
            🐾
          </p>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", lineHeight: 1.7, color: "#334155" }}>
            Ứng dụng gặp lỗi không mong muốn. Vui lòng tải lại trang. Nếu tình trạng
            này tiếp diễn, hãy liên hệ phòng khám.
          </p>
          <p
            style={{
              margin: "0 0 2rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#1e293b",
            }}
          >
            Bé cưng của bạn vẫn an toàn — nếu cần khám gấp, hãy gọi hotline 24/7.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "9999px",
                background: "#0f172a",
                color: "#ffffff",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 700,
              }}
            >
              Thử lại
            </button>
            <a
              href="/"
              style={{
                borderRadius: "9999px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Về trang chủ
            </a>
          </div>

          {error.digest ? (
            <p style={{ margin: "2rem 0 0", fontSize: "0.7rem", color: "#94a3b8" }}>
              Mã lỗi: <span style={{ fontFamily: "ui-monospace, monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
