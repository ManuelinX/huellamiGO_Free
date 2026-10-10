# HuellamiGO Front

App Next.js de HuellamiGO.

## Stack actual

- Next.js App Router.
- React.
- Leaflet para mapas.
- Backend Express mediante `NEXT_PUBLIC_API_URL`.
- Auth JWT guardada localmente.
- Uploads por backend.
- Notificaciones in-app y Web Push opcional.

## Arranque

```bash
npm install
npm run dev
```

Produccion:

```bash
npm run build
npm run start
```

## Variable principal

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Documentación

La documentación vigente está en [`documentation/README.md`](./documentation/README.md).
Las notas no vigentes o pendientes están en [`documentation/pendientes`](./documentation/pendientes/README.md).

No subir `.env.local`, builds, logs, backups pesados ni archivos con información sensible.
