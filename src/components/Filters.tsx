'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface FiltersProps {
  vineyardId: string;
  setVineyardId: (v: string) => void;
  blockId: string;
  setBlockId: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
}

export default function Filters({
  vineyardId, setVineyardId,
  blockId, setBlockId,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
}: FiltersProps) {
  const [vineyards, setVineyards] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('vineyards').select('id, name').order('name').then(({ data }) => {
      setVineyards(data || []);
    });
  }, []);

  useEffect(() => {
    if (!vineyardId) {
      setBlocks([]);
      setBlockId('');
      return;
    }
    supabase
      .from('blocks')
      .select('id, name, area, varieties(canonical_name)')
      .eq('vineyard_id', vineyardId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setBlocks(data || []);
      });
  }, [vineyardId]);

  return (
    <div className="flex flex-wrap gap-3 items-end mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Vineyard</label>
        <select
          value={vineyardId}
          onChange={(e) => setVineyardId(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none"
        >
          <option value="">All vineyards</option>
          {vineyards.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Block</label>
        <select
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none"
          disabled={!vineyardId}
        >
          <option value="">All blocks</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.area || b.name} — {b.varieties?.canonical_name || '—'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-vine-600 focus:outline-none"
        />
      </div>
    </div>
  );
}