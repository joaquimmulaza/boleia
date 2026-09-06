-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905095643 marketplace_t33_proposta_notify_contraparte
-- Do not rename; Supabase Preview CI requires exact version match.

-- T33: notificar a contraparte ao criar proposta (A ou B).
-- notificacoes sem política INSERT para authenticated → SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.notify_proposta_contraparte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_recipient uuid;
  v_inbox text;
  v_mensagem text;
BEGIN
  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = NEW.oferta_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = NEW.procura_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by = v_oferta.driver_id THEN
    -- Sentido B: motorista → passageiro/grupo
    v_recipient := v_procura.owner_id;
    v_inbox := 'passageiro';
    v_mensagem := 'Recebeste uma proposta de boleia do motorista. Revisa e aceita ou recusa.';
  ELSE
    -- Sentido A: owner procura → motorista
    v_recipient := v_oferta.driver_id;
    v_inbox := 'motorista';
    v_mensagem := 'Recebeste uma proposta de boleia. Revisa e aceita ou recusa.';
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.created_by THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  VALUES (
    v_recipient,
    v_mensagem,
    'info',
    jsonb_build_object(
      'type', 'proposal_received',
      'inbox', v_inbox,
      'proposta_id', NEW.id,
      'oferta_id', NEW.oferta_id,
      'procura_id', NEW.procura_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_proposta_created_notify ON public.propostas;

CREATE TRIGGER on_proposta_created_notify
  AFTER INSERT ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_proposta_contraparte();
