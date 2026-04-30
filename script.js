const inventoryContainer = document.getElementById('inventory');
const searchInput = document.getElementById('search');
const filterBrand = document.getElementById('filter-brand');
const summaryOutput = document.getElementById('summary');

const btnAddItem = document.getElementById('btn-add-item');
const addSection = document.getElementById('add-section');
const closeBtn = document.getElementById('closeModal');
const itemForm = document.getElementById('item-form');
const formMessage = document.getElementById('form-message');

const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const loginModal = document.getElementById('login-modal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('login-form');
const adminPasswordInput = document.getElementById('admin-password');
const loginMessage = document.getElementById('login-message');

const btnImportItems = document.getElementById('btn-import-items');
const importModal = document.getElementById('import-modal');
const closeImportModal = document.getElementById('closeImportModal');
const importText = document.getElementById('import-text');
const excelFileInput = document.getElementById('excel-file');
const saveImport = document.getElementById('save-import');
const importMessage = document.getElementById('import-message');
const fileNameLabel = document.getElementById('file-name');

const itemNameInput = document.getElementById('item-name');
const itemBarcodeInput = document.getElementById('item-barcode');
const itemBrandInput = document.getElementById('item-brand');
const itemQuantityInput = document.getElementById('item-quantity');
const itemUnitInput = document.getElementById('item-unit');

let items = [];
let editingItemId = null;
let adminPassword = localStorage.getItem('adminPassword') || '';

function updateAdminUI() {
  const isAdmin = Boolean(adminPassword);

  document.body.classList.toggle('admin', isAdmin);
  btnLogin.classList.toggle('hidden', isAdmin);
  btnLogout.classList.toggle('hidden', !isAdmin);
  btnAddItem.classList.toggle('hidden', !isAdmin);
  btnImportItems.classList.toggle('hidden', !isAdmin);
}

updateAdminUI();

class InventoryItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._item = null;
  }

  set item(value) {
    this._item = value;
    this.render();
  }

  render() {
    if (!this._item) return;

    const isAdmin = Boolean(localStorage.getItem('adminPassword'));
    const { name, quantity, brand, barcode, unit } = this._item;

    this.shadowRoot.innerHTML = `
      <style>
        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 0.85rem;
          display: grid;
          gap: 0.5rem;
          min-height: ${isAdmin ? '170px' : '135px'};
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        }

        h3 {
          margin: 0;
          font-size: 1.05rem;
          color: #0f172a;
          line-height: 1.3;
        }

        .badges {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.4rem;
          margin-top: 0.75rem;
        }

        .badge {
          background: #eef2ff;
          color: #0f4bff;
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          font-size: 0.82rem;
          word-break: break-word;
          max-width: 100%;
        }

        .actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.4rem;
        }

        .icon-btn {
          border: none;
          background: #eef2ff;
          color: #0f4bff;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .icon-btn:hover {
          background: #0f4bff;
          color: white;
        }

        .delete-btn {
          background: #fee2e2;
          color: #b91c1c;
        }

        .delete-btn:hover {
          background: #dc2626;
          color: white;
        }
      </style>

      <article class="card">
        <div>
          <h3>${name}</h3>

          <div class="badges">
            <span class="badge">Бренд: ${brand}</span>
            <span class="badge">Штрихкод: ${barcode}</span>
            <span class="badge">Осталось: ${quantity} ${unit || 'шт'}</span>
          </div>
        </div>

        ${
          isAdmin
            ? `
              <div class="actions">
                <button type="button" id="editBtn" class="icon-btn" title="Редактировать">✏️</button>
                <button type="button" id="deleteBtn" class="icon-btn delete-btn" title="Удалить">🗑️</button>
              </div>
            `
            : ''
        }
      </article>
    `;

    if (isAdmin) {
      this.shadowRoot.getElementById('editBtn').addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('edit-item', {
            detail: { id: this._item.id },
            bubbles: true
          })
        );
      });

      this.shadowRoot.getElementById('deleteBtn').addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('delete-item', {
            detail: { id: this._item.id },
            bubbles: true
          })
        );
      });
    }
  }
}

