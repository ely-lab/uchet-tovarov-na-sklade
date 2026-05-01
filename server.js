// 🔐 ПОДКЛЮЧЕНИЕ
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 📦 ЗАГРУЗКА ФАЙЛОВ
const upload = multer({ dest: 'uploads/' });

// 👥 ПОЛЬЗОВАТЕЛИ
const USERS = [
  { username: 'admin', password: '12345', role: 'head_office', warehouse: 'all' },
  { username: 'jalalabad', password: '0304', role: 'branch', warehouse: 'Жалал-Абад' },
  { username: 'bishkek', password: '0000', role: 'branch', warehouse: 'Бишкек' },
  { username: 'osh', password: '0302', role: 'branch', warehouse: 'Ош' },
  { username: 'balykchi', password: '0305', role: 'branch', warehouse: 'Балыкчи' },
  { username: 'karakol', password: '0306', role: 'branch', warehouse: 'Каракол' },
  { username: 'osh_market', password: '0308', role: 'branch', warehouse: 'Ошский рынок' },
  { username: 'talas', password: '0309', role: 'branch', warehouse: 'Талас' }
];

// 📂 ЗАГРУЗКА БАЗЫ
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      items: [],
      history: [],
      invoices: [],
      shippingLists: []
    }, null, 2));
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  db.items = db.items || [];
  db.history = db.history || [];
  db.invoices = db.invoices || [];
  db.shippingLists = db.shippingLists || [];

  return db;
}

// 💾 СОХРАНЕНИЕ БАЗЫ
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDB();
const sessions = new Map();

// 🧠 ИСТОРИЯ
function addHistory(entry) {
  db.history = db.history || [];

  db.history.push({
    id: Date.now(),
    ...entry,
    date: new Date().toISOString()
  });

  saveDB(db);
}

// 🔐 ВХОД
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = USERS.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = crypto.randomBytes(24).toString('hex');

  const safeUser = {
    username: user.username,
    role: user.role,
    warehouse: user.warehouse
  };

  sessions.set(token, safeUser);
  res.json({ user: safeUser, token });
});

// 🔐 ПРОВЕРКА ДОСТУПА
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  req.user = sessions.get(token);
  next();
}

// 🚪 ВЫХОД
app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7).trim();
  sessions.delete(token);
  res.json({ success: true });
});

// 📦 ПОЛУЧИТЬ ТОВАРЫ
app.get('/api/items', requireAuth, (req, res) => {
  if (req.user.role === 'head_office') {
    return res.json(db.items);
  }

  const filtered = db.items.filter(i => i.warehouse === req.user.warehouse);
  res.json(filtered);
});

// ➕ ДОБАВИТЬ ТОВАР
app.post('/api/items', requireAuth, (req, res) => {
  const { name, barcode, brand, quantity, unit } = req.body;

  if (!name || !barcode || !brand || typeof quantity !== 'number' || !unit) {
    return res.status(400).json({ error: 'Некорректные данные товара' });
  }

  const warehouse = req.user.role === 'head_office'
    ? 'Жалал-Абад'
    : req.user.warehouse;

  const item = {
    id: Date.now(),
    name,
    barcode,
    brand,
    quantity,
    unit,
    warehouse,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(item);
  saveDB(db);

  addHistory({
    action: 'create',
    user: req.user.username,
    text: `Создан товар: ${name} (${quantity} ${unit})`
  });

  res.json(item);
});

// ✏️ ИЗМЕНИТЬ ТОВАР
app.put('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, barcode, brand, quantity, unit } = req.body;

  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  const oldQuantity = item.quantity;

  item.name = name ?? item.name;
  item.barcode = barcode ?? item.barcode;
  item.brand = brand ?? item.brand;
  item.quantity = typeof quantity === 'number' ? quantity : item.quantity;
  item.unit = unit ?? item.unit;
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'update',
    user: req.user.username,
    text: `Изменён товар: ${item.name}. Было: ${oldQuantity}, стало: ${item.quantity}`
  });

  res.json(item);
});

// ❌ УДАЛИТЬ ТОВАР
app.delete('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const index = db.items.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  const removed = db.items.splice(index, 1)[0];
  saveDB(db);

  addHistory({
    action: 'delete',
    user: req.user.username,
    text: `Удалён товар: ${removed.name}`
  });

  res.json({ success: true });
});

// 🔻 СПИСАНИЕ
app.post('/api/items/:id/writeoff', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { amount } = req.body;

  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Некорректное количество' });
  }

  if (item.quantity < amount) {
    return res.status(400).json({ error: 'Недостаточно товара' });
  }

  item.quantity -= amount;
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'writeoff',
    user: req.user.username,
    text: `Списание: ${item.name} -${amount} ${item.unit}`
  });

  res.json(item);
});

// 📋 ИНВЕНТАРИЗАЦИЯ
app.post('/api/inventory/recount', requireAuth, (req, res) => {
  const { barcode, countedQty } = req.body;

  const item = db.items.find(i =>
    i.barcode === barcode &&
    (req.user.role === 'head_office' || i.warehouse === req.user.warehouse)
  );

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден на складе пользователя' });
  }

  if (typeof countedQty !== 'number' || countedQty < 0) {
    return res.status(400).json({ error: 'Некорректный фактический остаток' });
  }

  const before = item.quantity;
  item.quantity = countedQty;
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'inventory',
    user: req.user.username,
    text: `Инвентаризация ${item.name}: было ${before}, стало ${countedQty}`
  });

  res.json(item);
});

