import { ImageResponse } from 'next/og';

export const alt = 'USPS Form 1583 online notarization guide for Anytime Mailbox';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          color: '#eaf6fb',
          backgroundImage: 'linear-gradient(135deg, #06243b 0%, #0a4a4f 55%, #0d6a5f 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#34d0c0',
            }}
          />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>usaddres.com</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 4,
              color: '#9fe3da',
            }}
          >
            USPS FORM 1583 · ONLINE NOTARIZATION
          </div>
          <div style={{ display: 'flex', fontSize: 66, fontWeight: 800, lineHeight: 1.1 }}>
            Activate Your Anytime Mailbox Address
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#cfeaf2' }}>
            Online Notary (OneNotary) · No SSN Path · 2026 Update
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['Form 1583', 'Remote Notary', 'Step by Step'].map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                padding: '12px 22px',
                borderRadius: 999,
                fontSize: 24,
                fontWeight: 700,
                color: '#06303a',
                background: 'rgba(255,255,255,0.92)',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
