'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import DashboardShell from '../components/DashboardShell';
import Filters from '../components/Filters';
import { format } from 'date-fns';

const SEVERITY_COLORS: Record<string, string> = {
  none: 'bg-green-100 text-green-700',
  low: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
  severe: 'bg-red-200 text-red-800',
};

function Badge({ value }: { value: string }) {
  const cls = SEVERITY_COLORS[value] || 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{value}</span>;
}

export default function TimelinePage() {
  const [vineyardId, setVineyardId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadObservations();
  }, [vineyardId, blockId, dateFrom, dateTo]);

  async function loadObservations() {
    setLoading(true);
    let query = supabase
      .from('observations')
      .select(`
        id, observed_at, general_notes, transcript, extraction, needs_review, extraction_status,
        blocks!inner(id, name, area, vineyard_id, vineyards(name), varieties(canonical_name)),
        profiles(full_name),
        phenology(el_stage, description),
        pest_pressure(severity, pests_observed, description),
        disease_pressure(severity, diseases_observed, description),
        canopy_condition(vigor, closure, uniformity, description),
        soil_moisture(level, description),
        media(id, type, storage_url)
      `)
      .order('observed_at', { ascending: false })
      .limit(100);

    if (vineyardId) {
      query = query.eq('blocks.vineyard_id', vineyardId);
    }
    if (blockId) {
      query = query.eq('block_id', blockId);
    }
    if (dateFrom) {
      query = query.gte('observed_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('observed_at', dateTo + 'T23:59:59');
    }

    const { data, error } = await query;
    if (error) {
      console.error('Load error:', error.message);
    }
    setObservations(data || []);
    setLoading(false);
  }

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage
      .from('observation-photos')
      .getPublicUrl(storagePath);
    return data?.publicUrl || '';
  }

  async function getSignedUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from('observation-photos')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl || '';
  }

  return (
    <DashboardShell>
      <h2 className="text-lg font-bold mb-4" style={{ color: '#2E4A2E' }}>Observation Timeline</h2>

      <Filters
        vineyardId={vineyardId} setVineyardId={setVineyardId}
        blockId={blockId} setBlockId={setBlockId}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
      />

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading observations...</div>
      ) : observations.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No observations found for these filters.</div>
      ) : (
        <div className="space-y-3">
          {observations.map((obs) => {
            const block = obs.blocks;
            const pest = obs.pest_pressure?.[0] || obs.pest_pressure;
            const disease = obs.disease_pressure?.[0] || obs.disease_pressure;
            const phen = obs.phenology?.[0] || obs.phenology;
            const canopy = obs.canopy_condition?.[0] || obs.canopy_condition;
            const soil = obs.soil_moisture?.[0] || obs.soil_moisture;
            const photos = (Array.isArray(obs.media) ? obs.media : obs.media ? [obs.media] : [])
              .filter((m: any) => m.type === 'photo');
            const isExpanded = expanded === obs.id;

            return (
              <div
                key={obs.id}
                className={`bg-white rounded-lg shadow-sm border ${
                  obs.needs_review ? 'border-amber-300' : 'border-gray-200'
                } overflow-hidden`}
              >
                {/* Summary row — always visible */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : obs.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-2 items-center text-sm">
                    <div className="col-span-2">
                      <span className="text-xs text-gray-400 block">Date</span>
                      <span className="text-gray-700">
                        {format(new Date(obs.observed_at), 'MMM d, yyyy')}
                      </span>
                      <span className="text-xs text-gray-400 block">
                        {format(new Date(obs.observed_at), 'HH:mm')}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-xs text-gray-400 block">Location</span>
                      <span className="font-medium" style={{ color: '#2E4A2E' }}>
                        {block?.vineyards?.name}
                      </span>
                      <span className="text-gray-500 block text-xs">
                        {block?.area || block?.name} · {block?.varieties?.canonical_name}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-xs text-gray-400 block">E-L</span>
                      {phen && (
                        <span className="text-sm font-medium">{phen.el_stage}</span>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs text-gray-400 block">Pest</span>
                      {pest && <Badge value={pest.severity} />}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs text-gray-400 block">Disease</span>
                      {disease && <Badge value={disease.severity} />}
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-xs text-gray-400 block">Soil</span>
                      <span className="text-sm">{soil?.level || '—'}</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      {obs.needs_review && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Review
                        </span>
                      )}
                      {photos.length > 0 && (
                        <span className="text-xs text-gray-400">{photos.length} pic{photos.length > 1 ? 's' : ''}</span>
                      )}
                      <span className="text-gray-400 text-lg">{isExpanded ? '−' : '+'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Phenology</h4>
                        <p className="text-sm">E-L Stage {phen?.el_stage}{phen?.description ? ` — ${phen.description}` : ''}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Pest Pressure</h4>
                        <p className="text-sm">
                          <Badge value={pest?.severity || 'N/A'} />
                          {pest?.pests_observed?.length > 0 && (
                            <span className="ml-2">{pest.pests_observed.join(', ')}</span>
                          )}
                        </p>
                        {pest?.description && <p className="text-sm text-gray-600 mt-1">{pest.description}</p>}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Disease Pressure</h4>
                        <p className="text-sm">
                          <Badge value={disease?.severity || 'N/A'} />
                          {disease?.diseases_observed?.length > 0 && (
                            <span className="ml-2">{disease.diseases_observed.join(', ')}</span>
                          )}
                        </p>
                        {disease?.description && <p className="text-sm text-gray-600 mt-1">{disease.description}</p>}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Canopy Condition</h4>
                        <p className="text-sm">
                          Vigor: {canopy?.vigor || '—'} · Closure: {canopy?.closure || '—'} · Uniformity: {canopy?.uniformity || '—'}
                        </p>
                        {canopy?.description && <p className="text-sm text-gray-600 mt-1">{canopy.description}</p>}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Soil Moisture</h4>
                        <p className="text-sm">{soil?.level || '—'}</p>
                        {soil?.description && <p className="text-sm text-gray-600 mt-1">{soil.description}</p>}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Observer</h4>
                        <p className="text-sm">{obs.profiles?.full_name || 'Unknown'}</p>
                      </div>
                    </div>

                    {/* Photos */}
                    {photos.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Photos ({photos.length})
                        </h4>
                        <PhotoGrid photos={photos} />
                      </div>
                    )}

                    {obs.general_notes && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">General Notes</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{obs.general_notes}</p>
                      </div>
                    )}

                    {obs.transcript && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Voice Note Transcript</h4>
                        <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded italic">{obs.transcript}</p>
                      </div>
                    )}

                    {obs.extraction && (
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Extraction</h4>
                        <div className="text-sm bg-amber-50 p-2 rounded space-y-1">
                          {obs.extraction.transcript_summary && (
                            <p><strong>Summary:</strong> {obs.extraction.transcript_summary}</p>
                          )}
                          {obs.extraction.action_items?.length > 0 && (
                            <p><strong>Actions:</strong> {obs.extraction.action_items.join('; ')}</p>
                          )}
                          {obs.extraction.contradictions?.length > 0 && (
                            <p className="text-red-600"><strong>Contradictions:</strong> {obs.extraction.contradictions.join('; ')}</p>
                          )}
                          {obs.extraction.additional_fruit_notes && (
                            <p><strong>Fruit:</strong> {obs.extraction.additional_fruit_notes}</p>
                          )}
                          <p className="text-xs text-gray-500">Confidence: {obs.extraction.confidence || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

/* ── Photo Grid Component ── */
function PhotoGrid({ photos }: { photos: any[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const result: Record<string, string> = {};
      for (const photo of photos) {
        const { data } = await supabase.storage
          .from('observation-photos')
          .createSignedUrl(photo.storage_url, 3600);
        if (data?.signedUrl) {
          result[photo.id] = data.signedUrl;
        }
      }
      if (!cancelled) setUrls(result);
    }
    loadUrls();
    return () => { cancelled = true; };
  }, [photos]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo: any) => (
          <button
            key={photo.id}
            onClick={() => urls[photo.id] && setLightbox(urls[photo.id])}
            className="relative overflow-hidden rounded-md border border-gray-200 hover:border-gray-400 transition-colors"
          >
            {urls[photo.id] ? (
              <img
                src={urls[photo.id]}
                alt="Observation photo"
                className="w-24 h-24 object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                Loading...
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size photo"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}