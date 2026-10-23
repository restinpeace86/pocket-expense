import type { DocField, DocModel } from "@/lib/forms/layout";

// 지출결의서 문서 모양(화면용) — PDF(src/lib/tax/pdf-client.ts)와 같은 문서 모델을 그린다 (D-118, form-template.md §5)
// 좁은 화면에서는 문서 안에서만 가로로 밀어 본다(페이지는 넘치지 않음).
function Fields({ fields }: { fields: DocField[] }) {
  if (!fields.length) return null;
  const rows: DocField[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (!f.wide && last && last.length === 1 && !last[0].wide) last.push(f);
    else rows.push([f]);
  }
  return (
    <div className="border-l border-t border-zinc-400">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2">
          {row.map((f, k) => (
            <div key={k} className={`flex border-b border-r border-zinc-400 ${row.length === 1 && f.wide ? "col-span-2" : ""}`}>
              <div className="flex w-24 shrink-0 items-center justify-center bg-zinc-100 px-1.5 py-1.5 text-center text-[11px] text-zinc-600">{f.label}</div>
              <div className="min-w-0 flex-1 border-l border-zinc-400 px-2 py-1.5 text-xs whitespace-pre-wrap text-zinc-900">{f.value || "-"}</div>
            </div>
          ))}
          {row.length === 1 && !row[0].wide && <div className="border-b border-r border-zinc-400" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

export function ClaimDocument({ model }: { model: DocModel }) {
  const t = model.table;
  const sumW = t.cols.reduce((s, c) => s + c.w, 0);
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm" data-testid="claim-document">
      <article className="flex min-w-[520px] flex-col gap-3 p-5 text-zinc-900">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-wide">{model.title}</h3>
            <p className="text-xs text-zinc-500">{model.company}</p>
          </div>
          <div className="flex shrink-0">
            {model.approval.map((a, i) => (
              <div key={i} className="w-16 border border-zinc-400 text-center [&+&]:border-l-0">
                <div className="border-b border-zinc-400 py-0.5 text-[10px] text-zinc-500">{a.label}</div>
                <div className="px-1 pt-1 text-[11px] font-semibold">{a.name}</div>
                <div className="px-1 pb-1 text-[10px] text-zinc-600">{a.status}</div>
              </div>
            ))}
          </div>
        </header>
        <Fields fields={model.header} />
        <table className="w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            {t.cols.map((c, i) => (
              <col key={i} style={{ width: `${(c.w / sumW) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-brand-50">
              {t.cols.map((c, i) => (
                <th key={i} className="border border-zinc-300 px-1 py-1 text-center font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className={r.dim ? "text-zinc-400" : ""}>
                {r.cells.map((v, k) => (
                  <td key={k} className={`border border-zinc-300 px-1 py-1 align-top break-words ${t.cols[k].right ? "text-right tabular-nums" : ""}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {t.total && (
              <tr className="font-semibold">
                {t.total.map((v, k) => (
                  <td key={k} className={`border border-zinc-300 px-1 py-1 ${t.cols[k].right ? "text-right tabular-nums" : ""}`}>
                    {v}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
        <Fields fields={model.footer} />
        {model.dimNote && <p className="text-[11px] text-zinc-500">{model.dimNote}</p>}
        {(model.statement || model.date || model.signer || model.companyLine) && (
          <footer className="mt-2 flex flex-col items-center gap-2 text-center text-sm">
            {model.statement && <p>{model.statement}</p>}
            {model.date && <p>{model.date}</p>}
            {model.signer && <p>{model.signer}</p>}
            {model.companyLine && <p className="text-base font-bold">{model.companyLine}</p>}
          </footer>
        )}
      </article>
    </div>
  );
}
