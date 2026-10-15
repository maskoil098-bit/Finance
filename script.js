/* =========================================================
   FINANCE AI — STANDALONE SCRIPT
   Plain JavaScript only

   Main features:
   - Initial balance
   - Auto balance deduction
   - Quick expense
   - Thai voice expense input
   - Receipt / food photo upload
   - Gemini Vision (optional)
   - Editable extracted items
   - Receipt thumbnails
   - Expandable sub-items
   - Delete transaction = money returned
   - Webcam receipt capture
   - localStorage
========================================================= */

const STORAGE_KEY = "finance_ai_transactions";
const INITIAL_BALANCE_KEY = "finance_ai_initial_balance";
const API_KEY_STORAGE = "finance_ai_gemini_api_key";


/* =========================================================
   DEFAULT DATA
========================================================= */

const DEFAULT_TRANSACTIONS = [
  {
    id: 1714500001,
    merchant: "7-Eleven #OfficeSupply",
    category: "Shopping",
    total: 224,
    date: "Today · 00:39",
    image: "assets/demo_7eleven.jpg",
    tags: ["OfficeSupply"],
    items: [
      { name: "Tissue Paper 3-Ply Soft", price: 115 },
      { name: "Snack & Drink Combo", price: 109 }
    ]
  },

  {
    id: 1714500002,
    merchant: "Goodmate #Welfare",
    category: "Food",
    total: 95,
    date: "Today · 00:38",
    image: "assets/demo_goodmate.jpg",
    tags: ["Welfare"],
    items: [
      { name: "Goodmate Oat Milk Original 1L", price: 95 }
    ]
  }
];


/* =========================================================
   APP STATE
========================================================= */

let currentImageBase64 = "";
let currentMimeType = "image/jpeg";

let activeCameraStream = null;
let currentCameraFacing = "environment";

let speechRecognizer = null;
let isListening = false;


/* =========================================================
   DOM
========================================================= */

const DOM = {
  heroAmount: document.getElementById("financeHeroAmount"),
  initialBalance: document.getElementById("financeInitialBalance"),
  spentBalance: document.getElementById("financeSpentBalance"),
  availableBalance: document.getElementById("financeAvailableBalance"),
  budgetText: document.getElementById("budgetRemainingText"),
  budgetBar: document.getElementById("budgetBar"),

  initialBalanceCard: document.getElementById("initialBalanceCard"),

  quickExpenseForm: document.getElementById("quickExpenseForm"),
  quickExpenseTitle: document.getElementById("quickExpenseTitle"),
  quickExpenseAmount: document.getElementById("quickExpenseAmount"),
  quickExpenseCategory: document.getElementById("quickExpenseCategory"),

  voiceExpenseBtn: document.getElementById("voiceExpenseBtn"),
  voiceListeningBanner: document.getElementById("voiceListeningBanner"),
  voiceLiveTranscript: document.getElementById("voiceLiveTranscript"),
  voiceStopBtn: document.getElementById("voiceStopBtn"),

  inlineDropzone: document.getElementById("financeInlineDropzone"),
  inlineFileInput: document.getElementById("inlineReceiptFileInput"),
  inlineCameraBtn: document.getElementById("inlineCameraBtn"),
  directCameraInput: document.getElementById("directCameraCaptureInput"),
  scanBtn: document.getElementById("financeScanBtn"),

  historyList: document.getElementById("financeHistoryList"),
  resetBtn: document.getElementById("financeResetBtn"),

  receiptModal: document.getElementById("receiptModal"),
  fileInput: document.getElementById("receiptFileInput"),
  previewStage: document.getElementById("previewStage"),
  previewImg: document.getElementById("receiptPreview"),
  uploadPlaceholder: document.getElementById("uploadPlaceholder"),
  reuploadBar: document.getElementById("reuploadActionsBar"),

  aiStatusBadge: document.getElementById("aiStatusBadge"),
  emptyState: document.getElementById("aiEmptyState"),
  loadingState: document.getElementById("aiLoadingState"),
  resultState: document.getElementById("aiResultState"),

  merchantInput: document.getElementById("merchantInput"),
  categorySelect: document.getElementById("categorySelect"),
  itemsContainer: document.getElementById("receiptItemsContainer"),
  addItemBtn: document.getElementById("addReceiptItemBtn"),
  clearItemsBtn: document.getElementById("clearAllItemsBtn"),
  receiptTotal: document.getElementById("receiptTotal"),
  confirmBtn: document.getElementById("confirmReceiptBtn"),

  cameraModal: document.getElementById("liveCameraModal"),
  cameraVideo: document.getElementById("liveCameraVideo"),
  snapPhotoBtn: document.getElementById("snapPhotoBtn"),
  switchCameraBtn: document.getElementById("switchCameraBtn"),
  closeCameraBtn: document.getElementById("closeLiveCameraBtn"),
  cancelCameraBtn: document.getElementById("cancelCameraBtn"),

  apiSettingsModal: document.getElementById("apiSettingsModal"),
  openApiSettingsBtn: document.getElementById("openApiSettingsBtn"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
  clearApiKeyBtn: document.getElementById("clearApiKeyBtn"),

  scannerApiBox: document.getElementById("scannerApiBox"),
  scannerApiStatus: document.getElementById("scannerApiStatus"),
  scannerApiDot: document.getElementById("scannerApiDot"),
  scannerApiStatusText: document.getElementById("scannerApiStatusText"),
  toggleScannerApiEditBtn: document.getElementById("toggleScannerApiEditBtn"),
  scannerApiDrawer: document.getElementById("scannerApiDrawer"),
  scannerApiKeyInput: document.getElementById("scannerApiKeyInput"),
  scannerSaveKeyBtn: document.getElementById("scannerSaveKeyBtn"),
  scannerHintInput: document.getElementById("scannerHintInput"),
  scannerReanalyzeBtn: document.getElementById("scannerReanalyzeBtn"),
  scannerAiNotes: document.getElementById("scannerAiNotes"),
  testApiKeyBtn: document.getElementById("testApiKeyBtn"),

  toastContainer: document.getElementById("toastContainer")
};


/* =========================================================
   GENERAL HELPERS
========================================================= */

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}


function showModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.classList.add("show");
  }

  if (id === "receiptModal") {
    refreshScannerApiBanner();
  }
}


function hideModal(id) {
  const modal = document.getElementById(id);

  if (modal) {
    modal.classList.remove("show");
  }

  if (id === "liveCameraModal") {
    stopCamera();
  }
}

function refreshIcons() {
  if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") {
    lucide.createIcons();
  }
}

function toast(message, type = "info", duration = 3000) {
  const item = document.createElement("div");

  item.className = `toast ${type}`;
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  else if (type === "error") iconName = "alert-circle";
  else if (type === "warning") iconName = "alert-triangle";

  item.innerHTML = `<i data-lucide="${iconName}" class="toast-icon"></i> <span>${escapeHTML(message)}</span>`;

  DOM.toastContainer.appendChild(item);
  refreshIcons();

  setTimeout(() => {
    item.remove();
  }, duration);
}


function formatMoney(value, decimals = 0) {
  const number = Number(value) || 0;

  return number.toLocaleString(
    "th-TH",
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }
  );
}


function currentTimeLabel() {
  const now = new Date();

  return (
    `Today · ` +
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`
  );
}


function extractHashtags(text) {
  if (!text || typeof text !== "string") return [];
  const matches = text.match(/#([a-zA-Z0-9_\u0E00-\u0E7F\-]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(t => t.replace(/^#/, "").trim()).filter(Boolean)));
}


/* =========================================================
   BACKEND API & STORAGE INTEGRATION
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";
let apiTransactionsCache = null;

async function fetchTransactionsFromAPI() {
  try {
    const res = await fetch(`${API_BASE_URL}/transactions`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      apiTransactionsCache = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      refreshUI();
      console.log(`[API] Synced ${data.length} transactions from MySQL Backend.`);
      return data;
    }
  } catch (err) {
    console.info("[API] Backend not reachable, using local cache:", err.message);
    return getTransactions();
  }
}

function getTransactions() {
  if (Array.isArray(apiTransactionsCache)) {
    return structuredCloneSafe(apiTransactionsCache);
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(DEFAULT_TRANSACTIONS)
      );

      apiTransactionsCache = structuredCloneSafe(DEFAULT_TRANSACTIONS);
      return apiTransactionsCache;
    }

    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && (parsed.length === 4 && parsed[1]?.merchant === "Grab" || parsed.length === 0)) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(DEFAULT_TRANSACTIONS)
      );
      apiTransactionsCache = structuredCloneSafe(DEFAULT_TRANSACTIONS);
      return apiTransactionsCache;
    }

    apiTransactionsCache = parsed;
    return parsed;
  } catch (error) {
    console.warn(error);
    return structuredCloneSafe(DEFAULT_TRANSACTIONS);
  }
}

function saveTransactions(list) {
  try {
    apiTransactionsCache = list;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list)
    );

    // Send asynchronous bulk synchronization to FastAPI MySQL Backend
    fetch(`${API_BASE_URL}/transactions/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(list)
    })
      .then(res => {
        if (!res.ok) {
          console.warn("[API] Bulk save to backend returned status:", res.status);
        } else {
          console.log("[API] Successfully synchronized transactions to MySQL backend.");
        }
      })
      .catch(err => {
        console.info("[API] Backend offline, transaction saved to local cache:", err.message);
      });

    return true;
  } catch (error) {
    console.error(error);
    toast(
      "บันทึกไม่สำเร็จ อาจเกิดจากพื้นที่จัดเก็บเต็ม",
      "error",
      5000
    );
    return false;
  }
}


function structuredCloneSafe(data) {
  return JSON.parse(
    JSON.stringify(data)
  );
}


function getInitialBalance() {
  const saved =
    localStorage.getItem(
      INITIAL_BALANCE_KEY
    );

  if (saved === null) {
    return 10000;
  }

  return Math.max(
    0,
    Number(saved) || 0
  );
}


function setInitialBalance(amount) {
  const value =
    Math.max(
      0,
      Number(amount) || 0
    );

  localStorage.setItem(
    INITIAL_BALANCE_KEY,
    String(value)
  );

  refreshUI();
}


function getApiKey() {
  return (
    localStorage.getItem(
      API_KEY_STORAGE
    ) || ""
  ).trim();
}


/* =========================================================
   BALANCE
========================================================= */

function calculateSummary() {
  const initial =
    getInitialBalance();

  const transactions =
    getTransactions();

  const spent =
    transactions.reduce(
      (sum, tx) =>
        sum + (Number(tx.total) || 0),
      0
    );

  const available =
    Math.max(
      0,
      initial - spent
    );

  const remainingPct =
    initial > 0
      ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (available / initial) * 100
          )
        )
      )
      : 0;

  return {
    initial,
    spent,
    available,
    remainingPct
  };
}


function updateBalanceUI() {
  const summary =
    calculateSummary();

  DOM.heroAmount.textContent =
    formatMoney(
      summary.available,
      2
    );

  DOM.initialBalance.textContent =
    `฿${formatMoney(summary.initial)}`;

  DOM.spentBalance.textContent =
    `฿${formatMoney(summary.spent)}`;

  DOM.availableBalance.textContent =
    `฿${formatMoney(summary.available)}`;

  DOM.budgetText.textContent =
    `${summary.remainingPct}%`;

  DOM.budgetBar.style.width =
    `${summary.remainingPct}%`;
}


/* =========================================================
   TRANSACTION HISTORY
========================================================= */

function getCategoryIcon(category) {
  const cat =
    String(category || "")
      .toLowerCase();

  if (
    cat.includes("food") ||
    cat.includes("อาหาร")
  ) {
    return `<i data-lucide="utensils"></i>`;
  }

  if (
    cat.includes("transport") ||
    cat.includes("เดินทาง") ||
    cat.includes("รถ")
  ) {
    return `<i data-lucide="car"></i>`;
  }

  if (
    cat.includes("shopping") ||
    cat.includes("shop") ||
    cat.includes("ซื้อของ")
  ) {
    return `<i data-lucide="shopping-bag"></i>`;
  }

  if (
    cat.includes("bill") ||
    cat.includes("บิล") ||
    cat.includes("ไฟ") ||
    cat.includes("น้ำ")
  ) {
    return `<i data-lucide="lightbulb"></i>`;
  }

  if (
    cat.includes("co-op") ||
    cat.includes("lab")
  ) {
    return `<i data-lucide="layers"></i>`;
  }

  if (
    cat.includes("health") ||
    cat.includes("ยา") ||
    cat.includes("สุขภาพ")
  ) {
    return `<i data-lucide="pill"></i>`;
  }

  return `<i data-lucide="tag"></i>`;
}


function transactionHTML(tx) {
  const imageHTML =
    tx.image
      ? `
        <img
          src="${tx.image}"
          class="finance-thumb"
          alt="${escapeHTML(tx.merchant)}"
        />
      `
      : `
        <div class="finance-category-icon">
          ${getCategoryIcon(tx.category)}
        </div>
      `;


  const itemRows =
    Array.isArray(tx.items) &&
      tx.items.length
      ? tx.items
        .map(
          item => `
              <div class="subitem-row">
                <span>
                  ${escapeHTML(item.name)}
                </span>

                <strong>
                  ฿${formatMoney(item.price, 2)}
                </strong>
              </div>
            `
        )
        .join("")
      : `
        <div class="subitem-row">
          <span>ไม่มีรายการย่อย</span>
          <strong>
            ฿${formatMoney(tx.total, 2)}
          </strong>
        </div>
      `;


  const imagePreview =
    tx.image
      ? `
        <img
          src="${tx.image}"
          class="history-image"
          alt="Receipt image"
        />
      `
      : "";


  return `
    <article
      class="finance-item"
      data-id="${tx.id}"
    >

      <div class="finance-item-main">

        <div class="finance-item-left">

          ${imageHTML}

          <div class="finance-details">

            <div class="finance-title-row">

              <span class="finance-title">
                ${escapeHTML(
    tx.merchant ||
    "Transaction"
  )}
              </span>

              <span class="category-tag">
                ${escapeHTML(
    tx.category ||
    "General"
  )}
              </span>

            </div>

            <span class="finance-meta">
              ${escapeHTML(tx.date || "")}
            </span>

            ${(function () {
      const tagsList = Array.isArray(tx.tags) && tx.tags.length > 0
        ? tx.tags
        : extractHashtags(tx.merchant || "");
      if (tagsList.length === 0) return "";
      return `<div class="tx-tags-wrap">${tagsList.map(t => `<span class="tx-tag-pill">#${escapeHTML(t)}</span>`).join("")}</div>`;
    })()}

          </div>

        </div>


        <div class="finance-item-right">

          <span class="finance-amount">
            -฿${formatMoney(tx.total, 2)}
          </span>

          <span class="finance-chevron">
            <i data-lucide="chevron-down"></i>
          </span>

          <button
            class="finance-edit-btn"
            data-edit-id="${tx.id}"
            title="แก้ไขรายการ"
          >
            <i data-lucide="pencil"></i>
          </button>

          <button
            class="finance-delete-btn"
            data-delete-id="${tx.id}"
            title="ลบรายการ"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>

      </div>


      <div class="finance-subitems">

        ${itemRows}

        ${imagePreview}

      </div>

    </article>
  `;
}


function renderHistory() {
  const list =
    getTransactions();

  if (!list.length) {
    DOM.historyList.innerHTML =
      `
        <div class="empty-history">
          ยังไม่มีรายการใช้จ่าย
        </div>
      `;

    return;
  }


  DOM.historyList.innerHTML =
    list
      .map(transactionHTML)
      .join("");

  refreshIcons();

  DOM.historyList
    .querySelectorAll(
      ".finance-item-main"
    )
    .forEach(main => {

      main.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              ".finance-delete-btn"
            ) ||
            event.target.closest(
              ".finance-edit-btn"
            )
          ) {
            return;
          }

          main
            .closest(".finance-item")
            .classList
            .toggle("expanded");
        }
      );

    });


  DOM.historyList
    .querySelectorAll(
      "[data-edit-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          openEditTransactionModal(
            button.dataset.editId
          );
        }
      );

    });


  DOM.historyList
    .querySelectorAll(
      "[data-delete-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          deleteTransaction(
            button.dataset.deleteId
          );
        }
      );

    });
}


/* =========================================================
   ANIME CONFIRM & PROMPT DIALOGS (CUSTOM THEME & MASCOT)
========================================================= */

function formatAnimeBubbleHtml(text) {
  if (!text) return "";
  return escapeHTML(text)
    .replace(
      /\[plead\]/g,
      '<img src="assets/gura_emote_plead.png" alt="หน้าน้อง" class="inline-mascot-emoji" />'
    )
    .replace(
      /\[happy\]/g,
      '<img src="assets/gura_emote_happy.png" alt="หน้าน้อง" class="inline-mascot-emoji" />'
    );
}

function showAnimeConfirm(options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("animeDialogModal");
    if (!modal) {
      resolve(confirm(options.message || options.title || "ยืนยัน?"));
      return;
    }

    const mascot = document.getElementById("animeDialogMascot");
    const bubbleText = document.getElementById("animeDialogBubbleText");
    const title = document.getElementById("animeDialogTitle");
    const detailCard = document.getElementById("animeDialogDetailCard");
    const shopIcon = document.getElementById("animeDialogShopIcon");
    const merchant = document.getElementById("animeDialogMerchant");
    const amount = document.getElementById("animeDialogAmount");
    const refundHint = document.getElementById("animeDialogRefundHint");
    const message = document.getElementById("animeDialogMessage");
    const inputGroup = document.getElementById("animeDialogInputGroup");
    const cancelBtn = document.getElementById("animeDialogCancelBtn");
    const confirmBtn = document.getElementById("animeDialogConfirmBtn");

    // Mascot & speech bubble
    const isCrying = Boolean(options.danger || options.isCrying);
    if (mascot) {
      mascot.src = options.mascotSrc || (isCrying ? "assets/gura_emote_plead.png" : "assets/gura_chibi_left_clean.png");
      mascot.classList.toggle("is-crying", isCrying);
    }

    const tearLeft = document.getElementById("mascotTearLeft");
    const tearRight = document.getElementById("mascotTearRight");
    if (tearLeft) tearLeft.style.display = isCrying ? "block" : "none";
    if (tearRight) tearRight.style.display = isCrying ? "block" : "none";

    if (bubbleText) {
      const rawText =
        options.bubbleText ||
        (options.danger ? "แน่ใจไหมคะว่าจะลบ?" : "ยืนยันการทำรายการนะคะ~");
      bubbleText.innerHTML = formatAnimeBubbleHtml(rawText);
    }

    if (title) {
      title.textContent = options.title || "ยืนยันการทำรายการ";
    }

    // Detail card vs plain message
    if (options.merchant && options.amount !== undefined) {
      detailCard.style.display = "block";
      merchant.textContent = options.merchant;
      amount.textContent = `฿${formatMoney(options.amount)}`;

      const m = String(options.merchant).toLowerCase();
      if (m.includes("7-eleven") || m.includes("seven") || m.includes("เซเว่น")) {
        shopIcon.innerHTML = '<i data-lucide="store"></i>';
      } else if (
        m.includes("goodmate") ||
        m.includes("food") ||
        m.includes("cafe") ||
        m.includes("อาหาร") ||
        m.includes("ข้าวมันไก่")
      ) {
        shopIcon.innerHTML = '<i data-lucide="utensils"></i>';
      } else if (m.includes("grab") || m.includes("line man") || m.includes("foodpanda")) {
        shopIcon.innerHTML = '<i data-lucide="bike"></i>';
      } else {
        shopIcon.innerHTML = '<i data-lucide="shopping-bag"></i>';
      }

      if (refundHint) {
        refundHint.style.display = options.showRefund !== false ? "flex" : "none";
      }
      message.style.display = "none";
    } else {
      detailCard.style.display = "none";
      message.style.display = options.message ? "block" : "none";
      message.textContent = options.message || "";
    }

    // Hide input group
    inputGroup.style.display = "none";

    // Buttons
    cancelBtn.textContent = options.cancelText || "ยกเลิก";
    confirmBtn.textContent = options.confirmText || "ตกลง";

    if (options.danger) {
      confirmBtn.classList.remove("primary-style");
    } else {
      confirmBtn.classList.add("primary-style");
    }

    let isCleaned = false;
    function cleanup() {
      if (isCleaned) return;
      isCleaned = true;
      modal.classList.remove("show");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      modal.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeyDown);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }

    function onBackdropClick(e) {
      if (e.target === modal) {
        onCancel();
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    }

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    modal.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeyDown);

    modal.classList.add("show");
    refreshIcons();
    confirmBtn.focus();
  });
}

