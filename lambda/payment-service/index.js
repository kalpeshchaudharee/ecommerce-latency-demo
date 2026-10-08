'use strict';

exports.handler = async (event) => {
  const delayMs = Number(process.env.PAYMENT_DEMO_DELAY_MS || 0);

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.log(JSON.stringify({
    level: 'INFO',
    service: 'payment-service',
    message: 'payment authorization requested',
    orderId: event.orderId,
    amount: event.amount
  }));

  return {
    authorized: true,
    transactionId: `pay-${event.orderId}`
  };
};