// 🔄 ПЕРЕМЕЩЕНИЕ
app.post('/api/transfers', requireAuth, (req, res) => {
  const { barcode, toWarehouse, amount } = req.body;

  if (!barcode || !toWarehouse || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Некорректные данные перемещения' });
  }

  const fromWarehouse = req.user.role === 'head_office'
    ? (req.body.fromWarehouse || 'Жалал-Абад')
    : req.user.warehouse;

  const fromItem = db.items.find(i =>
    i.barcode === barcode &&
    i.warehouse === fromWarehouse
  );

  if (!fromItem) {
    return res.status(404).json({ error: 'Товар не найден на складе отправителя' });
  }

  if (fromItem.quantity < amount) {
    return res.status(400).json({ error: 'Недостаточно товара для перемещения' });
  }

  let toItem = db.items.find(i =>
    i.barcode === barcode &&
    i.warehouse === toWarehouse
  );

  fromItem.quantity -= amount;
  fromItem.updatedAt = new Date().toISOString();

  if (!toItem) {
    toItem = {
      id: Date.now(),
      name: fromItem.name,
      barcode: fromItem.barcode,
      brand: fromItem.brand,
      quantity: 0,
      unit: fromItem.unit,
      warehouse: toWarehouse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.items.push(toItem);
  }

  toItem.quantity += amount;
  toItem.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'transfer',
    user: req.user.username,
    text: `Перемещение ${fromItem.name}: ${amount} ${fromItem.unit} из ${fromWarehouse} в ${toWarehouse}`
  });

  res.json({ success: true, from: fromItem, to: toItem });
});

// 📄 ПОЛУЧИТЬ НАКЛАДНЫЕ
app.get('/api/invoices', requireAuth, (req, res) => {
  const invoices = (db.invoices || []).filter(inv => {
    return req.user.role === 'head_office' || inv.warehouse === req.user.warehouse;
  });

  res.json(invoices);
});

// 🔁 ВОЗВРАТ ПО НАКЛАДНОЙ
app.post('/api/returns', requireAuth, (req, res) => {
  const { invoiceId, items } = req.body;

  const invoice = (db.invoices || []).find(i => Number(i.id) === Number(invoiceId));

  if (!invoice) {
    return res.status(404).json({ error: 'Накладная не найдена' });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Не выбраны товары для возврата' });
  }

  let processed = 0;

  for (const returnItem of items) {
    if (!returnItem.barcode || typeof returnItem.quantity !== 'number' || returnItem.quantity <= 0) {
      continue;
    }

    const invoiceLine = (invoice.items || []).find(i => i.barcode === returnItem.barcode);

    if (!invoiceLine) {
      continue;
    }

    if (returnItem.quantity > invoiceLine.quantity) {
      return res.status(400).json({
        error: `Количество возврата по товару "${invoiceLine.name}" больше количества в накладной`
      });
    }

    let stockItem = db.items.find(i =>
      i.barcode === returnItem.barcode &&
      i.warehouse === invoice.warehouse
    );

    if (!stockItem) {
      stockItem = {
        id: Date.now() + processed,
        name: invoiceLine.name,
        barcode: invoiceLine.barcode,
        brand: invoiceLine.brand || 'Без бренда',
        quantity: 0,
        unit: invoiceLine.unit || 'шт',
        warehouse: invoice.warehouse,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.items.push(stockItem);
    }

    stockItem.quantity += returnItem.quantity;
    stockItem.updatedAt = new Date().toISOString();
    processed++;
  }

  saveDB(db);

  addHistory({
    action: 'return',
    user: req.user.username,
    text: `Возврат по накладной №${invoiceId}. Позиций: ${processed}`
  });

  res.json({ success: true, processed });
});

// 📦 ЗАГРУЗКА ZIP С НАКЛАДНЫМИ
app.post('/api/upload-invoices', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  try {
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();

    let imported = 0;

    entries.forEach(entry => {
      if (entry.isDirectory) return;
      if (!entry.entryName.toLowerCase().endsWith('.json')) return;

      const data = entry.getData().toString('utf8');
      const invoice = JSON.parse(data);

      if (!invoice.id || !Array.isArray(invoice.items)) {
        return;
      }

      const exists = db.invoices.some(i => Number(i.id) === Number(invoice.id));

      if (!exists) {
        db.invoices.push(invoice);
        imported++;
      }
    });

    saveDB(db);

    addHistory({
      action: 'invoice_import',
      user: req.user.username,
      text: `Импорт накладных из ZIP. Загружено: ${imported}`
    });

    fs.unlinkSync(req.file.path);

    res.json({ success: true, imported });
  } catch (err) {
    return res.status(400).json({ error: 'Ошибка чтения ZIP-архива' });
  }
});

// 📋 РЕЕСТРЫ
app.get('/api/registries/shipping-lists', requireAuth, (req, res) => {
  const fromShippingLists = (db.shippingLists || [])
    .filter(pl => (pl.source || '1c') === '1c');

  const fromInvoices = (db.invoices || [])
    .filter(o => (o.docType || '').toLowerCase() === 'pl')
    .map(o => ({
      id: o.id,
      number: o.number || o.id,
      date: o.date,
      warehouse: o.warehouse || '-',
      items: o.items || [],
      source: '1c'
    }));

  const merged = [...fromShippingLists, ...fromInvoices].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const dbb = new Date(b.date || 0).getTime();
    return dbb - da;
  });

  res.json(merged);
});

// 📊 ИСТОРИЯ
app.get('/api/history', requireAuth, (req, res) => {
  res.json(db.history || []);
});

// 🌐 ГЛАВНАЯ СТРАНИЦА
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🚀 СТАРТ СЕРВЕРА
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});