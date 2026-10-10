# Vaciar registros de la base de datos

Este comando elimina **solo registros**. No elimina tablas, columnas, indices, triggers ni extensiones.

Usalo solo en una base de desarrollo o despues de tener respaldo.

El listado incluye las tablas vigentes del flujo actual: auth propia, perfiles, reportes, avistamientos, presencia, notificaciones, logs y preferencias.

```sql
truncate table
  public.web_push_subscriptions,
  public.notification_logs,
  public.notifications,
  public.notification_preferences,
  public.email_verification_tokens,
  public.password_reset_tokens,
  public.app_presence,
  public.sightings,
  public.pet_photos,
  public.pet_reports,
  public.profiles,
  public.app_users
restart identity cascade;
```

Si quieres conservar usuarios/cuentas y borrar solo actividad/reportes/notificaciones:

```sql
truncate table
  public.web_push_subscriptions,
  public.notification_logs,
  public.notifications,
  public.notification_preferences,
  public.app_presence,
  public.sightings,
  public.pet_photos,
  public.pet_reports
restart identity cascade;
```
