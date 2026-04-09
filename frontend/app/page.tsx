"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { FileText, User } from "lucide-react";
import CandidateSidebar from "../components/dashboard/CandidateSidebar";
import UploadPanel from "../components/dashboard/UploadPanel";
import ValidationSummary from "../components/dashboard/ValidationSummary";
import UnifiedProfile from "../components/dashboard/UnifiedProfile";
import DocumentsSection from "../components/dashboard/DocumentsSection";
import { apiClient } from "../lib/apiClient";
import { apiRoutes } from "../lib/apiRoutes";
import {
  DocumentRecord,
  SessionDetailsResponse,
  SessionSummary,
  UploadErrorResponse,
  UploadMode,
  ValidationReport,
} from "../lib/dashboardTypes";

export default function Home() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [mode, setMode] = useState<UploadMode>("async");
  const [detectedRole, setDetectedRole] = useState("UNKNOWN");

  const fetchAllSessions = async () => {
    try {
      const res = await apiClient.get(apiRoutes.sessions.list);
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
      const res = await apiClient.get(apiRoutes.sessions.byId(id));
      const sessionData = res.data as SessionDetailsResponse;
      setDocuments(sessionData.documents || []);
      setDetectedRole(sessionData.detectedRole || "UNKNOWN");
      setReport(sessionData.validationResult || null);
      fetchAllSessions(); // refresh the sidebar list in case names updated
    } catch (e) {
      console.error("Failed to fetch session:", e);
    }
  };

  const handleCreateNewUser = () => {
    setSessionId(null);
    setDocuments([]);
    setReport(null);
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

        const res = await apiClient.post(apiRoutes.extract.upload(mode), formData, {
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
    } catch (error: unknown) {
      console.error("Upload failed", error);
      if (axios.isAxiosError<UploadErrorResponse>(error)) {
        alert(error.response?.data?.error || "Failed to upload document");
      } else {
        alert("Failed to upload document");
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const pollJob = async (jobId: string, sid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await apiClient.get(apiRoutes.jobs.byId(jobId));
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
      const res = await apiClient.post(apiRoutes.sessions.validate(sessionId));
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
      await apiClient.delete(apiRoutes.sessions.remove(id));
      if (sessionId === id) handleCreateNewUser();
      fetchAllSessions();
    } catch (err: unknown) {
      console.error("Failed to delete session", err);
      alert("Failed to delete the candidate.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex overflow-hidden">
      <CandidateSidebar
        sessions={sessions}
        sessionId={sessionId}
        onCreateNewUser={handleCreateNewUser}
        onSelectSession={(id) => {
          setSessionId(id);
          fetchSession(id);
        }}
        onDeleteSession={handleDeleteSession}
      />

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
          <UploadPanel
            sessionId={sessionId}
            mode={mode}
            isUploading={isUploading}
            processingSessionId={processingSessionId}
            onModeChange={setMode}
            onFileUpload={handleFileUpload}
          />

          {!sessionId && documents.length === 0 ? (
             <div className="flex flex-col border-2 border-dashed border-gray-300 bg-white items-center justify-center py-32 rounded-2xl text-gray-500 shadow-sm">
                <User className="w-20 h-20 text-gray-300 mb-6" />
                <h3 className="text-2xl font-bold text-gray-700 mb-2">No Candidate Selected</h3>
                <p className="mt-2 text-center max-w-md text-gray-500 font-medium">Select a candidate from the sidebar, or upload a document to instantly create a new candidate session workspace.</p>
             </div>
          ) : (
            <>
              {report && <ValidationSummary report={report} />}

              {documents.length > 0 && <UnifiedProfile documents={documents} detectedRole={detectedRole} />}

              {documents.length > 0 && (
                <DocumentsSection documents={documents} isValidating={isValidating} onValidate={handleValidate} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
