-- Evita dupla notificação: terminate_agreement já INSERT com mensagem específica;
-- o trigger genérico «Um acordo foi cancelado.» só corre quando não há rescisao_modo.

CREATE OR REPLACE FUNCTION public.handle_acordo_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      NEW.driver_id,
      'Novo acordo activo com ' || NEW.n_passageiros_contrato || ' passageiro(s).',
      'success',
      jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
    );

  ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    IF NEW.estado = 'cancelado'
       AND NULLIF(btrim(COALESCE(NEW.rescisao_modo, '')), '') IS NULL THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        NEW.driver_id,
        'Um acordo foi cancelado.',
        'warning',
        jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
      );

      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      SELECT
        ap.passenger_id,
        'O teu acordo de boleia foi cancelado.',
        'error',
        jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
      FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
