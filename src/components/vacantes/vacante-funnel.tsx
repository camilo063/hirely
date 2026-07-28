'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelChart } from '@/components/reportes/funnel-chart';
import type { FunnelData } from '@/lib/types/reportes.types';

export function VacanteFunnel({ vacanteId }: { vacanteId: string }) {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reportes/funnel?vacanteId=${vacanteId}`);
        const data = await res.json();
        if (data.success) setFunnel(data.data);
      } catch {
        // Fail silently: el funnel es un complemento, no debe tumbar la pagina.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vacanteId]);

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!funnel || funnel.totalAplicaciones === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Embudo de conversion</CardTitle>
      </CardHeader>
      <CardContent>
        <FunnelChart data={funnel} height={260} />
      </CardContent>
    </Card>
  );
}
