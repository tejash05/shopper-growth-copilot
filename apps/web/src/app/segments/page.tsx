import { Topbar } from '@/components/layout/topbar';
import { SegmentBuilder } from '@/components/segments/segment-builder';
import { SavedSegmentsList } from '@/components/segments/saved-segments-list';

export const metadata = { title: 'Segments · Shopper Growth Copilot' };

export default function SegmentsPage() {
  return (
    <>
      <Topbar title="Segment Builder" subtitle="Turn plain-English intent into precise, saveable audiences" />
      <div className="space-y-6 p-6">
        <SegmentBuilder />
        <SavedSegmentsList />
      </div>
    </>
  );
}
