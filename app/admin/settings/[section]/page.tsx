import SettingsEditor from '../../components/SettingsEditor';

export default async function AdminSettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <SettingsEditor section={section} />;
}
