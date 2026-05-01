// 🔐 ПОДКЛЮЧЕНИЕ
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');

const app = express();
const PORT = 3000;
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
      invoices: []
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDB();
const sessions = new Map();

// 🧠 ИСТОРИЯ
function addHistory(entry) {
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

// 🔐 ПРОВЕРКА
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  req.user = sessions.get(token);
  next();
}

// 📦 ПОЛУЧИТЬ ТОВАРЫ
app.get('/api/items', requireAuth, (req, res) => {
  if (req.user.role === 'head_office') {
    return res.json(db.items);
  }

  const filtered = db.items.filter(
    i => i.warehouse === req.user.warehouse
  );

  res.json(filtered);
});

// ➕ ДОБАВИТЬ
app.post('/api/items', requireAuth, (req, res) => {
  const { name, barcode, brand, quantity, unit } = req.body;

  if (!name || !barcode || !brand || typeof quantity !== 'number' || !unit) {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  const item = {
    id: Date.now(),
    name,
    barcode,
    brand,
    quantity,
    unit,
    warehouse: req.user.warehouse,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(item);
  saveDB(db);

  addHistory({
    action: 'create',
    user: req.user.username,
    text: `Создан товар ${name}`
  });

  res.json(item);
});

// ✏️ ИЗМЕНИТЬ
app.put('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  Object.assign(item, req.body);
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'update',
    user: req.user.username,
    text: `Изменён товар ${item.name}`
  });

  res.json(item);
});

// ❌ УДАЛИТЬ
app.delete('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.items = db.items.filter(i => i.id !== id);

  saveDB(db);

  addHistory({
    action: 'delete',
    user: req.user.username,
    text: `Удалён товар ID ${id}`
  });

  res.json({ success: true });
});

// 📄 НАКЛАДНЫЕ
app.get('/api/invoices', requireAuth, (req, res) => {
  res.json(db.invoices || []);
});

// 🔁 ВОЗВРАТ ПО НАКЛАДНОЙ
app.post('/api/returns', requireAuth, (req, res) => {
  const { invoiceId, items } = req.body;

  const invoice = db.invoices.find(i => i.id === invoiceId);

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

    const invoiceLine = invoice.items.find(i => i.barcode === returnItem.barcode);

    if (!invoiceLine) {
      continue;
    }

    if (returnItem.quantity > invoiceLine.quantity) {
      return res.status(400).json({
        error: `Количество возврата по товару "${invoiceLine.name}" больше количества в накладной`
      });
    }

    const stockItem = db.items.find(i =>
      i.barcode === returnItem.barcode &&
      (req.user.role === 'head_office' || i.warehouse === req.user.warehouse)
    );

    if (stockItem) {
      stockItem.quantity += returnItem.quantity;
      stockItem.updatedAt = new Date().toISOString();
      processed++;
    }
  }

  saveDB(db);

  addHistory({
    action: 'return',
    user: req.user.username,
    text: `Возврат по накладной №${invoiceId}. Позиций: ${processed}`
  });

  res.json({ success: true, processed });
});

// 📦 ЗАГРУЗКА ZIP
app.post('/api/upload-invoices', upload.single('file'), (req, res) => {
  const zip = new AdmZip(req.file.path);
  const entries = zip.getEntries();

  entries.forEach(entry => {
    const data = entry.getData().toString('utf8');
    const invoice = JSON.parse(data);
    db.invoices.push(invoice);
  });

  saveDB(db);

  res.json({ success: true });
});

// 🚀 СТАРТ
app.listen(PORT, () => {
  console.log('Сервер запущен на http://localhost:' + PORT);
});