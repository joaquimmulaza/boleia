# Diffs normalizados vs corpo anterior em `main`

## `handle_new_notification_push`

**Base:** `20260329161035_remote_schema.sql`

```diff
+ SET search_path TO 'public', 'vault', 'extensions'
+ DECLARE v_push_secret text; v_headers jsonb;
+ SELECT ds.decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret'
+ IF secret missing → headers só Content-Type + PERFORM net.http_post (legado v7)
+ IF secret present → header x-boleia-push-secret
+ headers incluem x-boleia-push-secret
+ EXCEPTION WHEN OTHERS → RAISE LOG, RETURN NEW
+ REVOKE EXECUTE FROM PUBLIC, anon, authenticated
```

## `create_proposal`

**Base:** `20260929233345_pacote_eng29_proposta_idempotency.sql`

```diff
+ DECLARE v_n_membros_activos integer;
+ IF p_grupo_id IS NOT NULL THEN
+   validar grupos.procura_id = p_procura_id
+   se owner: exige membro activo no grupo
+   COUNT membros activos; rejeitar se p_n_passageiros_propostos >
+ END IF;
```
