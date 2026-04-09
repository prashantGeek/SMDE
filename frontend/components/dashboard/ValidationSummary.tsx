import { AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { ValidationCheck, ValidationReport } from "../../lib/dashboardTypes";

type ValidationSummaryProps = {
  report: ValidationReport;
};

export default function ValidationSummary({ report }: ValidationSummaryProps) {
  return (
    <>
      <div
        className={`p-6 rounded-2xl border-2 shadow-sm flex items-start gap-5 ${
          report.overallStatus === "REJECTED"
            ? "bg-red-50 border-red-500 text-red-900"
            : report.overallStatus === "APPROVED"
              ? "bg-green-50 border-green-500 text-green-900"
              : "bg-amber-50 border-amber-500 text-amber-900"
        }`}
      >
        <ShieldAlert
          className={`w-10 h-10 mt-1 ${
            report.overallStatus === "REJECTED"
              ? "text-red-600"
              : report.overallStatus === "APPROVED"
                ? "text-green-600"
                : "text-amber-600"
          }`}
        />
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight">{report.overallStatus}</h2>
          <p className="text-lg font-bold opacity-80 mt-1">
            {report.overallStatus === "REJECTED"
              ? "Critical compliance issue detected"
              : report.overallStatus === "APPROVED"
                ? ""
                : "Requires manual review"}
          </p>
          {report.overallStatus === "REJECTED" && (
            <div className="mt-4 text-red-800 font-medium bg-white/50 p-4 rounded-lg border border-red-200">
              {report.missingDocuments?.map((m: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Missing required document: {m}
                </div>
              ))}
              {report.expiringDocuments?.map((m: { documentType?: string; isExpired?: boolean }, i: number) =>
                m.isExpired ? (
                  <div key={i} className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {m.documentType} is expired
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide flex items-center gap-2">Full Compliance Findings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-extrabold mb-2 tracking-widest">Actionable Recommendations</span>
              <ul className="space-y-2">
                {report.recommendations?.map((r: string, i: number) => (
                  <li key={i} className="text-xs font-bold text-gray-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100 border-l-4 border-l-blue-600 shadow-sm">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-extrabold mb-2 tracking-widest">AI Consistency Checks</span>
              <ul className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
                {report.consistencyChecks?.map((chk: ValidationCheck, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-bold border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                    {chk.isConsistent === true || chk.status === "OK" || chk.status === "PASSED" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <span className="text-gray-800 leading-snug">{chk.description || chk.message || JSON.stringify(chk)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