function showAnimePrompt(options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("animeDialogModal");
    if (!modal) {
      resolve(prompt(options.message || options.title, options.defaultValue || ""));
      return;
    }

    const mascot = document.getElementById("animeDialogMascot");
    const bubbleText = document.getElementById("animeDialogBubbleText");
    const title = document.getElementById("animeDialogTitle");
    const detailCard = document.getElementById("animeDialogDetailCard");
    const message = document.getElementById("animeDialogMessage");
    const inputGroup = document.getElementById("animeDialogInputGroup");
    const input = document.getElementById("animeDialogInput");
    const cancelBtn = document.getElementById("animeDialogCancelBtn");
    const confirmBtn = document.getElementById("animeDialogConfirmBtn");

    if (mascot) {
      mascot.src = options.mascotSrc || "assets/gura_chibi_right_clean.png";
      mascot.classList.remove("is-crying");
    }

    const tearLeftPrompt = document.getElementById("mascotTearLeft");
    const tearRightPrompt = document.getElementById("mascotTearRight");
    if (tearLeftPrompt) tearLeftPrompt.style.display = "none";
    if (tearRightPrompt) tearRightPrompt.style.display = "none";

    if (bubbleText) {
      const rawText = options.bubbleText || "ระบุจำนวนเงินได้เลยค่ะ~";
      bubbleText.innerHTML = formatAnimeBubbleHtml(rawText);
    }

    if (title) {
      title.textContent = options.title || "กรอกข้อมูล";
    }

    detailCard.style.display = "none";
    message.style.display = options.message ? "block" : "none";
    message.textContent = options.message || "";

    inputGroup.style.display = "block";
    input.value = options.defaultValue || "";
    input.placeholder = options.placeholder || "";

    cancelBtn.textContent = options.cancelText || "ยกเลิก";
    confirmBtn.textContent = options.confirmText || "บันทึก";
    confirmBtn.classList.add("primary-style");

    let isCleaned = false;
    function cleanup() {
      if (isCleaned) return;
      isCleaned = true;
      modal.classList.remove("show");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      modal.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeyDown);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onConfirm() {
      const val = input.value;
      cleanup();
      resolve(val);
    }

    function onBackdropClick(e) {
      if (e.target === modal) {
        onCancel();
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    }

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    modal.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeyDown);

    modal.classList.add("show");
    refreshIcons();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
}


async function deleteTransaction(id) {
  const transactions =
    getTransactions();

  const target =
    transactions.find(
      tx => String(tx.id) === String(id)
    );

  if (!target) {
    return;
  }

  const ok = await showAnimeConfirm({
    title: "ลบรายการใช้จ่ายนี้ใช่ไหม?",
    merchant: target.merchant,
    amount: target.total,
    category: target.category,
    mascotSrc: "assets/gura_emote_plead.png",
    bubbleText: "ฮืออ... แน่ใจไหมคะว่าจะลบรายการนี้? [plead]",
    confirmText: "ยืนยันลบรายการ",
    cancelText: "ยกเลิก",
    danger: true,
    isCrying: true
  });

  if (!ok) {
    return;
  }

  // Send DELETE request to FastAPI MySQL Backend
  fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: "DELETE"
  })
    .then(res => {
      if (!res.ok) {
        console.warn("[API] Backend DELETE returned status:", res.status);
      } else {
        console.log(`[API] Transaction ${id} deleted from MySQL backend.`);
      }
    })
    .catch(err => {
      console.info("[API] Backend offline during delete, updated local cache:", err.message);
    });

  const updated =
    transactions.filter(
      tx => String(tx.id) !== String(id)
    );

  saveTransactions(updated);

  refreshUI();

  toast(
    `ลบรายการแล้ว คืนเงิน ฿${formatMoney(target.total)}`,
    "success"
  );
}


/* =========================================================
   EDIT TRANSACTION MODAL LOGIC
========================================================= */

function openEditTransactionModal(id) {
  const list = getTransactions();
  const tx = list.find(t => String(t.id) === String(id));
  if (!tx) {
    toast("ไม่พบรายการที่ต้องการแก้ไข", "error");
    return;
  }

  const idInput = document.getElementById("editTxId");
  const merchantInput = document.getElementById("editTxMerchant");
  const categorySelect = document.getElementById("editTxCategory");
  const amountInput = document.getElementById("editTxAmount");

  if (idInput) idInput.value = tx.id;
  if (merchantInput) merchantInput.value = tx.merchant || "";
  if (categorySelect) categorySelect.value = tx.category || "General";
  if (amountInput) amountInput.value = tx.total !== undefined ? tx.total : "";

  showModal("editTransactionModal");
  refreshIcons();
  if (merchantInput) {
    setTimeout(() => merchantInput.focus(), 80);
  }
}

function saveEditTransaction() {
  const idInput = document.getElementById("editTxId");
  const merchantInput = document.getElementById("editTxMerchant");
  const categorySelect = document.getElementById("editTxCategory");
  const amountInput = document.getElementById("editTxAmount");

  if (!idInput || !merchantInput || !categorySelect || !amountInput) return;

  const id = idInput.value;
  const newMerchant = merchantInput.value.trim();
  const newCategory = categorySelect.value;
  const newTotal = parseFloat(amountInput.value);

  if (!newMerchant) {
    toast("กรุณากรอกชื่อรายการ", "error");
    merchantInput.focus();
    return;
  }

  if (isNaN(newTotal) || newTotal <= 0) {
    toast("กรุณาระบุราคาที่ถูกต้อง (มากกว่า 0)", "error");
    amountInput.focus();
    return;
  }

  const list = getTransactions();
  const index = list.findIndex(t => String(t.id) === String(id));
  if (index === -1) {
    toast("ไม่พบรายการนี้ในระบบ", "error");
    hideModal("editTransactionModal");
    return;
  }

  list[index].merchant = newMerchant;
  list[index].category = newCategory;
  list[index].total = newTotal;
  list[index].tags = extractHashtags(newMerchant);

  // If single item exists, update its name and price as well
  if (Array.isArray(list[index].items) && list[index].items.length === 1) {
    list[index].items[0].name = newMerchant;
    list[index].items[0].price = newTotal;
  }

  if (!saveTransactions(list)) {
    toast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    return;
  }

  hideModal("editTransactionModal");
  refreshUI();

  if (currentActiveTab === "dashboard") {
    renderDashboard();
  } else if (currentActiveTab === "analytics") {
    renderAnalytics();
    generateAiInsights();
  }

  toast(`แก้ไขรายการ "${newMerchant}" เรียบร้อยแล้ว`, "success");
}

function initEditTransactionModal() {
  const cancelBtn = document.getElementById("cancelEditTxBtn");
  const saveBtn = document.getElementById("saveEditTxBtn");
  const form = document.getElementById("editTransactionForm");
  const modal = document.getElementById("editTransactionModal");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      hideModal("editTransactionModal");
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveEditTransaction);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      saveEditTransaction();
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideModal("editTransactionModal");
      }
    });
  }
}


/* =========================================================
   INITIAL BALANCE
========================================================= */

async function editInitialBalance() {
  const current =
    getInitialBalance();

  const result = await showAnimePrompt({
    title: "แก้ไขเงินตั้งต้น",
    message: "ระบุเงินตั้งต้น / งบประมาณเริ่มต้น (บาท)",
    defaultValue: String(current),
    placeholder: "ระบุจำนวนเงิน เช่น 10000",
    bubbleText: "ตั้งงบเริ่มต้นใหม่เท่าไหร่ดีคะ?",
    confirmText: "บันทึก",
    cancelText: "ยกเลิก"
  });

  if (result === null) {
    return;
  }


  const value =
    Number(
      String(result)
        .replace(/,/g, "")
        .trim()
    );


  if (
    Number.isNaN(value) ||
    value < 0
  ) {
    toast(
      "กรุณาใส่จำนวนเงินที่ถูกต้อง",
      "warning"
    );

    return;
  }


  setInitialBalance(value);


  toast(
    `ตั้งเงินเริ่มต้นเป็น ฿${formatMoney(value)} แล้ว`,
    "success"
  );
}


/* =========================================================
   QUICK EXPENSE
========================================================= */

function saveQuickExpense(event) {
  event.preventDefault();


  const title =
    DOM.quickExpenseTitle
      .value
      .trim();

  const amount =
    Number(
      DOM.quickExpenseAmount.value
    ) || 0;

  const category =
    DOM.quickExpenseCategory.value;


  if (!title) {
    toast(
      "กรุณาระบุว่าใช้จ่ายค่าอะไร",
      "warning"
    );

    DOM.quickExpenseTitle.focus();

    return;
  }


  if (amount <= 0) {
    toast(
      "กรุณาระบุจำนวนเงิน",
      "warning"
    );

    DOM.quickExpenseAmount.focus();

    return;
  }


  const tags = extractHashtags(title);

  const transaction = {
    id: Date.now(),

    merchant: title,

    category,

    total: amount,

    date:
      currentTimeLabel(),

    image: "",

    tags,

    items: [
      {
        name: title,
        price: amount
      }
    ]
  };


  const list =
    getTransactions();

  list.unshift(transaction);


  if (!saveTransactions(list)) {
    return;
  }


  DOM.quickExpenseTitle.value = "";
  DOM.quickExpenseAmount.value = "";
  DOM.quickExpenseCategory.value =
    "General";


  refreshUI();


  toast(
    `บันทึก ${title} ฿${formatMoney(amount)} แล้ว`,
    "success"
  );
}


/* =========================================================
   THAI VOICE INPUT
========================================================= */

function parseThaiExpense(text) {
  const clean =
    String(text || "")
      .trim();

  if (!clean) {
    return null;
  }


  const amountMatch =
    clean.match(
      /(\d+(?:[.,]\d+)?)/
    );


  let amount = 0;

  if (amountMatch) {
    amount =
      Number(
        amountMatch[1]
          .replace(/,/g, "")
      ) || 0;
  }


  const lower =
    clean.toLowerCase();


  let category =
    "General";


  if (
    lower.includes("น้ำมัน") ||
    lower.includes("รถ") ||
    lower.includes("แท็กซี่") ||
    lower.includes("grab") ||
    lower.includes("bts") ||
    lower.includes("mrt") ||
    lower.includes("เดินทาง")
  ) {
    category = "Transport";
  }

  else if (
    lower.includes("lab") ||
    lower.includes("แล็บ") ||
    lower.includes("โปรเจกต์") ||
    lower.includes("co-op")
  ) {
    category = "Co-op";
  }

  else if (
    lower.includes("ยา") ||
    lower.includes("หมอ") ||
    lower.includes("โรงพยาบาล")
  ) {
    category = "Health";
  }

  else if (
    lower.includes("กิน") ||
    lower.includes("ข้าว") ||
    lower.includes("อาหาร") ||
    lower.includes("กาแฟ") ||
    lower.includes("ชา") ||
    lower.includes("ขนม") ||
    lower.includes("น้ำ")
  ) {
    category = "Food";
  }

  else if (
    lower.includes("ซื้อ") ||
    lower.includes("ช้อป") ||
    lower.includes("shopee") ||
    lower.includes("lazada")
  ) {
    category = "Shopping";
  }


  let title = clean;


  if (amountMatch) {
    title =
      title
        .replace(
          amountMatch[0],
          ""
        )
        .replace(
          /\s*(บาท|บ\.|฿)\s*/g,
          " "
        )
        .trim();
  }


  title =
    title
      .replace(
        /^(จ่ายค่า|ซื้อ|กิน|สั่ง|โอนค่า|จ่าย|โอน|ค่า)\s*/,
        ""
      )
      .trim();


  if (!title) {
    title =
      category === "Food"
        ? "ค่าอาหาร"
        : category === "Transport"
          ? "ค่าเดินทาง"
          : "ค่าใช้จ่าย";
  }


  return {
    title,
    amount,
    category
  };
}


function initSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {
    return null;
  }


  const recognition =
    new SpeechRecognition();


  recognition.lang =
    "th-TH";

  recognition.interimResults =
    true;

  recognition.continuous =
    false;

  recognition.maxAlternatives =
    1;


  recognition.onstart =
    () => {

      isListening = true;

      setVoiceUI(true);

      DOM.voiceLiveTranscript.textContent =
        "กำลังฟัง...";

    };


  recognition.onresult =
    event => {

      const transcript =
        Array.from(
          event.results
        )
          .map(
            item =>
              item[0].transcript
          )
          .join("");


      DOM.voiceLiveTranscript.textContent =
        `"${transcript}"`;


      const lastResult =
        event.results[
        event.results.length - 1
        ];


      if (
        lastResult.isFinal
      ) {
        applyVoiceResult(
          transcript
        );
      }
    };


  recognition.onerror =
    event => {

      console.warn(
        "Speech recognition:",
        event.error
      );


      setVoiceUI(false);


      if (
        event.error ===
        "not-allowed"
      ) {
        toast(
          "กรุณาอนุญาตสิทธิ์ Microphone ใน Browser",
          "warning",
          4500
        );
      }
    };


  recognition.onend =
    () => {

      isListening = false;

      setVoiceUI(false);
    };


  return recognition;
}


function setVoiceUI(listening) {
  DOM.voiceListeningBanner.style.display =
    listening
      ? "flex"
      : "none";

  DOM.voiceExpenseBtn.classList.toggle(
    "listening",
    listening
  );
}


function toggleVoice() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {
    toast(
      "Browser นี้ไม่รองรับ Speech Recognition — แนะนำ Chrome หรือ Edge",
      "warning",
      5000
    );

    return;
  }


  if (!speechRecognizer) {
    speechRecognizer =
      initSpeechRecognition();
  }


  if (isListening) {
    speechRecognizer.stop();

    return;
  }


  try {
    speechRecognizer.start();
  }

  catch (error) {
    console.warn(error);
  }
}


function applyVoiceResult(text) {
  const result =
    parseThaiExpense(text);


  if (!result) {
    return;
  }


  DOM.quickExpenseTitle.value =
    result.title;


  if (result.amount > 0) {
    DOM.quickExpenseAmount.value =
      result.amount;
  }


  DOM.quickExpenseCategory.value =
    result.category;


  toast(
    `รับเสียงแล้ว: ${result.title}` +
    (
      result.amount > 0
        ? ` ฿${formatMoney(result.amount)}`
        : ""
    ),
    "success"
  );
}


/* =========================================================
   IMAGE COMPRESSION
========================================================= */

function compressImage(
  file,
  maxDimension = 900,
  quality = .8
) {
  return new Promise(
    resolve => {

      const reader =
        new FileReader();


      reader.onerror =
        () => {
          resolve({
            dataUrl: "",
            mime:
              file.type ||
              "image/jpeg"
          });
        };


      reader.onload =
        event => {

          const rawDataUrl =
            event.target.result;


          const image =
            new Image();


          image.onerror =
            () => {

              resolve({
                dataUrl:
                  rawDataUrl,

                mime:
                  file.type ||
                  "image/jpeg"
              });
            };


          image.onload =
            () => {

              let width =
                image.width;

              let height =
                image.height;


              if (
                width > maxDimension ||
                height > maxDimension
              ) {

                if (width > height) {

                  height =
                    Math.round(
                      height *
                      maxDimension /
                      width
                    );

                  width =
                    maxDimension;
                }

                else {

                  width =
                    Math.round(
                      width *
                      maxDimension /
                      height
                    );

                  height =
                    maxDimension;
                }
              }


              const canvas =
                document.createElement(
                  "canvas"
                );


              canvas.width =
                width;

              canvas.height =
                height;


              const ctx =
                canvas.getContext("2d");


              ctx.drawImage(
                image,
                0,
                0,
                width,
                height
              );


              const mime =
                file.type ===
                  "image/png"
                  ? "image/png"
                  : "image/jpeg";


              const dataUrl =
                canvas.toDataURL(
                  mime,
                  quality
                );


              resolve({
                dataUrl,
                mime
              });
            };


          image.src =
            rawDataUrl;
        };


      reader.readAsDataURL(
        file
      );
    }
  );
}


/* =========================================================
   GEMINI VISION
========================================================= */

/*
  IMPORTANT:
  API Key ที่ใช้ใน Browser มองเห็นได้จาก Developer Tools เสมอ

  ดังนั้น:
  - เหมาะกับการทดลองในเครื่อง
  - ถ้าเผยแพร่เว็บจริง ควรย้าย AI request ไป Backend
*/


/*
  AI Status & Banner Helpers
*/

function updateAiStatusBadge(state, label) {
  if (!DOM.aiStatusBadge) return;
  DOM.aiStatusBadge.className = `ai-badge ${state}`;
  if (label) {
    DOM.aiStatusBadge.innerHTML = label;
  } else if (state === "live") {
    DOM.aiStatusBadge.innerHTML = '<i data-lucide="sparkles"></i> Gemini AI Live';
  } else if (state === "demo") {
    DOM.aiStatusBadge.innerHTML = '<i data-lucide="alert-triangle"></i> Demo AI Result';
  } else if (state === "analyzing") {
    DOM.aiStatusBadge.innerHTML = '<i data-lucide="loader-2" class="spin-icon"></i> AI Analyzing...';
  } else if (state === "error") {
    DOM.aiStatusBadge.innerHTML = '<i data-lucide="alert-octagon"></i> AI Error';
  } else {
    DOM.aiStatusBadge.innerHTML = '<i data-lucide="sparkles"></i> AI Vision Ready';
  }
  refreshIcons();
}

