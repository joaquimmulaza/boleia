-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260329161035 remote_schema
-- Do not rename; Supabase Preview CI requires exact version match.

drop extension if exists "pg_net"

create extension if not exists "pg_net" with schema "public"

create table "public"."acordos" (
    "id" uuid not null default gen_random_uuid(),
    "route_id" uuid not null,
    "passenger_id" uuid not null,
    "estado" text not null default 'Pendente'::text,
    "created_at" timestamp with time zone not null default now(),
    "is_hidden_by_user" boolean default false
      )

alter table "public"."acordos" enable row level security

create table "public"."faltas" (
    "id" uuid not null default gen_random_uuid(),
    "id_acordo" uuid not null,
    "data_falta" date not null,
    "tipo" text not null,
    "desconto_kz" numeric(10,2) not null default 1590.91,
    "observacao" text,
    "created_at" timestamp with time zone not null default now()
      )

alter table "public"."faltas" enable row level security

create table "public"."notificacoes" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "mensagem" text not null,
    "tipo" text not null,
    "lida" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "metadata" jsonb default '{}'::jsonb
      )

alter table "public"."notificacoes" enable row level security

create table "public"."perfis" (
    "id" uuid not null,
    "nome_completo" text,
    "telefone" text,
    "tipo_perfil" text not null,
    "created_at" timestamp with time zone not null default now()
      )

alter table "public"."perfis" enable row level security

create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "subscription" jsonb not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      )

alter table "public"."push_subscriptions" enable row level security

create table "public"."routes" (
    "id" uuid not null default gen_random_uuid(),
    "driver_id" uuid not null,
    "origin_name" text not null,
    "destination_name" text not null,
    "departure_time" time without time zone not null,
    "return_time" time without time zone not null,
    "available_seats" integer not null,
    "monthly_price_per_seat" numeric(10,2) not null,
    "created_at" timestamp with time zone not null default now(),
    "origin_lat" numeric,
    "origin_lng" numeric,
    "destination_lat" numeric,
    "destination_lng" numeric
      )

alter table "public"."routes" enable row level security

create table "public"."veiculos" (
    "id" uuid not null default gen_random_uuid(),
    "id_motorista" uuid not null,
    "marca_modelo" text not null,
    "matricula" text not null,
    "lugares_disponiveis" integer not null,
    "created_at" timestamp with time zone not null default now()
      )

alter table "public"."veiculos" enable row level security

CREATE UNIQUE INDEX acordos_pkey ON public.acordos USING btree (id)

CREATE UNIQUE INDEX faltas_pkey ON public.faltas USING btree (id)

CREATE UNIQUE INDEX notificacoes_pkey ON public.notificacoes USING btree (id)

CREATE UNIQUE INDEX perfis_pkey ON public.perfis USING btree (id)

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id)

CREATE UNIQUE INDEX push_subscriptions_user_id_subscription_key ON public.push_subscriptions USING btree (user_id, subscription)

CREATE UNIQUE INDEX routes_pkey ON public.routes USING btree (id)

CREATE UNIQUE INDEX unique_active_route_passenger ON public.acordos USING btree (route_id, passenger_id) WHERE (estado = ANY (ARRAY['Ativo'::text, 'Pendente'::text]))

CREATE UNIQUE INDEX veiculos_pkey ON public.veiculos USING btree (id)

alter table "public"."acordos" add constraint "acordos_pkey" PRIMARY KEY using index "acordos_pkey"

alter table "public"."faltas" add constraint "faltas_pkey" PRIMARY KEY using index "faltas_pkey"

alter table "public"."notificacoes" add constraint "notificacoes_pkey" PRIMARY KEY using index "notificacoes_pkey"

alter table "public"."perfis" add constraint "perfis_pkey" PRIMARY KEY using index "perfis_pkey"

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey"

alter table "public"."routes" add constraint "routes_pkey" PRIMARY KEY using index "routes_pkey"

alter table "public"."veiculos" add constraint "veiculos_pkey" PRIMARY KEY using index "veiculos_pkey"

