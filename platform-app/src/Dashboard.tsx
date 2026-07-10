import { useEffect, useState } from "react";

interface DashboardData {
  balance: number;
  usageThisMonth: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  pendingTopups: {
    count: number;
    amount: number;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="loading">Memuat dashboard...</div>;

  const fmtMoney = (n: number) =>
    "Rp " + n.toLocaleString("id-ID");

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="grid-3">
        <div className="card">
          <h3 className="card-title">Saldo</h3>
          <p className="card-value">{fmtMoney(data.balance)}</p>
          <p className="card-sub">Topup pending: {data.pendingTopups.count} ({fmtMoney(data.pendingTopups.amount)})</p>
        </div>
        <div className="card">
          <h3 className="card-title">Token Bulan Ini</h3>
          <p className="card-value">{data.usageThisMonth.total.toLocaleString("id-ID")}</p>
          <p className="card-sub">Input {data.usageThisMonth.input.toLocaleString("id-ID")} · Output {data.usageThisMonth.output.toLocaleString("id-ID")}</p>
        </div>
        <div className="card">
          <h3 className="card-title">Estimasi Biaya</h3>
          <p className="card-value">{fmtMoney(data.usageThisMonth.cost)}</p>
          <p className="card-sub">Berdasarkan pricing config</p>
        </div>
      </div>

      <h2 className="section-title">Grafik Pemakaian (placeholder)</h2>
      <div className="chart-placeholder">Chart usage bulanan akan tampil di sini</div>
    </div>
  );
}
