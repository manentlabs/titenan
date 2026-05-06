"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Memuat profil...</p>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (showPasswordFields && password !== confirmPassword) {
      setMessage({ type: "error", text: "Password dan konfirmasi password tidak cocok." });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          ...(showPasswordFields && password ? { password } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal update profil");

      await update({ name, email });
      setMessage({ type: "success", text: "Profil berhasil diperbarui!" });
      setShowPasswordFields(false);
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <button onClick={() => router.back()} style={styles.backBtn}>← Kembali</button>
          <h1 style={styles.title}>Edit Profil</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showPasswordFields}
                onChange={(e) => setShowPasswordFields(e.target.checked)}
              />
              <span>Ganti password</span>
            </label>
          </div>

          {showPasswordFields && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Password Baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                />
              </div>
            </>
          )}

          {message && (
            <div style={{ ...styles.message, ...(message.type === "error" ? styles.errorMsg : styles.successMsg) }}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#f8f8f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'Outfit', sans-serif",
  },
  card: {
    maxWidth: 500,
    width: "100%",
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
    padding: "32px 28px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 14,
    color: "#6366f1",
    cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    padding: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: "#6b7280",
    cursor: "pointer",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "'Outfit', sans-serif",
    outline: "none",
    transition: "all 0.2s",
  },
  button: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  message: {
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    textAlign: "center",
  },
  successMsg: {
    background: "rgba(16,185,129,0.1)",
    color: "#059669",
    border: "1px solid rgba(16,185,129,0.2)",
  },
  errorMsg: {
    background: "rgba(239,68,68,0.1)",
    color: "#dc2626",
    border: "1px solid rgba(239,68,68,0.2)",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 12,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "2px solid rgba(0,0,0,0.1)",
    borderTopColor: "#6366f1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};