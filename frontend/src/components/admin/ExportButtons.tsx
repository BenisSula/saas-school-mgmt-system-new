import { Button } from '../ui/Button';

interface ExportButtonsProps {
  onExportCSV: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  disabled?: boolean;
}

export function ExportButtons({
  onExportCSV,
  onExportPDF,
  onExportExcel,
  disabled = false,
}: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={onExportCSV} disabled={disabled}>
        Export CSV
      </Button>
      {onExportPDF && (
        <Button size="sm" variant="outline" onClick={onExportPDF} disabled={disabled}>
          Export PDF
        </Button>
      )}
      {onExportExcel && (
        <Button size="sm" variant="outline" onClick={onExportExcel} disabled={disabled}>
          Export Excel
        </Button>
      )}
    </div>
  );
}
