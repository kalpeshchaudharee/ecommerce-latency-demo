const state = {
  products: [],
  cart: [],
  latency: false
};

const $ = id => document.getElementById(id);

async function loadProducts() {
  const response = await fetch('/api/products');
  state.products = await response.json();

  $('products').innerHTML = state.products.map(product => `
    <article class="product">
      <img src="${product.image_url}" alt="${product.name}">
      <div class="product-body">
        <small>${product.category}</small>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <strong>$${Number(product.price).toFixed(2)}</strong>
        <button onclick="addToCart(${product.id})">Add to cart</button>
      </div>
    </article>
  `).join('');
}

window.addToCart = function(productId) {
  const existing = state.cart.find(item => item.productId === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }

  renderCart();
};

function renderCart() {
  const enriched = state.cart.map(item => ({
    ...item,
    product: state.products.find(p => p.id === item.productId)
  }));

  $('cartItems').innerHTML = enriched.length
    ? enriched.map(item => `
      <div class="cart-row">
        <span>${item.product.name} × ${item.quantity}</span>
        <span>$${(Number(item.product.price) * item.quantity).toFixed(2)}</span>
      </div>
    `).join('')
    : '<p>Your cart is empty.</p>';

  const total = enriched.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  $('total').textContent = total.toFixed(2);
}

async function refreshDemoStatus() {
  const response = await fetch('/api/demo/status');
  const status = await response.json();

  state.latency = status.demoDbLatencyEnabled;
  $('demoStatus').textContent = state.latency
    ? `ON — ${status.delayMs}ms`
    : 'OFF';

  $('toggleLatency').textContent = state.latency
    ? 'Restore normal latency'
    : 'Introduce latency';
}

$('toggleLatency').addEventListener('click', async () => {
  await fetch('/api/demo/failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !state.latency })
  });

  await refreshDemoStatus();
});

$('checkout').addEventListener('click', async () => {
  if (!state.cart.length) {
    $('result').textContent = 'Add a product first.';
    return;
  }

  $('result').textContent = 'Processing order…';

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: state.cart,
      customer: {
        name: $('customerName').value,
        email: $('customerEmail').value
      }
    })
  });

  const data = await response.json();

  if (response.ok) {
    $('result').textContent =
      `Order ${data.orderId} completed. Payment: ${data.paymentTransactionId}`;
    state.cart = [];
    renderCart();
  } else {
    $('result').textContent = `Order failed: ${data.error}`;
  }
});

loadProducts();
renderCart();
refreshDemoStatus();
