-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906114035 s22_recalc_vagas_disponiveis_trigger
-- Do not rename; Supabase Preview CI requires exact version match.

CREATE OR REPLACE FUNCTION public.oferta_ocupacao(p_oferta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = p_oferta_id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) = 'activo';
$function$;

REVOKE ALL ON FUNCTION public.oferta_ocupacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oferta_ocupacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalc_vagas_disponiveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ocupadas integer;
  v_disponiveis integer;
BEGIN
  v_ocupadas := public.oferta_ocupacao(NEW.id);
  v_disponiveis := NEW.vagas_totais - v_ocupadas;

  IF v_disponiveis < 0 THEN
    RAISE EXCEPTION
      'Capacidade inconsistente: a oferta já tem mais passageiros (%) do que lugares (%).',
      v_ocupadas, NEW.vagas_totais;
  END IF;

  NEW.vagas_disponiveis := v_disponiveis;

  IF lower(COALESCE(NEW.estado, '')) <> 'inactiva' THEN
    NEW.estado := CASE
      WHEN v_disponiveis = 0 THEN 'cheia'
      WHEN v_disponiveis < NEW.vagas_totais THEN 'parcial'
      ELSE 'disponivel'
    END;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ofertas_recalc_vagas ON public.ofertas_capacidade;

CREATE TRIGGER trg_ofertas_recalc_vagas
  BEFORE UPDATE ON public.ofertas_capacidade
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_vagas_disponiveis();

CREATE OR REPLACE FUNCTION public.recount_oferta_vagas(p_oferta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_disponiveis integer;
BEGIN
  IF p_oferta_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.ofertas_capacidade
  SET updated_at = now()
  WHERE id = p_oferta_id
  RETURNING vagas_disponiveis INTO v_disponiveis;

  RETURN v_disponiveis;
END;
$function$;

REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recount_oferta_vagas(uuid) TO authenticated;
