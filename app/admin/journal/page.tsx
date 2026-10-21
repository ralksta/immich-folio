import { JournalStudio } from '../components/journal/JournalStudio';
import { getConfig } from '@/lib/config';

export default function AdminJournalPage() {
  const config = getConfig();
  return <JournalStudio mapEnabled={config.map} mapTiles={config.mapTiles} />;
}
