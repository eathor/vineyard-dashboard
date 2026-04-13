'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardShell from '../../components/DashboardShell';
import { format } from 'date-fns';

const SEVERITY_OPTIONS = ['none', 'low', 'moderate', 'high', 'severe'];
const VIGOR_OPTIONS = ['weak', 'moderate', 'strong', 'excessive'];
const CLOSURE_OPTIONS = ['open', 'partial', 'closed'];
const UNIFORMITY_OPTIONS = ['uniform', 'patchy', 'variable'];
const SOIL_OPTIONS = ['dry', 'ok', 'wet'];
 function SelectField({ label, value, options, onChange }: {
    label: string; value: string; options: string[]; onChange: (v: string) => void;
  }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-600 focus:outline-none"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }

  function TextField({ label, value, onChange, multiline }: {
    label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
  }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-600 focus:outline-none"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-600 focus:outline-none"
          />
        )}
      </div>
    );
  }
export default function ReviewPage() {
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReviewQueue();
  }, []);

  async function loadReviewQueue() {
    setLoading(true);
    const { data, error } = await supabase
      .from('observations')
      .select(`
        id, observed_at, general_notes, transcript, extraction, needs_review, extraction_status,
        blocks(name, area, vineyards(name), varieties(canonical_name)),
        profiles(full_name),
        phenology(el_stage, description),
        pest_pressure(severity, pests_observed, description),
        disease_pressure(severity, diseases_observed, description),
        canopy_condition(vigor, closure, uniformity, description),
        soil_moisture(level, description)
      `)
      .eq('needs_review', true)
      .order('observed_at', { ascending: false });

    if (error) console.error(error);
    setObservations(data || []);
    setLoading(false);
  }

  async function approveObservation(id: string) {
    const { error } = await supabase
      .from('observations')
      .update({ needs_review: false })
      .eq('id', id);

    if (error) {
      alert('Failed to approve: ' + error.message);
      return;
    }
    setObservations((prev) => prev.filter((o) => o.id !== id));
  }

  function startEditing(obs: any) {
    const pest = Array.isArray(obs.pest_pressure) ? obs.pest_pressure[0] : obs.pest_pressure;
    const disease = Array.isArray(obs.disease_pressure) ? obs.disease_pressure[0] : obs.disease_pressure;
    const phen = Array.isArray(obs.phenology) ? obs.phenology[0] : obs.phenology;
    const canopy = Array.isArray(obs.canopy_condition) ? obs.canopy_condition[0] : obs.canopy_condition;
    const soil = Array.isArray(obs.soil_moisture) ? obs.soil_moisture[0] : obs.soil_moisture;

    setEditingId(obs.id);
    setEditData({
      elStage: phen?.el_stage?.toString() || '',
      phenDesc: phen?.description || '',
      pestSev: pest?.severity || 'none',
      pestList: (pest?.pests_observed || []).join(', '),
      pestDesc: pest?.description || '',
      disSev: disease?.severity || 'none',
      disList: (disease?.diseases_observed || []).join(', '),
      disDesc: disease?.description || '',
      vigor: canopy?.vigor || '',
      closure: canopy?.closure || '',
      uniformity: canopy?.uniformity || '',
      canDesc: canopy?.description || '',
      soilLevel: soil?.level || '',
      soilDesc: soil?.description || '',
      generalNotes: obs.general_notes || '',
    });
  }

  async function saveEdits(obsId: string) {
    setSaving(true);
    const parseArr = (s: string) => s.split(',').map((x: string) => x.trim()).filter(Boolean);

    const results = await Promise.all([
      supabase.from('phenology').update({
        el_stage: parseInt(editData.elStage, 10),
        description: editData.phenDesc || null,
      }).eq('observation_id', obsId),

      supabase.from('pest_pressure').update({
        severity: editData.pestSev,
        pests_observed: editData.pestSev === 'none' ? [] : parseArr(editData.pestList),
        description: editData.pestDesc || null,
      }).eq('observation_id', obsId),

      supabase.from('disease_pressure').update({
        severity: editData.disSev,
        diseases_observed: editData.disSev === 'none' ? [] : parseArr(editData.disList),
        description: editData.disDesc || null,
      }).eq('observation_id', obsId),

      supabase.from('canopy_condition').update({
        vigor: editData.vigor,
        closure: editData.closure,
        uniformity: editData.uniformity,
        description: editData.canDesc || null,
      }).eq('observation_id', obsId),

      supabase.from('soil_moisture').update({
        level: editData.soilLevel,
        description: editData.soilDesc || null,
      }).eq('observation_id', obsId),

      supabase.from('observations').update({
        general_notes: editData.generalNotes || null,
        needs_review: false,
      }).eq('id', obsId),
    ]);

    const err = results.find((r) => r.error);
    if (err) {
      alert('Save failed: ' + err.error?.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingId(null);
    setObservations((prev) => prev.filter((o) => o.id !== obsId));
  }

 

  return (
    <DashboardShell>
      <h2 className="text-lg font-bold mb-4" style={{ color: '#2E4A2E' }}>
        Extraction Review Queue
        {!loading && (
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({observations.length} item{observations.length !== 1 ? 's' : ''})
          </span>
        )}
      </h2>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading review queue...</div>
      ) : observations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-gray-500 text-lg">All caught up! No observations need review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => {
            const block = obs.blocks;
            const pest = Array.isArray(obs.pest_pressure) ? obs.pest_pressure[0] : obs.pest_pressure;
            const disease = Array.isArray(obs.disease_pressure) ? obs.disease_pressure[0] : obs.disease_pressure;
            const phen = Array.isArray(obs.phenology) ? obs.phenology[0] : obs.phenology;
            const canopy = Array.isArray(obs.canopy_condition) ? obs.canopy_condition[0] : obs.canopy_condition;
            const soil = Array.isArray(obs.soil_moisture) ? obs.soil_moisture[0] : obs.soil_moisture;
            const extraction = obs.extraction || {};
            const isEditing = editingId === obs.id;

            return (
              <div key={obs.id} className="bg-white rounded-lg shadow-sm border border-amber-300 p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium" style={{ color: '#2E4A2E' }}>
                      {block?.vineyards?.name} — {block?.area || block?.name}
                    </span>
                    <span className="text-sm text-gray-500 ml-3">
                      {format(new Date(obs.observed_at), 'MMM d, yyyy HH:mm')}
                    </span>
                    <span className="text-sm text-gray-500 ml-3">
                      by {obs.profiles?.full_name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEditing(obs)}
                          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => approveObservation(obs.id)}
                          className="bg-green-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-green-700"
                        >
                          Approve
                        </button>
                      </>
                    )}
                    {isEditing && (
                      <>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-gray-400 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdits(obs.id)}
                          disabled={saving}
                          className="bg-green-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save & Approve'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Review reason / contradictions */}
                {extraction.review_reason && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                    <p className="text-sm font-medium text-amber-800">Review reason:</p>
                    <p className="text-sm text-amber-700">{extraction.review_reason}</p>
                  </div>
                )}
                {extraction.contradictions?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                    <p className="text-sm font-medium text-red-800">Contradictions detected:</p>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {extraction.contradictions.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Read-only view */}
                {!isEditing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Structured Data</h4>
                      <div className="text-sm space-y-1">
                        <p>E-L Stage: <strong>{phen?.el_stage || '—'}</strong>{phen?.description ? ` — ${phen.description}` : ''}</p>
                        <p>Pest: <strong>{pest?.severity || '—'}</strong> {pest?.pests_observed?.length > 0 ? `(${pest.pests_observed.join(', ')})` : ''}</p>
                        <p>Disease: <strong>{disease?.severity || '—'}</strong> {disease?.diseases_observed?.length > 0 ? `(${disease.diseases_observed.join(', ')})` : ''}</p>
                        <p>Canopy: {canopy?.vigor || '—'} / {canopy?.closure || '—'} / {canopy?.uniformity || '—'}</p>
                        <p>Soil: <strong>{soil?.level || '—'}</strong></p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Voice Extraction</h4>
                      <div className="text-sm space-y-1">
                        {extraction.transcript_summary && <p><strong>Summary:</strong> {extraction.transcript_summary}</p>}
                        {extraction.additional_pests?.length > 0 && <p>Extra pests: {extraction.additional_pests.join(', ')}</p>}
                        {extraction.additional_diseases?.length > 0 && <p>Extra diseases: {extraction.additional_diseases.join(', ')}</p>}
                        {extraction.action_items?.length > 0 && <p><strong>Actions:</strong> {extraction.action_items.join('; ')}</p>}
                        <p className="text-xs text-gray-500">Confidence: {extraction.confidence || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit mode */}
                {isEditing && (
                  <div className="border border-blue-200 rounded-md p-4 bg-blue-50">
                    <h4 className="text-xs font-semibold text-blue-700 uppercase mb-3">Editing Observation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <TextField label="E-L Stage (1-47)" value={editData.elStage}
                        onChange={(v) => setEditData({ ...editData, elStage: v })} />
                      <TextField label="Phenology description" value={editData.phenDesc}
                        onChange={(v) => setEditData({ ...editData, phenDesc: v })} />
                      <SelectField label="Pest severity" value={editData.pestSev} options={SEVERITY_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, pestSev: v })} />
                      <TextField label="Pests observed (comma separated)" value={editData.pestList}
                        onChange={(v) => setEditData({ ...editData, pestList: v })} />
                      <TextField label="Pest description" value={editData.pestDesc}
                        onChange={(v) => setEditData({ ...editData, pestDesc: v })} />
                      <SelectField label="Disease severity" value={editData.disSev} options={SEVERITY_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, disSev: v })} />
                      <TextField label="Diseases observed (comma separated)" value={editData.disList}
                        onChange={(v) => setEditData({ ...editData, disList: v })} />
                      <TextField label="Disease description" value={editData.disDesc}
                        onChange={(v) => setEditData({ ...editData, disDesc: v })} />
                      <SelectField label="Vigor" value={editData.vigor} options={VIGOR_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, vigor: v })} />
                      <SelectField label="Closure" value={editData.closure} options={CLOSURE_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, closure: v })} />
                      <SelectField label="Uniformity" value={editData.uniformity} options={UNIFORMITY_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, uniformity: v })} />
                      <TextField label="Canopy description" value={editData.canDesc}
                        onChange={(v) => setEditData({ ...editData, canDesc: v })} />
                      <SelectField label="Soil moisture" value={editData.soilLevel} options={SOIL_OPTIONS}
                        onChange={(v) => setEditData({ ...editData, soilLevel: v })} />
                      <TextField label="Soil description" value={editData.soilDesc}
                        onChange={(v) => setEditData({ ...editData, soilDesc: v })} />
                    </div>
                    <div className="mt-3">
                      <TextField label="General notes" value={editData.generalNotes} multiline
                        onChange={(v) => setEditData({ ...editData, generalNotes: v })} />
                    </div>
                  </div>
                )}

                {/* Transcript */}
                {obs.transcript && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Full Transcript</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded italic">{obs.transcript}</p>
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