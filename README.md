# frontend-web

Cloud-side Next.js console for local auth, stream/recording control, database
sync state, and embedded mediasoup WebRTC viewing.

The live viewer is rendered inside the cloud dashboard and talks directly to the
local diploma media server:

```env
NEXT_PUBLIC_MEDIA_SERVER_URL=http://localhost:3010
NEXT_PUBLIC_MEDIA_VIEWER_TOKEN=local-viewer-token
```
