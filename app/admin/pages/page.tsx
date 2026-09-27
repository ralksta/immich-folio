import PageBuilder from '../components/PageBuilder';
import PageHeader from '../components/PageHeader';

export default function AdminPagesPage() {
  return (
    <>
      <PageHeader
        kicker="Content"
        title="Pages"
        description="The home page hero, standalone albums, subpages and content pages. Drag to reorder; changes go live when saved."
      />
      <PageBuilder />
    </>
  );
}