alter table "public"."acordos" add constraint "acordos_estado_check" CHECK ((estado = ANY (ARRAY['Pendente'::text, 'Ativo'::text, 'Cancelado'::text]))) not valid

alter table "public"."acordos" validate constraint "acordos_estado_check"

alter table "public"."acordos" add constraint "acordos_id_passageiro_fkey" FOREIGN KEY (passenger_id) REFERENCES public.perfis(id) ON DELETE CASCADE not valid

alter table "public"."acordos" validate constraint "acordos_id_passageiro_fkey"

alter table "public"."acordos" add constraint "acordos_id_rota_fkey" FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE not valid

alter table "public"."acordos" validate constraint "acordos_id_rota_fkey"

alter table "public"."faltas" add constraint "faltas_id_acordo_fkey" FOREIGN KEY (id_acordo) REFERENCES public.acordos(id) ON DELETE CASCADE not valid

alter table "public"."faltas" validate constraint "faltas_id_acordo_fkey"

alter table "public"."faltas" add constraint "faltas_tipo_check" CHECK ((tipo = ANY (ARRAY['Passageiro'::text, 'Motorista'::text]))) not valid

alter table "public"."faltas" validate constraint "faltas_tipo_check"

alter table "public"."notificacoes" add constraint "notificacoes_tipo_check" CHECK ((tipo = ANY (ARRAY['success'::text, 'warning'::text, 'info'::text, 'error'::text]))) not valid

alter table "public"."notificacoes" validate constraint "notificacoes_tipo_check"

alter table "public"."notificacoes" add constraint "notificacoes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid

alter table "public"."notificacoes" validate constraint "notificacoes_user_id_fkey"

alter table "public"."perfis" add constraint "perfis_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid

alter table "public"."perfis" validate constraint "perfis_id_fkey"

alter table "public"."perfis" add constraint "perfis_tipo_perfil_check" CHECK ((tipo_perfil = ANY (ARRAY['Passageiro'::text, 'Motorista'::text]))) not valid

alter table "public"."perfis" validate constraint "perfis_tipo_perfil_check"

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.perfis(id) ON DELETE CASCADE not valid

alter table "public"."push_subscriptions" validate constraint "push_subscriptions_user_id_fkey"

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_subscription_key" UNIQUE using index "push_subscriptions_user_id_subscription_key"

alter table "public"."routes" add constraint "routes_available_seats_check" CHECK ((available_seats > 0)) not valid

alter table "public"."routes" validate constraint "routes_available_seats_check"

alter table "public"."routes" add constraint "routes_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.perfis(id) ON DELETE CASCADE not valid

alter table "public"."routes" validate constraint "routes_driver_id_fkey"

alter table "public"."routes" add constraint "routes_monthly_price_per_seat_check" CHECK ((monthly_price_per_seat >= (0)::numeric)) not valid

alter table "public"."routes" validate constraint "routes_monthly_price_per_seat_check"

alter table "public"."veiculos" add constraint "veiculos_id_motorista_fkey" FOREIGN KEY (id_motorista) REFERENCES public.perfis(id) ON DELETE CASCADE not valid

alter table "public"."veiculos" validate constraint "veiculos_id_motorista_fkey"

alter table "public"."veiculos" add constraint "veiculos_lugares_disponiveis_check" CHECK ((lugares_disponiveis > 0)) not valid

alter table "public"."veiculos" validate constraint "veiculos_lugares_disponiveis_check"

set check_function_bodies = off

