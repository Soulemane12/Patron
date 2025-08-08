'use client';

import { useEffect, useState } from 'react';

interface ServiceRequest {
  id: string;
  user_id: string | null;
  provider_id: string | null;
  service_id: string | null;
  status: string;
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
}

export default function ProviderDashboard({ params }: { params: { providerId: string } }) {
  const providerId = params.providerId;
  const [assigned, setAssigned] = useState<ServiceRequest[]>([]);
  const [claimable, setClaimable] = useState<ServiceRequest[]>([]);
  const [catalog, setCatalog] = useState<{id:string; code:string; name:string; price:number; currency:string}[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/requests?includePending=true`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load requests');
      const data = await res.json();
      setAssigned(data.assigned || []);
      setClaimable(data.claimable || []);
      const catRes = await fetch('/api/catalog', { cache: 'no-store' });
      if (catRes.ok) {
        const cat = await catRes.json();
        setCatalog(cat.items || []);
        if (!selectedCatalogId && cat.items?.length) setSelectedCatalogId(cat.items[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const claim = async (requestId: string) => {
    setClaimingId(requestId);
    try {
      const res = await fetch(`/api/providers/${providerId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to claim');
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-blue-800 mb-4">Provider Dashboard</h1>
      <p className="text-sm text-gray-700 mb-2">Provider ID: <span className="font-mono">{providerId}</span></p>

      {loading ? (
        <p className="text-black">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-blue-700 mb-3">Add Service From Catalog</h2>
            {catalog.length === 0 ? (
              <p className="text-sm text-gray-700">No catalog items available.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <select
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="border border-gray-300 rounded p-2 text-sm bg-white text-black min-w-[220px]"
                >
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency} {Number(c.price).toFixed(2)})
                    </option>
                  ))}
                </select>
                <button
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  onClick={async () => {
                    if (!selectedCatalogId) return;
                    // Create or ensure mapping in provider_services
                    const resp = await fetch('/api/providers/map-catalog', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ providerId, catalogId: selectedCatalogId })
                    });
                    if (!resp.ok) {
                      const b = await resp.json().catch(() => ({}));
                      alert(b.error || 'Failed to add');
                    } else {
                      alert('Added to your services');
                    }
                  }}
                >
                  Add to My Services
                </button>
              </div>
            )}
          </section>
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-blue-700 mb-3">Assigned to you</h2>
            {assigned.length === 0 ? (
              <p className="text-sm text-gray-700">No assigned requests.</p>
            ) : (
              <div className="space-y-3">
                {assigned.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm text-black"><span className="font-medium">Request:</span> {r.id}</p>
                        <p className="text-sm text-black"><span className="font-medium">Status:</span> {r.status}</p>
                        {r.scheduled_date && (
                          <p className="text-sm text-black"><span className="font-medium">Scheduled:</span> {new Date(r.scheduled_date).toLocaleString()}</p>
                        )}
                        {r.notes && (
                          <p className="text-sm text-black"><span className="font-medium">Notes:</span> {r.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-blue-700 mb-3">Available to claim</h2>
            {claimable.length === 0 ? (
              <p className="text-sm text-gray-700">No pending requests for your services.</p>
            ) : (
              <div className="space-y-3">
                {claimable.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm text-black"><span className="font-medium">Request:</span> {r.id}</p>
                        {r.scheduled_date && (
                          <p className="text-sm text-black"><span className="font-medium">Scheduled:</span> {new Date(r.scheduled_date).toLocaleString()}</p>
                        )}
                        {r.notes && (
                          <p className="text-sm text-black"><span className="font-medium">Notes:</span> {r.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => claim(r.id)}
                        disabled={claimingId === r.id}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {claimingId === r.id ? 'Claiming...' : 'Claim'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

