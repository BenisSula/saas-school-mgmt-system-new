import { BrandProvider } from '../BrandProvider';
import { Button } from './Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { DatePicker } from '../DatePicker';
import { Table } from '../Table';

const demoOptions = [
  { label: 'Option A', value: 'A' },
  { label: 'Option B', value: 'B' },
  { label: 'Option C', value: 'C' }
];

const demoTableColumns = [
  { header: 'Name', key: 'name' as const },
  { header: 'Role', key: 'role' as const }
];

const demoTableData = [
  { name: 'Jane Doe', role: 'Teacher' },
  { name: 'John Smith', role: 'Admin' }
];

/**
 * `ExamplesGallery` renders the core UI components in a single view.
 * It is intended for manual visual review and regression checks without requiring Storybook.
 */
export function ExamplesGallery() {
  return (
    <BrandProvider>
      <div className="space-y-6 bg-[var(--brand-surface)] p-6 text-[var(--brand-surface-contrast)]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading>Loading</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Form controls</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Text input" placeholder="Type here…" helperText="Helper text" />
            <Input label="Input with error" error="Invalid value" defaultValue="Oops" />
            <Select label="Select menu" options={demoOptions} defaultValue="A" />
            <DatePicker label="Date picker" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Table</h2>
          <Table columns={demoTableColumns} data={demoTableData} caption="Demo table" />
        </section>
      </div>
    </BrandProvider>
  );
}

export default ExamplesGallery;
