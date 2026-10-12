import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../services/ProfileService';
import { listMyRepassesMotorista } from '../services/PaymentService';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { Card, CardContent } from '../components/ui/card';
import { PROFILE_RECEIPTS } from '../utils/profileCopy';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export default function ProfileRecebimentos() {
  const [loading, setLoading] = useState(true);
  const [tipoPerfil, setTipoPerfil] = useState('Passageiro');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const perfil = await getProfile(user.id);
        setTipoPerfil(perfil?.tipo_perfil || 'Passageiro');
        if (perfil?.tipo_perfil === 'Motorista') {
          const data = await listMyRepassesMotorista(user.id);
          setRows(data);
        }
      } catch (err) {
        console.error('Erro ao carregar recebimentos:', err);
        setError(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <LoadingSkeleton variant="profile" />
      </PageShell>
    );
  }

  if (tipoPerfil !== 'Motorista') {
    return <Navigate to="/perfil" replace />;
  }

  return (
    <PageShell className="pb-shell space-y-4">
      <Link
        to="/perfil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Perfil
      </Link>
      <h1 className="text-2xl font-bold text-foreground">{PROFILE_RECEIPTS}</h1>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Ainda não tens repasses registados.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="p-4 text-sm">
                  <p className="font-semibold text-foreground">
                    {row.valor_repasse_liquido_kz != null ? `${row.valor_repasse_liquido_kz} Kz` : 'Repasse'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {row.mes_referencia ? String(row.mes_referencia).slice(0, 10) : ''}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
