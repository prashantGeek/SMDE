import { CheckCircle, AlertCircle, Clock, ShieldAlert, FileText, User } from "lucide-react";

export default function DocumentCard({ doc }: { doc: any }) {
  const getStatusColor = (status: string) => {
    if (status === 'OK' || status === 'VALID') return 'text-green-700 bg-green-100';
    if (status === 'WARNING') return 'text-amber-700 bg-amber-100';
    if (status === 'EXPIRED' || status === 'MISSING' || status === 'FAILED') return 'text-red-700 bg-red-100';
    return 'text-gray-700 bg-gray-100';
  };

  const getConfidenceColor = (conf: string) => {
    if (conf === 'HIGH') return 'bg-green-100 text-green-800';
    if (conf === 'MEDIUM') return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const isExpired = doc.isExpired || doc.validity?.isExpired || (doc.validity?.daysUntilExpiry !== undefined && doc.validity?.daysUntilExpiry !== null && doc.validity?.daysUntilExpiry <= 0) || doc.flags?.some((f: any) => f.message?.toLowerCase().includes('expired'));

  const borderColor = isExpired ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : 'border-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]';

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden flex flex-col mb-6 transition-all ${borderColor}`}>
      
      {/* 1. Header Section */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-3">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-slate-500 w-5 h-5"/>
                {doc.documentType} <span className="text-sm font-medium text-slate-500">({doc.category || 'CATEGORY'})</span>
             </h3>
             {isExpired ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">EXPIRED</span>
             ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">VALID</span>
             )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{doc.fileName} • Role: <span className="font-semibold text-slate-700">{doc.applicableRole}</span></p>
        </div>
        <div className={`px-2.5 py-1 rounded text-xs font-bold ${getConfidenceColor(doc.confidence)}`}>
          {doc.confidence} CONFIDENCE
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="space-y-6">
          {/* 5. Validity Section */}
          {(doc.validity && typeof doc.validity === 'object' && Object.keys(doc.validity).length > 0) && (
          <section className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-slate-500"/> Validity
            </h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
               <div><span className="text-slate-500 block text-xs">Issued On</span><span className="font-medium">{doc.validity.dateOfIssue || '—'}</span></div>
               <div><span className="text-slate-500 block text-xs">Expires On</span><span className="font-medium text-slate-900 font-bold">{doc.validity.dateOfExpiry || '—'}</span></div>
               
               {doc.validity.daysUntilExpiry !== undefined && doc.validity.daysUntilExpiry !== null && (
                 <div className="col-span-2 flex items-center gap-2 mt-2">
                   <div className={`w-3 h-3 rounded-full ${doc.validity.daysUntilExpiry <= 0 ? 'bg-red-500' : doc.validity.daysUntilExpiry < 90 ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                   <span className="font-semibold text-slate-700">
                     {doc.validity.daysUntilExpiry <= 0 ? 'Expired' : `${doc.validity.daysUntilExpiry} days until expiry`}
                   </span>
                 </div>
               )}
            </div>
          </section>
          )}

          {/* 6. Compliance Info */}
          {(doc.compliance && typeof doc.compliance === 'object') && (
           <section className="bg-slate-50 rounded-lg p-4 border border-slate-100">
             <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
               <ShieldAlert className="w-4 h-4 text-slate-500"/> Compliance
             </h4>
             <div className="grid grid-cols-1 gap-y-2 text-sm">
                <div><span className="text-slate-500 inline-block w-32">Authority:</span><span className="font-medium">{doc.compliance.issuingAuthority || '—'}</span></div>
                <div><span className="text-slate-500 inline-block w-32">Recognized:</span><span className="font-medium">{doc.compliance.recognizedAuthority ? 'Yes' : 'No'}</span></div>
                {doc.compliance.limitations && <div><span className="text-slate-500 inline-block w-full">Limitations:</span><span className="font-medium text-amber-700">{doc.compliance.limitations}</span></div>}
             </div>
           </section>
          )}

        </div>

        <div className="space-y-6">
          {/* 3. Medical Summary (Highlight if present) */}
          {(doc.medicalData && typeof doc.medicalData === 'object' && Object.keys(doc.medicalData).length > 0) && (
            <section className="bg-blue-50/50 rounded-lg p-5 border border-blue-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
               <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                 Medical Summary
               </h4>
               <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="bg-white p-3 rounded border border-blue-100">
                    <span className="text-slate-500 block text-xs mb-1">Fitness Status</span>
                    <span className={`font-bold ${doc.medicalData.fitnessResult?.toUpperCase() === 'FIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {doc.medicalData.fitnessResult === 'FIT' ? '✅ FIT' : (doc.medicalData.fitnessResult || 'N/A')}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded border border-blue-100">
                    <span className="text-slate-500 block text-xs mb-1">Drug Test</span>
                    <span className={`font-bold ${doc.medicalData.drugTestResult?.toUpperCase() === 'NEGATIVE' ? 'text-green-600' : 'text-red-600'}`}>
                      {doc.medicalData.drugTestResult === 'NEGATIVE' ? '✅ NEGATIVE' : (doc.medicalData.drugTestResult || 'N/A')}
                    </span>
                  </div>
               </div>
               
               {doc.medicalData.restrictions && doc.medicalData.restrictions !== 'N/A' && (
                 <div className="mb-2"><span className="text-sm font-semibold text-slate-700">Restrictions:</span> <span className="text-sm text-slate-600">{doc.medicalData.restrictions}</span></div>
               )}
               {doc.medicalData.specialNotes && doc.medicalData.specialNotes !== 'N/A' && (
                 <div><span className="text-sm font-semibold text-slate-700">Notes:</span> <span className="text-sm text-slate-600">{doc.medicalData.specialNotes}</span></div>
               )}
            </section>
          )}

          {/* 4. Extracted Fields grouped by Importance */}
          {doc.fields && doc.fields.length > 0 && (
            <section>
              <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Extracted Information</h4>
              <div className="space-y-4">
                {/* Group 1: Critical Fields */}
                {doc.fields.filter((f: any) => f.importance === 'CRITICAL').length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3"/> Critical Fields
                    </h5>
                    <div className="bg-white border-l-2 border-red-500 rounded-r-lg shadow-sm">
                      <table className="w-full text-sm text-left">
                        <tbody>
                          {doc.fields.filter((f: any) => f.importance === 'CRITICAL').map((f: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-800 w-1/3">
                                {f.label}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{f.value || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(f.status)}`}>{f.status || 'OK'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Group 2: Important Fields */}
                {doc.fields.filter((f: any) => f.importance === 'HIGH' || f.importance === 'MEDIUM').length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-amber-600 uppercase mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3"/> Important Fields
                    </h5>
                    <div className="bg-white border-l-2 border-amber-400 rounded-r-lg shadow-sm">
                      <table className="w-full text-sm text-left">
                        <tbody>
                          {doc.fields.filter((f: any) => f.importance === 'HIGH' || f.importance === 'MEDIUM').map((f: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-700 w-1/3 flex items-center gap-2">
                                {f.label}
                                {f.importance === 'HIGH' && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold">HIGH</span>}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">{f.value || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(f.status)}`}>{f.status || 'OK'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Group 3: Additional Info (LOW) */}
                {doc.fields.filter((f: any) => !['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.importance)).length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Additional Info</h5>
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                      <table className="w-full text-sm text-left">
                        <tbody>
                          {doc.fields.filter((f: any) => !['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.importance)).map((f: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-600 w-1/3">{f.label}</td>
                              <td className="px-3 py-2 text-slate-700">{f.value || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 7. Flags Section */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
         <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">Flags & Anomalies</h4>
         {(!doc.flags || doc.flags.length === 0) ? (
           <p className="text-sm text-green-700 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4"/> No issues detected</p>
         ) : (
           <ul className="space-y-2">
             {doc.flags.map((flag: any, i: number) => (
               <li key={i} className="flex items-start gap-2 text-sm bg-white p-2 rounded border border-slate-100 shadow-sm">
                  {flag.severity === 'CRITICAL' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0"/>}
                  {flag.severity === 'HIGH' && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0"/>}
                  {flag.severity === 'MEDIUM' && <AlertCircle className="w-5 h-5 text-amber-500 shrink-0"/>}
                  {flag.severity !== 'CRITICAL' && flag.severity !== 'HIGH' && flag.severity !== 'MEDIUM' && <AlertCircle className="w-5 h-5 text-blue-500 shrink-0"/>}
                  <div>
                    <span className={`font-bold text-xs mr-2 ${flag.severity === 'CRITICAL' ? 'text-red-700' : flag.severity === 'HIGH' ? 'text-amber-700' : 'text-slate-600'}`}>{flag.severity}</span>
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