function refreshScannerApiBanner() {
  const apiKey = getApiKey();
  const hasKey = Boolean(apiKey);

  if (DOM.scannerApiStatus) {
    DOM.scannerApiStatus.className = `scanner-api-status ${hasKey ? "live-mode" : "demo-mode"}`;
  }
  if (DOM.scannerApiDot) {
    DOM.scannerApiDot.className = `status-indicator-dot ${hasKey ? "live" : "demo"}`;
  }
  if (DOM.scannerApiStatusText) {
    DOM.scannerApiStatusText.innerHTML = hasKey
      ? '<i data-lucide="sparkles"></i> เชื่อมต่อ Gemini Vision AI แล้ว (พร้อมอ่านรูปภาพ & ประเมินราคาจริง)'
      : '<i data-lucide="alert-triangle"></i> กำลังใช้งาน Demo Mode — กรุณาใส่ Gemini API Key เพื่อให้ AI อ่านรูปจริง';
  }
  if (DOM.scannerApiKeyInput) {
    DOM.scannerApiKeyInput.value = apiKey;
  }
  if (!hasKey) {
    if (DOM.scannerApiDrawer) DOM.scannerApiDrawer.style.display = "block";
    updateAiStatusBadge("demo", '<i data-lucide="alert-triangle"></i> Demo Mode');
  } else {
    if (DOM.scannerApiDrawer) DOM.scannerApiDrawer.style.display = "none";
    updateAiStatusBadge("live", '<i data-lucide="sparkles"></i> Gemini AI Live');
  }
  refreshIcons();
}

function toggleScannerApiDrawer() {
  if (!DOM.scannerApiDrawer) return;
  const isHidden = DOM.scannerApiDrawer.style.display === "none";
  DOM.scannerApiDrawer.style.display = isHidden ? "block" : "none";
  if (isHidden && DOM.scannerApiKeyInput) {
    DOM.scannerApiKeyInput.focus();
  }
}

/*
  Smart Demo result when API key is not yet configured
*/
function getSmartDemoResult(hint = "") {
  const lower = (hint || "").toLowerCase();

  if (
    lower.includes("ทิชชู่") ||
    lower.includes("เช็ดหน้า") ||
    lower.includes("tissue")
  ) {
    return {
      merchant: "กระดาษทิชชู่เช็ดหน้า (Demo)",
      category: "Shopping",
      items: [
        {
          name: "กระดาษทิชชู่เช็ดหน้า (ซองพกพา)",
          price: 20
        }
      ],
      totalAmount: 20,
      detectedDetail: "โหมดตัวอย่าง: ประเมินจากคำช่วยค้นหา 'ทิชชู่เช็ดหน้า' (ราคาปลีก 7-Eleven ~฿20)",
      isDemo: true
    };
  }

  if (
    lower.includes("โค้ก") ||
    lower.includes("coke") ||
    lower.includes("cola") ||
    lower.includes("น้ำอัดลม")
  ) {
    return {
      merchant: "Coca-Cola (Demo)",
      category: "Food",
      items: [
        {
          name: "โค้ก Original (กระป๋อง 325ml)",
          price: 16
        }
      ],
      totalAmount: 16,
      detectedDetail: "โหมดตัวอย่าง: โค้กกระป๋อง 325ml (ราคาขายปลีกมาตรฐาน 7-Eleven ~฿16)",
      isDemo: true
    };
  }

  if (
    lower.includes("สมูทตี้") ||
    lower.includes("smoothie") ||
    lower.includes("ปั่น") ||
    lower.includes("frappe")
  ) {
    return {
      merchant: "ร้านเครื่องดื่ม / Smoothie (Demo)",
      category: "Food",
      items: [
        {
          name: "น้ำผลไม้ปั่น / สมูทตี้ (Smoothie)",
          price: 45
        }
      ],
      totalAmount: 45,
      detectedDetail: "โหมดตัวอย่าง: สมูทตี้/น้ำปั่น (ราคาตลาดทั่วไป ~฿45)",
      isDemo: true
    };
  }

  if (
    lower.includes("น้ำ") ||
    lower.includes("กาแฟ") ||
    lower.includes("ชา") ||
    lower.includes("ข้าว")
  ) {
    return {
      merchant: hint || "อาหาร/เครื่องดื่ม (Demo)",
      category: "Food",
      items: [
        {
          name: hint || "อาหาร/เครื่องดื่ม",
          price: 50
        }
      ],
      totalAmount: 50,
      detectedDetail: `โหมดตัวอย่าง: ประเมินจากคำช่วยค้นหา '${hint}' (~฿50)`,
      isDemo: true
    };
  }

  // Realistic default matching packaging (e.g. tissue paper)
  return {
    merchant: "กระดาษทิชชู่เช็ดหน้า (Demo AI)",
    category: "Shopping",
    items: [
      {
        name: "กระดาษทิชชู่เช็ดหน้า",
        price: 25
      }
    ],
    totalAmount: 25,
    detectedDetail: "โหมดจำลอง (Demo): เพื่อให้ AI อ่านรูปจริงและค้นหาราคาตลาดไทยอัตโนมัติ กรุณาใส่ Gemini API Key ฟรีที่กล่องด้านบน",
    isDemo: true
  };
}

/*
  Dynamic Model Discovery & Available Models Service
*/
let activeWorkingModel = null;
let cachedDiscoveredModels = null;

const FALLBACK_CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-flash-latest"
];

/*
  Dynamically query ModelService.ListModels to detect active models supporting generateContent
*/
async function getAvailableGeminiModels(apiKey) {
  if (cachedDiscoveredModels && cachedDiscoveredModels.length) {
    return cachedDiscoveredModels;
  }

  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models?key=` +
      encodeURIComponent(apiKey);

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      }
    });

    if (!res.ok) {
      return FALLBACK_CANDIDATE_MODELS;
    }

    const data = await res.json();
    if (!Array.isArray(data?.models)) {
      return FALLBACK_CANDIDATE_MODELS;
    }

    // Filter models supporting generateContent and multimodal tasks
    const usable = data.models
      .filter(m =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
      )
      .map(m => m.name.replace(/^models\//, ""))
      .filter(name =>
        !name.includes("embedding") &&
        !name.includes("aqa") &&
        !name.includes("imagen") &&
        name !== "gemini-1.5-flash" // permanently exclude retired model
      );

    if (!usable.length) {
      return FALLBACK_CANDIDATE_MODELS;
    }

    // Rank models: prioritize latest Flash models
    function score(m) {
      const lower = m.toLowerCase();
      if (lower.includes("3.8-flash")) return 100;
      if (lower.includes("3.5-flash")) return 95;
      if (lower.includes("2.5-flash")) return 90;
      if (lower.includes("2.0-flash") && !lower.includes("lite")) return 85;
      if (lower.includes("2.0-flash-exp")) return 80;
      if (lower.includes("2.0-flash-lite")) return 75;
      if (lower.includes("flash")) return 70;
      if (lower.includes("pro")) return 60;
      return 10;
    }

    usable.sort((a, b) => score(b) - score(a));
    cachedDiscoveredModels = usable;
    return usable;
  } catch (err) {
    console.warn("Could not query ListModels:", err);
    return FALLBACK_CANDIDATE_MODELS;
  }
}

/*
  Main Gemini Vision AI Caller with Multi-Model Auto-Fallback & Thai Retail Price Estimation
*/
async function callGeminiVision(
  dataUrl,
  mimeType,
  userHint = ""
) {
  const apiKey = getApiKey();

  if (!apiKey) {
    await delay(750);
    return getSmartDemoResult(userHint);
  }

  const base64 =
    dataUrl.split(",")[1] ||
    dataUrl;

  const hintInstruction =
    userHint && userHint.trim()
      ? `\nคำช่วยค้นหา/ข้อมูลระบุเพิ่มเติมจากผู้ใช้: "${userHint.trim()}" (นำคำนี้มาช่วยระบุชนิดสินค้าและค้นหาราคาตลาดจริง)`
      : "";

  const instruction = `
You are an expert AI OCR & Data Extraction Specialist and Thai Retail Pricing Intelligence Engine.
Analyze the provided image with high precision and classify it into ONE of two scenarios:

============================================================
SCENARIO 1: RECEIPT / BILL / INVOICE / PAYMENT SLIP
============================================================
If the image is a receipt, cash register slip, e-slip, tax invoice, or restaurant bill:
1. MERCHANT:
   - Extract the official store/merchant name (e.g., "7-Eleven", "Lotus's", "Big C", "Tops", "Café Amazon", "ร้านอาหาร/ชื่อร้านค้า").
2. ITEMS EXTRACTION (STRICT LINE-BY-LINE OCR):
   - You MUST extract EVERY individual purchased line item into the "items" array.
   - For each item:
     * "name": Item description in clean Thai or English (keep brand, flavor, or size if listed, e.g., "แซนวิชแฮมชีส", "All Café อเมริกาโน่เย็น", "Coca-Cola 325ml").
     * "price": Numeric total price for that line item as a Number (e.g., 39, not "39 บาท" or "฿39").
   - IGNORE ALL NOISE & METADATA: Discard Tax IDs (เลขประจำตัวผู้เสียภาษี), store addresses, branch codes, phone numbers, POS terminal/cashier IDs, date/time timestamps, change/cash tendered, payment method, VAT/tax breakdowns (ภาษีมูลค่าเพิ่ม), and promotional disclaimer footers. Focus strictly on actual purchased items and the payable total.
3. TOTAL AMOUNT:
   - Extract the net grand total paid (Number). Ensure it matches the sum of the extracted items.
4. CATEGORY:
   - Assign the primary spending category strictly from: "Food", "Transport", "Shopping", "Co-op", "Health", "Other".
5. DETECTED DETAIL:
   - A brief summary in Thai stating it is a receipt, the store name, and the count of items found (e.g., "สแกนใบเสร็จ 7-Eleven พบ 3 รายการ ยอดรวม ฿94").

============================================================
SCENARIO 2: STANDALONE PRODUCT / FOOD / BEVERAGE / OBJECT
============================================================
If the image is a photo of a single physical product, packaged consumer good, beverage, dish, or item held up to the camera or placed on a table (e.g., a can/bottle of Coke, an iced tea/frappe/smoothie, tissue paper, snack, toiletries, or street food dish):
1. IDENTIFICATION:
   - Identify the exact object name, brand, variant, and container/size if recognizable (e.g., "โค้ก ออริจินัล (กระป๋อง 325ml)", "ชาไทยปั่น / สมูทตี้", "กระดาษทิชชู่เช็ดหน้าพกพา (Kuma)").
2. REAL-WORLD THAI MARKET PRICE ESTIMATION:
   - Estimate its standard retail market price in Thailand in THB (Thai Baht) based on realistic market data:
     * Convenience Store benchmark (7-Eleven, Lawson, FamilyMart):
       - Canned soda (Coke, Pepsi 325ml): 15 - 18 THB
       - Bottled water (500-600ml): 7 - 10 THB
       - Ready-to-drink green tea / tea / coffee: 20 - 30 THB
       - Pocket tissue paper pack (Kuma, Kleenex, Cellox): 15 - 25 THB
       - Toasted sandwich / Ham Cheese: 32 - 39 THB
       - Snack / Potato chips (Lay's): 20 - 32 THB
     * Local Beverage Stalls & Cafés:
       - Fresh fruit smoothie / Frappe / Iced drink (น้ำผลไม้ปั่น, สมูทตี้): 35 - 55 THB
       - Branded café smoothie / Specialty coffee: 60 - 85 THB
     * Street Food & Casual Meals:
       - Made-to-order dish (Pad Kra Pao, Fried Rice, Noodles): 50 - 70 THB
     * Supermarket & Pharmacy goods:
       - Standard retail shelf price in THB.
   - Return this as EXACTLY ONE item in the "items" array:
     [ { "name": "<Identified Product Name>", "price": <Estimated Price Number> } ]
3. MERCHANT:
   - Set to the product name or brand (e.g., "Coca-Cola", "Café / ร้านเครื่องดื่ม", "7-Eleven").
4. TOTAL AMOUNT:
   - Set to the same estimated price as the single item.
5. CATEGORY:
   - Set to "Food" for drinks/meals/snacks, "Shopping" for tissue/household goods, "Health" for medicine/supplements/masks, etc.
6. DETECTED DETAIL:
   - Provide a clear, brief explanation in Thai of what was identified and how the price was estimated (e.g., "ตรวจพบ: โค้กกระป๋อง 325ml — ประเมินราคาขายปลีกมาตรฐาน 7-Eleven ~฿16").

${hintInstruction}

============================================================
STRICT JSON OUTPUT RULES
============================================================
- Respond ONLY with a single, raw, valid JSON object.
- DO NOT wrap the output in markdown code fences (NO \`\`\`json or \`\`\`).
- DO NOT add any greeting, preamble, or trailing commentary.
- The output JSON must strictly match this exact schema:
{
  "merchant": "String (Store name or Product name)",
  "category": "Food" | "Transport" | "Shopping" | "Co-op" | "Health" | "Other",
  "items": [
    { "name": "String (Item name)", "price": 0.00 }
  ],
  "totalAmount": 0.00,
  "detectedDetail": "String (Brief explanation of what was found or how the price was estimated in Thai)"
}
`.trim();

  // Dynamically resolve models supported by this API key via ModelService.ListModels
  const discovered = await getAvailableGeminiModels(apiKey);
  let candidateModels = Array.from(new Set(
    (discovered && discovered.length ? discovered : FALLBACK_CANDIDATE_MODELS)
  ));

  // If a known working model was already verified, try it first
  if (activeWorkingModel && candidateModels.includes(activeWorkingModel)) {
    candidateModels = [
      activeWorkingModel,
      ...candidateModels.filter(m => m !== activeWorkingModel)
    ];
  }

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const generateEndpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${model}:generateContent?key=` +
        encodeURIComponent(apiKey);

      const payload = {
        contents: [
          {
            parts: [
              {
                text: instruction
              },
              {
                inline_data: {
                  mime_type:
                    mimeType ||
                    "image/jpeg",
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type:
            "application/json",
          temperature: 0.1
        }
      };

      let response = await fetch(
        generateEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(payload)
        }
      );

      // If generateContent indicates Interactions API or returns 404, fallback to Interactions API
      if (!response.ok && response.status !== 401 && response.status !== 403) {
        let errMessage = "";
        try {
          const errData = await response.clone().json();
          errMessage = errData?.error?.message || "";
        } catch { }

        if (
          errMessage.includes("Interactions API") ||
          errMessage.includes("interactions") ||
          response.status === 404
        ) {
          const interactionsEndpoint =
            `https://generativelanguage.googleapis.com/v1beta/interactions?key=` +
            encodeURIComponent(apiKey);

          const interactionPayload = {
            model: model,
            input: {
              contents: payload.contents
            },
            generation_config: {
              response_mime_type: "application/json",
              temperature: 0.1
            }
          };

          const intResponse = await fetch(interactionsEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify(interactionPayload)
          });

          if (intResponse.ok) {
            response = intResponse;
          }
        }
      }

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          message = errorData?.error?.message || message;
        } catch { }

        if (
          message.includes("API key not valid") ||
          message.includes("PERMISSION_DENIED") ||
          message.includes("API_KEY_INVALID")
        ) {
          throw new Error("Gemini API Key ไม่ถูกต้อง กรุณาตรวจสอบ Key ใน AI Settings");
        }

        throw new Error(message);
      }

      const result = await response.json();
      const raw =
        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
        result?.output_text ||
        result?.outputs?.[result.outputs.length - 1]?.text ||
        result?.outputs?.[0]?.text ||
        (Array.isArray(result?.output) ? result.output[0]?.text : null) ||
        result?.text;

      if (!raw) {
        throw new Error("AI ไม่ได้ส่งข้อความตอบกลับ");
      }

      // Robust cleaning: strip markdown code blocks if present
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("ผลลัพธ์จาก AI ไม่ใช่รูปแบบ JSON ที่ถูกต้อง");
        }
        parsed = JSON.parse(jsonMatch[0]);
      }

      // 1. Merchant name
      const merchant = String(
        parsed.merchant ||
        (Array.isArray(parsed.items) && parsed.items[0]?.name) ||
        "สินค้าที่ตรวจพบ"
      ).trim();

      // 2. Category
      const category = normalizeCategory(parsed.category);

      // 3. Normalized items array
      let items = [];
      if (Array.isArray(parsed.items)) {
        items = parsed.items
          .map(item => ({
            name: String(item.name || "").trim(),
            price: Number(item.price) || 0
          }))
          .filter(item => item.name.length > 0 || item.price > 0);
      }

      // 4. Total Amount normalization
      let totalAmount = Number(parsed.totalAmount);
      const itemsSum = items.reduce(
        (sum, item) => sum + (Number(item.price) || 0),
        0
      );

      if (Number.isNaN(totalAmount) || totalAmount <= 0) {
        totalAmount = itemsSum > 0 ? itemsSum : 0;
      }

      // Ensure at least one item exists for DOM mapping and review
      if (items.length === 0) {
        items = [
          {
            name: merchant || "สินค้าที่ตรวจพบ",
            price: totalAmount > 0 ? totalAmount : 0
          }
        ];
      }

      // 5. Detected Detail explanation
      const detectedDetail = String(parsed.detectedDetail || "").trim();

      activeWorkingModel = model;

      return {
        merchant,
        category,
        items,
        totalAmount,
        detectedDetail,
        isDemo: false,
        modelUsed: model
      };
    } catch (err) {
      console.warn(`Model ${model} failed:`, err);
      lastError = err;
      if (err.message.includes("API Key ไม่ถูกต้อง")) {
        throw err;
      }
    }
  }

  throw lastError || new Error("ไม่สามารถเชื่อมต่อ Gemini AI ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ API Key");
}

/*
  Re-analyze current image with optional user hint
*/
async function reanalyzeCurrentImage(hint = "") {
  if (!currentImageBase64) {
    toast("กรุณาเลือกหรือถ่ายรูปภาพก่อน", "warning");
    return;
  }

  setScannerState("loading");
  updateAiStatusBadge("analyzing", "AI กำลังค้นหา & อ่านรูป...");

  try {
    const result = await callGeminiVision(
      currentImageBase64,
      currentMimeType,
      hint
    );

    DOM.merchantInput.value = result.merchant;
    DOM.categorySelect.value = result.category;
    renderReceiptItems(result.items);

    if (DOM.scannerAiNotes) {
      if (result.detectedDetail) {
        DOM.scannerAiNotes.innerHTML = `<i data-lucide="search"></i> AI ตรวจพบ: ${escapeHTML(result.detectedDetail)}`;
        DOM.scannerAiNotes.style.display = "block";
        refreshIcons();
      } else {
        DOM.scannerAiNotes.style.display = "none";
      }
    }

    updateAiStatusBadge(
      result.isDemo ? "demo" : "live",
      result.isDemo ? '<i data-lucide="alert-triangle"></i> Demo AI Result' : '<i data-lucide="sparkles"></i> Gemini Vision AI'
    );
    setScannerState("result");

    if (result.isDemo) {
      toast("ยังไม่ได้ใส่ API Key — ผลลัพธ์แสดงแบบ Demo ใส่ Gemini API Key เพื่ออ่านรูปจริง", "warning", 4500);
      if (DOM.scannerApiDrawer) DOM.scannerApiDrawer.style.display = "block";
    } else {
      toast(`AI วิเคราะห์รูปภาพสำเร็จ: ${result.merchant} (฿${result.totalAmount})`, "success", 4000);
    }
  } catch (error) {
    console.error(error);
    toast(`AI วิเคราะห์ไม่สำเร็จ: ${error.message}`, "error", 5000);
    setScannerState("result");
    updateAiStatusBadge("error", "AI Error");
  }
}

