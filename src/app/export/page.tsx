'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardShell from '../../components/DashboardShell';
import Filters from '../../components/Filters';
import { format } from 'date-fns';

export default function ExportPage() {
  const [vineyardId, setVineyardId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);

    let query = supabase
      .from('observations')
      .select(`
        id, observed_at, general_notes, transcript, needs_review,
        blocks!inner(name, area, vineyard_id, vineyards(name), varieties(canonical_name)),
        profiles(full_name),
        phenology(el_stage, description),
        pest_pressure(severity, pests_observed, description),
        disease_pressure(severity, diseases_observed, description),
        canopy_condition(vigor, closure, uniformity, description),
        soil_moisture(level, description)
      `)
      .order('observed_at', { ascending: false });

    if (vineyardId) query = query.eq('blocks.vineyard_id', vineyardId);
    if (blockId) query = query.eq('block_id', blockId);
    if (dateFrom) query = query.gte('observed_at', dateFrom);
    if (dateTo) query = query.lte('observed_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) {
      alert('Export failed: ' + error.message);
      setExporting(false);
      return;
    }

    const headers = [
      'Date', 'Vineyard', 'Block', 'Variety', 'Observer',
      'EL Stage', 'Phenology Notes',
      'Pest Severity', 'Pests Observed', 'Pest Notes',
      'Disease Severity', 'Diseases Observed', 'Disease Notes',
      'Canopy Vigor', 'Canopy Closure', 'Canopy Uniformity', 'Canopy Notes',
      'Soil Moisture', 'Soil Notes',
      'General Notes', 'Transcript', 'Needs Review',
    ];

    const rows = (data || []).map((obs) => {
     // @ts-ignore
      const block = (Array.isArray(obs.blocks) ? obs.blocks[0] : obs.blocks) as any;
      const phen = Array.isArray(obs.phenology) ? obs.phenology[0] : obs.phenology;
      const pest = Array.isArray(obs.pest_pressure) ? obs.pest_pressure[0] : obs.pest_pressure;
      const disease = Array.isArray(obs.disease_pressure) ? obs.disease_pressure[0] : obs.disease_pressure;
      const canopy = Array.isArray(obs.canopy_condition) ? obs.canopy_condition[0] : obs.canopy_condition;
      const soil = Array.isArray(obs.soil_moisture) ? obs.soil_moisture[0] : obs.soil_moisture;

      return [
        format(new Date(obs.observed_at), 'yyyy-MM-dd HH:mm'),
        block?.vineyards?.name || '',
        block?.area || block?.name || '',
        block?.varieties?.canonical_name || '',
        obs.profiles?.full_name || '',
        phen?.el_stage || '',
        phen?.description || '',
        pest?.severity || '',
        (pest?.pests_observed || []).join('; '),
        pest?.description || '',
        disease?.severity || '',
        (disease?.diseases_observed || []).join('; '),
        disease?.description || '',
        canopy?.vigor || '',
        canopy?.closure || '',
        canopy?.uniformity || '',
        canopy?.description || '',
        soil?.level || '',
        soil?.description || '',
        obs.general_notes || '',
        obs.transcript || '',
        obs.needs_review ? 'Yes' : 'No',
      ];
    });

    const escape = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [
      headers.map(escape).join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vineyard-observations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  }

  return (
    <DashboardShell>
      <h2 className="text-lg font-bold text-vine-600 mb-4">Export Data</h2>

      <Filters
        vineyardId={vineyardId} setVineyardId={setVineyardId}
        blockId={blockId} setBlockId={setBlockId}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-4">
          Export filtered observations as a CSV file. Includes all structured data, transcripts,
          and review status. Use the filters above to narrow the export.
        </p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-vine-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-vine-700 disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : 'Download CSV'}
        </button>
      </div>
    </DashboardShell>
  );
}