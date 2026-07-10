import { useEffect, useMemo, useState } from "react";

interface BillingRow {
  id: string;
  type: "topup" | "usage";
  amount: number;
  status: string;
  reference: string | null;
  createdAt: number;
}

export function Billing() {
  const [transactions, setTransactions] = useState<BillingRow[]>([]);
  const [filter, setFilter] = useState<"all" | "topup" | "usage">("all");

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  const fmtMoney = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const fmtDate = (ts: number) => new Date(ts).toLocaleString("id-ID");

  const exportCsv = () => {
    const rows = [
      ["Tanggal", "Tipe", "Jumlah", "Status", "Referensi"].join(","),
      ...filtered.map((t) =>
        [fmtDate(t.createdAt), t.type, t.amount, t.status, t.reference ?? ""].join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="user-bar">
        <h1 className="page-title" style={{ margin: 0 }}>Billing</h1>
        <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        {(["all", "topup", "usage"] as const).map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Semua" : f === "topup" ? "Top Up" : "Pemakaian"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Tidak ada transaksi.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Jumlah</th>
              <th>Status</th>
              <th>Referensi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.createdAt)}</td>
                <td>
                  <span className={`badge badge-${t.type === "topup" ? "pending" : "usage"}`}>
                    {t.type === "topup" ? "Top Up" : "Pemakaian"}
                  </span>
                </td>
                <td>{fmtMoney(t.amount)}</td>
                <td>{t.status}</td>
                <td>{t.reference ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
