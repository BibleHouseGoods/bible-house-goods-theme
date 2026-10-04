import Capture from '@/components/Capture';
import PageHeader from '@/components/PageHeader';

export default function CapturePage() {
  return (
    <>
      <PageHeader eyebrow="New recording" title="Capture" subtitle="Say it once. The original is kept exactly as recorded." />
      <Capture />
    </>
  );
}
