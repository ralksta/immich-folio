import { JournalStudio } from '../components/JournalStudio';
import { getConfig } from '@/lib/config';

export default function AdminJournalPage() {
  return <JournalStudio mapEnabled={getConfig().map} />;
}