CREATE OR REPLACE FUNCTION public.decrement_available_seats(route_id_param uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
  UPDATE routes
  SET available_seats = available_seats - 1
  WHERE id = route_id_param AND available_seats > 0;
$function$

CREATE OR REPLACE FUNCTION public.handle_acordo_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  driver_id uuid;
  route_origin text;
  route_dest text;
BEGIN
  -- Get route details
  SELECT r.driver_id, r.origin_name, r.destination_name
  INTO driver_id, route_origin, route_dest
  FROM public.routes r
  WHERE r.id = NEW.route_id;

  IF TG_OP = 'INSERT' THEN
    -- New request: Notify driver
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      driver_id, 
      'Novo pedido de boleia para a rota ' || route_origin || ' → ' || route_dest || '.', 
      'info',
      jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- State changed: Notify passenger
    IF NEW.estado = 'Ativo' THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        NEW.passenger_id, 
        'A tua boleia para ' || route_dest || ' foi aceite!', 
        'success',
        jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
      );
    ELSIF NEW.estado = 'Cancelado' THEN
      INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
      VALUES (
        NEW.passenger_id, 
        'O teu pedido de boleia para ' || route_dest || ' foi recusado/cancelado.', 
        'error',
        jsonb_build_object('type', 'agreement_update', 'acordo_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_falta_desconto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_valor_mensal NUMERIC;
BEGIN
    SELECT r.monthly_price_per_seat INTO v_valor_mensal
    FROM public.acordos a
    JOIN public.routes r ON a.route_id = r.id
    WHERE a.id = NEW.id_acordo;

    IF v_valor_mensal IS NOT NULL THEN
        NEW.desconto_kz := ROUND((v_valor_mensal / 4.0 / 22.0), 2);
    END IF;

    RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_notification_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    project_url text;
BEGIN
    -- Obter o URL do projecto actual, assumindo a convenção
    -- Aqui iremos codificar o URL da Edge Function send-push directamente, 
    -- num ambiente de produção real seria recomendável ler dos secrets se possível
    -- https://fdclrbcgytnuqcrpsevw.supabase.co/functions/v1/send-push
    
    PERFORM net.http_post(
        url := 'https://fdclrbcgytnuqcrpsevw.supabase.co/functions/v1/send-push',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := json_build_object(
            'type', 'INSERT',
            'table', TG_RELNAME,
            'schema', TG_TABLE_SCHEMA,
            'record', row_to_json(NEW),
            'old_record', null
        )::jsonb
    );
    
    RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, telefone, tipo_perfil)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nome_completo',
    new.raw_user_meta_data->>'telefone',
    new.raw_user_meta_data->>'tipo_perfil'
  );
  RETURN new;
END;
$function$

