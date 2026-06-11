export const CUSTOMER_CSV_TEMPLATE = `externalCustomerId,firstName,lastName,email,phone,city,state,preferredChannel,loyaltyTier,consentWhatsApp,consentSms,consentEmail,consentRcs
CUST001,Priya,Sharma,priya@example.com,9876543210,Bangalore,Karnataka,WHATSAPP,GOLD,true,true,true,false
CUST002,Arjun,Mehta,arjun@example.com,9123456780,Mumbai,Maharashtra,EMAIL,SILVER,true,false,true,false`;

export const ORDER_CSV_TEMPLATE = `externalOrderId,externalCustomerId,customerEmail,customerPhone,orderDate,orderValue,currency,category,productName,quantity,status
ORD001,CUST001,priya@example.com,,2026-05-20,2499,INR,FASHION,Summer Floral Dress,1,COMPLETED
ORD002,CUST002,arjun@example.com,,2026-05-18,1799,INR,BEAUTY,Vitamin C Serum,1,COMPLETED`;

export const JSON_TEMPLATE = {
  customers: [
    {
      externalCustomerId: 'CUST001',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya@example.com',
      phone: '9876543210',
      city: 'Bangalore',
      state: 'Karnataka',
      preferredChannel: 'WHATSAPP',
      loyaltyTier: 'GOLD',
      consentWhatsApp: true,
      consentSms: true,
      consentEmail: true,
      consentRcs: false,
    },
  ],
  orders: [
    {
      externalOrderId: 'ORD001',
      externalCustomerId: 'CUST001',
      customerEmail: 'priya@example.com',
      orderDate: '2026-05-20',
      orderValue: 2499,
      currency: 'INR',
      category: 'FASHION',
      productName: 'Summer Floral Dress',
      quantity: 1,
      status: 'COMPLETED',
    },
  ],
};

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJsonTemplate() {
  downloadTextFile(
    'shopper-import-template.json',
    `${JSON.stringify(JSON_TEMPLATE, null, 2)}\n`,
    'application/json',
  );
}

export function downloadCustomerCsvTemplate() {
  downloadTextFile('customers-template.csv', `${CUSTOMER_CSV_TEMPLATE}\n`, 'text/csv');
}

export function downloadOrderCsvTemplate() {
  downloadTextFile('orders-template.csv', `${ORDER_CSV_TEMPLATE}\n`, 'text/csv');
}
