'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from './LoadingSpinner';

interface CustomerRow {
  _id: string;
  selected: boolean;
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
  isReferral: boolean;
  referralSource: string;
  leadSize: '500MB' | '1GIG' | '2GIG' | undefined;
  orderNumber: string;
  notes: string;
  confidence: number;
}

interface BatchImportProps {
  user: { id: string } | null;
  onCustomersAdded: () => void;
}

type Step = 'input' | 'review' | 'saving' | 'done';

export default function BatchImport({ user, onCustomersAdded }: BatchImportProps) {
  const [step, setStep] = useState<Step>('input');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [formatDetected, setFormatDetected] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState({ saved: 0, failed: 0, total: 0 });

  const processData = async () => {
    if (!rawText.trim()) {
      setError('Please paste some data first');
      return;
    }
    setIsProcessing(true);
    setError('');

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/batch-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.type === 'rate_limit') {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        throw new Error(data.error || 'Failed to process data');
      }

      if (!data.customers || data.customers.length === 0) {
        throw new Error('No records found in the pasted data. Please check the format and try again.');
      }

      setRows(
        data.customers.map((c: any, i: number) => ({
          _id: `row-${i}-${Date.now()}`,
          selected: true,
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          serviceAddress: c.serviceAddress || '',
          installationDate: c.installationDate || '',
          installationTime: c.installationTime || '',
          isReferral: c.isReferral || false,
          referralSource: c.referralSource || '',
          leadSize: c.leadSize,
          orderNumber: c.orderNumber || '',
          notes: c.notes || '',
          confidence: c.confidence || 0,
        }))
      );
      setFormatDetected(data.formatDetected || '');
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAll = (selected: boolean) => setRows(rows.map((r) => ({ ...r, selected })));
  const toggleRow = (id: string) =>
    setRows(rows.map((r) => (r._id === id ? { ...r, selected: !r.selected } : r)));
  const updateRow = (id: string, field: keyof CustomerRow, value: string | boolean) =>
    setRows(rows.map((r) => (r._id === id ? { ...r, [field]: value } : r)));

  const selectedCount = rows.filter((r) => r.selected).length;

  const saveSelected = async () => {
    if (!user) return;
    const toSave = rows.filter((r) => r.selected);
    if (toSave.length === 0) return;

    setStep('saving');
    setSaveProgress({ saved: 0, failed: 0, total: toSave.length });

    let saved = 0;
    let failed = 0;

    for (const row of toSave) {
      try {
        const { error: dbError } = await supabase.from('customers').insert([
          {
            user_id: user.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            service_address: row.serviceAddress,
            installation_date:
              row.installationDate && row.installationDate !== 'Not provided' && row.installationDate !== ''
                ? row.installationDate
                : new Date().toISOString().split('T')[0],
            installation_time:
              row.installationTime && row.installationTime !== 'Not provided'
                ? row.installationTime
                : null,
            status: 'active',
            is_referral: row.isReferral || false,
            referral_source: row.isReferral ? row.referralSource : null,
            lead_size: row.leadSize || null,
          },
        ]);

        if (dbError) {
          console.error('Row save error:', dbError);
          failed++;
        } else {
          saved++;
        }
      } catch {
        failed++;
      }

      setSaveProgress({ saved, failed, total: toSave.length });
    }

    onCustomersAdded();
    setStep('done');
    setSaveProgress({ saved, failed, total: toSave.length });
  };

  const reset = () => {
    setStep('input');
    setRawText('');
    setRows([]);
    setError('');
    setFormatDetected('');
    setExpandedRow(null);
  };

  const confidenceColor = (c: number) =>
    c >= 80 ? 'bg-green-100 text-green-700' : c >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  const statusColor = (notes: string) => {
    const n = notes?.toLowerCase() || '';
    if (n.includes('cancel')) return 'text-red-600';
    if (n.includes('completed') || n.includes('active')) return 'text-green-600';
    if (n.includes('process') || n.includes('submitted')) return 'text-blue-600';
    return 'text-gray-600';
  };

  if (step === 'input') {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 border-t-4 border-indigo-500">
        <h2 className="text-lg md:text-xl font-semibold text-blue-800 mb-2">Batch Import</h2>
        <p className="text-xs md:text-sm text-black mb-4">
          Paste your order data below (BASS export, spreadsheet, or any format). The AI will
          extract and organize all records for you to review before saving.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste your BASS export, spreadsheet data, or order list here..."
          className="w-full h-48 p-4 border border-gray-300 rounded-lg text-black text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono"
        />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="flex gap-3 mt-4">
          <button
            onClick={processData}
            disabled={isProcessing}
            className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? <LoadingSpinner /> : null}
            {isProcessing ? 'Processing...' : 'Process with AI'}
          </button>
          {rawText && (
            <button
              onClick={() => setRawText('')}
              className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 border-t-4 border-indigo-500">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-blue-800">
              Review {rows.length} Records
            </h2>
            {formatDetected && (
              <p className="text-xs text-gray-500 mt-0.5">Format detected: {formatDetected}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="px-3 py-1 text-xs bg-indigo-50 text-indigo-700 rounded border border-indigo-200 hover:bg-indigo-100"
            >
              Select All
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-3 py-1 text-xs bg-gray-50 text-gray-700 rounded border border-gray-200 hover:bg-gray-100"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {rows.map((row) => (
            <div
              key={row._id}
              className={`border rounded-lg transition-shadow ${
                row.selected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedRow(expandedRow === row._id ? null : row._id)}
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleRow(row._id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 text-indigo-600 rounded flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-black truncate">{row.name || 'Unknown'}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${confidenceColor(row.confidence)}`}>
                      {row.confidence}%
                    </span>
                    {row.notes && (
                      <span className={`text-xs font-medium ${statusColor(row.notes)}`}>
                        {row.notes.length > 30 ? row.notes.substring(0, 30) + '...' : row.notes}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {row.phone && row.phone !== 'Not provided' && <span>{row.phone}</span>}
                    {row.serviceAddress && row.serviceAddress !== 'Not provided' && (
                      <span className="truncate max-w-xs">{row.serviceAddress}</span>
                    )}
                    {row.orderNumber && <span className="text-gray-400">#{row.orderNumber}</span>}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${expandedRow === row._id ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              {expandedRow === row._id && (
                <div className="border-t border-gray-200 p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white rounded-b-lg">
                  {(
                    [
                      { label: 'Name', field: 'name' as const, type: 'text' },
                      { label: 'Phone', field: 'phone' as const, type: 'tel' },
                      { label: 'Email', field: 'email' as const, type: 'email' },
                      { label: 'Service Address', field: 'serviceAddress' as const, type: 'text' },
                      { label: 'Installation Date', field: 'installationDate' as const, type: 'text' },
                      { label: 'Installation Time', field: 'installationTime' as const, type: 'text' },
                      { label: 'Order #', field: 'orderNumber' as const, type: 'text' },
                      { label: 'Notes / Status', field: 'notes' as const, type: 'text' },
                    ] as { label: string; field: keyof CustomerRow; type: string }[]
                  ).map(({ label, field, type }) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input
                        type={type}
                        value={(row[field] as string) || ''}
                        onChange={(e) => updateRow(row._id, field, e.target.value)}
                        className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead Size</label>
                    <select
                      value={row.leadSize || ''}
                      onChange={(e) =>
                        updateRow(row._id, 'leadSize', e.target.value as '500MB' | '1GIG' | '2GIG')
                      }
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Not specified</option>
                      <option value="500MB">500MB</option>
                      <option value="1GIG">1GIG</option>
                      <option value="2GIG">2GIG</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={saveSelected}
            disabled={selectedCount === 0}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
            </svg>
            Save Selected ({selectedCount})
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'saving') {
    const { saved, failed, total } = saveProgress;
    const progress = total > 0 ? Math.round(((saved + failed) / total) * 100) : 0;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-t-4 border-indigo-500">
        <h2 className="text-lg font-semibold text-blue-800 mb-4">Saving Records...</h2>
        <p className="text-sm text-gray-600 mb-3">
          Saving {saved + failed} of {total} records
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {saved} saved{failed > 0 ? `, ${failed} failed` : ''}
        </p>
      </div>
    );
  }

  // done
  const { saved, failed } = saveProgress;
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-t-4 border-green-500">
      <div className="flex items-center gap-3 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <h2 className="text-lg font-semibold text-blue-800">Import Complete</h2>
      </div>
      <p className="text-sm text-gray-700 mb-1">
        <span className="font-semibold text-green-600">{saved}</span> records saved successfully
        {failed > 0 && (
          <span>, <span className="font-semibold text-red-500">{failed}</span> failed</span>
        )}
      </p>
      <p className="text-xs text-gray-500 mb-5">Your new customers are now in the pipeline.</p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
      >
        Import More
      </button>
    </div>
  );
}