function normalizeCategory(value) {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("food") ||
    text.includes("อาหาร") ||
    text.includes("เครื่องดื่ม") ||
    text.includes("กิน") ||
    text.includes("ขนม")
  ) {
    return "Food";
  }

  if (
    text.includes("transport") ||
    text.includes("เดินทาง") ||
    text.includes("รถ") ||
    text.includes("น้ำมัน")
  ) {
    return "Transport";
  }

  if (
    text.includes("health") ||
    text.includes("ยา") ||
    text.includes("แพทย์") ||
    text.includes("สุขภาพ") ||
    text.includes("อนามัย")
  ) {
    return "Health";
  }

  if (
    text.includes("shop") ||
    text.includes("ทิชชู่") ||
    text.includes("ของใช้") ||
    text.includes("ซื้อ") ||
    text.includes("tissue")
  ) {
    return "Shopping";
  }

  if (
    text.includes("co-op") ||
    text.includes("lab") ||
    text.includes("เรียน") ||
    text.includes("วิจัย")
  ) {
    return "Co-op";
  }

  return "Other";
}


/* =========================================================
   RECEIPT SCANNER UI
========================================================= */

function setScannerState(state) {
  DOM.emptyState.style.display =
    state === "empty"
      ? "flex"
      : "none";

  DOM.loadingState.style.display =
    state === "loading"
      ? "flex"
      : "none";

  DOM.resultState.style.display =
    state === "result"
      ? "block"
      : "none";


  DOM.previewStage.classList.toggle(
    "analyzing",
    state === "loading"
  );
}


function addReceiptItem(
  name = "",
  price = 0
) {
  const row =
    document.createElement(
      "div"
    );


  row.className =
    "receipt-item";


  row.innerHTML = `
    <input
      type="text"
      class="receipt-item-name"
      value="${escapeHTML(name)}"
      placeholder="ชื่อรายการ"
    />

    <input
      type="number"
      class="receipt-item-price"
      value="${Number(price) || 0}"
      min="0"
      step="any"
      placeholder="0"
    />

    <button
      type="button"
      class="receipt-item-delete"
    >
      ×
    </button>
  `;


  row
    .querySelector(
      ".receipt-item-price"
    )
    .addEventListener(
      "input",
      calculateReceiptTotal
    );


  row
    .querySelector(
      ".receipt-item-delete"
    )
    .addEventListener(
      "click",
      () => {

        row.remove();

        calculateReceiptTotal();
      }
    );


  DOM.itemsContainer
    .appendChild(row);
}


function renderReceiptItems(items) {
  DOM.itemsContainer.innerHTML = "";


  items.forEach(
    item => {

      addReceiptItem(
        item.name,
        item.price
      );
    }
  );


  calculateReceiptTotal();
}


function calculateReceiptTotal() {
  let total = 0;


  DOM.itemsContainer
    .querySelectorAll(
      ".receipt-item-price"
    )
    .forEach(
      input => {

        total +=
          Number(input.value) ||
          0;
      }
    );


  const decimals = total % 1 !== 0 ? 2 : 0;
  DOM.receiptTotal.textContent =
    `฿${formatMoney(total, decimals)}`;

  return total;
}


function getReceiptItems() {
  return Array.from(
    DOM.itemsContainer
      .querySelectorAll(
        ".receipt-item"
      )
  )
    .map(
      row => ({

        name:
          row
            .querySelector(
              ".receipt-item-name"
            )
            .value
            .trim(),

        price:
          Number(
            row
              .querySelector(
                ".receipt-item-price"
              )
              .value
          ) || 0
      })
    )
    .filter(
      item =>
        item.name ||
        item.price > 0
    )
    .map(
      item => ({
        name:
          item.name ||
          "Item",

        price:
          item.price
      })
    );
}


function resetScanner() {
  currentImageBase64 = "";

  currentMimeType =
    "image/jpeg";


  DOM.previewImg.src = "";
  DOM.previewImg.style.display =
    "none";

  DOM.uploadPlaceholder.style.display =
    "flex";

  DOM.reuploadBar.style.display =
    "none";

  DOM.fileInput.value = "";

  DOM.merchantInput.value =
    "";

  DOM.categorySelect.value =
    "Shopping";

  DOM.itemsContainer.innerHTML =
    "";

  if (DOM.scannerHintInput) {
    DOM.scannerHintInput.value = "";
  }

  if (DOM.scannerAiNotes) {
    DOM.scannerAiNotes.style.display = "none";
    DOM.scannerAiNotes.textContent = "";
  }

  updateAiStatusBadge(
    getApiKey() ? "live" : "demo",
    getApiKey() ? '<i data-lucide="sparkles"></i> Gemini AI Live' : '<i data-lucide="alert-triangle"></i> Demo Mode'
  );

  setScannerState(
    "empty"
  );
}


async function processImage(file) {
  if (!file) {
    return;
  }


  const isImage =
    (
      file.type &&
      file.type.startsWith(
        "image/"
      )
    ) ||
    /\.(jpg|jpeg|png|webp|bmp|gif)$/i
      .test(file.name || "");


  if (!isImage) {
    toast(
      "กรุณาเลือกไฟล์รูปภาพ",
      "error"
    );

    return;
  }


  showModal(
    "receiptModal"
  );


  setScannerState(
    "loading"
  );


  updateAiStatusBadge(
    "analyzing",
    '<i data-lucide="loader-2" class="spin-icon"></i> AI Analyzing Image...'
  );


  try {

    const {
      dataUrl,
      mime
    } =
      await compressImage(
        file
      );


    currentImageBase64 =
      dataUrl;

    currentMimeType =
      mime;


    DOM.previewImg.src =
      dataUrl;

    DOM.previewImg.style.display =
      "block";

    DOM.uploadPlaceholder.style.display =
      "none";

    DOM.reuploadBar.style.display =
      "flex";


    const hint =
      DOM.scannerHintInput
        ? DOM.scannerHintInput.value.trim()
        : "";

    const result =
      await callGeminiVision(
        dataUrl,
        mime,
        hint
      );


    DOM.merchantInput.value =
      result.merchant;


    DOM.categorySelect.value =
      result.category;


    renderReceiptItems(
      result.items
    );


    if (DOM.scannerAiNotes) {
      if (result.detectedDetail) {
        DOM.scannerAiNotes.innerHTML =
          `<i data-lucide="search"></i> AI ตรวจพบ: ${escapeHTML(result.detectedDetail)}`;
        DOM.scannerAiNotes.style.display =
          "block";
        refreshIcons();
      } else {
        DOM.scannerAiNotes.style.display =
          "none";
      }
    }


    updateAiStatusBadge(
      result.isDemo ? "demo" : "live",
      result.isDemo
        ? '<i data-lucide="alert-triangle"></i> Demo AI Result'
        : '<i data-lucide="sparkles"></i> Gemini Vision AI'
    );


    setScannerState(
      "result"
    );


    if (result.isDemo) {
      toast(
        "ยังไม่ได้ใส่ API Key — แสดงผลตัวอย่าง (Demo) ใส่ Key เพื่ออ่านรูปจริง",
        "warning",
        4500
      );
      if (DOM.scannerApiDrawer) {
        DOM.scannerApiDrawer.style.display = "block";
      }
    } else {
      toast(
        `AI วิเคราะห์สำเร็จ: ${result.merchant} (฿${result.totalAmount})`,
        "success",
        4000
      );
    }

  }

  catch (error) {

    console.error(error);


    toast(
      `AI วิเคราะห์ไม่สำเร็จ: ${error.message}`,
      "error",
      5000
    );


    renderReceiptItems([
      {
        name:
          "กรอกรายการเอง",

        price:
          0
      }
    ]);


    DOM.merchantInput.value =
      "Manual Entry";


    DOM.aiStatusBadge.textContent =
      "Manual Input";


    setScannerState(
      "result"
    );
  }
}


function confirmReceipt() {
  const items =
    getReceiptItems();


  const total =
    calculateReceiptTotal();


  if (
    !items.length ||
    total <= 0
  ) {
    toast(
      "กรุณาระบุรายการและราคาอย่างน้อย 1 รายการ",
      "warning"
    );

    return;
  }


  const merchant =
    DOM.merchantInput
      .value
      .trim() ||
    "Receipt / Food";

  const category =
    DOM.categorySelect.value;

  const merchantTags = extractHashtags(merchant);
  const itemTags = items.flatMap(it => extractHashtags(it.name || ""));
  const hintTags = DOM.scannerHintInput ? extractHashtags(DOM.scannerHintInput.value || "") : [];
  const tags = Array.from(new Set([...merchantTags, ...itemTags, ...hintTags]));

  const transaction = {
    id:
      Date.now(),

    merchant,

    category,

    total,

    date:
      currentTimeLabel(),

    image:
      currentImageBase64,

    tags,

    items
  };


  const list =
    getTransactions();


  list.unshift(
    transaction
  );


  if (!saveTransactions(list)) {
    return;
  }


  hideModal(
    "receiptModal"
  );


  resetScanner();

  refreshUI();


  const available =
    calculateSummary()
      .available;


  toast(
    `บันทึก ฿${formatMoney(total)} แล้ว · คงเหลือ ฿${formatMoney(available)}`,
    "success",
    4200
  );
}


/* =========================================================
   CAMERA
========================================================= */

async function openCamera() {
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    if (DOM.directCameraInput) {
      DOM.directCameraInput.click();
      return;
    }
    toast(
      "Browser นี้ไม่รองรับการเปิดกล้องโดยตรง",
      "warning"
    );

    return;
  }


  try {

    stopCamera();

    showModal(
      "liveCameraModal"
    );


    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode:
              currentCameraFacing,

            width: {
              ideal:
                1920
            },

            height: {
              ideal:
                1080
            }
          },

          audio:
            false
        });


    activeCameraStream =
      stream;


    DOM.cameraVideo.srcObject =
      stream;


    await DOM.cameraVideo.play();

  }

  catch (error) {

    console.error(error);

    hideModal(
      "liveCameraModal"
    );

    if (DOM.directCameraInput) {
      DOM.directCameraInput.click();
      return;
    }

    toast(
      "เปิดกล้องไม่ได้ กรุณาตรวจสอบ Camera Permission",
      "error",
      4500
    );
  }
}


function stopCamera() {
  if (activeCameraStream) {

    activeCameraStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );


    activeCameraStream =
      null;
  }


  DOM.cameraVideo.srcObject =
    null;
}


function closeCamera() {
  stopCamera();

  hideModal(
    "liveCameraModal"
  );
}


function captureCameraPhoto() {
  if (
    !activeCameraStream ||
    DOM.cameraVideo.readyState < 2
  ) {
    toast(
      "กล้องยังไม่พร้อม",
      "warning"
    );

    return;
  }


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    DOM.cameraVideo.videoWidth ||
    1280;

  canvas.height =
    DOM.cameraVideo.videoHeight ||
    720;


  const ctx =
    canvas.getContext("2d");


  ctx.drawImage(
    DOM.cameraVideo,
    0,
    0,
    canvas.width,
    canvas.height
  );


  const flash =
    document.getElementById(
      "cameraFlashOverlay"
    );


  flash.classList.add(
    "flashing"
  );


  setTimeout(
    () => {
      flash.classList.remove(
        "flashing"
      );
    },
    300
  );


  closeCamera();


  canvas.toBlob(
    blob => {

      if (!blob) {
        return;
      }


      const file =
        new File(
          [blob],
          `receipt_${Date.now()}.jpg`,
          {
            type:
              "image/jpeg"
          }
        );


      processImage(file);
    },

    "image/jpeg",
    .92
  );
}


async function switchCamera() {
  currentCameraFacing =
    currentCameraFacing ===
      "environment"
      ? "user"
      : "environment";


  await openCamera();
}


/* =========================================================
   API SETTINGS
========================================================= */

function openApiSettings() {
  DOM.apiKeyInput.value =
    getApiKey();

  updateBackupInfoDisplay();

  showModal(
    "apiSettingsModal"
  );

  refreshIcons();
}


function saveApiKey() {
  const key =
    DOM.apiKeyInput
      .value
      .trim();

  cachedDiscoveredModels = null;
  activeWorkingModel = null;

  if (key) {
    localStorage.setItem(
      API_KEY_STORAGE,
      key
    );

    toast(
      "บันทึก AI API Key ใน Browser นี้แล้ว",
      "success"
    );
  }

  else {
    localStorage.removeItem(
      API_KEY_STORAGE
    );

    toast(
      "ไม่ได้ตั้ง API Key — ระบบจะใช้ Demo AI",
      "warning"
    );
  }

  refreshScannerApiBanner();

  hideModal(
    "apiSettingsModal"
  );
}


function clearApiKey() {
  localStorage.removeItem(
    API_KEY_STORAGE
  );

  cachedDiscoveredModels = null;
  activeWorkingModel = null;

  DOM.apiKeyInput.value =
    "";

  if (DOM.scannerApiKeyInput) {
    DOM.scannerApiKeyInput.value = "";
  }

  refreshScannerApiBanner();

  toast(
    "ล้าง API Key แล้ว",
    "success"
  );
}


function saveApiKeyFromScanner() {
  const key =
    (DOM.scannerApiKeyInput?.value || "")
      .trim();

  if (!key) {
    toast(
      "กรุณาวาง Gemini API Key ก่อน",
      "warning"
    );
    return;
  }

  cachedDiscoveredModels = null;
  activeWorkingModel = null;

  localStorage.setItem(
    API_KEY_STORAGE,
    key
  );

  DOM.apiKeyInput.value = key;
  refreshScannerApiBanner();

  toast(
    "บันทึก Gemini API Key สำเร็จ! กำลังประมวลผลรูปจริง...",
    "success"
  );

  if (currentImageBase64) {
    const hint =
      DOM.scannerHintInput
        ? DOM.scannerHintInput.value.trim()
        : "";
    reanalyzeCurrentImage(hint);
  }
}


async function testApiKey() {
  const key =
    DOM.apiKeyInput.value.trim() ||
    getApiKey();

  if (!key) {
    toast(
      "กรุณาวาง API Key ก่อนทดสอบ",
      "warning"
    );
    return;
  }

  toast(
    "กำลังตรวจสอบโมเดลที่รองรับ & ทดสอบเชื่อมต่อ Gemini API...",
    "info",
    2000
  );

  const discovered = await getAvailableGeminiModels(key);
  const models = Array.from(new Set(
    (discovered && discovered.length ? discovered : FALLBACK_CANDIDATE_MODELS)
  ));

  let successModel = null;
  let lastErr = "";

  for (const m of models) {
    try {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${m}:generateContent?key=` +
        encodeURIComponent(key);

      const payload = {
        contents: [
          {
            parts: [
              { text: "ping" }
            ]
          }
        ]
      };

      let res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // Try Interactions endpoint
        const intRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/interactions?key=` +
          encodeURIComponent(key),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key
            },
            body: JSON.stringify({
              model: m,
              input: "ping"
            })
          }
        );
        if (intRes.ok) {
          res = intRes;
        }
      }

      if (res.ok) {
        successModel = m;
        activeWorkingModel = m;
        break;
      } else {
        const d = await res.json().catch(() => ({}));
        lastErr = d?.error?.message || `HTTP ${res.status}`;
      }
    } catch (e) {
      lastErr = e.message;
    }
  }

  if (successModel) {
    toast(
      `เชื่อมต่อสำเร็จ! AI Model ${successModel} พร้อมใช้งาน`,
      "success",
      4500
    );
  } else {
    toast(
      `ทดสอบไม่สำเร็จ: ${lastErr}`,
      "error",
      5000
    );
  }
}


/* =========================================================
   RESET DATA
========================================================= */

async function resetDemoData() {
  const ok = await showAnimeConfirm({
    title: "รีเซ็ตข้อมูล Demo?",
    message: "ต้องการรีเซ็ตรายการใช้จ่ายทั้งหมดกลับเป็นข้อมูลเริ่มต้น (Demo) หรือไม่?",
    bubbleText: "จะรีเซ็ตข้อมูลทั้งหมดจริงเหรอคะ?",
    confirmText: "ยืนยันรีเซ็ต",
    cancelText: "ยกเลิก",
    danger: true
  });

  if (!ok) {
    return;
  }


  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      DEFAULT_TRANSACTIONS
    )
  );


  refreshUI();


  toast(
    "Reset Demo Data แล้ว",
    "success"
  );
}


/* =========================================================
   DATA MANAGEMENT: BACKUP & RESTORE (EXPORT / IMPORT JSON)
========================================================= */

function updateBackupInfoDisplay() {
  const txList = getTransactions();
  const txCountEl = document.getElementById("backupTxCount");
  const balEl = document.getElementById("backupBalanceVal");
  if (txCountEl) {
    txCountEl.textContent = `${Array.isArray(txList) ? txList.length : 0} รายการ`;
  }
  if (balEl) {
    balEl.textContent = `฿${formatMoney(getInitialBalance())}`;
  }
}