customElements.define('inventory-item', InventoryItem);

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': adminPassword
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Сервер вернул ошибку');
  }

  return response.json();
}

function parseQuantity(value) {
  let str = String(value || '').trim();

  // убираем пробелы
  str = str.replace(/\s/g, '');

  // если есть и запятая и точка → запятая это тысячи
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  }
  // если только запятая → это дробь
  else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  return Number(str);
}

function normalizeBarcode(value) {
  return String(value ?? '').trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function setFormMessage(text, type = 'error') {
  formMessage.textContent = text;
  formMessage.style.color = type === 'success' ? '#0f5132' : '#b91c1c';
}

function updateSummary(list = items) {
  summaryOutput.textContent = `Найдено товаров: ${list.length}`;
}

function renderItems(list) {
  inventoryContainer.innerHTML = '';

  if (!list.length) {
    inventoryContainer.innerHTML = '<p>Товары не найдены. Попробуйте изменить фильтр.</p>';
    updateSummary([]);
    return;
  }

  list.forEach((item) => {
    const element = document.createElement('inventory-item');
    element.item = item;

    element.addEventListener('edit-item', (event) => {
      if (!adminPassword) {
        openLoginModal();
        return;
      }

      const selected = items.find((entry) => entry.id === event.detail.id);
      if (selected) openEditModal(selected);
    });

    element.addEventListener('delete-item', async (event) => {
      if (!adminPassword) {
        openLoginModal();
        return;
      }

      const selected = items.find((entry) => entry.id === event.detail.id);
      if (selected) await deleteItem(selected.id, selected.name);
    });

    inventoryContainer.appendChild(element);
  });
}

function filterItems() {
  const query = normalizeText(searchInput.value);
  const brand = filterBrand.value;
  const words = query.split(' ').filter(Boolean);

  const filtered = items.filter((item) => {
    const itemText = normalizeText(
      String(item.name || '') + ' ' +
      String(item.barcode || '') + ' ' +
      String(item.brand || '') + ' ' +
      String(item.quantity || '') + ' ' +
      String(item.unit || '')
    );

    const matchesQuery =
      words.length === 0 ||
      words.every((word) => itemText.includes(word));

    const matchesBrand = brand === 'all' || item.brand === brand;

    return matchesQuery && matchesBrand;
  });

  updateSummary(filtered);
  renderItems(filtered);
}

async function loadItems() {
  try {
    items = await apiFetch('/api/items');
    filterItems();
  } catch (error) {
    inventoryContainer.innerHTML = `<p class="error">Ошибка загрузки товаров: ${error.message}</p>`;
  }
}

function openAddModal() {
  if (!adminPassword) {
    openLoginModal();
    return;
  }

  editingItemId = null;
  itemForm.reset();
  itemUnitInput.value = 'шт';
  setFormMessage('');
  addSection.classList.remove('hidden');
}

function openEditModal(item) {
  editingItemId = item.id;

  itemNameInput.value = item.name || '';
  itemBarcodeInput.value = item.barcode || '';
  itemBrandInput.value = item.brand || '';
  itemQuantityInput.value = item.quantity || 0;
  itemUnitInput.value = item.unit || 'шт';

  setFormMessage('');
  addSection.classList.remove('hidden');
}

function closeAddModal() {
  addSection.classList.add('hidden');
  itemForm.reset();
  editingItemId = null;
  setFormMessage('');
}

async function handleSaveItem(event) {
  event.preventDefault();

  const name = itemNameInput.value.trim();
  const barcode = itemBarcodeInput.value.trim();
  const brand = itemBrandInput.value;
  const quantity = Number(itemQuantityInput.value);
  const unit = itemUnitInput.value;

  if (!name || !barcode || !brand || Number.isNaN(quantity) || quantity < 0 || !unit) {
    setFormMessage('Пожалуйста, заполните все обязательные поля.');
    return;
  }

  try {
    const payload = { name, barcode, brand, quantity, unit };

    if (editingItemId === null) {
      const newItem = await apiFetch('/api/items', {
        method: 'POST',
        body: payload
      });

      items.push(newItem);
    } else {
      const updatedItem = await apiFetch(`/api/items/${editingItemId}`, {
        method: 'PUT',
        body: payload
      });

      items = items.map((item) =>
        item.id === editingItemId ? updatedItem : item
      );
    }

    closeAddModal();
    await loadItems();
  } catch (error) {
    setFormMessage(error.message);
  }
}

async function deleteItem(itemId, itemName) {
  const confirmed = window.confirm(`Удалить товар "${itemName}"?`);
  if (!confirmed) return;

  try {
    await apiFetch(`/api/items/${itemId}`, {
      method: 'DELETE'
    });

    await loadItems();
  } catch (error) {
    alert(error.message);
  }
}

function openLoginModal() {
  loginMessage.textContent = '';
  adminPasswordInput.value = '';
  loginModal.classList.remove('hidden');
  adminPasswordInput.focus();
}

function closeLoginModalWindow() {
  loginModal.classList.add('hidden');
  loginForm.reset();
  loginMessage.textContent = '';
}

function openImportModal() {
  if (!adminPassword) {
    openLoginModal();
    return;
  }

  importText.value = '';
  excelFileInput.value = '';

  if (fileNameLabel) {
    fileNameLabel.textContent = 'Файл не выбран';
    fileNameLabel.classList.remove('error');
  }

  importMessage.textContent = '';
  importModal.classList.remove('hidden');
}

function closeImportModalWindow() {
  importModal.classList.add('hidden');
  importText.value = '';
  excelFileInput.value = '';

  if (fileNameLabel) {
    fileNameLabel.textContent = 'Файл не выбран';
    fileNameLabel.classList.remove('error');
  }

  importMessage.textContent = '';
}

async function importOneItem(name, barcode, brand, quantity, unit = 'шт') {
  const cleanName = String(name || '').replace(/\s+/g, ' ').trim();
const cleanBarcode = String(barcode || '').replace(/\s+/g, '').trim();
const cleanBrand = String(brand || '').replace(/\s+/g, ' ').trim();
const cleanUnit = String(unit || 'шт').trim();
  const cleanQuantity = parseQuantity(quantity);

  if (!cleanName || !cleanBarcode || !cleanBrand || Number.isNaN(cleanQuantity) || cleanQuantity < 0) {
    throw new Error('Некорректные данные товара');
  }

  const existing = items.find((item) => normalizeBarcode(item.barcode) === cleanBarcode);

  if (existing) {
    const updatedItem = await apiFetch(`/api/items/${existing.id}`, {
      method: 'PUT',
      body: {
        name: cleanName,
        barcode: cleanBarcode,
        brand: cleanBrand,
        quantity: Number(existing.quantity || 0) + cleanQuantity,
        unit: cleanUnit || existing.unit || 'шт'
      }
    });

    items = items.map((item) =>
      item.id === existing.id ? updatedItem : item
    );

    return 'updated';
  }

  const newItem = await apiFetch('/api/items', {
    method: 'POST',
    body: {
      name: cleanName,
      barcode: cleanBarcode,
      brand: cleanBrand,
      quantity: cleanQuantity,
      unit: cleanUnit
    }
  });

  items.push(newItem);
  return 'added';
}

async function importFromText() {
  const lines = importText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    importMessage.textContent = 'Вставьте список товаров или выберите Excel файл.';
    importMessage.style.color = '#b91c1c';
    return;
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of lines) {
    const parts = line.split(';').map((part) => part.trim());

    if (parts.length < 4) {
      skipped++;
      continue;
    }

    const [name, barcode, brand, quantityText, unit = 'шт'] = parts;

    try {
      const result = await importOneItem(name, barcode, brand, quantityText, unit);

      if (result === 'updated') updated++;
      else added++;
    } catch {
      skipped++;
    }
  }

  await loadItems();

  importMessage.style.color = '#0f5132';
  importMessage.textContent = `Добавлено: ${added}. Обновлено: ${updated}. Пропущено: ${skipped}.`;
}

