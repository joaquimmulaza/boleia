import React from 'react';
import { LogOut } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { PROFILE_SIGN_OUT } from '../../utils/profileCopy';

/**
 * @param {{ onSignOut: () => void | Promise<void>; busy?: boolean }} props
 */
export default function ProfileSignOutButton({ onSignOut, busy = false }) {
  return (
    <div className="pt-6 mt-2">
      <Card>
        <CardContent className="p-0">
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-semibold text-foreground hover:bg-accent/40 transition-colors disabled:opacity-60 rounded-xl"
          >
            <LogOut className="size-5 shrink-0" aria-hidden="true" />
            {PROFILE_SIGN_OUT}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
