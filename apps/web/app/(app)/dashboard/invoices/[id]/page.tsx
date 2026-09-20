"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

export default function InvoicePrintViewPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoices/${invoiceId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch invoice");
      return res.json();
    },
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading invoice...</div>;
  }

  if (error || !data?.invoice) {
    return <div className="p-8 text-center text-red-500">Invoice not found or error loading.</div>;
  }

  const { invoice, lineItems } = data;
  const project = invoice.project || {};
  const client = project.client || {};

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center py-8">
      {/* Non-printable controls */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 px-4 print:hidden">
        <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={() => window.print()} className="flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </Button>
      </div>

      {/* Printable Area */}
      <div className="w-full max-w-4xl bg-white shadow-sm border rounded-sm p-12 print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-12 border-b pb-8">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-neutral-900 uppercase">Invoice</h1>
            <p className="text-sm text-neutral-500 mt-2 font-mono">{invoice.documentNumber}</p>
          </div>
          <div className="text-right">
            <h2 className="font-semibold text-lg">{invoice.issuedToClientName || client.name}</h2>
            {client.address && <p className="text-sm text-neutral-600 whitespace-pre-line">{client.address}</p>}
            {client.email && <p className="text-sm text-neutral-600">{client.email}</p>}
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-8 mb-12 text-sm">
          <div>
            <h3 className="font-semibold text-neutral-900 mb-2">Details</h3>
            <div className="grid grid-cols-2 gap-2 text-neutral-600">
              <span>Date:</span>
              <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
              <span>Status:</span>
              <span className="capitalize">{invoice.status.replace("_", " ")}</span>
              <span>Currency:</span>
              <span className="uppercase">{invoice.currency}</span>
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-neutral-900 mb-2">Project</h3>
            <p className="text-neutral-600">{project.name || "N/A"}</p>
            {project.internalId && <p className="text-neutral-500 text-xs mt-1">Ref: {project.internalId}</p>}
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-12">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-neutral-50 text-neutral-600 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lineItems
                ?.sort((a: any, b: any) => a.displayOrder - b.displayOrder)
                .map((item: any) => (
                  <tr key={item.id} className="group">
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-neutral-900">{item.label}</div>
                      {item.subDescription && (
                        <div className="text-xs text-neutral-500 mt-1">{item.subDescription}</div>
                      )}
                      {item.qualifier && (
                        <div className="inline-block px-2 py-0.5 mt-2 text-[10px] font-medium bg-neutral-100 text-neutral-600 rounded">
                          {item.qualifier}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-neutral-900 align-top">
                      {formatCurrency(parseFloat(item.totalValue), invoice.currency)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t pt-8">
          <div className="w-64 space-y-3 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>{formatCurrency(parseFloat(invoice.totalBaseAmount), invoice.currency)}</span>
            </div>
            {parseFloat(invoice.totalChargesAmount) > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Charges / Tax</span>
                <span>{formatCurrency(parseFloat(invoice.totalChargesAmount), invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-semibold text-neutral-900 pt-4 border-t border-neutral-200">
              <span>Total</span>
              <span>{formatCurrency(parseFloat(invoice.grandTotalAmount), invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        {invoice.notes && (
          <div className="mt-16 pt-8 border-t text-sm text-neutral-500">
            <h4 className="font-semibold text-neutral-700 mb-2">Notes</h4>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
