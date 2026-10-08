INSERT INTO products (name, description, price, category, image_url)
SELECT * FROM (VALUES
  ('Cloud Hoodie', 'Soft developer hoodie for late-night deployments.', 49.99, 'Apparel', 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800'),
  ('DevOps Mug', 'A coffee mug for infrastructure engineers.', 19.99, 'Accessories', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800'),
  ('Observability Notebook', 'Notebook for metrics, traces and incident notes.', 14.99, 'Stationery', 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800'),
  ('Cloud Cap', 'Minimal cap for cloud builders.', 24.99, 'Apparel', 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800')
) AS v(name, description, price, category, image_url)
WHERE NOT EXISTS (SELECT 1 FROM products);
