import React, { useState, useEffect } from 'react'
import { Bell, MapPin, Navigation } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import {
  isPermissionsEligible,
  PERMISSIONS_ELIGIBLE_EVENT,
} from '../utils/permissionsPrompt'

// --- Stitch Design System: Boleia Certa ---
// Design source: Stitch project/16509963580370012988
// Screen: "Permission Overlay" (34536da98a764be0a8909bfac3fcc776)
// Primary: #16a34a | Surface: #ffffff | Font: Inter
// M3 Bottom Sheet — handle bar, FilledButton (primary), TextButton (low-emphasis)

/**
 * Checks whether the user still needs to see the onboarding permission prompt.
 * Returns true if the component should NOT be rendered.
 * - Notifications already granted OR denied (user decided)
 * - Geolocation already granted
 * - profile.onboarding_completed === true
 */
const checkShouldSkip = async (profile) => {
  if (profile?.onboarding_completed === true) return true

  const notifPermission = typeof Notification !== 'undefined'
    ? Notification.permission
    : 'granted'

  // 'default' means the browser hasn't asked yet → we should prompt
  if (notifPermission === 'granted') return true

  try {
    const geoStatus = await navigator.permissions.query({ name: 'geolocation' })
    if (geoStatus.state === 'granted') return true
  } catch {
    // navigator.permissions not available; fall through and show the prompt
  }

  return false
}

const persistOnboardingCompleted = async (userId) => {
  if (!userId) return
  const { error } = await supabase
    .from('perfis')
    .update({ onboarding_completed: true })
    .eq('id', userId)
  if (error) throw error
}

const OnboardingPermissions = () => {
  const { user, profile, refreshProfile } = useAuth()
  const { subscribe, isSupported } = usePushNotifications()
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    let cancelled = false

    const evaluate = async () => {
      if (!isPermissionsEligible()) {
        if (!cancelled) {
          setAnimating(false)
          setVisible(false)
        }
        return
      }

      const skip = await checkShouldSkip(profile)
      if (!cancelled && !skip) {
        setVisible(true)
        requestAnimationFrame(() => {
          if (!cancelled) setAnimating(true)
        })
      } else if (!cancelled) {
        setAnimating(false)
        setVisible(false)
      }
    }

    evaluate()

    const onEligible = () => {
      evaluate()
    }
    window.addEventListener(PERMISSIONS_ELIGIBLE_EVENT, onEligible)

    return () => {
      cancelled = true
      window.removeEventListener(PERMISSIONS_ELIGIBLE_EVENT, onEligible)
    }
  }, [profile])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setAnimating(false)
    setTimeout(() => setVisible(false), 300)
  }

  // ─── Cenário C: Ativar Recursos ──────────────────────────────────────────────
  const handleActivate = async () => {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      await Notification.requestPermission()
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {}
      )
    }

    if (isSupported && user?.id) {
      try {
        await subscribe(user.id)
      } catch (err) {
        console.warn('[OnboardingPermissions] Push subscription failed:', err)
      }
    }

    if (user?.id) {
      try {
        await persistOnboardingCompleted(user.id)
        await refreshProfile()
      } catch (err) {
        console.warn('[OnboardingPermissions] Failed to persist onboarding:', err)
      }
    }

    handleClose()
  }

  // ─── Cenário D: Agora Não ────────────────────────────────────────────────────
  const handleDismiss = async () => {
    // Close UI immediately for snappy UX (Luanda-proof: optimistic close)
    handleClose()

    // Persist decision in the background — if it fails, user still has access
    if (user?.id) {
      try {
        await persistOnboardingCompleted(user.id)
        await refreshProfile()
      } catch (err) {
        // Resiliência local: swallow error, the component already closed
        console.warn('[OnboardingPermissions] Failed to persist dismiss:', err)
      }
    }
  }

  // ─── Render guard ────────────────────────────────────────────────────────────
  if (!visible) return null

  return (
    // Backdrop — dark translucent overlay (M3 scrim)
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ative os Recursos Essenciais"
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleDismiss}
    >
      {/* Bottom Sheet — M3 Level 3 elevation, 24px top radius */}
      <div
        role="document"
        className="w-full max-w-sm bg-white px-6 pb-8 shadow-2xl"
        style={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar — M3 Bottom Sheet drag indicator */}
        <div className="flex justify-center pt-4 pb-2">
          <div
            className="bg-gray-300 rounded-full"
            style={{ width: '40px', height: '4px' }}
            aria-hidden="true"
          />
        </div>

        {/* Brand Icon — car/navigation in brand green circle */}
        <div className="flex justify-center mt-6">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: '#16a34a',
            }}
            aria-hidden="true"
          >
            <Navigation size={28} color="#ffffff" strokeWidth={2} />
          </div>
        </div>

        {/* Headline — M3 headline-md, bold */}
        <h2
          className="text-center font-bold mt-4"
          style={{
            fontSize: '22px',
            lineHeight: '28px',
            color: '#111827',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Ative os Recursos Essenciais
        </h2>

        {/* Body copy */}
        <p
          className="text-center mt-3"
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b7280',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Para te avisarmos sobre propostas, acordos e alterações da tua rota,
          precisamos da tua autorização.
        </p>

        {/* Permission Cards */}
        <div className="mt-4 space-y-3">
          {/* Card: Notificações */}
          <div
            className="flex items-center gap-4 rounded-xl p-4"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#dcfce7',
              }}
              aria-hidden="true"
            >
              <Bell size={20} color="#16a34a" strokeWidth={2} />
            </div>
            <div>
              <p
                className="font-semibold"
                style={{
                  fontSize: '15px',
                  color: '#111827',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Notificações de Boleia
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Recebe alertas da tua rota
              </p>
            </div>
          </div>

          {/* Card: Localização */}
          <div
            className="flex items-center gap-4 rounded-xl p-4"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#dcfce7',
              }}
              aria-hidden="true"
            >
              <MapPin size={20} color="#16a34a" strokeWidth={2} />
            </div>
            <div>
              <p
                className="font-semibold"
                style={{
                  fontSize: '15px',
                  color: '#111827',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Localização Atual
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Ajuda a confirmar o ponto de recolha combinado
              </p>
            </div>
          </div>
        </div>

        {/* PRIMARY — M3 FilledButton, brand green (#16a34a) */}
        <button
          id="btn-ativar-recursos"
          type="button"
          onClick={handleActivate}
          className="w-full mt-6 font-semibold text-white rounded-full transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            height: '52px',
            backgroundColor: '#16a34a',
            fontSize: '16px',
            fontFamily: 'Inter, sans-serif',
            focusRingColor: '#16a34a',
          }}
          aria-label="Ativar Recursos — Notificações e Localização"
        >
          Ativar Recursos
        </button>

        {/* SECONDARY — M3 TextButton, on-surface-variant, low emphasis */}
        <button
          id="btn-agora-nao"
          type="button"
          onClick={handleDismiss}
          className="w-full mt-4 font-medium transition-colors hover:bg-gray-50 rounded-full py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
          style={{
            fontSize: '16px',
            color: '#6b7280',
            fontFamily: 'Inter, sans-serif',
          }}
          aria-label="Agora Não — fechar este pedido de permissão"
          tabIndex={0}
        >
          Agora Não
        </button>

        {/* Disclaimer */}
        <p
          className="text-center mt-4"
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Podes alterar as permissões a qualquer momento nas definições do
          dispositivo.
        </p>
      </div>
    </div>
  )
}

export default OnboardingPermissions