async function importFromExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.length < 4) {
      skipped++;
      continue;
    }

    const [name, barcode, brand, quantityText, unit = 'шт'] = row;

    const looksLikeHeader =
      String(name || '').toLowerCase().includes('название') ||
      String(barcode || '').toLowerCase().includes('штрих') ||
      String(brand || '').toLowerCase().includes('бренд');

    if (looksLikeHeader) {
      continue;
    }

    try {
      const result = await importOneItem(name, barcode, brand, quantityText, unit);

      if (result === 'updated') updated++;
      else added++;
    } catch (e) {
  skipped++;

  console.log('❌ ПРОПУЩЕНА СТРОКА:', {
    rowIndex: i,
    row: row,
    error: e.message
  });
}
  }

  await loadItems();

  importMessage.style.color = '#0f5132';
  importMessage.textContent = `Excel: добавлено ${added}. Обновлено: ${updated}. Пропущено: ${skipped}.`;
}

btnAddItem.addEventListener('click', openAddModal);
closeBtn.addEventListener('click', closeAddModal);
itemForm.addEventListener('submit', handleSaveItem);

searchInput.addEventListener('input', filterItems);
filterBrand.addEventListener('change', filterItems);

addSection.addEventListener('click', (event) => {
  if (event.target === addSection) {
    closeAddModal();
  }
});