function exportBackup() {
  try {
    // 1. Collect all data from localStorage
    const storageDump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storageDump[key] = localStorage.getItem(key);
      }
    }

    // 2. Prepare structured backup payload
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`; // e.g. 2026-10-15
    const txList = getTransactions();
    const initialBal = getInitialBalance();

    const backupPayload = {
      appName: "FinanceAI",
      version: "1.0",
      exportDate: now.toISOString(),
      exportDateFormatted: `${dateStr} ${now.toTimeString().split(" ")[0]}`,
      meta: {
        transactionCount: Array.isArray(txList) ? txList.length : 0,
        initialBalance: initialBal
      },
      storage: storageDump
    };

    // 3. Convert to formatted JSON
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // 4. Download file named finance_backup_YYYY-MM-DD.json
    const filename = `finance_backup_${dateStr}.json`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    toast(`ส่งออกไฟล์แบ็คอัปสำเร็จ! (${filename})`, "success", 4000);
  } catch (err) {
    console.error("Export backup failed:", err);
    toast("เกิดข้อผิดพลาดในการส่งออกข้อมูล: " + (err.message || "ไม่สามารถสร้างไฟล์ได้"), "error", 4500);
  }
}

function triggerImportBackup() {
  const fileInput = document.getElementById("importBackupFileInput");
  if (fileInput) {
    fileInput.value = ""; // Clear so same file can be selected again
    fileInput.click();
  }
}

async function handleImportBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
    toast("กรุณาเลือกไฟล์สำรองข้อมูลที่เป็นนามสกุล .json เท่านั้น", "warning", 4000);
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const content = e.target.result;
      const parsed = JSON.parse(content);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("โครงสร้างไฟล์ JSON ไม่ถูกต้อง");
      }

      let itemsToRestore = {};

      if (parsed.storage && typeof parsed.storage === "object") {
        // Standard FinanceAI export structure
        itemsToRestore = parsed.storage;
      } else if (parsed.localStorage && typeof parsed.localStorage === "object") {
        // Alternative backup structure
        itemsToRestore = parsed.localStorage;
      } else if (Array.isArray(parsed)) {
        // Direct transactions array backup
        itemsToRestore[STORAGE_KEY] = JSON.stringify(parsed);
      } else {
        // Direct key-value dump
        itemsToRestore = parsed;
      }

      const keys = Object.keys(itemsToRestore);
      if (keys.length === 0) {
        throw new Error("ไม่พบข้อมูลที่สามารถนำเข้าได้ในไฟล์นี้");
      }

      // Ask user confirmation before overwriting data
      const ok = await showAnimeConfirm({
        title: "ยืนยันการนำเข้าข้อมูล?",
        message: `พบข้อมูลในไฟล์สำรอง (${keys.length} รายการข้อมูล/การตั้งค่า) การนำเข้าจะเขียนทับข้อมูลปัจจุบัน และรีเฟรชหน้าต่างเพื่อให้ข้อมูลใหม่แสดงผล ต้องการดำเนินการต่อหรือไม่?`,
        bubbleText: "ต้องการนำเข้าไฟล์ข้อมูลนี้ใช่ไหมคะ?",
        confirmText: "นำเข้าและเซฟทับ",
        cancelText: "ยกเลิก",
        danger: false
      });

      if (!ok) {
        toast("ยกเลิกการนำเข้าข้อมูลแล้ว", "info", 2500);
        return;
      }

      // Write items to localStorage
      keys.forEach(k => {
        const val = itemsToRestore[k];
        if (typeof val === "string") {
          localStorage.setItem(k, val);
        } else {
          localStorage.setItem(k, JSON.stringify(val));
        }
      });

      toast("นำเข้าข้อมูลสำเร็จ! กำลังรีเฟรชหน้าต่าง...", "success", 2000);

      // Refresh window to display fresh data as requested
      setTimeout(() => {
        window.location.reload();
      }, 700);

    } catch (err) {
      console.error("Import backup error:", err);
      toast("นำเข้าข้อมูลไม่สำเร็จ: " + (err.message || "ไฟล์ไม่ถูกต้อง"), "error", 5000);
    }
  };

  reader.onerror = function () {
    toast("ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่อีกครั้ง", "error", 4000);
  };

  reader.readAsText(file, "UTF-8");
}

function initDataManagement() {
  const exportBtn = document.getElementById("exportBackupBtn");
  const importBtn = document.getElementById("importBackupBtn");
  const fileInput = document.getElementById("importBackupFileInput");

  if (exportBtn) {
    exportBtn.addEventListener("click", exportBackup);
  }

  if (importBtn) {
    importBtn.addEventListener("click", triggerImportBackup);
  }

  if (fileInput) {
    fileInput.addEventListener("change", handleImportBackupFile);
  }
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  /* Close modal */

  document
    .querySelectorAll(
      "[data-close-modal]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            hideModal(
              button.dataset.closeModal
            );
          }
        );
      }
    );


  document
    .querySelectorAll(
      ".modal"
    )
    .forEach(
      modal => {

        modal.addEventListener(
          "click",
          event => {

            if (
              event.target === modal
            ) {
              hideModal(
                modal.id
              );
            }
          }
        );
      }
    );


  /* Initial balance */

  DOM.initialBalanceCard
    .addEventListener(
      "click",
      editInitialBalance
    );


  /* Quick Expense */

  DOM.quickExpenseForm
    .addEventListener(
      "submit",
      saveQuickExpense
    );


  /* Voice */

  DOM.voiceExpenseBtn
    .addEventListener(
      "click",
      toggleVoice
    );


  DOM.voiceStopBtn
    .addEventListener(
      "click",
      () => {

        if (
          speechRecognizer &&
          isListening
        ) {
          speechRecognizer.stop();
        }
      }
    );


  /* Main Scan Button — Open Camera directly for scanning receipts */

  if (DOM.scanBtn) {
    DOM.scanBtn
      .addEventListener(
        "click",
        event => {
          event.preventDefault();
          openCamera();
        }
      );
  }


  /* Receipt File */

  DOM.fileInput
    .addEventListener(
      "change",
      event => {

        const file =
          event.target
            .files?.[0];


        if (file) {
          processImage(file);
        }
      }
    );


  /* Inline File */

  DOM.inlineFileInput
    .addEventListener(
      "change",
      event => {

        const file =
          event.target
            .files?.[0];


        if (file) {
          processImage(file);
        }


        DOM.inlineFileInput.value =
          "";
      }
    );


  /* Direct Camera Capture (Mobile Fallback) */

  if (DOM.directCameraInput) {
    DOM.directCameraInput
      .addEventListener(
        "change",
        event => {
          const file = event.target.files?.[0];
          if (file) {
            processImage(file);
          }
          DOM.directCameraInput.value = "";
        }
      );
  }


  /* Dropzone */

  DOM.inlineDropzone
    .addEventListener(
      "dragover",
      event => {

        event.preventDefault();

        DOM.inlineDropzone
          .classList
          .add("drag-over");
      }
    );


  DOM.inlineDropzone
    .addEventListener(
      "dragleave",
      event => {

        event.preventDefault();

        DOM.inlineDropzone
          .classList
          .remove("drag-over");
      }
    );


  DOM.inlineDropzone
    .addEventListener(
      "drop",
      event => {

        event.preventDefault();

        DOM.inlineDropzone
          .classList
          .remove("drag-over");


        const file =
          event.dataTransfer
            ?.files?.[0];


        if (file) {
          processImage(file);
        }
      }
    );

  /* Scanner Chibi Interactive Click & Speech */
  const chibiLeft = document.getElementById("scannerChibiLeft");
  const chibiRight = document.getElementById("scannerChibiRight");
  const bubbleLeft = document.getElementById("chibiBubbleLeft");
  const bubbleRight = document.getElementById("chibiBubbleRight");

  const leftQuotes = [
    "A! สแกนสลิปไหม?",
    "Gura พร้อมช่วยจ้า!",
    "Shark checking receipt!",
    "มีค่าใช้จ่ายอะไรไหม?",
    "สแกนแล้วเก็บตังค์!"
  ];
  let leftQuoteIdx = 0;

  if (chibiLeft && bubbleLeft) {
    chibiLeft.addEventListener("click", () => {
      chibiLeft.classList.remove("chibi-jump");
      void chibiLeft.offsetWidth;
      chibiLeft.classList.add("chibi-jump");

      leftQuoteIdx = (leftQuoteIdx + 1) % leftQuotes.length;
      bubbleLeft.textContent = leftQuotes[leftQuoteIdx];
      bubbleLeft.classList.add("show");

      setTimeout(() => {
        bubbleLeft.classList.remove("show");
        chibiLeft.classList.remove("chibi-jump");
      }, 2000);
    });

    chibiLeft.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chibiLeft.click();
      }
    });
  }

  const rightQuotes = [
    "ลากสลิปมาเลย!",
    "เย้! วันนี้กินอะไรดี?",
    "Domogura~!",
    "ส่งรูปมาให้ดูหน่อย!",
    "ตรวจสลิปให้ทันใจ!"
  ];
  let rightQuoteIdx = 0;

  if (chibiRight && bubbleRight) {
    chibiRight.addEventListener("click", () => {
      chibiRight.classList.remove("chibi-jump");
      void chibiRight.offsetWidth;
      chibiRight.classList.add("chibi-jump");

      rightQuoteIdx = (rightQuoteIdx + 1) % rightQuotes.length;
      bubbleRight.textContent = rightQuotes[rightQuoteIdx];
      bubbleRight.classList.add("show");

      setTimeout(() => {
        bubbleRight.classList.remove("show");
        chibiRight.classList.remove("chibi-jump");
      }, 2000);
    });

    chibiRight.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chibiRight.click();
      }
    });
  }


  /* Paste image */

  window.addEventListener(
    "paste",
    event => {

      const items =
        event.clipboardData
          ?.items;


      if (!items) {
        return;
      }


      for (
        const item of items
      ) {

        if (
          item.type.startsWith(
            "image/"
          )
        ) {

          const file =
            item.getAsFile();


          if (file) {
            processImage(file);
          }


          break;
        }
      }
    }
  );


  /* Receipt items */

  DOM.addItemBtn
    .addEventListener(
      "click",
      () => {

        addReceiptItem(
          "",
          0
        );
      }
    );


  DOM.clearItemsBtn
    .addEventListener(
      "click",
      async () => {
        const ok = await showAnimeConfirm({
          title: "ล้างรายการทั้งหมด?",
          message: "ต้องการล้างรายการสินค้าที่สแกนได้ทั้งหมดหรือไม่?",
          bubbleText: "จะล้างรายการสินค้าทั้งหมดเลยนะคะ!",
          confirmText: "ล้างทั้งหมด",
          cancelText: "ยกเลิก",
          danger: true
        });

        if (!ok) {
          return;
        }


        DOM.itemsContainer.innerHTML =
          "";


        calculateReceiptTotal();
      }
    );


  DOM.confirmBtn
    .addEventListener(
      "click",
      confirmReceipt
    );


  /* Camera triggers */

  document
    .querySelectorAll(
      ".trigger-live-camera"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            openCamera();
          }
        );
      }
    );


  DOM.snapPhotoBtn
    .addEventListener(
      "click",
      captureCameraPhoto
    );


  DOM.switchCameraBtn
    .addEventListener(
      "click",
      switchCamera
    );


  DOM.closeCameraBtn
    .addEventListener(
      "click",
      closeCamera
    );


  DOM.cancelCameraBtn
    .addEventListener(
      "click",
      closeCamera
    );


  /* Reset */

  DOM.resetBtn
    .addEventListener(
      "click",
      resetDemoData
    );


  /* API Settings */

  DOM.openApiSettingsBtn
    .addEventListener(
      "click",
      openApiSettings
    );


  DOM.saveApiKeyBtn
    .addEventListener(
      "click",
      saveApiKey
    );


  DOM.clearApiKeyBtn
    .addEventListener(
      "click",
      clearApiKey
    );

  if (DOM.testApiKeyBtn) {
    DOM.testApiKeyBtn.addEventListener(
      "click",
      testApiKey
    );
  }

  /* Scanner Inline API & AI Search Events */

  if (DOM.toggleScannerApiEditBtn) {
    DOM.toggleScannerApiEditBtn.addEventListener(
      "click",
      toggleScannerApiDrawer
    );
  }

  if (DOM.scannerSaveKeyBtn) {
    DOM.scannerSaveKeyBtn.addEventListener(
      "click",
      saveApiKeyFromScanner
    );
  }

  if (DOM.scannerReanalyzeBtn) {
    DOM.scannerReanalyzeBtn.addEventListener(
      "click",
      () => {
        const hint =
          DOM.scannerHintInput
            ? DOM.scannerHintInput.value.trim()
            : "";
        reanalyzeCurrentImage(hint);
      }
    );
  }

  if (DOM.scannerHintInput) {
    DOM.scannerHintInput.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          const hint =
            DOM.scannerHintInput.value.trim();
          reanalyzeCurrentImage(hint);
        }
      }
    );
  }
}


/* =========================================================
   SPA TAB NAVIGATION (HOME, DASHBOARD, ANALYTICS)
========================================================= */

let currentActiveTab = "home";

function switchTab(tabName) {
  if (!tabName) return;
  currentActiveTab = tabName;

  // 1. Update navigation tab active class
  const tabButtons = document.querySelectorAll(".nav-tab");
  tabButtons.forEach(btn => {
    const isTarget = btn.dataset.tab === tabName;
    btn.classList.toggle("active", isTarget);
    btn.setAttribute("aria-selected", isTarget ? "true" : "false");
  });

  // 2. Hide all views and show target view
  const views = document.querySelectorAll(".app-view");
  views.forEach(view => {
    view.classList.remove("active");
    view.style.display = "none";
  });

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.style.display = "block";
    // Trigger reflow for fade-in animation
    void targetView.offsetWidth;
    targetView.classList.add("active");
  }

  // 3. Update top page title and Month Selector visibility
  const pageTitleEl = document.getElementById("pageTitle");
  const monthSelectorBar = document.getElementById("monthSelectorBar");

  if (pageTitleEl) {
    if (tabName === "home") {
      pageTitleEl.textContent = "Home";
    } else if (tabName === "dashboard") {
      pageTitleEl.textContent = "Dashboard";
    } else if (tabName === "analytics") {
      pageTitleEl.textContent = "Analytics";
    }
  }

  if (monthSelectorBar) {
    if (tabName === "dashboard" || tabName === "analytics") {
      monthSelectorBar.style.display = "inline-flex";
      updateMonthSelectorUI();
    } else {
      monthSelectorBar.style.display = "none";
    }
  }

  // 4. Render/refresh tab content if switching to dashboard or analytics
  if (tabName === "dashboard") {
    renderDashboard();
  } else if (tabName === "analytics") {
    // Delay slightly to ensure canvas dimensions are computed by the browser
    setTimeout(() => {
      renderAnalytics();
      generateAiInsights();
    }, 60);
  }
  refreshIcons();
}

function initNavigationTabs() {
  const tabButtons = document.querySelectorAll(".nav-tab");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) {
        switchTab(tab);
      }
    });
  });
}

/* =========================================================
   DASHBOARD VIEW: BUDGET CONTROL & CASH FLOW LOGIC
========================================================= */

const CATEGORY_CONFIGS = [
  { key: "food", name: "อาหาร & เครื่องดื่ม", icon: '<i data-lucide="utensils"></i>', color: "#f59e0b", bg: "#fef3c7", weight: 0.35, match: ["food", "อาหาร", "กิน", "ข้าว", "ขนม", "cafe", "coffee", "กาแฟ", "drinks"] },
  { key: "shopping", name: "ช้อปปิ้ง / ซื้อของ", icon: '<i data-lucide="shopping-bag"></i>', color: "#ec4899", bg: "#fce7f3", weight: 0.20, match: ["shopping", "ช้อปปิ้ง", "ซื้อของ", "7-eleven", "เซเว่น", "mall", "market"] },
  { key: "transport", name: "การเดินทาง", icon: '<i data-lucide="car"></i>', color: "#0ea5e9", bg: "#e0f2fe", weight: 0.15, match: ["transport", "เดินทาง", "รถ", "bts", "mrt", "grab", "แท็กซี่", "taxi", "น้ำมัน"] },
  { key: "bills", name: "บิล & สาธารณูปโภค", icon: '<i data-lucide="lightbulb"></i>', color: "#8b5cf6", bg: "#ede9fe", weight: 0.15, match: ["bills", "bill", "ค่าไฟ", "ค่าน้ำ", "เน็ต", "โทรศัพท์", "utility", "co-op", "lab"] },
  { key: "health", name: "สุขภาพ & ยา", icon: '<i data-lucide="pill"></i>', color: "#10b981", bg: "#d1fae5", weight: 0.10, match: ["health", "ยา", "หมอ", "โรงพยาบาล", "วิตามิน", "ฟิตเนส"] },
  { key: "other", name: "อื่น ๆ / บันเทิง", icon: '<i data-lucide="tag"></i>', color: "#64748b", bg: "#f1f5f9", weight: 0.05, match: ["other", "entertainment", "general", "อื่น", "ทั่วไป", "เกม"] }
];

function normalizeCategoryKey(category) {
  const cat = String(category || "").toLowerCase();
  for (const cfg of CATEGORY_CONFIGS) {
    if (cfg.match.some(m => cat.includes(m))) {
      return cfg.key;
    }
  }
  return "other";
}

/* =========================================================
   MONTH SELECTOR STATE & LOGIC
========================================================= */

let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth(); // 0 - 11

function getThaiMonthName(monthIndex) {
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  return thaiMonths[monthIndex] || "";
}

function getThaiMonthLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${getThaiMonthName(d.getMonth())} ${d.getFullYear()}`;
}

function getSelectedMonthLabel() {
  return `${getThaiMonthName(selectedMonth)} ${selectedYear}`;
}