CREATE OR REPLACE FUNCTION public.increment_available_seats(route_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE routes
  SET available_seats = available_seats + 1
  WHERE id = route_id_param;
END;
$function$

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$

grant delete on table "public"."acordos" to "anon"

grant insert on table "public"."acordos" to "anon"

grant references on table "public"."acordos" to "anon"

grant select on table "public"."acordos" to "anon"

grant trigger on table "public"."acordos" to "anon"

grant truncate on table "public"."acordos" to "anon"

grant update on table "public"."acordos" to "anon"

grant delete on table "public"."acordos" to "authenticated"

grant insert on table "public"."acordos" to "authenticated"

grant references on table "public"."acordos" to "authenticated"

grant select on table "public"."acordos" to "authenticated"

grant trigger on table "public"."acordos" to "authenticated"

grant truncate on table "public"."acordos" to "authenticated"

grant update on table "public"."acordos" to "authenticated"

grant delete on table "public"."acordos" to "service_role"

grant insert on table "public"."acordos" to "service_role"

grant references on table "public"."acordos" to "service_role"

grant select on table "public"."acordos" to "service_role"

grant trigger on table "public"."acordos" to "service_role"

grant truncate on table "public"."acordos" to "service_role"

grant update on table "public"."acordos" to "service_role"

grant delete on table "public"."faltas" to "anon"

grant insert on table "public"."faltas" to "anon"

grant references on table "public"."faltas" to "anon"

grant select on table "public"."faltas" to "anon"

grant trigger on table "public"."faltas" to "anon"

grant truncate on table "public"."faltas" to "anon"

grant update on table "public"."faltas" to "anon"

grant delete on table "public"."faltas" to "authenticated"

grant insert on table "public"."faltas" to "authenticated"

grant references on table "public"."faltas" to "authenticated"

grant select on table "public"."faltas" to "authenticated"

grant trigger on table "public"."faltas" to "authenticated"

grant truncate on table "public"."faltas" to "authenticated"

grant update on table "public"."faltas" to "authenticated"

grant delete on table "public"."faltas" to "service_role"

grant insert on table "public"."faltas" to "service_role"

grant references on table "public"."faltas" to "service_role"

grant select on table "public"."faltas" to "service_role"

grant trigger on table "public"."faltas" to "service_role"

grant truncate on table "public"."faltas" to "service_role"

grant update on table "public"."faltas" to "service_role"

grant delete on table "public"."notificacoes" to "anon"

grant insert on table "public"."notificacoes" to "anon"

grant references on table "public"."notificacoes" to "anon"

grant select on table "public"."notificacoes" to "anon"

grant trigger on table "public"."notificacoes" to "anon"

grant truncate on table "public"."notificacoes" to "anon"

grant update on table "public"."notificacoes" to "anon"

grant delete on table "public"."notificacoes" to "authenticated"

grant insert on table "public"."notificacoes" to "authenticated"

grant references on table "public"."notificacoes" to "authenticated"

grant select on table "public"."notificacoes" to "authenticated"

grant trigger on table "public"."notificacoes" to "authenticated"

grant truncate on table "public"."notificacoes" to "authenticated"

grant update on table "public"."notificacoes" to "authenticated"

grant delete on table "public"."notificacoes" to "service_role"

grant insert on table "public"."notificacoes" to "service_role"

grant references on table "public"."notificacoes" to "service_role"

grant select on table "public"."notificacoes" to "service_role"

grant trigger on table "public"."notificacoes" to "service_role"

grant truncate on table "public"."notificacoes" to "service_role"

grant update on table "public"."notificacoes" to "service_role"

grant delete on table "public"."perfis" to "anon"

grant insert on table "public"."perfis" to "anon"

grant references on table "public"."perfis" to "anon"

grant select on table "public"."perfis" to "anon"

grant trigger on table "public"."perfis" to "anon"

grant truncate on table "public"."perfis" to "anon"

grant update on table "public"."perfis" to "anon"

grant delete on table "public"."perfis" to "authenticated"

grant insert on table "public"."perfis" to "authenticated"

grant references on table "public"."perfis" to "authenticated"

grant select on table "public"."perfis" to "authenticated"

grant trigger on table "public"."perfis" to "authenticated"

grant truncate on table "public"."perfis" to "authenticated"

grant update on table "public"."perfis" to "authenticated"

grant delete on table "public"."perfis" to "service_role"

grant insert on table "public"."perfis" to "service_role"

grant references on table "public"."perfis" to "service_role"

grant select on table "public"."perfis" to "service_role"

grant trigger on table "public"."perfis" to "service_role"

grant truncate on table "public"."perfis" to "service_role"

grant update on table "public"."perfis" to "service_role"

grant delete on table "public"."push_subscriptions" to "anon"

grant insert on table "public"."push_subscriptions" to "anon"

grant references on table "public"."push_subscriptions" to "anon"

grant select on table "public"."push_subscriptions" to "anon"

grant trigger on table "public"."push_subscriptions" to "anon"

grant truncate on table "public"."push_subscriptions" to "anon"

grant update on table "public"."push_subscriptions" to "anon"

grant delete on table "public"."push_subscriptions" to "authenticated"

grant insert on table "public"."push_subscriptions" to "authenticated"

grant references on table "public"."push_subscriptions" to "authenticated"

grant select on table "public"."push_subscriptions" to "authenticated"

grant trigger on table "public"."push_subscriptions" to "authenticated"

grant truncate on table "public"."push_subscriptions" to "authenticated"

grant update on table "public"."push_subscriptions" to "authenticated"

grant delete on table "public"."push_subscriptions" to "service_role"

grant insert on table "public"."push_subscriptions" to "service_role"

grant references on table "public"."push_subscriptions" to "service_role"

grant select on table "public"."push_subscriptions" to "service_role"

grant trigger on table "public"."push_subscriptions" to "service_role"

grant truncate on table "public"."push_subscriptions" to "service_role"

grant update on table "public"."push_subscriptions" to "service_role"

grant delete on table "public"."routes" to "anon"

grant insert on table "public"."routes" to "anon"

grant references on table "public"."routes" to "anon"

grant select on table "public"."routes" to "anon"

grant trigger on table "public"."routes" to "anon"

grant truncate on table "public"."routes" to "anon"

grant update on table "public"."routes" to "anon"

grant delete on table "public"."routes" to "authenticated"

grant insert on table "public"."routes" to "authenticated"

grant references on table "public"."routes" to "authenticated"

grant select on table "public"."routes" to "authenticated"

grant trigger on table "public"."routes" to "authenticated"

grant truncate on table "public"."routes" to "authenticated"

grant update on table "public"."routes" to "authenticated"

grant delete on table "public"."routes" to "service_role"

grant insert on table "public"."routes" to "service_role"

grant references on table "public"."routes" to "service_role"

grant select on table "public"."routes" to "service_role"

grant trigger on table "public"."routes" to "service_role"

grant truncate on table "public"."routes" to "service_role"

grant update on table "public"."routes" to "service_role"

grant delete on table "public"."veiculos" to "anon"

grant insert on table "public"."veiculos" to "anon"

grant references on table "public"."veiculos" to "anon"

grant select on table "public"."veiculos" to "anon"

grant trigger on table "public"."veiculos" to "anon"

grant truncate on table "public"."veiculos" to "anon"

grant update on table "public"."veiculos" to "anon"

grant delete on table "public"."veiculos" to "authenticated"

grant insert on table "public"."veiculos" to "authenticated"

grant references on table "public"."veiculos" to "authenticated"

grant select on table "public"."veiculos" to "authenticated"

grant trigger on table "public"."veiculos" to "authenticated"

grant truncate on table "public"."veiculos" to "authenticated"

grant update on table "public"."veiculos" to "authenticated"

grant delete on table "public"."veiculos" to "service_role"

grant insert on table "public"."veiculos" to "service_role"

grant references on table "public"."veiculos" to "service_role"

grant select on table "public"."veiculos" to "service_role"

grant trigger on table "public"."veiculos" to "service_role"

grant truncate on table "public"."veiculos" to "service_role"

grant update on table "public"."veiculos" to "service_role"

create policy "acordos_delete_envolvidos"
  on "public"."acordos"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = passenger_id) OR (auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id)))))

