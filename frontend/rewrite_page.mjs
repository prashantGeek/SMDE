import fs from 'fs';

const file = '/Users/prashant/Desktop/smde/frontend/app/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `import { UploadCloud, CheckCircle, FileText, AlertCircle, RefreshCw } from "lucide-react";`,
  `import { UploadCloud, CheckCircle, FileText, AlertCircle, RefreshCw } from "lucide-react";\nimport DocumentCard from "../components/DocumentCard";`
);

const oldListStart = `              <div className="space-y-3 pt-2">\n                {documents.map((doc: any, i: number) => (\n                  <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2">`;
const oldListEnd = `                    )}
                  </div>
                ))}
              </div>`;

// Since it might be hard to match the exact spacing, use a regex to replace everything inside documents.map
const mapRegex = /\{documents\.map\(\(doc: any, i: number\) => \([\s\S]*?\}\)/g;
code = code.replace(mapRegex, `{documents.map((doc: any, i: number) => (\n                  <DocumentCard key={i} doc={doc} />\n                ))}`);

fs.writeFileSync(file, code);
console.log('Rewrote page.tsx');