function getTransactionDate(tx) {
  if (tx.timestamp) {
    const d = new Date(tx.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof tx.date === "string" && (tx.date.toLowerCase().includes("today") || tx.date.includes("วันนี้"))) {
    return new Date();
  }
  if (tx.id) {
    const num = Number(tx.id);
    if (!isNaN(num) && num > 0) {
      const ms = num > 1e11 ? num : num * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function getFilteredTransactions(year = selectedYear, month = selectedMonth) {
  const all = getTransactions();
  return all.filter(tx => {
    const d = getTransactionDate(tx);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function populateMonthDropdown() {
  const select = document.getElementById("monthSelectDropdown");
  if (!select) return;

  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth();

  const txList = getTransactions();
  const monthSet = new Set();

  for (let i = -12; i <= 3; i++) {
    const d = new Date(currentY, currentM + i, 1);
    monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
  }

  txList.forEach(tx => {
    const d = getTransactionDate(tx);
    monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
  });

  const sortedMonths = Array.from(monthSet).map(str => {
    const [y, m] = str.split("-").map(Number);
    return { year: y, month: m, time: new Date(y, m, 1).getTime() };
  }).sort((a, b) => b.time - a.time);

  select.innerHTML = sortedMonths.map(item => {
    const isSelected = item.year === selectedYear && item.month === selectedMonth;
    const isCurrent = item.year === currentY && item.month === currentM;
    const label = `${getThaiMonthName(item.month)} ${item.year}${isCurrent ? " (เดือนนี้)" : ""}`;
    return `<option value="${item.year}-${item.month}" ${isSelected ? "selected" : ""}>${label}</option>`;
  }).join("");

  updateMonthSelectorUI();
}

function setSelectedMonth(year, month) {
  selectedYear = Number(year);
  selectedMonth = Number(month);
  populateMonthDropdown();
  updateMonthSelectorUI();

  if (currentActiveTab === "dashboard") {
    renderDashboard();
  } else if (currentActiveTab === "analytics") {
    renderAnalytics();
    generateAiInsights();
  }
}

function prevMonth() {
  let y = selectedYear;
  let m = selectedMonth - 1;
  if (m < 0) {
    m = 11;
    y--;
  }
  setSelectedMonth(y, m);
}

function nextMonth() {
  let y = selectedYear;
  let m = selectedMonth + 1;
  if (m > 11) {
    m = 0;
    y++;
  }
  setSelectedMonth(y, m);
}

function goToCurrentMonth() {
  const now = new Date();
  setSelectedMonth(now.getFullYear(), now.getMonth());
}

function updateMonthSelectorUI() {
  const select = document.getElementById("monthSelectDropdown");
  if (select) {
    select.value = `${selectedYear}-${selectedMonth}`;
  }
  const currentBtn = document.getElementById("currentMonthBtn");
  if (currentBtn) {
    const now = new Date();
    const isNow = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    currentBtn.classList.toggle("active", isNow);
  }
}

function initMonthSelector() {
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");
  const select = document.getElementById("monthSelectDropdown");
  const currentBtn = document.getElementById("currentMonthBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", prevMonth);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", nextMonth);
  }

  if (select) {
    select.addEventListener("change", (e) => {
      const [y, m] = e.target.value.split("-").map(Number);
      setSelectedMonth(y, m);
    });
  }

  if (currentBtn) {
    currentBtn.addEventListener("click", goToCurrentMonth);
  }

  populateMonthDropdown();
}

function renderDashboard() {
  const initial = getInitialBalance();
  const transactions = getFilteredTransactions(selectedYear, selectedMonth);

  const spent = transactions.reduce((sum, tx) => sum + (Number(tx.total) || 0), 0);
  const remaining = initial - spent;

  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
  const dailyBurn = spent > 0 ? Math.round(spent / currentDay) : 0;
  const remainingPct = initial > 0 ? Math.max(0, Math.round((remaining / initial) * 100)) : 0;
  const spentPct = initial > 0 ? Math.round((spent / initial) * 100) : 0;

  // 1. KPI Cards
  const kpiInitial = document.getElementById("dashKpiInitial");
  const kpiSpent = document.getElementById("dashKpiSpent");
  const kpiCount = document.getElementById("dashKpiCount");
  const kpiRemaining = document.getElementById("dashKpiRemaining");
  const kpiRemainingPct = document.getElementById("dashKpiRemainingPct");
  const kpiDailyBurn = document.getElementById("dashKpiDailyBurn");
  const kpiDaysInMonth = document.getElementById("dashKpiDaysInMonth");

  if (kpiInitial) kpiInitial.textContent = `฿${formatMoney(initial)}`;
  if (kpiSpent) kpiSpent.textContent = `฿${formatMoney(spent)}`;
  if (kpiCount) kpiCount.textContent = `${transactions.length} รายการ`;
  if (kpiRemaining) kpiRemaining.textContent = `฿${formatMoney(remaining)}`;
  if (kpiRemainingPct) kpiRemainingPct.textContent = `${remainingPct}% คงเหลือ`;
  if (kpiDailyBurn) kpiDailyBurn.textContent = `฿${formatMoney(dailyBurn)} / วัน`;
  if (kpiDaysInMonth) {
    if (isCurrentMonth) {
      kpiDaysInMonth.textContent = `ผ่านไปแล้ว ${currentDay} จาก ${daysInMonth} วัน`;
    } else {
      kpiDaysInMonth.textContent = `เดือนนี้มี ${daysInMonth} วัน`;
    }
  }

  // 2. Monthly Cash Flow Card
  const monthBadge = document.getElementById("dashCashflowMonthBadge");
  const healthBadge = document.getElementById("dashCashflowHealthBadge");
  const spentPctEl = document.getElementById("dashCashflowSpentPct");
  const meterBar = document.getElementById("dashCashflowMeterBar");
  const statusDesc = document.getElementById("dashCashflowStatusDesc");
  const safeRemain = document.getElementById("dashCashflowRemainingSafe");
  const cfInflow = document.getElementById("dashCashflowInflow");
  const cfOutflow = document.getElementById("dashCashflowOutflow");
  const cfNet = document.getElementById("dashCashflowNet");

  if (monthBadge) monthBadge.textContent = getSelectedMonthLabel();
  if (spentPctEl) spentPctEl.textContent = `${spentPct}%`;

  if (meterBar) {
    meterBar.style.width = `${Math.min(100, spentPct)}%`;
    meterBar.classList.toggle("warning-fill", spentPct > 75);
  }

  if (healthBadge) {
    healthBadge.className = "cashflow-health-status";
    if (spentPct <= 45) {
      healthBadge.classList.add("good");
      healthBadge.innerHTML = '<i data-lucide="check-circle-2"></i> การเงินดีเยี่ยม';
      if (statusDesc) statusDesc.textContent = "คุณใช้จ่ายอย่างมีวินัยและมีเงินออมเหลือเฟือ";
    } else if (spentPct <= 75) {
      healthBadge.classList.add("warning");
      healthBadge.innerHTML = '<i data-lucide="alert-circle"></i> อยู่ในเกณฑ์ปลอดภัย';
      if (statusDesc) statusDesc.textContent = "การใช้จ่ายอยู่ในเกณฑ์เหมาะสม ยังมีงบเหลือสำหรับสิ้นเดือน";
    } else if (spentPct <= 90) {
      healthBadge.classList.add("warning");
      healthBadge.innerHTML = '<i data-lucide="alert-triangle"></i> ใช้อย่างระมัดระวัง';
      if (statusDesc) statusDesc.textContent = "ใช้งบไปค่อนข้างมาก ควรชะลอการซื้อของฟุ่มเฟือย";
    } else {
      healthBadge.classList.add("danger");
      healthBadge.innerHTML = '<i data-lucide="alert-octagon"></i> งบใกล้เต็มพิกัด';
      if (statusDesc) statusDesc.textContent = "คุณใช้เงินเกือบเต็มงบประมาณแล้ว แนะนำให้คุมรายจ่ายด่วน";
    }
  }

  if (safeRemain) safeRemain.textContent = `คงเหลือปลอดภัย ฿${formatMoney(remaining)}`;
  if (cfInflow) cfInflow.textContent = `฿${formatMoney(initial)}`;
  if (cfOutflow) cfOutflow.textContent = `-฿${formatMoney(spent)}`;
  if (cfNet) cfNet.textContent = remaining >= 0 ? `+฿${formatMoney(remaining)}` : `-฿${formatMoney(Math.abs(remaining))}`;

  // 3. Budget by Category
  const categorySpentMap = {};
  CATEGORY_CONFIGS.forEach(c => { categorySpentMap[c.key] = 0; });

  transactions.forEach(tx => {
    const key = normalizeCategoryKey(tx.category);
    categorySpentMap[key] = (categorySpentMap[key] || 0) + (Number(tx.total) || 0);
  });

  const categoryListContainer = document.getElementById("dashboardCategoryList");
  if (categoryListContainer) {
    categoryListContainer.innerHTML = CATEGORY_CONFIGS.map(cfg => {
      const catSpent = categorySpentMap[cfg.key] || 0;
      const catBudget = Math.round(initial * cfg.weight);
      const catPct = catBudget > 0 ? Math.min(150, Math.round((catSpent / catBudget) * 100)) : 0;
      const isOver = catSpent > catBudget;
      const diff = Math.abs(catBudget - catSpent);

      let remainText = "";
      let remainClass = "";
      if (isOver) {
        remainText = `<i data-lucide="alert-triangle"></i> เกินงบ ฿${formatMoney(diff)}`;
        remainClass = "remain-over";
      } else if (catPct >= 80) {
        remainText = `<i data-lucide="alert-circle"></i> เหลืองบ ฿${formatMoney(diff)} (ใกล้เต็ม)`;
        remainClass = "remain-warn";
      } else {
        remainText = `<i data-lucide="check"></i> เหลืองบ ฿${formatMoney(diff)}`;
        remainClass = "remain-safe";
      }

      const barWidth = Math.min(100, catPct);
      const barColor = isOver ? "#ef4444" : cfg.color;

      return `
        <div class="category-budget-item">
          <div class="cat-row-top">
            <div class="cat-info-left">
              <div class="cat-icon-badge" style="background:${cfg.bg}; color:${cfg.color};">
                ${cfg.icon}
              </div>
              <div>
                <span class="cat-name">${cfg.name}</span>
                <span class="cat-counts"> (${Math.round(cfg.weight * 100)}% ของงบรวม)</span>
              </div>
            </div>
            <div class="cat-info-right">
              <span class="cat-spent-text">฿${formatMoney(catSpent)}</span>
              <span class="cat-limit-text"> / ฿${formatMoney(catBudget)}</span>
            </div>
          </div>

          <div class="cat-progress-track">
            <div class="cat-progress-fill" style="width: ${barWidth}%; background: ${barColor};"></div>
          </div>

          <div class="cat-row-bottom">
            <span>ใช้ไปแล้ว ${catPct}%</span>
            <span class="cat-badge-remain ${remainClass}">${remainText}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // 4. Update AI Forecast Widget (Predictive Budgeting)
  renderDashboardForecast();

  refreshIcons();
}

/* =========================================================
   PREDICTIVE BUDGETING: AI FORECAST FUNCTIONS
========================================================= */

function computeLocalForecast(year = selectedYear, month = selectedMonth) {
  const initial = getInitialBalance();
  const transactions = getFilteredTransactions(year, month);
  const spentSoFar = transactions.reduce((sum, tx) => sum + (Number(tx.total) || 0), 0);
  const now = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const elapsedDays = isCurrentMonth
    ? Math.max(1, now.getDate())
    : (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth()) ? daysInMonth : 0);
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const dailyAvg = elapsedDays > 0 ? Math.round((spentSoFar / elapsedDays) * 100) / 100 : 0;
  const projectedRemaining = Math.round(dailyAvg * remainingDays * 100) / 100;
  const projectedTotal = Math.round((spentSoFar + projectedRemaining) * 100) / 100;
  const isOverBudget = projectedTotal > initial;
  const difference = Math.round(Math.abs(projectedTotal - initial) * 100) / 100;
  const burnPercentage = initial > 0 ? Math.round((projectedTotal / initial) * 1000) / 10 : 0;

  const advice = isOverBudget
    ? `เตือน: อัตราใช้จ่ายเฉลี่ยวันละ ฿${formatMoney(Math.round(dailyAvg))} อาจทำให้ยอดรวมสิ้นเดือนแตะ ฿${formatMoney(Math.round(projectedTotal))} ซึ่งเกินงบประมาณไป ฿${formatMoney(Math.round(difference))} แนะนำให้ชะลอรายจ่ายที่ไม่จำเป็น`
    : `การเงินปลอดภัย: อัตราใช้จ่ายเฉลี่ยวันละ ฿${formatMoney(Math.round(dailyAvg))} คาดว่าสิ้นเดือนจะใช้งบประมาณ ฿${formatMoney(Math.round(projectedTotal))} และยังเหลืองบออมปลอดภัย ฿${formatMoney(Math.round(difference))}`;

  return {
    year,
    month: month + 1,
    days_in_month: daysInMonth,
    elapsed_days: elapsedDays,
    remaining_days: remainingDays,
    spent_so_far: spentSoFar,
    transaction_count: transactions.length,
    daily_avg: dailyAvg,
    projected_remaining: projectedRemaining,
    projected_total: projectedTotal,
    budget: initial,
    is_over_budget: isOverBudget,
    difference: difference,
    burn_percentage: burnPercentage,
    advice: advice
  };
}

async function fetchForecastFromAPI(year = selectedYear, month = selectedMonth) {
  const initial = getInitialBalance();
  const apiMonth = month + 1;
  const url = `${API_BASE_URL}/forecast?year=${year}&month=${apiMonth}&budget=${initial}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    // Fallback to local computation if backend is offline
    return computeLocalForecast(year, month);
  }
}

function updateForecastWidgetUI(forecast) {
  if (!forecast) return;

  const widget = document.getElementById("aiForecastWidget");
  if (!widget) return;

  const isOver = Boolean(forecast.is_over_budget);
  const diffVal = Math.round(forecast.difference || 0);

  // 1. Month Badge & Budget Tag
  const monthBadge = document.getElementById("forecastMonthBadge");
  const budgetTag = document.getElementById("forecastBudgetTag");
  if (monthBadge) monthBadge.textContent = getSelectedMonthLabel();
  if (budgetTag) budgetTag.textContent = `งบประมาณ ฿${formatMoney(forecast.budget)}`;

  // 2. Hero Card & Projected Total Number
  const heroCard = document.getElementById("forecastHeroCard");
  const projectedTotalEl = document.getElementById("forecastProjectedTotal");
  const alertBadge = document.getElementById("forecastAlertBadge");
  const heroDiffEl = document.getElementById("forecastHeroDiff");

  if (heroCard) {
    heroCard.classList.toggle("is-over-budget", isOver);
  }

  if (projectedTotalEl) {
    projectedTotalEl.textContent = formatMoney(Math.round(forecast.projected_total));
    if (isOver) {
      projectedTotalEl.classList.remove("text-safe");
      projectedTotalEl.classList.add("text-danger");
    } else {
      projectedTotalEl.classList.remove("text-danger");
      projectedTotalEl.classList.add("text-safe");
    }
  }

  if (alertBadge) {
    if (isOver) {
      alertBadge.style.display = "inline-flex";
      alertBadge.innerHTML = `<i data-lucide="alert-triangle"></i> เกินงบ ฿${formatMoney(diffVal)}`;
    } else {
      alertBadge.style.display = "none";
    }
  }

  if (heroDiffEl) {
    if (isOver) {
      heroDiffEl.className = "forecast-hero-diff danger-text";
      heroDiffEl.innerHTML = `<i data-lucide="alert-octagon"></i> เสี่ยงเกินงบประมาณไป ฿${formatMoney(diffVal)} ณ สิ้นเดือน`;
    } else {
      heroDiffEl.className = "forecast-hero-diff safe-text";
      heroDiffEl.innerHTML = `<i data-lucide="check-circle-2"></i> คาดการณ์เหลืองบปลอดภัย ฿${formatMoney(diffVal)} ณ สิ้นเดือน`;
    }
  }

  // 3. Status Badge
  const statusBadge = document.getElementById("forecastStatusBadge");
  if (statusBadge) {
    if (isOver) {
      statusBadge.className = "forecast-status-badge danger";
      statusBadge.innerHTML = `<i data-lucide="alert-triangle"></i> เสี่ยงเกินงบประมาณ!`;
    } else {
      statusBadge.className = "forecast-status-badge safe";
      statusBadge.innerHTML = `<i data-lucide="shield-check"></i> คาดว่าจะคุมงบได้`;
    }
  }

  // 4. Sub Metrics
  const spentSoFarEl = document.getElementById("forecastSpentSoFar");
  const elapsedDaysEl = document.getElementById("forecastElapsedDays");
  const dailyAvgEl = document.getElementById("forecastDailyAvg");
  const dailyAvgHintEl = document.getElementById("forecastDailyAvgHint");
  const remainingSpendEl = document.getElementById("forecastRemainingSpend");
  const remainingDaysEl = document.getElementById("forecastRemainingDays");

  if (spentSoFarEl) spentSoFarEl.textContent = `฿${formatMoney(Math.round(forecast.spent_so_far))}`;
  if (elapsedDaysEl) elapsedDaysEl.textContent = `ผ่านไปแล้ว ${forecast.elapsed_days} จาก ${forecast.days_in_month} วัน`;
  if (dailyAvgEl) dailyAvgEl.textContent = `฿${formatMoney(Math.round(forecast.daily_avg))} / วัน`;
  if (dailyAvgHintEl) dailyAvgHintEl.textContent = `จากทั้งหมด ${forecast.transaction_count} รายการ`;
  if (remainingSpendEl) remainingSpendEl.textContent = `฿${formatMoney(Math.round(forecast.projected_remaining))}`;
  if (remainingDaysEl) remainingDaysEl.textContent = `เหลืออีก ${forecast.remaining_days} วันในเดือนนี้`;

  // 5. Meter Progress Bar
  const pctText = document.getElementById("forecastPercentText");
  const meterFill = document.getElementById("forecastMeterFill");
  const pctVal = Math.round(forecast.burn_percentage || 0);

  if (pctText) pctText.textContent = `${pctVal}%`;
  if (meterFill) {
    meterFill.style.width = `${Math.min(100, pctVal)}%`;
    meterFill.classList.toggle("danger-fill", isOver);
    meterFill.classList.toggle("warning-fill", !isOver && pctVal >= 80);
  }

  // 6. Advice Banner
  const adviceBanner = document.getElementById("forecastAdviceBanner");
  const adviceIcon = document.getElementById("forecastAdviceIcon");
  const adviceTitle = document.getElementById("forecastAdviceTitle");
  const adviceDesc = document.getElementById("forecastAdviceDesc");

  if (adviceBanner) {
    adviceBanner.classList.toggle("danger", isOver);
  }
  if (adviceIcon) {
    adviceIcon.innerHTML = isOver ? `<i data-lucide="alert-triangle"></i>` : `<i data-lucide="sparkles"></i>`;
  }
  if (adviceTitle) {
    adviceTitle.textContent = isOver ? "คำเตือนการคุมงบประมาณจาก AI" : "คำแนะนำการเงินจาก AI";
  }
  if (adviceDesc) {
    adviceDesc.textContent = forecast.advice || "ระบบกำลังประเมินแนวโน้มการเงิน...";
  }

  // 7. Outer Card border state
  widget.classList.toggle("is-danger-state", isOver);

  refreshIcons();
}

async function renderDashboardForecast() {
  const currentY = selectedYear;
  const currentM = selectedMonth;

  // 1. Render immediate local computation for instant UI responsiveness
  const snapshot = computeLocalForecast(currentY, currentM);
  updateForecastWidgetUI(snapshot);

  // 2. Fetch live predictive budgeting data from FastAPI MySQL backend
  try {
    const liveData = await fetchForecastFromAPI(currentY, currentM);
    if (selectedYear === currentY && selectedMonth === currentM) {
      updateForecastWidgetUI(liveData);
    }
  } catch (err) {
    console.info("[Forecast] Fallback to local predictive calculation:", err.message);
  }
}

/* =========================================================
   ANALYTICS VIEW: CHART.JS & AI INSIGHTS
========================================================= */

let categoryDonutChartInstance = null;
let spendingTrendsChartInstance = null;

function renderAnalytics() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js is not loaded yet.");
    return;
  }

  const viewAnalytics = document.getElementById("view-analytics");
  if (viewAnalytics && viewAnalytics.style.display === "none") {
    return;
  }

  const transactions = getFilteredTransactions(selectedYear, selectedMonth);

  // 1. Calculate Category Distribution & Item Counts
  const catTotals = {};
  const catCounts = {};
  CATEGORY_CONFIGS.forEach(c => {
    catTotals[c.key] = 0;
    catCounts[c.key] = 0;
  });

  transactions.forEach(tx => {
    const key = normalizeCategoryKey(tx.category);
    const amt = Number(tx.total) || 0;
    catTotals[key] = (catTotals[key] || 0) + amt;
    catCounts[key] = (catCounts[key] || 0) + 1;
  });

  const totalSpent = Object.values(catTotals).reduce((a, b) => a + b, 0);

  const chartLabels = [];
  const chartData = [];
  const chartColors = [];
  const chartItems = [];

  CATEGORY_CONFIGS.forEach(cfg => {
    const amount = catTotals[cfg.key] || 0;
    const count = catCounts[cfg.key] || 0;
    if (amount > 0 || totalSpent === 0) {
      const displayAmount = totalSpent === 0 ? Math.round(cfg.weight * 100) : amount;
      chartLabels.push(cfg.name.split(" ")[0]);
      chartData.push(displayAmount);
      chartColors.push(cfg.color);
      chartItems.push({
        name: cfg.name.split(" ")[0],
        fullName: cfg.name,
        icon: cfg.icon,
        amount: amount,
        count: count,
        pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : Math.round(cfg.weight * 100),
        color: cfg.color
      });
    }
  });

  // Render Modern Donut Chart with Thicker Ring & 3D Shadow
  const donutCanvas = document.getElementById("categoryDonutChart");
  if (donutCanvas) {
    if (categoryDonutChartInstance) {
      categoryDonutChartInstance.destroy();
      categoryDonutChartInstance = null;
    }

    const donutDropShadowPlugin = {
      id: "donutDropShadow",
      beforeDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
      },
      afterDatasetsDraw(chart) {
        chart.ctx.restore();
      }
    };

    const donutCenterInfoPlugin = {
      id: "donutCenterInfo",
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Sub-title label (High contrast slate)
        ctx.font = "600 11px 'Plus Jakarta Sans', 'Prompt', sans-serif";
        ctx.fillStyle = "#334155";
        ctx.fillText("รวมค่าใช้จ่าย", centerX, centerY - 10);

        // Amount sum (Deep high contrast slate)
        ctx.font = "800 16px 'Plus Jakarta Sans', 'Prompt', sans-serif";
        ctx.fillStyle = "#0f172a";
        ctx.fillText(`฿${formatMoney(totalSpent)}`, centerX, centerY + 11);

        ctx.restore();
      }
    };

    categoryDonutChartInstance = new Chart(donutCanvas, {
      type: "doughnut",
      data: {
        labels: chartLabels,
        datasets: [{
          data: chartData,
          backgroundColor: chartColors,
          borderWidth: 2,
          borderColor: "#ffffff",
          borderRadius: 6,
          spacing: 3,
          hoverOffset: 10
        }]
      },
      plugins: [donutDropShadowPlugin, donutCenterInfoPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%", // Increased ring thickness for modern look
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.94)",
            titleColor: "#38bdf8",
            titleFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 13,
              weight: "700"
            },
            bodyColor: "#f1f5f9",
            bodyFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 12,
              weight: "500"
            },
            bodySpacing: 6,
            padding: { top: 12, bottom: 12, left: 16, right: 16 },
            cornerRadius: 10,
            borderColor: "rgba(56, 189, 248, 0.35)",
            borderWidth: 1.5,
            displayColors: true,
            boxPadding: 6,
            callbacks: {
              label: function (context) {
                const val = context.parsed;
                const pct = totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0;
                const item = chartItems[context.dataIndex];
                const count = item ? item.count : 0;
                return [
                  ` ยอดใช้จ่าย: ฿${val.toLocaleString()} บาท (${pct}%)`,
                  ` จำนวนรายการ: ${count} รายการ`
                ];
              }
            }
          }
        }
      }
    });

    // Custom HTML Legend with High Contrast and Lucide Icons
    const legendContainer = document.getElementById("categoryChartLegend");
    if (legendContainer) {
      legendContainer.innerHTML = chartItems.map(item => `
        <div class="legend-item" title="${item.fullName}: ฿${formatMoney(item.amount)} (${item.count} รายการ)">
          <span class="legend-color-dot" style="background:${item.color};"></span>
          <span class="legend-label-text">${item.icon} ${item.name}</span>
          <strong>${item.pct}%</strong>
        </div>
      `).join("");
    }
  }

  // 2. Calculate Monthly Spending Trends (Weekly Breakdown & Counts)
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);
  const trendLabels = [];
  const trendAmounts = new Array(weekCount).fill(0);
  const trendCounts = new Array(weekCount).fill(0);
  const weekDetails = [];

  for (let w = 1; w <= weekCount; w++) {
    const startDay = (w - 1) * 7 + 1;
    const endDay = Math.min(daysInMonth, w * 7);
    trendLabels.push(`สัปดาห์ ${w}`);
    weekDetails.push({
      weekNum: w,
      startDay,
      endDay,
      daysCount: endDay - startDay + 1
    });
  }

  transactions.forEach(tx => {
    const amt = Number(tx.total) || 0;
    if (amt <= 0) return;

    const txDate = getTransactionDate(tx);
    const day = txDate.getDate();
    const weekIdx = Math.min(weekCount - 1, Math.floor((day - 1) / 7));
    if (weekIdx >= 0 && weekIdx < weekCount) {
      trendAmounts[weekIdx] += amt;
      trendCounts[weekIdx] += 1;
    }
  });

  const sumMonth = trendAmounts.reduce((a, b) => a + b, 0);
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const divisorDays = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
  const avgDaily = Math.round(sumMonth / divisorDays);

  let maxWeekIndex = 0;
  let maxWeekAmount = 0;
  trendAmounts.forEach((amt, idx) => {
    if (amt > maxWeekAmount) {
      maxWeekAmount = amt;
      maxWeekIndex = idx;
    }
  });

  const currentWeekIdx = isCurrentMonth ? Math.min(weekCount - 1, Math.floor((now.getDate() - 1) / 7)) : -1;
  const barCanvas = document.getElementById("spendingTrendsChart");
  if (barCanvas) {
    if (spendingTrendsChartInstance) {
      spendingTrendsChartInstance.destroy();
      spendingTrendsChartInstance = null;
    }

    spendingTrendsChartInstance = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: trendLabels,
        datasets: [{
          label: "ยอดใช้จ่าย (บาท)",
          data: trendAmounts,
          backgroundColor: function (context) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) {
              return "rgba(56, 189, 248, 0.45)";
            }
            const idx = context.dataIndex;
            const isCurrent = idx === currentWeekIdx;
            const isMax = idx === maxWeekIndex && maxWeekAmount > 0;
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            if (isCurrent) {
              gradient.addColorStop(0, "rgba(14, 165, 233, 0.35)");
              gradient.addColorStop(1, "rgba(2, 132, 199, 0.90)");
            } else if (isMax) {
              gradient.addColorStop(0, "rgba(56, 189, 248, 0.25)");
              gradient.addColorStop(1, "rgba(14, 165, 233, 0.85)");
            } else {
              gradient.addColorStop(0, "rgba(56, 189, 248, 0.18)");
              gradient.addColorStop(1, "rgba(56, 189, 248, 0.70)");
            }
            return gradient;
          },
          borderColor: function (context) {
            const idx = context.dataIndex;
            if (idx === currentWeekIdx) return "#0284c7";
            if (idx === maxWeekIndex && maxWeekAmount > 0) return "#0ea5e9";
            return "rgba(14, 165, 233, 0.85)";
          },
          borderWidth: 2,
          hoverBackgroundColor: function (context) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(14, 165, 233, 0.95)";
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, "rgba(56, 189, 248, 0.50)");
            gradient.addColorStop(1, "rgba(2, 132, 199, 0.98)");
            return gradient;
          },
          hoverBorderColor: "#0369a1",
          hoverBorderWidth: 2.5,
          borderRadius: {
            topLeft: 10,
            topRight: 10,
            bottomLeft: 3,
            bottomRight: 3
          },
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 850
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.94)",
            titleColor: "#38bdf8",
            titleFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 13,
              weight: "700"
            },
            bodyColor: "#f1f5f9",
            bodyFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 12,
              weight: "500"
            },
            bodySpacing: 6,
            padding: { top: 12, bottom: 12, left: 16, right: 16 },
            cornerRadius: 10,
            borderColor: "rgba(56, 189, 248, 0.35)",
            borderWidth: 1.5,
            displayColors: false,
            callbacks: {
              title: function (items) {
                if (!items.length) return "";
                const idx = items[0].dataIndex;
                const detail = weekDetails[idx];
                const thaiM = getThaiMonthName(selectedMonth);
                return `สัปดาห์ที่ ${idx + 1} (${detail.startDay}-${detail.endDay} ${thaiM})`;
              },
              label: function (context) {
                const idx = context.dataIndex;
                const val = context.parsed.y || 0;
                const pct = sumMonth > 0 ? Math.round((val / sumMonth) * 100) : 0;
                const txCount = trendCounts[idx] || 0;
                const detail = weekDetails[idx];
                const daysCount = detail ? detail.daysCount : 7;
                const dailyAvg = Math.round(val / daysCount);

                const lines = [
                  `ยอดใช้จ่าย: ฿${val.toLocaleString()} บาท`,
                  `สัดส่วน: ${pct}% ของยอดทั้งเดือน`,
                  `จำนวนรายการ: ${txCount} รายการ`,
                  `เฉลี่ยต่อวัน: ฿${dailyAvg.toLocaleString()} บาท/วัน`
                ];

                if (idx === currentWeekIdx) {
                  lines.push(`สถานะ: สัปดาห์ปัจจุบัน`);
                }
                if (idx === maxWeekIndex && maxWeekAmount > 0) {
                  lines.push(`สถานะ: สัปดาห์ที่จ่ายสูงสุดของเดือน`);
                }
                return lines;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            border: {
              color: "#cbd5e1",
              width: 1.5
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
                size: 12,
                weight: "600"
              },
              color: "#1e293b", // Deep slate for high contrast
              padding: 8
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(203, 213, 225, 0.45)",
              drawBorder: false
            },
            border: {
              dash: [4, 4],
              color: "transparent"
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
                size: 11,
                weight: "600"
              },
              color: "#1e293b", // Deep slate for high contrast
              padding: 8,
              callback: function (val) {
                return `฿${val.toLocaleString()}`;
              }
            }
          }
        }
      }
    });
  }

  // Update Footer Stats
  const sumEl = document.getElementById("trends7DaySum");
  const avgEl = document.getElementById("trendsDailyAvg");
  const peakEl = document.getElementById("trendsPeakDay");
  const descEl = document.getElementById("spendingTrendsDesc");

  if (descEl) descEl.textContent = `ยอดใช้จ่ายประจำเดือน ${getSelectedMonthLabel()} (บาท)`;
  if (sumEl) sumEl.textContent = `฿${formatMoney(sumMonth)}`;
  if (avgEl) avgEl.textContent = `฿${formatMoney(avgDaily)}`;
  if (peakEl) {
    if (maxWeekAmount > 0) {
      peakEl.textContent = `สัปดาห์ ${maxWeekIndex + 1} (฿${formatMoney(maxWeekAmount)})`;
    } else {
      peakEl.textContent = "ไม่มี";
    }
  }

  // 3. Render Cost by Project Tags
  renderProjectCost(transactions);

  refreshIcons();
}

