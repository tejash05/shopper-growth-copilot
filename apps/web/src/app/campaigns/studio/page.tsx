import { Topbar } from '@/components/layout/topbar';
import { CampaignStudio } from '@/components/campaigns/campaign-studio';

export const metadata = { title: 'Campaign Studio · Shopper Growth Copilot' };

export default function StudioPage() {
  return (
    <>
      <Topbar title="AI Campaign Studio" subtitle="From business goal to launched, personalised campaign" />
      <div className="p-6">
        <CampaignStudio />
      </div>
    </>
  );
}
