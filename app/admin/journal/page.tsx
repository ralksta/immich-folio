import { JournalStudio } from '../components/journal/JournalStudio';
import { getConfig } from '@/lib/config';

export default function AdminJournalPage() {
  return <JournalStudio mapEnabled={getConfig().map} />;
}
