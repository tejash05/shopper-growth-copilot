import { Topbar } from '@/components/layout/topbar';
import { CustomersTable } from '@/components/customers/customers-table';

export const metadata = { title: 'Shoppers · Shopper Growth Copilot' };

export default function CustomersPage() {
  return (
    <>
      <Topbar title="Shoppers" subtitle="Customer intelligence — RFM, churn risk, lifetime value & personas" />
      <div className="p-6">
        <CustomersTable />
      </div>
    </>
  );
}
