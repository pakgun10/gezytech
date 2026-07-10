import { useEffect, useMemo, useState } from "react";

interface UsageRow {
  date: number;
  input: number;
  output: number;
  total: number;
  cost: number;
}

export function Usage() {
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: start.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  });
  const [usage, setUsage] = useState<UsageRow[]>([]);

  useEffect(() => {
    fetch(`/api/usage?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((data) => setUsage(data.usage ?? []));
  }, [range]);

  const totals = useMemo(() => {
    return usage.reduce(
      (acc, row) => ({
        input: acc.input + row.input,
        output: acc.output + row.output,
        total: acc.total + row.total,
        cost: acc.cost + row.cost,
      }),
      { input: 0, output: 0, total: 0, cost: 0 },
    );
  }, [usage]);

  const fmtMoney = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("id-ID");

  const setPreset = (preset: "today" | "week" | "month") => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from: string;
    if (preset === "today") {
      from = to;
    } else if (preset === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      from = d.toISOString().slice(0, 10);
    }
    setRange({ from, to });
  };

  return (
    <div>
      <h1 className="page-title">Pemakaian</h1>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <button className="btn btn-outline" onClick={() => setPreset("today")}>Hari ini</button>
        <button className="btn btn-outline" onClick={() => setPreset("week")}>7 hari</button>
        <button className="btn btn-outline" onClick={() => setPreset("month")}>Bulan ini</button>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Dari</label>
          <input
            className="input"
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Sampai</label>
          <input
            className="input"
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card"><h3 className="card-title">Total Token</h3><p className="card-value">{totals.total.toLocaleString("id-ID")}</p></div>
        <div className="card"><h3 className="card-title">Input / Output</h3><p className="card-value">{totals.input.toLocaleString("id-ID")} / {totals.output.toLocaleString("id-ID")}</p></div>
        <div className="card"><h3 className="card-title">Estimasi Biaya</h3><p className="card-value">{fmtMoney(totals.cost)}</p></div>
      </div>

      <h2 className="section-title">Detail Harian</h2>
      {usage.length === 0 ? (
        <div className="empty">Tidak ada data pemakaian di rentang ini.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Input</th>
              <th>Output</th>
              <th>Total</th>
              <th>Estimasi Biaya</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((row) => (
              <tr key={row.date}>
                <td>{fmtDate(row.date)}</td>
                <td>{row.input.toLocaleString("id-ID")}</td>
                <td>{row.output.toLocaleString("id-ID")}</td>
                <td>{row.total.toLocaleString("id-ID")}</td>
                <td>{fmtMoney(row.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
