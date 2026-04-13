'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardShell from '../../components/DashboardShell';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const SEVERITY_MAP: Record<string, number> = {
  none: 0, low: 1, moderate: 2, high: 3, severe: 4,
};

export default function ComparePage() {
  const [vineyardId, setVineyardId] = useState('');
  const [vineyards, setVineyards] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('vineyards').select('id, name').order('name').then(({ data }) => {
      setVineyards(data || []);
    });
  }, []);

  useEffect(() => {
    if (!vineyardId) {
      setChartData([]);
      return;
    }
    loadComparison();
  }, [vineyardId, dateFrom, dateTo]);

  async function loadComparison() {
    setLoading(true);

    let query = supabase
      .from('observations')
      .select(`
        block_id,
        blocks!inner(name, area, vineyard_id, varieties(canonical_name)),
        pest_pressure(severity),
        disease_pressure(severity),
        canopy_condition(vigor),
        soil_moisture(level)
      `)
      .eq('blocks.vineyard_id', vineyardId)
      .order('observed_at', { ascending: false });

    if (dateFrom) query = query.gte('observed_at', dateFrom);
    if (dateTo) query = query.lte('observed_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const blockMap = new Map<string, {
      name: string;
      pestTotal: number;
      diseaseTotal: number;
      count: number;
    }>();

    for (const obs of (data || [])) {
      const block = obs.blocks;
      const blockName = `${block?.area || block?.name} (${block?.varieties?.canonical_name || '—'})`;
      const key = obs.block_id;

      if (!blockMap.has(key)) {
        blockMap.set(key, { name: blockName, pestTotal: 0, diseaseTotal: 0, count: 0 });
      }

      const entry = blockMap.get(key)!;
      const pest = Array.isArray(obs.pest_pressure) ? obs.pest_pressure[0] : obs.pest_pressure;
      const disease = Array.isArray(obs.disease_pressure) ? obs.disease_pressure[0] : obs.disease_pressure;

      entry.pestTotal += SEVERITY_MAP[pest?.severity || 'none'] || 0;
      entry.diseaseTotal += SEVERITY_MAP[disease?.severity || 'none'] || 0;
      entry.count += 1;
    }

    const chart = Array.from(blockMap.values()).map((b) => ({
      block: b.name,
      'Avg Pest Pressure': b.count > 0 ? +(b.pestTotal / b.count).toFixed(2) : 0,
      'Avg Disease Pressure': b.count > 0 ? +(b.diseaseTotal / b.count).toFixed(2) : 0,
      observations: b.count,
    }));

    setChartData(chart.sort((a, b) => a.block.localeCompare(b.block)));
    setLoading(false);
  }

  return (
    <DashboardShell>
      <h2 className="text-lg font-bold text-vine-600 mb-4">Block Comparison</h2>

      <div className="flex flex-wrap gap-3 items-end mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Vineyard</label>
          <select
            value={vineyardId}
            onChange={(e) => setVineyardId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none"
          >
            <option value="">Select vineyard...</option>
            {vineyards.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none" />
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Severity scale: 0 = none, 1 = low, 2 = moderate, 3 = high, 4 = severe
      </p>

      {!vineyardId ? (
        <div className="text-center text-gray-500 py-8">Select a vineyard to compare blocks.</div>
      ) : loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : chartData.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No observations found for this vineyard.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="block" angle={-35} textAnchor="end" interval={0} fontSize={12} />
              <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => [value.toFixed(2), name]}
                labelFormatter={(label) => `Block: ${label}`}
              />
              <Legend />
              <Bar dataKey="Avg Pest Pressure" fill="#DC2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Avg Disease Pressure" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <table className="w-full mt-6 text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Block</th>
                <th className="pb-2 text-center">Observations</th>
                <th className="pb-2 text-center">Avg Pest</th>
                <th className="pb-2 text-center">Avg Disease</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.block} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{row.block}</td>
                  <td className="py-2 text-center">{row.observations}</td>
                  <td className="py-2 text-center">{row['Avg Pest Pressure']}</td>
                  <td className="py-2 text-center">{row['Avg Disease Pressure']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}