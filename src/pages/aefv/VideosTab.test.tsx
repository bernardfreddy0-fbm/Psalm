// src/pages/aefv/VideosTab.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VideosTab } from './VideosTab';
import type { MergedVideo } from '@/lib/aefvVideos';

afterEach(cleanup);

const merged: MergedVideo[] = [
  { video_id: 'pub1', title: 'Culte du 25/05', thumbnail: 't', url: 'u',
    published: new Date('2026-05-25T00:00:00Z'), status: 'publie',
    stats: { videoId: 'pub1', viewCount: 200, likeCount: 5, commentCount: 0 }, isLate: false,
    fiche: { video_id: 'pub1', sunday_id: null, preacher: 'Past. X', theme: 'Espérance', status: 'publie', assigned_to: null, filmed_by: null, checklist: { montage: true, subtitles: true, thumbnail: true, description_yt: true, published: true }, updated_at: null } },
  { video_id: 'prod1', title: 'prod1', thumbnail: 't', url: 'u',
    published: undefined, status: 'montage', isLate: true,
    fiche: { video_id: 'prod1', sunday_id: null, preacher: null, theme: 'En cours', status: 'montage', assigned_to: null, filmed_by: null, checklist: { montage: false, subtitles: false, thumbnail: false, description_yt: false, published: false }, updated_at: null } },
];

describe('VideosTab', () => {
  it('affiche le pipeline par défaut avec les colonnes de statut', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('bascule en Catalogue et ne montre que les vidéos publiées', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    fireEvent.click(screen.getByText('Catalogue'));
    expect(screen.getByText('Mai 2026')).toBeInTheDocument();
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });

  it('affiche un avertissement quand le flux chaîne est en erreur', () => {
    render(<VideosTab merged={merged} team={[]} channelError={true} isLoading={false} />);
    expect(screen.getByText(/Vidéothèque de la chaîne indisponible/)).toBeInTheDocument();
  });

  it('filtre par recherche', () => {
    render(<VideosTab merged={merged} team={[]} channelError={false} isLoading={false} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: 'Espérance' } });
    expect(screen.getByText('Espérance')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });
});
