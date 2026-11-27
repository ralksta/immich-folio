import { JournalStudio } from '../../components/journal/JournalStudio';
import { getConfig } from '@/lib/config';

export default async function AdminJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getConfig();
  return <JournalStudio slug={slug} mapEnabled={config.map} mapTiles={config.mapTiles} />;
}