let projectCostChartInstance = null;

const PROJECT_PALETTE = [
  "#0ea5e9", // Sky blue
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#f43f5e", // Rose
  "#3b82f6", // Blue
  "#64748b"  // Slate
];

function renderProjectCost(transactions) {
  const projectTotals = {};
  const projectCounts = {};

  transactions.forEach(tx => {
    const amt = Number(tx.total) || 0;
    if (amt <= 0) return;

    let tags = Array.isArray(tx.tags) && tx.tags.length > 0
      ? tx.tags
      : extractHashtags(tx.merchant || "");

    if (tags.length === 0 && Array.isArray(tx.items)) {
      tx.items.forEach(it => {
        const itTags = extractHashtags(it.name || "");
        if (itTags.length > 0) tags = [...tags, ...itTags];
      });
      tags = Array.from(new Set(tags));
    }

    if (tags.length > 0) {
      tags.forEach(tag => {
        const cleanTag = tag.trim();
        if (!cleanTag) return;
        projectTotals[cleanTag] = (projectTotals[cleanTag] || 0) + amt;
        projectCounts[cleanTag] = (projectCounts[cleanTag] || 0) + 1;
      });
    }
  });

  const projectKeys = Object.keys(projectTotals).sort((a, b) => projectTotals[b] - projectTotals[a]);
  const totalCost = Object.values(projectTotals).reduce((a, b) => a + b, 0);

  const badgeEl = document.getElementById("projectCountBadge");
  const tableWrapEl = document.getElementById("projectTableWrap");
  const tableBodyEl = document.getElementById("projectCostTableBody");
  const emptyEl = document.getElementById("projectCostEmpty");
  const chartCanvas = document.getElementById("projectCostChart");

  if (badgeEl) {
    badgeEl.textContent = `${projectKeys.length} โปรเจกต์`;
  }

  if (projectKeys.length === 0) {
    if (tableWrapEl) tableWrapEl.style.display = "none";
    if (emptyEl) emptyEl.style.display = "block";
    if (projectCostChartInstance) {
      projectCostChartInstance.destroy();
      projectCostChartInstance = null;
    }
    return;
  }

  if (tableWrapEl) tableWrapEl.style.display = "block";
  if (emptyEl) emptyEl.style.display = "none";

  // 1. Render Table Rows
  if (tableBodyEl) {
    tableBodyEl.innerHTML = projectKeys.map((tag, idx) => {
      const amt = projectTotals[tag];
      const count = projectCounts[tag];
      const pct = totalCost > 0 ? Math.round((amt / totalCost) * 100) : 0;
      const color = PROJECT_PALETTE[idx % PROJECT_PALETTE.length];

      return `
        <tr>
          <td>
            <span class="project-tag-badge" style="background: ${color}18; color: ${color}; border-color: ${color}40;">
              <i data-lucide="tag"></i> #${escapeHTML(tag)}
            </span>
          </td>
          <td><strong>${count}</strong> รายการ</td>
          <td>
            <div class="project-pct-cell">
              <div class="project-pct-bar-wrap">
                <div class="project-pct-bar" style="width: ${pct}%; background: ${color};"></div>
              </div>
              <span>${pct}%</span>
            </div>
          </td>
          <td style="text-align: right; font-weight: 800; color: #0f172a;">
            ฿${formatMoney(amt, 2)}
          </td>
        </tr>
      `;
    }).join("");
  }

  // 2. Render Horizontal Bar Chart
  if (chartCanvas) {
    if (projectCostChartInstance) {
      projectCostChartInstance.destroy();
      projectCostChartInstance = null;
    }

    const chartLabels = projectKeys.map(k => `#${k}`);
    const chartAmounts = projectKeys.map(k => projectTotals[k]);
    const chartColors = projectKeys.map((k, idx) => PROJECT_PALETTE[idx % PROJECT_PALETTE.length]);

    projectCostChartInstance = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: chartLabels,
        datasets: [{
          label: "ต้นทุนโปรเจกต์ (บาท)",
          data: chartAmounts,
          backgroundColor: chartColors.map(c => `${c}cc`),
          borderColor: chartColors,
          borderWidth: 1.5,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: "y", // Horizontal Bar Chart
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.94)",
            titleColor: "#38bdf8",
            titleFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 13,
              weight: "700"
            },
            bodyColor: "#f1f5f9",
            bodyFont: {
              family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
              size: 12,
              weight: "500"
            },
            bodySpacing: 6,
            padding: { top: 10, bottom: 10, left: 14, right: 14 },
            cornerRadius: 10,
            borderColor: "rgba(56, 189, 248, 0.35)",
            borderWidth: 1.5,
            callbacks: {
              label: function (context) {
                const val = context.parsed.x || 0;
                const idx = context.dataIndex;
                const tag = projectKeys[idx];
                const count = projectCounts[tag] || 0;
                const pct = totalCost > 0 ? Math.round((val / totalCost) * 100) : 0;
                return [
                  ` รวมต้นทุน: ฿${val.toLocaleString()} บาท`,
                  ` สัดส่วน: ${pct}% ของงบโปรเจกต์ทั้งหมด`,
                  ` จำนวนรายการ: ${count} รายการ`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: "rgba(203, 213, 225, 0.45)"
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
                size: 11,
                weight: "600"
              },
              color: "#1e293b",
              callback: function (val) {
                return `฿${val.toLocaleString()}`;
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', 'Prompt', sans-serif",
                size: 12,
                weight: "700"
              },
              color: "#0f172a"
            }
          }
        }
      }
    });
  }
}

function generateAiInsights() {
  const transactions = getFilteredTransactions(selectedYear, selectedMonth);
  const catTotals = {};
  CATEGORY_CONFIGS.forEach(c => { catTotals[c.key] = 0; });

  transactions.forEach(tx => {
    const key = normalizeCategoryKey(tx.category);
    catTotals[key] = (catTotals[key] || 0) + (Number(tx.total) || 0);
  });

  let topKey = null;
  let maxSpent = 0;
  let totalSpent = 0;

  Object.entries(catTotals).forEach(([key, amount]) => {
    totalSpent += amount;
    if (amount > maxSpent) {
      maxSpent = amount;
      topKey = key;
    }
  });

  const speechEl = document.getElementById("aiInsightsSpeech");
  const adviceEl = document.getElementById("aiInsightsAdvice");
  const topCatEl = document.getElementById("aiTopCategory");
  const topPctEl = document.getElementById("aiTopCategoryPct");
  const sevenDayEl = document.getElementById("ai7DayTotal");
  const timestampEl = document.getElementById("aiAnalysisTimestamp");

  if (timestampEl) {
    timestampEl.textContent = `วิเคราะห์ล่าสุด ${currentTimeLabel()}`;
  }

  const topCfg = CATEGORY_CONFIGS.find(c => c.key === topKey) || CATEGORY_CONFIGS[0];
  const pct = totalSpent > 0 ? Math.round((maxSpent / totalSpent) * 100) : 0;

  if (topCatEl) topCatEl.innerHTML = maxSpent > 0 ? `${topCfg.icon} <span>${topCfg.name.split(" ")[0]}</span>` : "ยังไม่มีข้อมูล";
  if (topPctEl) topPctEl.textContent = `${pct}%`;
  if (sevenDayEl) sevenDayEl.textContent = `฿${formatMoney(totalSpent)}`;

  if (totalSpent === 0) {
    if (speechEl) speechEl.innerHTML = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> ยังไม่มีรายการใช้จ่ายที่บันทึกไว้ในระบบค่ะ`;
    if (adviceEl) adviceEl.textContent = `คุณสามารถสลับดูเดือนอื่นจากแถบเลือกเดือนด้านบน หรือเพิ่มรายการใหม่ในหน้านี้ได้เลยนะคะ!`;
    refreshIcons();
    return;
  }

  let speechText = "";
  let adviceText = "";

  if (topKey === "shopping") {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> คุณใช้เงินกับหมวด <strong>Shopping</strong> มากที่สุดถึง <strong>฿${formatMoney(maxSpent)}</strong> (${pct}% ของรายจ่ายทั้งหมด)`;
    adviceText = `น้องแนะนำ: ลองลดการช้อปปิ้งออนไลน์หรือจำกัดงบซื้อของไม่จำเป็นลงสักนิด จะช่วยประหยัดเงินได้เพิ่มอีกอย่างน้อย ฿${formatMoney(Math.round(maxSpent * 0.3))} สำหรับเงินออมค่ะ~`;
  } else if (topKey === "food") {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> คุณใช้เงินกับหมวด <strong>อาหาร & เครื่องดื่ม</strong> มากที่สุด รวม <strong>฿${formatMoney(maxSpent)}</strong> (${pct}% ของรายจ่าย)`;
    adviceText = `น้องแนะนำ: ค่าอาหารเป็นหมวดที่คุมได้ง่าย หากลองเตรียมอาหารเองบางมื้อ หรือคุมค่ากาแฟ/ชานมวันละ 1 แก้ว จะช่วยเซฟงบรายเดือนได้ดีมากๆ เลยค่ะ`;
  } else if (topKey === "transport") {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> คุณมีค่าใช้จ่ายสูงสุดในหมวด <strong>การเดินทาง</strong> รวม <strong>฿${formatMoney(maxSpent)}</strong> (${pct}% ของรายจ่าย)`;
    adviceText = `น้องแนะนำ: หากต้องเดินทางเส้นทางเดิมเป็นประจำ ลองพิจารณาตั๋วโดยสารแบบรายเดือน หรือใช้ระบบขนส่งสาธารณะเพื่อช่วยลดต้นทุนการเดินทางนะคะ~`;
  } else if (topKey === "bills") {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> ค่าใช้จ่ายส่วนใหญ่หมดไปกับหมวด <strong>บิล & สาธารณูปโภค</strong> รวม <strong>฿${formatMoney(maxSpent)}</strong> (${pct}%)`;
    adviceText = `น้องแนะนำ: ตรวจสอบและชำระค่าบริการให้ตรงเวลาเพื่อเลี่ยงค่าปรับ และลองตรวจสอบแพ็กเกจอินเทอร์เน็ตที่คุ้มค่ากว่าเดิมเพื่อลดค่าใช้จ่ายคงที่ค่ะ`;
  } else if (topKey === "health") {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> คุณมีการใช้จ่ายในหมวด <strong>สุขภาพ & ยา</strong> รวม <strong>฿${formatMoney(maxSpent)}</strong> (${pct}%)`;
    adviceText = `น้องแนะนำ: การดูแลสุขภาพเป็นการลงทุนที่คุ้มค่าที่สุดค่ะ! พักผ่อนให้เพียงพอและดื่มน้ำเยอะๆ เพื่อสุขภาพที่ดีนะคะ~`;
  } else {
    speechText = `ในเดือน <strong>${getSelectedMonthLabel()}</strong> หมวดที่คุณใช้จ่ายมากที่สุดคือ <strong>${topCfg.name.split(" ")[0]}</strong> รวม <strong>฿${formatMoney(maxSpent)}</strong> (${pct}% ของรายจ่าย)`;
    adviceText = `น้องแนะนำ: สุขภาพการเงินของคุณโดยรวมยังอยู่ในเกณฑ์ที่ปลอดภัย จัดสรรเงินออมสำรองฉุกเฉินสม่ำเสมอจะช่วยให้คุณอุ่นใจยิ่งขึ้นค่ะ`;
  }

  if (speechEl) speechEl.innerHTML = speechText;
  if (adviceEl) adviceEl.textContent = adviceText;
  refreshIcons();
}

