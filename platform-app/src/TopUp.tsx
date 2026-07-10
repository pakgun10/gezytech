import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  amount: number;
  status: "pending" | "success" | "rejected";
  reference: string;
  createdAt: number;
}

const PRESETS = [50000, 100000, 200000, 500000];

export function TopUp() {
  const [amount, setAmount] = useState<number>(100000);
  const [custom, setCustom] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = () => {
    fetch("/api/topup/history")
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []));
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const submit = async () => {
    const final = custom ? Number(custom) : amount;
    if (!final || final < 1000) return alert("Minimum topup Rp 1.000");
    setLoading(true);
    try {
      const res = await fetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: final }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Topup failed");
      setCustom("");
      fetchHistory();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtMoney = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const fmtDate = (ts: number) => new Date(ts).toLocaleString("id-ID");

  return (
    <div>
      <h1 className="page-title">Top Up Saldo</h1>

      <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <h3 className="card-title">Pilih Nominal</h3>
        <div className="amount-options">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`btn ${amount === p && !custom ? "btn-primary" : "btn-outline"}`}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
            >
              {fmtMoney(p)}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label>Nominal Lain</label>
          <input
            className="input"
            type="number"
            placeholder="Masukkan nominal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Memproses..." : "Request Top Up"}
        </button>

        <div className="rekening-box">
          <strong>Transfer ke:</strong>
          <div>Bank BCA - 1234567890 a.n PT GezyTech</div>
          <div style={{ marginTop: 6 }}>Masukkan kode referensi di berita transfer.</div>
        </div>
      </div>

      <h2 className="section-title">Riwayat Top Up</h2>
      {transactions.length === 0 ? (
        <div className="empty">Belum ada topup.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Referensi</th>
              <th>Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.createdAt)}</td>
                <td><code>{t.reference}</code></td>
                <td>{fmtMoney(t.amount)}</td>
                <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
