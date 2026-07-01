import React from "react";
import { Download } from "lucide-react";

export default function ExportButton({ data, config }) {
  const handleExport = () => {
    if (!data.length) return;

    const { filename = "export", columns } = config;
    const headers = columns.map((c) => c.label);
    const csvRows = [headers.join(",")];

    data.forEach((item) => {
      const row = columns.map((col) => {
        const raw = col.render ? col.render(item) : (item[col.key] ?? "");
        const str = String(raw).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str}"`
          : str;
      });
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      title="Export CSV"
      className="p-2 rounded-md shadow-sm border border-grayborder bg-white text-gray-text hover:bg-gray-50 transition-colors"
    >
      <Download size={17} />
    </button>
  );
}