/* =========================================================
   REFRESH
========================================================= */

function refreshUI() {
  updateBalanceUI();
  renderHistory();
  renderDashboard();

  if (currentActiveTab === "analytics") {
    renderAnalytics();
    generateAiInsights();
  }
  refreshIcons();
}


function delay(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


/* =========================================================
   ANIME DESKTOP WIDGETS & GLASSMORPHISM CONTROLS
========================================================= */

/* 1. Digital Clock & Date Updater */
function initAnimeClock() {
  const timeEl = document.getElementById("animeClockTime");
  const dateEl = document.getElementById("animeClockDate");
  if (!timeEl && !dateEl) return;

  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    if (timeEl) {
      timeEl.textContent = `${hours}:${minutes}`;
    }

    if (dateEl) {
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ];
      const dayName = days[now.getDay()];
      const monthNum = String(now.getMonth() + 1).padStart(2, "0");
      const dateNum = String(now.getDate()).padStart(2, "0");
      dateEl.textContent = `${dayName} ${monthNum}/${dateNum}`;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/* 2. Mini Calendar Generator */
function initAnimeCalendar() {
  const monthEl = document.getElementById("animeCalendarMonth");
  const yearEl = document.getElementById("animeCalendarYear");
  const gridEl = document.getElementById("animeCalendarGrid");
  if (!gridEl) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (monthEl) monthEl.textContent = monthNames[month];
  if (yearEl) yearEl.textContent = year;

  // First day of month (0 = Sun, 1 = Mon...)
  const firstDay = new Date(year, month, 1).getDay();
  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  gridEl.innerHTML = "";

  // Pad previous month days
  for (let i = 0; i < firstDay; i++) {
    const emptySpan = document.createElement("span");
    emptySpan.className = "calendar-day muted";
    emptySpan.textContent = "";
    gridEl.appendChild(emptySpan);
  }

  // Populate actual month days
  for (let day = 1; day <= totalDays; day++) {
    const daySpan = document.createElement("span");
    daySpan.className = "calendar-day" + (day === today ? " active" : "");
    daySpan.textContent = day;
    gridEl.appendChild(daySpan);
  }
}

/* 3. Web Audio API Synth Lo-Fi Chill Music Player */
let audioCtx = null;
let loFiInterval = null;
let isLoFiPlaying = false;

function initLoFiPlayer() {
  const playBtn = document.getElementById("musicPlayBtn");
  const discAnim = document.getElementById("musicDiscAnim");
  const waveAnim = document.getElementById("musicWaveAnim");
  const likeBtn = document.getElementById("musicLikeBtn");
  const trackTitle = document.getElementById("musicTrackTitle");
  const prevBtn = document.getElementById("musicPrevBtn");
  const nextBtn = document.getElementById("musicNextBtn");

  const playlist = [
    {
      title: "ギターと孤独と蒼い惑星",
      artist: "Bocchi The Rock! · Lo-Fi Chill",
      chords: [
        [261.63, 329.63, 392.00],
        [293.66, 349.23, 440.00],
        [220.00, 261.63, 329.63],
        [174.61, 220.00, 261.63]
      ]
    },
    {
      title: "あのバンド (That Band)",
      artist: "Kessoku Band · Midnight Lo-Fi",
      chords: [
        [220.00, 261.63, 329.63],
        [196.00, 246.94, 293.66],
        [174.61, 220.00, 261.63],
        [164.81, 207.65, 246.94]
      ]
    },
    {
      title: "星座になれたら (Constellation)",
      artist: "Ryo Yamada · Chillhop Bass",
      chords: [
        [329.63, 392.00, 493.88],
        [261.63, 329.63, 392.00],
        [220.00, 261.63, 329.63],
        [293.66, 349.23, 440.00]
      ]
    }
  ];
  let currentTrackIdx = 0;

  function playChord(freqs, time) {
    if (!audioCtx) return;
    freqs.forEach(freq => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.05, time + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(time);
      osc.stop(time + 2.0);
    });
  }

  function startLoFiMusic() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const chords = playlist[currentTrackIdx].chords;
    let chordIdx = 0;

    playChord(chords[chordIdx], audioCtx.currentTime);
    chordIdx = (chordIdx + 1) % chords.length;

    loFiInterval = setInterval(() => {
      if (audioCtx && isLoFiPlaying) {
        playChord(chords[chordIdx], audioCtx.currentTime);
        chordIdx = (chordIdx + 1) % chords.length;
      }
    }, 2000);

    isLoFiPlaying = true;
    if (playBtn) {
      playBtn.innerHTML = '<i data-lucide="pause"></i>';
      refreshIcons();
    }
    if (discAnim) discAnim.classList.add("spinning");
    if (waveAnim) waveAnim.classList.add("active");
  }

  function stopLoFiMusic() {
    if (loFiInterval) {
      clearInterval(loFiInterval);
      loFiInterval = null;
    }
    isLoFiPlaying = false;
    if (playBtn) {
      playBtn.innerHTML = '<i data-lucide="play"></i>';
      refreshIcons();
    }
    if (discAnim) discAnim.classList.remove("spinning");
    if (waveAnim) waveAnim.classList.remove("active");
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (isLoFiPlaying) {
        stopLoFiMusic();
      } else {
        startLoFiMusic();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentTrackIdx = (currentTrackIdx + 1) % playlist.length;
      if (trackTitle) trackTitle.textContent = playlist[currentTrackIdx].title;
      if (isLoFiPlaying) {
        stopLoFiMusic();
        startLoFiMusic();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentTrackIdx = (currentTrackIdx - 1 + playlist.length) % playlist.length;
      if (trackTitle) trackTitle.textContent = playlist[currentTrackIdx].title;
      if (isLoFiPlaying) {
        stopLoFiMusic();
        startLoFiMusic();
      }
    });
  }

  if (likeBtn) {
    likeBtn.addEventListener("click", () => {
      likeBtn.classList.toggle("liked");
      toast(
        likeBtn.classList.contains("liked")
          ? "Liked track"
          : "Unliked track",
        "info",
        1500
      );
    });
  }
}

/* 4. Smooth Dock Navigation & Glass Dimmer Mode */
function initAnimeDocks() {
  document.querySelectorAll("[data-scroll]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-scroll");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        document
          .querySelectorAll(".anime-left-dock .dock-btn")
          .forEach(b => b.classList.remove("active"));
        if (btn.classList.contains("dock-btn")) {
          btn.classList.add("active");
        }
      }
    });
  });

  const dockScanBtn = document.getElementById("dockScanBtn");
  const bottomDockScanBtn = document.getElementById("bottomDockScanBtn");
  [dockScanBtn, bottomDockScanBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        showModal("receiptModal");
      });
    }
  });

  const dockSettingsBtn = document.getElementById("dockSettingsBtn");
  const bottomDockSettingsBtn = document.getElementById("bottomDockSettingsBtn");
  [dockSettingsBtn, bottomDockSettingsBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        openApiSettings();
      });
    }
  });

  const dockThemeToggle = document.getElementById("dockThemeToggle");
  if (dockThemeToggle) {
    dockThemeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dimmed-mode");
      const isDim = document.body.classList.contains("dimmed-mode");
      dockThemeToggle.classList.toggle("active", isDim);
      toast(
        isDim
          ? "โหมดสลัวกระจก (Focus Dim Mode)"
          : "โหมดสว่างสดใส (Bright Anime Mode)",
        "info",
        2000
      );
    });
  }
}


function initMascotInteraction() {
  const stage = document.getElementById("heroMascotStage");
  if (!stage) return;

  const cuteQuotes = [
    "Shark mascot: สู้ๆ นะคะ! ดูแลการเงินให้อย่างดีเลย~",
    "Gura: วันนี้บันทึกรายจ่ายไปเท่าไหร่แล้วน้า~",
    "Shark mascot: อย่าลืมเก็บออมด้วยนะคะ! A~",
    "Gura: ขอบคุณที่แวะมาทักทายน้องนะ! เย้~",
    "Shark mascot: โบกมือทักทายคุณเจ้านายค่ะ! บ๊ายบายความจน~"
  ];
  let quoteIndex = 0;

  stage.addEventListener("click", () => {
    stage.classList.remove("mascot-cheer");
    // force reflow
    void stage.offsetWidth;
    stage.classList.add("mascot-cheer");

    setTimeout(() => {
      stage.classList.remove("mascot-cheer");
    }, 700);

    const quote = cuteQuotes[quoteIndex % cuteQuotes.length];
    quoteIndex++;
    if (typeof toast === "function") {
      toast(quote, "info", 2500);
    }
  });

  const heroContentMascot = document.querySelector(".hero-content-mascot-img");
  if (heroContentMascot) {
    heroContentMascot.addEventListener("click", () => {
      heroContentMascot.style.transform = "scale(1.2) rotate(-8deg)";
      setTimeout(() => {
        heroContentMascot.style.transform = "";
      }, 300);
      const cuteLeftQuotes = [
        "A~ สวัสดีค่ะคุณเจ้านาย! ยินดีต้อนรับกลับบ้านนะคะ",
        "วันนี้พร้อมบันทึกรายรับ-รายจ่ายหรือยังคะ? น้องพร้อมช่วยแล้ว!",
        "Gura: ออมเงินวันนี้ รวยวันหน้านะคะคุณเจ้านาย~",
        "ฉลามน้อยคอยดูแลเงินให้คุณเสมอค่ะ! เย้~"
      ];
      const q = cuteLeftQuotes[Math.floor(Math.random() * cuteLeftQuotes.length)];
      if (typeof toast === "function") {
        toast(q, "info", 2500);
      }
    });
  }
}

/* =========================================================
   THEME AMBIENT FALLING SNOW & OCEANIC SPARKLE BACKGROUND
========================================================= */

function initThemeSnowBackground() {
  const canvas = document.getElementById("snowThemeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Procedural Vector Drawings (Zero emojis, 100% smooth vector shapes)
  function drawSparkleStar(ctx, x, y, size, rotation, alpha, isDimmed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (isDimmed) {
      ctx.fillStyle = `rgba(165, 243, 252, ${alpha})`;
      ctx.shadowColor = "rgba(56, 189, 248, 0.85)";
      ctx.shadowBlur = Math.max(4, size * 1.2);
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = "rgba(186, 230, 253, 0.75)";
      ctx.shadowBlur = Math.max(3, size * 0.9);
    }

    ctx.beginPath();
    const outer = size;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const nextAngle = ((i + 1) * Math.PI) / 2;
      if (i === 0) {
        ctx.moveTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      } else {
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      }
      ctx.quadraticCurveTo(0, 0, Math.cos(nextAngle) * outer, Math.sin(nextAngle) * outer);
    }
    ctx.closePath();
    ctx.fill();

    // Center bright core
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.6, size * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.4)})`;
    ctx.fill();

    ctx.restore();
  }

  function drawBubble(ctx, x, y, radius, alpha, isDimmed) {
    ctx.save();
    ctx.translate(x, y);

    // Subtle outer ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = isDimmed ? `rgba(125, 211, 252, ${alpha * 0.75})` : `rgba(186, 230, 253, ${alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Translucent glass fill
    ctx.fillStyle = isDimmed ? `rgba(56, 189, 248, ${alpha * 0.14})` : `rgba(224, 242, 254, ${alpha * 0.16})`;
    ctx.fill();

    // Glossy crescent highlight in upper left
    ctx.beginPath();
    ctx.arc(-radius * 0.35, -radius * 0.35, Math.max(0.7, radius * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.3)})`;
    ctx.fill();

    ctx.restore();
  }

  function drawSnowflake(ctx, x, y, size, rotation, alpha, isDimmed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.strokeStyle = isDimmed ? `rgba(224, 242, 254, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = Math.max(1, size * 0.15);
    ctx.lineCap = "round";

    if (isDimmed) {
      ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
      ctx.shadowBlur = 4;
    }

    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, size);

      const wingY = size * 0.55;
      const wingSize = size * 0.32;
      ctx.moveTo(-wingSize, wingY - wingSize * 0.4);
      ctx.lineTo(0, wingY);
      ctx.lineTo(wingSize, wingY - wingSize * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.7, size * 0.18), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    ctx.restore();
  }

  function drawSnowOrb(ctx, x, y, radius, alpha, isDimmed) {
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.2);
    const color = isDimmed ? "147, 197, 253" : "255, 255, 255";
    grad.addColorStop(0, `rgba(${color}, ${alpha * 0.9})`);
    grad.addColorStop(0.45, `rgba(${color}, ${alpha * 0.35})`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const particleCount = 65;
  const particles = [];

  function createParticle(initialY = null) {
    const typeRoll = Math.random();
    let type = "snow_orb";
    if (typeRoll < 0.32) type = "star";
    else if (typeRoll < 0.58) type = "bubble";
    else if (typeRoll < 0.78) type = "snowflake";

    const depth = Math.random(); // 0 = far/tiny/slow, 1 = close/larger/faster
    const baseSize = type === "snowflake" ? 4.5 + depth * 6.5
      : type === "star" ? 3.5 + depth * 6.5
        : type === "bubble" ? 4.0 + depth * 7.5
          : 2.0 + depth * 3.5;

    return {
      x: Math.random() * width,
      y: initialY !== null ? initialY : Math.random() * height,
      size: baseSize,
      speedY: 0.45 + depth * 0.85,
      swaySpeed: 0.0012 + Math.random() * 0.002,
      swayAmp: 0.7 + depth * 1.3,
      swayOffset: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.012,
      baseAlpha: 0.28 + depth * 0.48,
      pulseSpeed: 0.0018 + Math.random() * 0.0025,
      pulseOffset: Math.random() * Math.PI * 2,
      type: type
    };
  }

  // Pre-populate particles across full screen
  for (let i = 0; i < particleCount; i++) {
    particles.push(createParticle());
  }

  let animId = null;
  let lastTime = performance.now();

  function animate(currentTime) {
    const dt = Math.min(32, currentTime - lastTime);
    lastTime = currentTime;

    ctx.clearRect(0, 0, width, height);
    const isDimmed = document.body.classList.contains("dimmed-mode");

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y += p.speedY * (dt / 16);
      p.x += Math.sin(currentTime * p.swaySpeed + p.swayOffset) * (p.swayAmp * (dt / 16));
      p.rotation += p.rotSpeed * (dt / 16);

      const pulse = Math.sin(currentTime * p.pulseSpeed + p.pulseOffset) * 0.14;
      const alpha = Math.max(0.12, Math.min(0.95, p.baseAlpha + pulse));

      // Wrap around when falling beyond bottom or out of sides
      if (p.y > height + 25) {
        particles[i] = createParticle(-20);
      } else if (p.x < -30) {
        p.x = width + 20;
      } else if (p.x > width + 30) {
        p.x = -20;
      }

      if (p.type === "star") {
        drawSparkleStar(ctx, p.x, p.y, p.size, p.rotation, alpha, isDimmed);
      } else if (p.type === "bubble") {
        drawBubble(ctx, p.x, p.y, p.size, alpha, isDimmed);
      } else if (p.type === "snowflake") {
        drawSnowflake(ctx, p.x, p.y, p.size, p.rotation, alpha, isDimmed);
      } else {
        drawSnowOrb(ctx, p.x, p.y, p.size, alpha, isDimmed);
      }
    }

    animId = requestAnimationFrame(animate);
  }

  animId = requestAnimationFrame(animate);

  // Pause when tab is hidden to save CPU/battery
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (animId) cancelAnimationFrame(animId);
    } else {
      lastTime = performance.now();
      animId = requestAnimationFrame(animate);
    }
  });
}

/* =========================================================
   PROGRESSIVE WEB APP (PWA) SERVICE WORKER REGISTRATION
========================================================= */

function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered successfully with scope:", registration.scope);
        })
        .catch((error) => {
          console.warn("[PWA] Service Worker registration failed:", error);
        });
    });
  }
}

/* =========================================================
   START
========================================================= */

setupEvents();
initNavigationTabs();
initMonthSelector();
initEditTransactionModal();
initDataManagement();
refreshUI();
resetScanner();

// Connect and fetch latest transactions from FastAPI MySQL Backend
fetchTransactionsFromAPI();

// Initialize Anime Desktop Widgets & Background
initAnimeClock();
initAnimeCalendar();
initLoFiPlayer();
initAnimeDocks();
initMascotInteraction();
initThemeSnowBackground();

// Register PWA Service Worker for Offline Capabilities
initServiceWorker();

// Initialize Lucide Vector Icons
refreshIcons();
if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") {
  lucide.createIcons();
}

/*
  Optional public API:
  เปิด Console แล้วเรียก FinanceAI.getSummary()
*/

window.FinanceAI = {
  getSummary:
    calculateSummary,

  getTransactions,
  fetchTransactionsFromAPI,
  getFilteredTransactions,

  processImage,

  openCamera,

  refresh:
    refreshUI,

  switchTab,
  renderDashboard,
  renderAnalytics,
  refreshIcons,

  // Month selector & edit APIs
  setSelectedMonth,
  prevMonth,
  nextMonth,
  goToCurrentMonth,
  openEditTransactionModal,

  // Data management APIs
  exportBackup,
  importBackup: triggerImportBackup,

  // Predictive Budgeting APIs
  fetchForecastFromAPI,
  computeLocalForecast,
  renderDashboardForecast
};

