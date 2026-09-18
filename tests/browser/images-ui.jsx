import { createRoot } from 'react-dom/client'

import { videoThumbnailSource } from '../../src/lib/video-image-source'
import { VideoThumbnail } from '../../src/modules/videos/ui/components/video-thumbnail'

createRoot(document.getElementById('root')).render(
  <div style={{ width: 320 }}>
    <style>{`
      .relative { position: relative; }
      .aspect-video { aspect-ratio: 16 / 9; }
      .opacity-0 { opacity: 0; }
      .opacity-100 { opacity: 1; }
      .hidden { display: none; }
      .pointer-events-none { pointer-events: none; }
      img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    `}</style>
    <div data-testid="thumbnail">
      <VideoThumbnail title="Test video" imageUrl="/test-cover.png" previewUrl="/test-preview.gif" duration={60} />
    </div>
    <div data-testid="no-preview">
      <VideoThumbnail title="Without preview" imageUrl="/test-cover.png" duration={60} />
    </div>
    {['public', 'private'].map(visibility => (
      <VideoThumbnail
        key={`${visibility}-mux`}
        title={`${visibility} mux`}
        imageUrl={videoThumbnailSource({
          id: '00000000-0000-4000-8000-000000000002',
          visibility,
          thumbnailKey: null,
          muxPlaybackId: 'test-mux',
          thumbnailUrl: '/test-cover.png',
        })}
        duration={60}
      />
    ))}
    {['public', 'private'].map(visibility => (
      <VideoThumbnail
        key={visibility}
        title={`${visibility} custom`}
        imageUrl={videoThumbnailSource({
          id: '00000000-0000-4000-8000-000000000002',
          visibility,
          thumbnailKey: 'cover',
          thumbnailUrl: '/test-cover.png',
        })}
        duration={60}
      />
    ))}
  </div>
)