create policy "acordos_delete_motorista"
  on "public"."acordos"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))

create policy "acordos_delete_motorista_rota"
  on "public"."acordos"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))

create policy "acordos_insert_passageiro"
  on "public"."acordos"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = passenger_id))

create policy "acordos_select_envolvidos"
  on "public"."acordos"
  as permissive
  for select
  to authenticated
using (((auth.uid() = passenger_id) OR (auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id)))))

create policy "acordos_select_motorista_rota"
  on "public"."acordos"
  as permissive
  for select
  to authenticated
using ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))

create policy "acordos_update_envolvidos"
  on "public"."acordos"
  as permissive
  for update
  to authenticated
using (((auth.uid() = passenger_id) OR (auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id)))))
with check (((auth.uid() = passenger_id) OR (auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id)))))

create policy "acordos_update_motorista"
  on "public"."acordos"
  as permissive
  for update
  to authenticated
using ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))
with check ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))

create policy "acordos_update_motorista_rota"
  on "public"."acordos"
  as permissive
  for update
  to authenticated
using ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))
with check ((auth.uid() = ( SELECT routes.driver_id
   FROM public.routes
  WHERE (routes.id = acordos.route_id))))

create policy "faltas_delete_envolvidos"
  on "public"."faltas"
  as permissive
  for delete
  to authenticated
using (((auth.uid() = ( SELECT acordos.passenger_id
   FROM public.acordos
  WHERE (acordos.id = faltas.id_acordo))) OR (auth.uid() = ( SELECT r.driver_id
   FROM (public.acordos a
     JOIN public.routes r ON ((a.route_id = r.id)))
  WHERE (a.id = faltas.id_acordo)))))

