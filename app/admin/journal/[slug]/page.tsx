import { JournalStudio } from '../../components/journal/JournalStudio';
import { getConfig } from '@/lib/config';

export default async function AdminJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <JournalStudio slug={slug} mapEnabled={getConfig().map} />;
}
