import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Product Name",
      "Total Price",
      "Status",
      "Date",
      "Customer",
      "Address",
    ];
    const csvContent = [
      headers.join(","),
      ...orders.map((o) =>
        [
          o.id,
          \`"\${o.product_name.replace(/"/g, '""')}"\`,
          o.total_price,
          o.status,
          format(new Date(o.created_at), "yyyy-MM-dd HH:mm:ss"),
          \`"\${o.customer_name.replace(/"/g, '""')}"\`,
          \`"\${o.address.replace(/"/g, '""')}, \${o.city.replace(/"/g, '""')}"\`,
        ].join(","),
      ),
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      \`orders_export_\${format(new Date(), "yyyyMMdd_HHmmss")}.csv\`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders exported as CSV!");
  };`;

const replacement = `  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Product Name",
      "Total Price",
      "Status",
      "Date",
      "Customer",
      "Address",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredOrders.map((o) =>
        [
          o.id,
          \`"\${o.product_name.replace(/"/g, '""')}"\`,
          o.total_price,
          o.status,
          format(new Date(o.created_at), "yyyy-MM-dd HH:mm:ss"),
          \`"\${o.customer_name.replace(/"/g, '""')}"\`,
          \`"\${o.address.replace(/"/g, '""')}, \${o.city.replace(/"/g, '""')}"\`,
        ].join(","),
      ),
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      \`accounting_orders_export_\${format(new Date(), "yyyyMMdd_HHmmss")}.csv\`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders exported as CSV for Accounting!");
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
console.log("Replaced:", content.includes("Orders exported as CSV for Accounting!"));
