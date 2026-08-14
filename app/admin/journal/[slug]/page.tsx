import { JournalStudio } from '../../components/JournalStudio';

export default async function AdminJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <JournalStudio slug={slug} />;
}
