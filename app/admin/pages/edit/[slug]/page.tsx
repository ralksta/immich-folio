import { PageContentEditor } from '../../../components/page-builder/PageContentEditor';

/** The block editor for one content page (#722), reached from Pages. */
export default async function AdminPageContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PageContentEditor slug={slug} />;
}
