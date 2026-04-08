import fs from 'fs';
const file = '/Users/prashant/Desktop/smde/frontend/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// I'll just restore the original and replace correctly
const oldCode = `        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-100 pb-2">Documents ({documents.length})</h2>
            {documents.length === 0 ? (
              <p className="text-gray-500 text-sm mt-4">No documents extracted yet.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {documents.map((doc: any, i: number) => (
                  <DocumentCard key={i} doc={doc} />
                ))}
                </p>
              </div>
              <p className="text-gray-700 text-sm bg-blue-50 p-4 rounded text-justify leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}`;

const correctCode = `        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-transparent">
            {documents.length === 0 ? (
              <div className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
                <h2 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-100 pb-2">Documents ({documents.length})</h2>
                <p className="text-gray-500 text-sm mt-4">No documents extracted yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {documents.map((doc: any, i: number) => (
                  <DocumentCard key={i} doc={doc} />
                ))}
              </div>
            )}
          </div>

          {report && (
            <div className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
              <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <FileText className="text-blue-600" /> Validation Report
              </h2>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                <p className="text-sm text-gray-500 mb-1">Overall Status</p>
                <p className={\`text-xl font-bold \${report.overallStatus === 'REJECTED' ? 'text-red-600' : report.overallStatus === 'APPROVED' ? 'text-green-600' : 'text-amber-600'}\`}>
                  {report.overallStatus} (Score: {report.overallScore})
                </p>
              </div>
              <p className="text-gray-700 text-sm bg-blue-50 p-4 rounded text-justify leading-relaxed">{report.summary}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}`;

code = code.replace(oldCode, correctCode);
fs.writeFileSync(file, code);
console.log('Fixed page!');
