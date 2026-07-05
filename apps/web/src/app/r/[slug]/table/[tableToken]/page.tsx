import { Metadata } from 'next';
import GuestPortal from './GuestPortal';

interface Props { params: Promise<{ slug: string; tableToken: string }>; }

// Server-side fetch needs an absolute URL (NEXT_PUBLIC_API_URL is a relative /api proxy path)
const API_INTERNAL = process.env.API_INTERNAL_URL || 'http://localhost:5000/api';

interface PublicBranding {
  primaryColor: string; secondaryColor: string; accentColor: string;
  backgroundColor: string; fontFamily: string; restaurantName: string;
  tagline?: string; logoUrl?: string; faviconUrl?: string;
  paymentQrUrl?: string;
}

const DEFAULT_BRANDING: PublicBranding = {
  primaryColor: '#E85D04', secondaryColor: '#1A1A2E', accentColor: '#F5A623',
  backgroundColor: '#FFFFFF', fontFamily: 'Inter', restaurantName: '',
};

async function fetchBranding(slug: string): Promise<PublicBranding> {
  try {
    const res = await fetch(`${API_INTERNAL}/restaurant/public/${encodeURIComponent(slug)}/branding`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_BRANDING;
    const data = await res.json();
    return { ...DEFAULT_BRANDING, ...data.branding, paymentQrUrl: data.paymentQrUrl };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const branding = await fetchBranding(slug);
  return {
    title: branding.restaurantName ? `${branding.restaurantName} — order at your table` : `Order at table — ${slug}`,
    ...(branding.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
  };
}

export default async function GuestPage({ params }: Props) {
  const { slug, tableToken } = await params;
  const branding = await fetchBranding(slug);

  const cssVars = [
    `--primary:${branding.primaryColor}`,
    `--secondary:${branding.secondaryColor}`,
    `--accent:${branding.accentColor}`,
    `--bg:${branding.backgroundColor}`,
  ].join(';');

  return (
    <div style={{ fontFamily: branding.fontFamily, backgroundColor: branding.backgroundColor, minHeight: '100vh' }}>
      <style>{`:root{${cssVars}}`}</style>
      <GuestPortal
        slug={slug}
        tableToken={tableToken}
        restaurantName={branding.restaurantName}
        tagline={branding.tagline}
        logoUrl={branding.logoUrl}
        paymentQrUrl={branding.paymentQrUrl}
      />
    </div>
  );
}