btnLogin.addEventListener('click', openLoginModal);

btnLogout.addEventListener('click', async () => {
  adminPassword = '';
  localStorage.removeItem('adminPassword');

  updateAdminUI();
  await loadItems();
});

closeLoginModal.addEventListener('click', closeLoginModalWindow);

loginModal.addEventListener('click', (event) => {
  if (event.target === loginModal) {
    closeLoginModalWindow();
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = adminPasswordInput.value.trim();

  if (!password) {
    loginMessage.textContent = 'Введите пароль.';
    loginMessage.style.color = '#b91c1c';
    return;
  }

  adminPassword = password;
  localStorage.setItem('adminPassword', adminPassword);

  updateAdminUI();
  closeLoginModalWindow();
  await loadItems();
});

btnImportItems.addEventListener('click', openImportModal);
closeImportModal.addEventListener('click', closeImportModalWindow);

importModal.addEventListener('click', (event) => {
  if (event.target === importModal) {
    closeImportModalWindow();
  }
});

excelFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];

  if (!file) {
    if (fileNameLabel) {
      fileNameLabel.textContent = 'Файл не выбран';
      fileNameLabel.classList.add('error');
    }
    return;
  }

  if (fileNameLabel) {
    fileNameLabel.textContent = `Выбран: ${file.name}`;
    fileNameLabel.classList.remove('error');
  }

  importMessage.textContent = '';
});

saveImport.addEventListener('click', async () => {
  const file = excelFileInput.files[0];

  if (file) {
    importMessage.textContent = 'Идёт импорт Excel...';
    importMessage.style.color = '#475569';

    try {
      await importFromExcel(file);
    } catch (error) {
      importMessage.style.color = '#b91c1c';
      importMessage.textContent = `Ошибка импорта Excel: ${error.message}`;
    }

    return;
  }

  if (!importText.value.trim()) {
    if (fileNameLabel) {
      fileNameLabel.textContent = 'Файл не выбран';
      fileNameLabel.classList.add('error');
    }

    importMessage.textContent = 'Выберите Excel файл или вставьте список товаров.';
    importMessage.style.color = '#b91c1c';
    return;
  }

  await importFromText();
});

loadItems();