const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

const ADMIN_PASSWORD = '12345';

function checkAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({
      error: 'Доступ запрещён. Нужен пароль администратора.'
    });
  }

  next();
}

function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ items: [] }, null, 2), 'utf8');
  }

  const content = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(content);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

const db = loadDatabase();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/items', (req, res) => {
  res.json(db.items);
});

app.post('/api/items', checkAdmin, (req, res) => {
  const { name, barcode, brand, quantity, unit } = req.body;

  if (
    !name ||
    !barcode ||
    !brand ||
    typeof quantity !== 'number' ||
    quantity < 0 ||
    !unit
  ) {
    return res.status(400).json({
      error: 'Заполните все обязательные поля корректно.'
    });
  }

  const item = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name,
    barcode,
    brand,
    quantity,
    unit,
    createdAt: new Date().toISOString()
  };

  db.items.push(item);
  saveDatabase(db);

  res.status(201).json(item);
});

app.put('/api/items/:id', checkAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const { name, barcode, brand, quantity, unit } = req.body;

  if (
    !name ||
    !barcode ||
    !brand ||
    typeof quantity !== 'number' ||
    quantity < 0 ||
    !unit
  ) {
    return res.status(400).json({
      error: 'Заполните все обязательные поля корректно.'
    });
  }

  const index = db.items.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return res.status(404).json({
      error: 'Товар не найден.'
    });
  }

  db.items[index] = {
    ...db.items[index],
    name,
    barcode,
    brand,
    quantity,
    unit,
    updatedAt: new Date().toISOString()
  };

  saveDatabase(db);
  res.json(db.items[index]);
});

app.delete('/api/items/:id', checkAdmin, (req, res) => {
  const itemId = Number(req.params.id);

  const index = db.items.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return res.status(404).json({
      error: 'Товар не найден.'
    });
  }

  const deletedItem = db.items[index];
  db.items.splice(index, 1);
  saveDatabase(db);

  res.json({
    message: 'Товар удалён.',
    item: deletedItem
  });
});

app.listen(PORT, () => {
  console.log(`Warehouse inventory server started at http://localhost:${PORT}`);
});