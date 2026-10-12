import React from 'react';
import { ChevronRight, Landmark, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { PROFILE_BANK_SUBTITLE, PROFILE_BANK_TITLE, PROFILE_RECEIPTS } from '../../utils/profileCopy';

/**
 * Links motorista: dados bancários + recebimentos.
 */
export default function ProfileDriverLinks() {
  return (
    <Card>
      <CardContent className="p-0">
        <Link
          to="/perfil/dados-bancarios"
          className="flex items-center gap-3 px-4 py-4 hover:bg-accent/40 transition-colors"
        >
          <Landmark className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{PROFILE_BANK_TITLE}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{PROFILE_BANK_SUBTITLE}</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
        </Link>
        <div className="mx-4 border-t border-border" />
        <Link
          to="/perfil/recebimentos"
          className="flex items-center gap-3 px-4 py-4 hover:bg-accent/40 transition-colors"
        >
          <Wallet className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="flex-1 font-semibold text-foreground">{PROFILE_RECEIPTS}</p>
          <ChevronRight className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
