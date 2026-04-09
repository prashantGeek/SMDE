import { CheckCircle, AlertCircle, FileText, Download } from "lucide-react";

const META_KEYS = new Set([
  "id",
  "sessionId",
  "fileName",
  "s3Url",
  "documentType",
  "applicableRole",
  "category",
  "confidence",
  "processingTimeMs",
  "isExpired",
  "status",
  "flags",
]);

function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

function hasDisplayValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function renderPrimitive(value: any): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export default function DocumentCard({ doc }: { doc: any }) {
  const getConfidenceColor = (conf: string) => {
    if (conf === "HIGH") return "bg-green-100 text-green-800";
    if (conf === "MEDIUM") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const hasIssues =
    doc.isExpired ||
    doc.flags?.some((f: any) => ["CRITICAL", "HIGH", "MEDIUM"].includes(String(f.severity || "").toUpperCase()));

  const extractedEntries = Object.entries(doc || {}).filter(
    ([key, value]) => !META_KEYS.has(key) && hasDisplayValue(value)
  );

  const renderNode = (value: any, path: string, depth = 0): React.ReactNode => {
    if (!hasDisplayValue(value)) {
      return <span className="text-xs text-slate-400">-</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={`${path}-${index}`}
              className={`rounded p-2 text-xs border ${depth > 0 ? "bg-slate-50 border-slate-200" : "bg-white border-slate-100"}`}
            >
              <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Item {index + 1}</div>
              {renderNode(item, `${path}-${index}`, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value).filter(([, childValue]) => hasDisplayValue(childValue));
      if (entries.length === 0) {
        return <span className="text-xs text-slate-400">-</span>;
      }

      return (
        <div className="space-y-1">
          {entries.map(([childKey, childValue]) => (
            <div key={`${path}-${childKey}`} className="grid grid-cols-[140px_1fr] gap-2 text-xs">
              <span className="text-slate-500 font-semibold uppercase text-[10px] pt-0.5">{formatKey(childKey)}</span>
              <div className="text-slate-800 wrap-break-word">{renderNode(childValue, `${path}-${childKey}`, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-xs text-slate-800 wrap-break-word">{renderPrimitive(value)}</span>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col mb-4 transition-all">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-slate-500 w-4 h-4" />
              {doc.documentType || "Document"} <span className="text-xs font-medium text-slate-500">({doc.category || "CATEGORY"})</span>
            </h3>
            {hasIssues ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">ISSUES</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">CLEAR</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {doc.fileName} {doc.applicableRole ? <>• Role: <span className="font-semibold text-slate-700">{doc.applicableRole}</span></> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc.s3Url && (
            <a
              href={doc.s3Url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded text-[11px] font-bold transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
          <div className={`px-2 py-1 rounded-md border text-[10px] font-bold shadow-sm ${getConfidenceColor(doc.confidence)} border-opacity-20`}>
            {doc.confidence || "LOW"} CONFIDENCE
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Extracted Data</h4>
        {extractedEntries.length === 0 ? (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded p-3">No extracted fields available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extractedEntries.map(([key, value]) => (
              <section key={key} className="bg-slate-50 rounded-md p-3 border border-slate-100">
                <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide mb-2">{formatKey(key)}</h5>
                {renderNode(value, key)}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1">Flags & Anomalies</h4>
        {!doc.flags || doc.flags.length === 0 ? (
          <p className="text-xs text-green-700 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> No issues detected
          </p>
        ) : (
          <ul className="space-y-1">
            {doc.flags.map((flag: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-100 shadow-sm leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs mr-2 text-slate-700">{flag.severity || "INFO"}</span>
                  <span className="text-slate-700">{flag.message}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