create policy "faltas_insert_envolvidos"
  on "public"."faltas"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = ( SELECT acordos.passenger_id
   FROM public.acordos
  WHERE (acordos.id = faltas.id_acordo))) OR (auth.uid() = ( SELECT r.driver_id
   FROM (public.acordos a
     JOIN public.routes r ON ((a.route_id = r.id)))
  WHERE (a.id = faltas.id_acordo)))))

create policy "faltas_select_envolvidos"
  on "public"."faltas"
  as permissive
  for select
  to authenticated
using (((auth.uid() = ( SELECT acordos.passenger_id
   FROM public.acordos
  WHERE (acordos.id = faltas.id_acordo))) OR (auth.uid() = ( SELECT r.driver_id
   FROM (public.acordos a
     JOIN public.routes r ON ((a.route_id = r.id)))
  WHERE (a.id = faltas.id_acordo)))))

create policy "faltas_update_envolvidos"
  on "public"."faltas"
  as permissive
  for update
  to authenticated
using (((auth.uid() = ( SELECT acordos.passenger_id
   FROM public.acordos
  WHERE (acordos.id = faltas.id_acordo))) OR (auth.uid() = ( SELECT r.driver_id
   FROM (public.acordos a
     JOIN public.routes r ON ((a.route_id = r.id)))
  WHERE (a.id = faltas.id_acordo)))))
with check (((auth.uid() = ( SELECT acordos.passenger_id
   FROM public.acordos
  WHERE (acordos.id = faltas.id_acordo))) OR (auth.uid() = ( SELECT r.driver_id
   FROM (public.acordos a
     JOIN public.routes r ON ((a.route_id = r.id)))
  WHERE (a.id = faltas.id_acordo)))))

create policy "Users can delete their own notifications"
  on "public"."notificacoes"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id))

create policy "Users can update their own notifications"
  on "public"."notificacoes"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))

create policy "Users can view their own notifications"
  on "public"."notificacoes"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id))

create policy "perfis_select_autenticados"
  on "public"."perfis"
  as permissive
  for select
  to authenticated
using (true)

create policy "perfis_update_proprio"
  on "public"."perfis"
  as permissive
  for update
  to authenticated
using ((auth.uid() = id))
with check ((auth.uid() = id))

create policy "Users can delete their own push subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id))

create policy "Users can insert their own push subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id))

create policy "Users can update their own push subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id))

create policy "Users can view their own push subscriptions"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id))

create policy "routes_delete_proprio_motorista"
  on "public"."routes"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = driver_id))

create policy "routes_insert_proprio_motorista"
  on "public"."routes"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = driver_id))

create policy "routes_select_autenticados"
  on "public"."routes"
  as permissive
  for select
  to authenticated
using (true)

create policy "routes_update_proprio_motorista"
  on "public"."routes"
  as permissive
  for update
  to authenticated
using ((auth.uid() = driver_id))
with check ((auth.uid() = driver_id))

create policy "veiculos_delete_proprio_motorista"
  on "public"."veiculos"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = id_motorista))

create policy "veiculos_insert_proprio_motorista"
  on "public"."veiculos"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = id_motorista))

create policy "veiculos_select_autenticados"
  on "public"."veiculos"
  as permissive
  for select
  to authenticated
using (true)

create policy "veiculos_update_proprio_motorista"
  on "public"."veiculos"
  as permissive
  for update
  to authenticated
using ((auth.uid() = id_motorista))
with check ((auth.uid() = id_motorista))

CREATE TRIGGER trigger_acordos_notifications AFTER INSERT OR UPDATE ON public.acordos FOR EACH ROW EXECUTE FUNCTION public.handle_acordo_notifications()

CREATE TRIGGER on_falta_calc_desconto BEFORE INSERT OR UPDATE ON public.faltas FOR EACH ROW EXECUTE FUNCTION public.handle_falta_desconto()

CREATE TRIGGER on_notification_created_push AFTER INSERT ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification_push()

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
