"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { UploadCloud, CheckCircle, FileText, AlertCircle, RefreshCw, ShieldAlert, User, Clock, Plus, Trash2 } from "lucide-react";
import DocumentCard from "../components/DocumentCard";

export default function Home() {
  const [sessions, setSessions] = useState<{id: string, candidateName: string, role: string, createdAt: string}[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [mode, setMode] = useState("async");
  const [health, setHealth] = useState("OK");
  const [detectedRole, setDetectedRole] = useState("UNKNOWN");

  const fetchAllSessions = async () => {
    try {
      const res = await axios.get("/api/sessions");
      setSessions(res.data);
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  };

  useEffect(() => {
    fetchAllSessions();
  }, []);

  const fetchSession = async (id: string) => {
    try {
      const res = await axios.get(`/api/sessions/${id}`);
      setDocuments(res.data.documents || []);
      setHealth(res.data.overallHealth || "OK");
      setDetectedRole(res.data.detectedRole || "UNKNOWN");
      setReport(res.data.validationResult || null);
      fetchAllSessions(); // refresh the sidebar list in case names updated
    } catch (e) {
      console.error("Failed to fetch session:", e);
    }
  };

  const handleCreateNewUser = () => {
    setSessionId(null);
    setDocuments([]);
    setReport(null);
    setHealth("OK");
    setDetectedRole("UNKNOWN");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);

    const files = Array.from(e.target.files);
    let currentSessionId = sessionId;

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("document", file);
        if (currentSessionId) {
          formData.append("sessionId", currentSessionId);
        }

        const res = await axios.post(`/api/extract?mode=${mode}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (mode === "sync" || res.headers["x-deduplicated"]) {
          currentSessionId = res.data.sessionId;
          setSessionId(currentSessionId);
          await fetchSession(currentSessionId!);
        } else {
          const jobRes = res.data;
          currentSessionId = jobRes.sessionId;
          setSessionId(currentSessionId);
          if (jobRes.jobId) {
            setProcessingSessionId(currentSessionId);
            pollJob(jobRes.jobId, jobRes.sessionId);
          } else {
            await fetchSession(jobRes.sessionId);
          }
        }
      }
    } catch (error: any) {
      console.error("Upload failed", error);
      alert(error.response?.data?.error || "Failed to upload document");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const pollJob = async (jobId: string, sid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/jobs/${jobId}`);
        if (res.data.status === "COMPLETE" || res.data.status === "FAILED") {
          clearInterval(pollInterval);
          await fetchSession(sid);
          setProcessingSessionId((prev) => prev === sid ? null : prev);
        }
      } catch (e) {
        clearInterval(pollInterval);
        console.error("Polling failed", e);
        setProcessingSessionId((prev) => prev === sid ? null : prev);
      }
    }, 3000);
  };

  const handleValidate = async () => {
    if (!sessionId) return;
    setIsValidating(true);
    try {
      const res = await axios.post(`/api/sessions/${sessionId}/validate`);
      setReport(res.data);
    } catch (error) {
      console.error("Validation failed", error);
      alert("Validation failed. Are there enough documents?");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to completely delete this candidate and their documents? This cannot be undone.")) return;

    try {
      await axios.delete(`/api/sessions/${id}`);
      if (sessionId === id) handleCreateNewUser();
      fetchAllSessions();
    } catch (err: any) {
      console.error("Failed to delete session", err);
      alert("Failed to delete the candidate.");
    }
  };

  const seafarer = {
    name: documents.find(d => d.holderName)?.holderName || '—',
    dob: documents.find(d => d.dateOfBirth)?.dateOfBirth || '—',
    nationality: documents.find(d => d.nationality)?.nationality || '—',
    sirb: documents.find(d => d.sirbNumber)?.sirbNumber || '—',
    role: detectedRole !== 'UNKNOWN' ? detectedRole : (documents.find(d => d.applicableRole && d.applicableRole !== 'N/A')?.applicableRole || '—'),
  };

  const isDocExpired = (d: any) => {
    if (d.isExpired) return true;
    if (d.validity?.isExpired) return true;
    if (d.validity?.daysUntilExpiry !== null && d.validity?.daysUntilExpiry !== undefined && d.validity?.daysUntilExpiry <= 0) return true;
    if (d.flags?.some((f: any) => f.message?.toLowerCase().includes('expired'))) return true;
    return false;
  };

  const criticalIssues: string[] = [];
  documents.forEach(doc => {
    if (isDocExpired(doc)) criticalIssues.push(`[${doc.documentType}] Document is expired`);
    doc.flags?.forEach((flag: any) => {
      if (flag.severity === 'CRITICAL') {
        criticalIssues.push(`[${doc.documentType}] ${flag.message}`);
      }
    });
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex overflow-hidden">
      <aside className="w-[340px] bg-white border-r border-gray-200 h-screen flex flex-col shrink-0 sticky top-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-900 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="text-blue-300 w-6 h-6"/> Candidates Directory
          </h2>
        </div>
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <button 
            onClick={handleCreateNewUser}
            className="w-full py-3 px-4 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl border-2 border-blue-200 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create New Candidate
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {sessions.length === 0 ? (
            <div className="text-center text-sm text-gray-400 mt-4">No candidates yet</div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => { setSessionId(s.id); fetchSession(s.id); }}
                className={`group p-4 rounded-xl cursor-pointer border-2 transition-all relative ${
                  sessionId === s.id 
                  ? 'border-blue-500 bg-white shadow-md transform scale-[1.02]' 
                  : 'border-transparent bg-white shadow-sm hover:border-blue-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="font-bold text-gray-800 truncate text-base pr-2">{s.candidateName}</div>
                  <button 
                    onClick={(e) => handleDeleteSession(s.id, e)} 
                    title="Delete Candidate"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-wider bg-blue-50 inline-block px-2 py-0.5 rounded">{s.role}</div>
                <div className="text-xs text-gray-400 mt-3 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" /> {(new Date(s.createdAt)).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto h-screen bg-gray-100 relative">
        <header className="bg-white border-b border-gray-200 px-8 py-5 sticky top-0 z-40 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl flex items-center font-bold text-slate-800 gap-2 tracking-tight">
              <FileText className="text-blue-600" /> SMDE Dashboard
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Smart Maritime Document Extractor</p>
          </div>
        </header>

        <main className="max-w-5xl mx-auto py-8 px-8 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">
                  {sessionId ? "Upload to current candidate" : "Start a new candidate"}
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-1">Drop a new document to automatically append it</p>
              </div>
              <select value={mode} onChange={e => setMode(e.target.value)} className="bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm font-bold rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-blue-400 transition-colors">
                <option value="sync">Sync Mode</option>
                <option value="async">Async Mode</option>
              </select>
            </div>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 transition-all">
              <div className="flex flex-col items-center justify-center">
                {isUploading ? <RefreshCw className="w-8 h-8 text-blue-500 mb-3 animate-spin"/> : <UploadCloud className="w-8 h-8 text-blue-500 mb-3" />}
                <span className="text-base text-blue-700 font-bold">{isUploading ? "Uploading..." : "Select File (PDF/Image)"}</span>
              </div>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" disabled={isUploading || (processingSessionId === sessionId && sessionId !== null)} />
            </label>
            
            {processingSessionId === sessionId && sessionId !== null && (
              <div className="flex items-center justify-center gap-3 p-4 bg-indigo-50 border border-indigo-200 shadow-sm rounded-xl mt-4">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                <span className="text-indigo-800 font-bold text-sm tracking-wide">Processing Document Async... This may take a few seconds.</span>
              </div>
            )}
          </div>

          {!sessionId && documents.length === 0 ? (
             <div className="flex flex-col border-2 border-dashed border-gray-300 bg-white items-center justify-center py-32 rounded-2xl text-gray-500 shadow-sm">
                <User className="w-20 h-20 text-gray-300 mb-6" />
                <h3 className="text-2xl font-bold text-gray-700 mb-2">No Candidate Selected</h3>
                <p className="mt-2 text-center max-w-md text-gray-500 font-medium">Select a candidate from the sidebar, or upload a document to instantly create a new candidate session workspace.</p>
             </div>
          ) : (
            <>
              {report && (
                <div className={`p-6 rounded-2xl border-2 shadow-sm flex items-start gap-5 ${
                  report.overallStatus === 'REJECTED' ? 'bg-red-50 border-red-500 text-red-900' :
                  report.overallStatus === 'APPROVED' ? 'bg-green-50 border-green-500 text-green-900' :
                  'bg-amber-50 border-amber-500 text-amber-900'
                }`}>
                  <ShieldAlert className={`w-10 h-10 mt-1 ${
                    report.overallStatus === 'REJECTED' ? 'text-red-600' :
                    report.overallStatus === 'APPROVED' ? 'text-green-600' : 'text-amber-600'
                  }`} />
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tight">
                      {report.overallStatus}
                    </h2>
                    <p className="text-lg font-bold opacity-80 mt-1">
                      {report.overallStatus === 'REJECTED' ? 'Critical compliance issue detected' :
                       report.overallStatus === 'APPROVED' ? 'Cleared for deployment' : 'Requires manual review'}
                    </p>
                    {report.overallStatus === 'REJECTED' && (
                      <div className="mt-4 text-red-800 font-medium bg-white/50 p-4 rounded-lg border border-red-200">
                        {report.missingDocuments?.map((m: string, i: number) => (
                          <div key={i} className="flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Missing required document: {m}</div>
                        ))}
                        {report.expiringDocuments?.map((m: any, i: number) => (
                          m.isExpired && <div key={i} className="flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {m.documentType} is expired</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {report && (
                <div className="grid grid-cols-1 gap-6 mb-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide flex items-center gap-2">
                      ⚖️ Full Compliance Findings
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                         <span className="text-gray-500 block text-[10px] uppercase font-extrabold mb-2 tracking-widest">Actionable Recommendations</span>
                         <ul className="space-y-2">
                           {report.recommendations?.map((r: string, i: number) => (
                             <li key={i} className="text-xs font-bold text-gray-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100 border-l-4 border-l-blue-600 shadow-sm">{r}</li>
                           ))}
                         </ul>
                       </div>
                       <div>
                          <span className="text-gray-500 block text-[10px] uppercase font-extrabold mb-2 tracking-widest">AI Consistency Checks</span>
                          <ul className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
                            {report.consistencyChecks?.map((chk: any, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs font-bold border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                                {chk.isConsistent === true || chk.status === 'OK' || chk.status === 'PASSED' ? (
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
              )}

              {documents.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
                <h2 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide flex items-center gap-2">
                  👤 Candidate Unified Profile
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-gray-50 border border-gray-100 p-2 rounded shadow-sm md:col-span-2"><span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Full Legal Name</span><span className="font-extrabold text-gray-900 text-sm">{seafarer.name}</span></div>
                  <div className="bg-gray-50 border border-gray-100 p-2 rounded shadow-sm"><span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Target Role</span><span className="font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded inline-block text-xs">{seafarer.role}</span></div>
                  <div className="p-1"><span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Date of Birth</span><span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.dob}</span></div>
                  <div className="p-1"><span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Nationality</span><span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.nationality}</span></div>
                  <div className="p-1 md:col-span-2"><span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">SIRB Identity Number</span><span className="font-bold text-gray-900 text-xs leading-tight">{seafarer.sirb}</span></div>
                </div>
                {documents.some(d => d.holderName && d.holderName !== seafarer.name) && (
                  <div className="mt-3 text-amber-800 bg-amber-50 p-2 rounded text-xs font-bold flex items-center gap-2 border border-amber-200 shadow-sm">
                    <AlertCircle className="w-4 h-4"/> Name mismatch detected deeply across different documents!
                  </div>
                )}
              </div>
              )}

              {documents.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200 mt-4">
                     <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                       📄 Documents ({documents.length})
                     </h2>
                     <button 
                       onClick={handleValidate} 
                       disabled={isValidating || documents.length < 2}
                       className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none disabled:text-gray-500 disabled:cursor-not-allowed"
                     >
                       {isValidating ? <RefreshCw className="w-5 h-5 animate-spin"/> : <ShieldAlert className="w-5 h-5"/>}
                       Run Compliance
                     </button>
                  </div>
                  
                  <div className="space-y-6 mt-4">
                    {documents.map((doc, i) => (
                      <DocumentCard key={i} doc={doc} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
