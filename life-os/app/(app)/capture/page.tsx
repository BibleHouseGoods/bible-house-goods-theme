import Capture from '@/components/Capture';
import PageHeader from '@/components/PageHeader';

export default function CapturePage() {
  return (
    <>
      <PageHeader title="Capture" subtitle="Record or import. Originals are kept exactly as recorded." />
      <Capture />
    </>
  );
}
